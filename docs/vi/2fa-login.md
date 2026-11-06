---
title: 2FA sau bước nhập mật khẩu
tryIt: /app/login
---
# 2FA sau bước nhập mật khẩu

Mật khẩu thì bạn tự check. Nếu user đã có yếu tố, cấp cho họ một session "nửa vời" chỉ đủ quyền làm
bước thứ hai, rồi gọi AuthGate.

```text
browser              your backend                     AuthGate
  │ user + password ───► check password
  │                      GET /api/factors/{subjectId}
  │                      ◄── {pin, webauthn}
  │ ◄── which factors ── half session
  │ chosen factor ─────► POST /api/challenges {subjectId, purpose: "login", factor}
  │                      ◄── {challengeId, expiresAt, publicKey?}
  │ ◄── publicKey? ───── keep challengeId in the half session
  │ pin | credential ──► POST /api/challenges/{challengeId}/verify {pin | credential}
  │                      ◄── {token, expiresAt, factor}
  │                      verify the token, full session
  │ ◄── done
```

## Backend của bạn

Mở challenge. `publicKey` chỉ có khi `factor` là `webauthn`.

```ts
const { status, data } = await authGate('POST', '/api/challenges', {
  subjectId: user.id,
  purpose: 'login',
  factor, // 'pin' or 'webauthn'
});
// Keep data.challengeId in the half session, send data.publicKey to the browser.
```

Chuyển câu trả lời sang AuthGate, verify token, rồi đổi session nửa vời thành session đầy đủ:

```ts
const proof = pin !== undefined ? { pin } : { credential };
const { status, data } = await authGate(
  'POST',
  `/api/challenges/${halfSession.challengeId}/verify`,
  proof,
);
if (status === 200) {
  await verifyAuthGateToken(data.token, { subject: user.id, purpose: 'login' });
  // Start the full session.
}
```

Gửi đúng một trong hai: `pin` hoặc `credential`. Hàm `verifyAuthGateToken` nằm ở trang
[Verify token](/docs/verify-token).

Giữ `challengeId` ở phía bạn. AuthGate chỉ gắn challenge với client của bạn, không gắn với browser,
nên nếu lấy nó từ request thì user này có thể trả lời challenge của user khác. Khi đó bước check
`sub` sẽ từ chối token, nhưng `200` hay `400` vẫn cho biết đoán PIN đúng hay sai, và mỗi lần đoán sai
đều tính vào lượt khoá của user kia.

## Browser

Với PIN, gửi `{ pin }` về backend. Với passkey, dùng các hàm ở phần
[Chuyển đổi dữ liệu WebAuthn](/docs/enroll#chuyen-doi-du-lieu-webauthn):

```ts
const cred = (await navigator.credentials.get({
  publicKey: toRequestOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

## Khi có lỗi

- `400 verification_failed`: trả lời sai. Hỏi lại trên chính challenge đó, hoặc mở challenge mới khi
  `attemptsRemaining` về 0.
- `423 locked`: sai PIN quá nhiều lần. Hiện `lockedUntil`.
- `410 challenge_gone`: hết hạn, đã dùng hoặc hết lượt thử. Mở challenge mới.

Danh sách đầy đủ ở trang [Xử lý lỗi](/docs/errors).
