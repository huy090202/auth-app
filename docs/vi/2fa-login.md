---
title: 2FA sau mật khẩu
tryIt: /app/login
---
# 2FA sau mật khẩu

Bạn tự kiểm tra mật khẩu. Nếu user có yếu tố thứ hai, cấp một session "tạm" chỉ đủ
để làm bước tiếp theo, rồi hỏi auth-gate.

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

Backend: chuyển tiếp, rồi verify token trước khi tin nó (`bff/src/routes/auth.ts`):

```ts
const v = await authGate.verifyChallenge(c.var.trace, challengeId, parseProof(b));
await verifyLoginToken(v.token, userId);
await issueSession(c, secret, { userId, mfa: true });
```

Bản thân lời gọi API chuyển tiếp chỉ là một `fetch` kèm client key (`bff/src/authgate/client.ts`):

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

Trình duyệt, với passkey (`app/src/app/SecondFactor.tsx`, codec lấy từ `webauthn.ts`):

```ts
const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(ch.publicKey) })) as PublicKeyCredential | null;
```

rồi gửi `{ credential: serializeCredential(cred) }`. Với PIN thì gửi `{ pin }`.
