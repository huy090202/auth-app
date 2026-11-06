---
title: 2FA sau bước nhập mật khẩu
tryIt: /app/login
---
# 2FA sau bước nhập mật khẩu

Đây là xác thực 2 yếu tố (2FA) kiểu quen thuộc. Mật khẩu thì bạn tự check. Nếu user
đã bật PIN hoặc passkey, cấp cho họ một session "nửa vời" chỉ đủ quyền xác thực yếu tố thứ hai, rồi gọi AuthGate.

```text
browser            backend                          auth-gate
  │ user + password ──► check password, half session
  │ factor=pin ───────► POST /api/challenges {subjectId, purpose: "login", factor}
  │ ◄── challengeId ◄── {challengeId, expiresAt, publicKey?}
  │ pin | credential ─► POST /api/challenges/{id}/verify
  │                   ◄── {token, expiresAt, factor}
  │                     verify token, full session
  │ ◄── done
```

Phía backend: forward sang AuthGate, rồi verify token xong mới tin
(`bff/src/routes/auth.ts`):

```ts
const v = await authGate.verifyChallenge(c.var.trace, challengeId, parseProof(b));
await verifyLoginToken(v.token, userId);
await issueSession(c, secret, { userId, mfa: true });
```

Phần forward chỉ là một `fetch` kèm client key (`bff/src/authgate/client.ts`):

```ts
res = await this.fetchFn(`${this.baseUrl}${path}`, {
  method,
  headers: {
    'x-internal-access-key': this.clientKey,
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
```

Phía browser, nếu dùng passkey (`app/src/app/SecondFactor.tsx`, codec nằm trong
`webauthn.ts`):

```ts
const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(ch.publicKey) })) as PublicKeyCredential | null;
```

rồi gửi `{ credential: serializeCredential(cred) }`. Nếu dùng PIN thì gửi `{ pin }`.
