---
title: Step-up trước thao tác nhạy cảm
tryIt: /app/home
---
# Step-up trước thao tác nhạy cảm

User đã đăng nhập rồi, nhưng muốn đổi email thì nên bắt xác thực lại. Vẫn là challenge như lúc login,
chỉ khác `purpose` là tên của thao tác đó.

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

Mở và trả lời challenge giống như [2FA sau bước nhập mật khẩu](/docs/2fa-login), với `purpose` là tên
thao tác. Khác biệt nằm ở chỗ token được xử lý ra sao.

## Vì sao token phải đi kèm thao tác

Mỗi token chỉ chứng minh một lần xác thực, cho một subject, cho một purpose. Nếu verify xong bạn chỉ
set `steppedUp = true` vào session thì coi như bỏ hết mấy ràng buộc đó: cái flag này dùng được cho mọi
thao tác, miễn session còn hạn.

Cách đúng là trả token về frontend, để frontend gửi nó kèm chính request thực hiện thao tác. Handler
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

`purpose` là chuỗi do bạn tự đặt, dài 1 đến 256 byte, không chứa `#`. Mỗi thao tác nên có một purpose
riêng, vì token cấp cho `transfer` không được phép dùng cho `change-email`.

Hãy để backend tự gán purpose cho từng route, hoặc kiểm tra nó với một danh sách cố định. Đừng lấy
thẳng từ request.

## Yếu tố và passkey

Nếu thao tác chỉ chấp nhận một số yếu tố nhất định thì phải kiểm tra `amr` trong token, vì trong flow
này browser là bên chọn yếu tố. AuthGate cũng không bắt buộc user verification, nên security key chỉ
cần chạm vẫn qua được step-up bằng passkey.

## Chỉ dùng một lần

Token dùng lại được cho tới khi hết hạn. Nếu thao tác cần chặn chuyện này thì lưu từng `jti` cho tới
`exp` của nó, và từ chối token nào đã gặp rồi.
