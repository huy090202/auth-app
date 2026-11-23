---
title: Verify token
---
# Verify token

Lần nào nhận token cũng phải verify, kể cả khi browser gửi token lại cho bạn lúc step-up. Token về
từ AuthGate qua kết nối của chính bạn cũng đừng tin ngay.

Code mẫu dưới đây chỉ cần [`jose`](https://github.com/panva/jose). Dùng ngôn ngữ khác thì chọn một
thư viện JOSE rồi kiểm tra đúng những mục này.

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

Kiểm tra nào fail thì hàm cũng throw. Đổi lỗi đó thành lỗi của riêng bạn, và đừng cho người gọi biết
bước nào fail.

## Cần kiểm tra những gì

| Mục | Kiểm tra |
|---|---|
| chữ ký | ES256, dùng key trong `<base URL>/.well-known/jwks.json` có `kid` khớp với header của token |
| `iss` | bằng base URL của bạn, ví dụ `https://<authgate-host>` |
| `aud` | bằng `clientId` của bạn |
| `exp` | chưa tới |
| `sub` | đúng user bạn đang chờ, nếu biết trước. Lúc đăng nhập chỉ bằng passkey, claim này cho bạn biết user là ai. |
| `purpose` | đúng thao tác bạn sắp cho phép |

Token còn ba claim khác, cần thì dùng:

| Claim | Ý nghĩa |
|---|---|
| `amr` | `["pin"]` hoặc `["webauthn"]`: yếu tố user đã dùng. Thao tác nào chỉ chấp nhận một số yếu tố thì phải kiểm tra claim này. |
| `iat` | thời điểm cấp token |
| `jti` | id của challenge, mỗi token một giá trị. Cần token [dùng một lần](/docs/step-up#chi-dung-mot-lan) thì lưu lại. |

## Key có thể đổi

Mỗi lần verify, chọn key theo `kid`, đừng hard-code key trong code. Trong lúc rotate signing key, bộ
key có thể có nhiều hơn một key. Bộ key có thể bị cache tối đa 300 giây. Key set của `jose` ở trên đã
tự lo chuyện cache lẫn `kid` lạ.
