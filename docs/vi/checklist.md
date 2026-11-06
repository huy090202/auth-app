---
title: Checklist tích hợp
---
# Checklist tích hợp

Làm lần lượt từ trên xuống. Bước sau cần bước trước.

## 1. Lấy credentials

Chọn `rpId` và `origins`, rồi xin cấp client. Bạn sẽ nhận base URL, `clientId` và `accessKey`. Xem
[Lấy credentials](/docs/setup).

## 2. Thêm call AuthGate vào backend

Giữ key ở backend và viết một helper để gửi key đó. Thêm các route của riêng bạn cho browser gọi,
vì browser không bao giờ gọi thẳng AuthGate. Xem [Gọi AuthGate](/docs/setup#goi-authgate).

Chọn `subjectId`: một user id cố định bên bạn, đừng dùng username, chỉ gồm chữ cái, chữ số, `-` và
`_`, tối đa 64 byte.

## 3. Thêm bước verify token

Làm bước này trước mọi flow, để không flow nào lên production mà thiếu nó. Xem
[Verify token](/docs/verify-token).

## 4. Cho user đăng ký yếu tố

Thêm form PIN, nút passkey, hoặc cả hai vào trang cài đặt sau khi đăng nhập. User phải có yếu tố thì
bạn mới mở challenge được. Xem [Đăng ký PIN hoặc passkey](/docs/enroll).

## 5. Làm các flow bạn cần

| Bạn muốn | Làm flow |
|---|---|
| Thêm một bước sau mật khẩu | [2FA sau bước nhập mật khẩu](/docs/2fa-login) |
| Login không cần mật khẩu | [Đăng nhập chỉ bằng passkey](/docs/passkey-login) |
| Xác thực lại trước thao tác nhạy cảm | [Step-up](/docs/step-up) |

Đặt một chuỗi `purpose` cho mỗi thao tác, ví dụ `login` hoặc `change-email`. Backend của bạn tự chọn
chuỗi này, và token sẽ ghi lại đúng chuỗi đó.

## 6. Xử lý lỗi

Tối thiểu phải xử lý sai PIN, bị khoá và challenge hết hạn. Xem [Xử lý lỗi](/docs/errors).

## 7. Kiểm tra trước khi lên production

- Mỗi môi trường có client riêng, và origin trên production là HTTPS.
- `accessKey` nằm trong secret store, không bao giờ tới browser hay log.
- PIN và response của passkey không bị ghi vào request log.
- `subjectId` luôn lấy từ session hoặc từ bước tra user, không bao giờ lấy từ request.
- Token nào cũng được kiểm tra chữ ký, `iss`, `aud`, `exp`, `purpose`, và cả `sub` nếu bạn biết
  trước đó là user nào.
- Thêm, đổi hoặc gỡ yếu tố phải có session đầy đủ, và phải qua step-up nếu user đã có yếu tố.
- Endpoint của bạn có rate limit.
- Có quy trình khôi phục cho user mất yếu tố.
- Xoá user thì gỡ luôn các yếu tố của họ. Xem
  [Xem và gỡ yếu tố](/docs/enroll#xem-va-go-yeu-to).
