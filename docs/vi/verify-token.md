---
title: Verify token
---
# Verify token

Token trả về từ AuthGate qua kết nối của chính bạn thì cũng đừng tin ngay. Lần nào cũng phải verify,
kể cả khi browser gửi lại token cho bạn lúc step-up.

Đoạn code này dùng [`jose`](https://github.com/panva/jose) và không cần gì thêm. Nếu dùng ngôn ngữ
khác, chọn một thư viện JOSE rồi kiểm tra đúng những mục này.

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTHGATE_URL = process.env.AUTHGATE_URL!; // https://<authgate-host>, no trailing slash
const CLIENT_ID = process.env.AUTHGATE_CLIENT_ID!;

const jwks = createRemoteJWKSet(new URL('/.well-known/jwks.json', AUTHGATE_URL), {
  cacheMaxAge: 300_000,
});

/** Throws if the token is not valid for this purpose and, when given, this subject. */
export async function verifyAuthGateToken(
  token: string,
  expected: { purpose: string; subject?: string },
) {
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['ES256'],
    issuer: AUTHGATE_URL,
    audience: CLIENT_ID,
    subject: expected.subject,
    requiredClaims: ['exp', 'sub'],
  });
  if (payload.purpose !== expected.purpose) throw new Error('wrong purpose');
  return payload;
}
```

Có gì sai là hàm throw. Đổi nó thành lỗi của riêng bạn, và đừng cho người gọi biết bước nào fail.

## Cần kiểm tra những gì

| Mục | Kiểm tra |
|---|---|
| chữ ký | ES256, dùng key trong `<base URL>/.well-known/jwks.json` có `kid` khớp với header của token |
| `iss` | bằng base URL của bạn, ví dụ `https://<authgate-host>` |
| `aud` | bằng `clientId` của bạn |
| `exp` | chưa tới |
| `sub` | đúng user bạn đang chờ, nếu biết trước. Với đăng nhập chỉ bằng passkey, đây là cách bạn biết user là ai. |
| `purpose` | đúng thao tác bạn sắp cho phép |

Có thêm ba claim nữa nếu bạn cần:

| Claim | Ý nghĩa |
|---|---|
| `amr` | `["pin"]` hoặc `["webauthn"]`: yếu tố đã dùng. Phải kiểm tra nếu thao tác chỉ chấp nhận một số yếu tố nhất định. |
| `iat` | thời điểm cấp token |
| `jti` | id của challenge, mỗi token một giá trị. Lưu lại nếu bạn cần [dùng một lần](/docs/step-up#chi-dung-mot-lan). |

## Key có thể đổi

Mỗi lần verify, chọn key theo `kid`, đừng hard-code key trong code. Bộ key có thể có nhiều hơn một key
trong lúc rotate signing key. Bộ này được cache tối đa 300 giây, và key set của `jose` ở trên đã tự lo
chuyện cache lẫn `kid` lạ.
