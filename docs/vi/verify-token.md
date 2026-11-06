---
title: Verify token
---
# Verify token

Token trả về từ AuthGate qua kết nối của chính bạn thì cũng đừng tin ngay, luôn verify.
File này (`bff/src/authgate/token.ts`) không phụ thuộc phần nào khác trong `bff`, cứ
copy về mà dùng. Chỉ cần thêm `jose`.

```ts
export function remoteJwks(baseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/.well-known/jwks.json', baseUrl), {
    cooldownDuration: 300_000,
    cacheMaxAge: 300_000,
  });
}

/** Verify an auth-gate token (login or step-up). Any failure throws TokenRejectedError. */
export async function verifyAuthGateToken(
  token: string,
  opts: { jwks: JWTVerifyGetKey; issuer: string; audience: string; subject: string; purpose: string },
): Promise<AuthGateClaims> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks, {
      algorithms: ['ES256'],
      issuer: opts.issuer,
      audience: opts.audience,
    });
    if (payload.sub !== opts.subject || payload.purpose !== opts.purpose) {
      throw new Error('claim mismatch');
    }
    return payload as unknown as AuthGateClaims;
  } catch {
    throw new TokenRejectedError();
  }
}
```

Fail ở bước nào cũng throw `TokenRejectedError`, không kèm chi tiết. Bạn tự map sang
lỗi của mình: `bff` trả `401` khi login và `403 step_up_required` khi step-up.

| Claim | Check gì |
|---|---|
| chữ ký | ES256, key lấy từ `<AUTHGATE_BASE_URL>/.well-known/jwks.json` (cache 5 phút) |
| `iss` | khớp `AUTHGATE_BASE_URL` của bạn |
| `aud` | khớp `clientId` của bạn |
| `exp` | chưa hết hạn (`jose` tự check) |
| `sub` | đúng user bạn đang xử lý |
| `purpose` | đúng thao tác bạn đang xử lý (`login`, `change-email`, ...) |
| `jti` | id duy nhất; lưu lại nếu cần token chỉ dùng được một lần |
