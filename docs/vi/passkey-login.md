---
title: Đăng nhập chỉ bằng passkey
tryIt: /app/login/passkey
---
# Đăng nhập chỉ bằng passkey

Không có mật khẩu. User gõ username, bạn tra user rồi challenge passkey của họ.
auth-gate v1 chưa hỗ trợ discoverable credential, nên bắt buộc phải có username.

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

Đừng để lộ username nào tồn tại. Trong `bff`, username không có và user chưa có passkey
nhận cùng một câu trả lời, `409 factor_not_enrolled`:

```ts
const notEnrolled = () => c.json({ error: 'factor_not_enrolled' }, 409);
if (!user) return notEnrolled();
const f = await authGate.factors(c.var.trace, user.userId);
if (f.webauthn.length === 0) return notEnrolled();
const ch = await authGate.createChallenge(c.var.trace, user.userId, 'login', 'webauthn');
```

Lúc verify chưa có session, nên lấy `sub` từ token, nhưng vẫn verify đủ (chữ ký, `iss`,
`aud`, `exp`, `purpose: "login"`), rồi kiểm tra user có tồn tại phía bạn không.

Trình duyệt (`app/src/lib/webauthn.ts`):

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
