---
title: Xử lý lỗi
---
# Xử lý lỗi

AuthGate trả lỗi dạng status code kèm `{error}`. `bff` map lại như bảng dưới, nhiều
khả năng bạn cũng sẽ làm y vậy:

| AuthGate | bff | Hiện gì cho user |
|---|---|---|
| 400 `verification_failed` + `attemptsRemaining` | 400 giữ nguyên, kèm `attemptsRemaining` | "Sai PIN, còn N lần thử" |
| 423 `locked` + `lockedUntil` | 423 giữ nguyên | khoá form, báo khi nào mở lại |
| 410 `challenge_gone` | 410 giữ nguyên | "Hết hạn, thử lại nhé", tự mở challenge mới |
| 404 `factor_not_found` | 409 `factor_not_enrolled` | dẫn sang `/app/security` để đăng ký |
| 400 `registration_failed` | 400 giữ nguyên | "Không đăng ký được passkey này" |
| 5xx hoặc lỗi mạng | 502 `authgate_unavailable` | thông báo chung chung; đừng lộ lỗi từ upstream |

Vài điểm cần để ý:

- Challenge chỉ dùng được một lần và hết hạn nhanh. Gặp `410` thì mở challenge mới,
  đừng retry verify.
- `404 factor_not_found` được đổi thành `409` vì nhìn từ phía user thì server không
  thiếu gì cả, chỉ là họ chưa đăng ký PIN/passkey.
- Với login chỉ bằng passkey, username không tồn tại cũng nhận `409
  factor_not_enrolled`, để không ai dò được username.
- Token verify fail thì xử lý thế nào là quyền của bạn: `bff` trả `401 unauthorized`
  khi login và `403 step_up_required` với thao tác cần step-up.
