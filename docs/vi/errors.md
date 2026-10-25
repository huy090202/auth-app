---
title: Lỗi
---
# Lỗi

AuthGate trả về một status và `{error}`. `bff` ánh xạ như dưới đây, và nhiều khả năng
bạn cũng muốn làm y vậy:

| AuthGate | bff | Hiển thị gì |
|---|---|---|
| 400 `verification_failed` + `attemptsRemaining` | 400 như cũ, giữ `attemptsRemaining` | "Sai PIN, còn N lần thử" |
| 423 `locked` + `lockedUntil` | 423 như cũ | khoá form, hiện giờ mở khoá |
| 410 `challenge_gone` | 410 như cũ | "Hết hạn, thử lại", tự động làm lại |
| 404 `factor_not_found` | 409 `factor_not_enrolled` | dẫn tới `/app/security` để đăng ký |
| 400 `registration_failed` | 400 như cũ | "Không đăng ký được passkey này" |
| 5xx hoặc lỗi mạng | 502 `authgate_unavailable` | thông báo chung; đừng lộ chi tiết phía sau |

Vài lưu ý:

- Challenge chỉ dùng một lần và có thời hạn ngắn. Gặp `410` thì làm lại từ đầu, đừng gọi lại
  verify.
- `404 factor_not_found` thành `409` vì với user, server không thiếu gì cả; chỉ là họ
  chưa cài yếu tố đó.
- Khi đăng nhập chỉ bằng passkey, username không tồn tại cũng nhận `409
  factor_not_enrolled`, để không ai dò được username.
- Token verify hỏng thì tuỳ bạn xử lý: `bff` trả `401 unauthorized` khi đăng nhập và
  `403 step_up_required` ở thao tác step-up.
