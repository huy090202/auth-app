---
title: Verify token
---
# Verify token

Đừng tin token chỉ vì nó về từ auth-gate qua kết nối của chính bạn. Hãy kiểm tra nó.
File này (`bff/src/authgate/token.ts`) không phụ thuộc phần nào khác của `bff`; cứ chép
về. Nó cần `jose`.

```ts
export function remoteJwks(baseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/.well-known/jwks.json', baseUrl), {
    cooldownDuration: 300_000,
    cacheMaxAge: 300_000,
  });
}

/** Verify an auth-gate step-up token. Any failure throws TokenRejectedError. */
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

Mọi lỗi đều ném `TokenRejectedError`, không kèm chi tiết. Bạn tự đổi nó sang lỗi của
mình: `bff` trả `401` khi đăng nhập và `403 step_up_required` khi step-up.

| Claim | Kiểm tra |
|---|---|
| chữ ký | ES256, key lấy từ `<AUTHGATE_BASE_URL>/.well-known/jwks.json` (cache 5 phút) |
| `iss` | bằng `AUTHGATE_BASE_URL` của bạn |
| `aud` | bằng `clientId` của bạn |
| `exp` | chưa tới (`jose` lo việc này) |
| `sub` | đúng user bạn đang chờ |
| `purpose` | đúng thao tác bạn đang chờ (`login`, `change-email`, ...) |
| `jti` | id duy nhất; lưu lại nếu cần dùng một lần |
