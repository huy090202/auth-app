---
title: Step-up trước thao tác nhạy cảm
tryIt: /app/home
---
# Step-up trước thao tác nhạy cảm

User đã đăng nhập, nhưng đổi email thì nên kiểm tra lại cho chắc. Vẫn là challenge như
cũ, chỉ khác `purpose` mang tên thao tác.

```text
browser               backend                        auth-gate
  │ start ─────────────► POST /api/challenges {subjectId, purpose: "change-email", factor}
  │ pin | credential ──► POST /api/challenges/{id}/verify
  │ ◄── stepUpToken ◄─── {token}; verify it
  │ new email + stepUpToken ──► verify again, sub + purpose, then update
```

**Vì sao token phải đi cùng thao tác.** Token chứng minh một lần xác thực, cho một
subject, cho một mục đích. Nếu bạn verify xong rồi đặt `steppedUp = true` trong session,
bạn đã vứt bỏ điều đó: cờ ấy dùng được cho mọi thao tác, chừng nào session còn sống. Vậy
hãy đưa token cho frontend, bắt nó gửi token kèm đúng request làm việc đó. Handler của
thao tác verify ngay tại chỗ:

```ts
await verifyAuthGateToken(typeof b.stepUpToken === 'string' ? b.stepUpToken : '', {
  jwks,
  issuer: config.authGateBaseUrl,
  audience: config.authGateClientId,
  subject: userId,
  purpose: 'change-email',
});
```

Chỉ mở step-up cho những purpose bạn biết trước (`bff` giữ một allow-list), để purpose
bịa ra không bao giờ tới được AuthGate.

Ở v1, token bị dùng lại vẫn được chấp nhận cho tới `exp`. Nếu điều đó quan trọng với
bạn, hãy lưu `jti` và từ chối token đã thấy rồi.
