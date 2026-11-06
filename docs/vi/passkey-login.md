---
title: Đăng nhập chỉ bằng passkey
tryIt: /app/login/passkey
---
# Đăng nhập chỉ bằng passkey

Không cần mật khẩu. User nhập username, bạn tìm user rồi mở challenge cho passkey của
họ. AuthGate v1 chưa hỗ trợ discoverable credential nên vẫn phải có username.

```text
browser          backend                          auth-gate
  │ username ─────► look up user, GET /api/factors/{subjectId}
  │                 POST /api/challenges {subjectId, purpose: "login", factor: "webauthn"}
  │ ◄── publicKey ◄── {challengeId, publicKey}
  │ navigator.credentials.get(...)
  │ credential ───► POST /api/challenges/{id}/verify {credential}
  │                 ◄── {token}; verify it, full session
  │ ◄── done
```

Đừng để người ngoài dò được username nào có thật. Trong `bff`, username không tồn tại
và user chưa có passkey đều nhận cùng một response, `409 factor_not_enrolled`:

```ts
const notEnrolled = () => c.json({ error: 'factor_not_enrolled' }, 409);
if (!user) return notEnrolled();
const f = await authGate.factors(c.var.trace, user.userId);
if (f.webauthn.length === 0) return notEnrolled();
const ch = await authGate.createChallenge(c.var.trace, user.userId, 'login', 'webauthn');
```

Lúc verify thì chưa có session, nên bạn lấy `sub` từ token. Dù vậy vẫn phải verify đủ
(chữ ký, `iss`, `aud`, `exp`, `purpose: "login"`), rồi check xem user đó có thật trong
hệ thống của bạn không.

Phía browser (`app/src/lib/webauthn.ts`):

```ts
export function toRequestOptions(publicKey: unknown): PublicKeyCredentialRequestOptions {
  const pk = publicKey as Record<string, unknown> & { challenge: string; allowCredentials?: Desc[] };
  return {
    ...pk,
    challenge: fromB64url(pk.challenge),
    allowCredentials: descs(pk.allowCredentials),
  } as PublicKeyCredentialRequestOptions;
}
```
