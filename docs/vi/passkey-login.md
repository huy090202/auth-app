---
title: Đăng nhập chỉ bằng passkey
tryIt: /app/login/passkey
---
# Đăng nhập chỉ bằng passkey

Không cần mật khẩu. User nhập username, bạn tra user rồi mở challenge cho passkey của họ. AuthGate v1
chưa có discoverable credential nên vẫn phải có username.

```text
browser          your backend                       AuthGate
  │ username ───────► look up the user
  │                   POST /api/challenges {subjectId, purpose: "login", factor: "webauthn"}
  │                   ◄── {challengeId, expiresAt, publicKey}
  │ ◄── publicKey ─── keep challengeId
  │ navigator.credentials.get(...)
  │ credential ─────► POST /api/challenges/{challengeId}/verify {credential}
  │                   ◄── {token, expiresAt, factor}
  │                   verify the token, take sub, start the session
  │ ◄── done
```

## Backend của bạn

Mở challenge. Username không tồn tại và user chưa có passkey phải nhận cùng một câu trả lời, để không
ai dùng endpoint này dò được username nào có thật.

```ts
const user = await findUserByUsername(username);
if (!user) return notEnrolledResponse();

const begin = await authGate('POST', '/api/challenges', {
  subjectId: user.id,
  purpose: 'login',
  factor: 'webauthn',
});
if (begin.status === 404) return notEnrolledResponse(); // factor_not_found
if (begin.status !== 201) return errorResponse();
// Keep begin.data.challengeId in a short-lived pre-login session, send begin.data.publicKey to the browser.
```

Cách này không giấu được hết: user có passkey vẫn nhận được options, nên người gọi biết tài khoản đó
có passkey. Nhớ rate limit endpoint này.

Verify câu trả lời. Lúc này user chưa đăng nhập, nên đọc `challengeId` từ session tạm trước login, lấy
user từ `sub` trong token, vẫn kiểm tra đủ các mục còn lại, rồi xác nhận user đó có tồn tại bên bạn:

```ts
const { status, data } = await authGate('POST', `/api/challenges/${challengeId}/verify`, { credential });
if (status === 200) {
  const claims = await verifyAuthGateToken(data.token, { purpose: 'login' });
  const user = await findUserById(claims.sub!);
  // No user: refuse. Otherwise start the session.
}
```

Hàm `verifyAuthGateToken` nằm ở trang [Verify token](/docs/verify-token).

## Browser

Dùng các hàm ở phần [Chuyển đổi dữ liệu WebAuthn](/docs/enroll#chuyen-doi-du-lieu-webauthn):

```ts
const cred = (await navigator.credentials.get({
  publicKey: toRequestOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

## Mức độ an toàn

AuthGate không bắt buộc user verification. Đa số passkey sẽ hỏi sinh trắc học hoặc PIN của thiết bị,
nhưng security key chỉ cần chạm cũng qua được, và token không cho biết đã xảy ra trường hợp nào. Hãy
cân nhắc điều này trước khi để passkey là lớp bảo vệ duy nhất của tài khoản.

## Khi có lỗi

- `400 verification_failed`: assertion không hợp lệ. Mỗi challenge passkey có ba lượt thử, nên mở
  challenge mới khi `attemptsRemaining` về 0.
- `410 challenge_gone`: hết hạn, đã dùng hoặc hết lượt thử. Mở challenge mới.

Danh sách đầy đủ ở trang [Xử lý lỗi](/docs/errors).
