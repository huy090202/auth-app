---
title: Step-up trước thao tác nhạy cảm
tryIt: /app/home
---
# Step-up trước thao tác nhạy cảm

User đã đăng nhập, nhưng muốn đổi email thì nên bắt xác thực lại. Bạn dùng đúng challenge như lúc
login, chỉ khác `purpose` là tên thao tác đó.

```text
browser                 your backend                      AuthGate
  │ start ───────────────► POST /api/challenges {subjectId, purpose: "change-email", factor}
  │                        ◄── {challengeId, expiresAt, publicKey?}
  │ ◄── publicKey? ─────── keep challengeId in the session
  │ pin | credential ────► POST /api/challenges/{challengeId}/verify {pin | credential}
  │                        ◄── {token, expiresAt, factor}
  │ ◄── token ───────────
  │ new email + token ───► verify the token (sub, purpose), then update
  │ ◄── done
```

Mở và trả lời challenge như trang [2FA sau bước nhập mật khẩu](/docs/2fa-login), đặt `purpose` là
tên thao tác. Chỗ khác nằm ở cách bạn dùng token.

## Vì sao token phải đi kèm thao tác

Mỗi token chỉ chứng minh một lần xác thực, cho một subject, cho một purpose. Nếu verify xong bạn chỉ
set `steppedUp = true` vào session thì mất hết mấy ràng buộc đó: flag này dùng được cho mọi thao
tác, miễn session còn hạn.

Vì vậy, trả token về frontend, để frontend gửi token kèm chính request thực hiện thao tác. Handler
của thao tác verify token ngay tại đó:

```ts
await verifyAuthGateToken(body.stepUpToken, {
  subject: session.userId,
  purpose: 'change-email',
});
// It passed: change the email.
```

Hàm `verifyAuthGateToken` nằm ở trang [Verify token](/docs/verify-token).

## Chọn purpose

Mỗi thao tác nên có một purpose riêng, vì token cấp cho `transfer` không được dùng cho
`change-email`. `purpose` là chuỗi bạn tự đặt, dài 1 đến 256 byte, không chứa `#`.

Để backend tự gán purpose cho từng route, hoặc kiểm tra purpose theo một danh sách cố định. Đừng
lấy thẳng từ request.

## Yếu tố và passkey

Thao tác nào chỉ chấp nhận một số yếu tố thì phải kiểm tra `amr` trong token, vì ở flow này browser
là bên chọn yếu tố. AuthGate cũng không bắt buộc user verification, nên security key chỉ cần chạm
vẫn qua được step-up bằng passkey.

## Chỉ dùng một lần

Token dùng lại được cho tới khi hết hạn. Thao tác nào cần chặn chuyện này thì lưu từng `jti` cho
tới `exp` của nó, và từ chối token nào có `jti` đã gặp.
