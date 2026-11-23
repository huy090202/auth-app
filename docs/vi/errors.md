---
title: Xử lý lỗi
---
# Xử lý lỗi

AuthGate trả lỗi dạng status kèm `{"error": "<code>"}`. Backend của bạn quyết định user thấy gì, nên
đừng chuyển nguyên các response này ra ngoài.

## Lỗi do user gây ra

| Status và mã | Chuyện gì xảy ra | Nên làm gì |
|---|---|---|
| `400 verification_failed` + `attemptsRemaining` | Sai PIN, hoặc câu trả lời passkey không hợp lệ. | Hỏi lại trên chính challenge đó và cho user biết còn mấy lượt. Về `0` thì mở challenge mới. |
| `423 locked` + `lockedUntil` | Subject này sai PIN quá nhiều lần. | Khoá form và báo khi nào mở lại. |
| `410 challenge_gone` | Challenge hoặc registration đã hết hạn, đã dùng, hết lượt thử, hoặc không phải của bạn. | Đừng retry call đó. Bắt đầu lại từ đầu. |
| `400 pin_rejected` | PIN mới không đúng policy: sai độ dài, có ký tự không phải số, lặp một số, hoặc là dãy liền nhau. | Bảo user chọn PIN khác. |
| `404 factor_not_found` | Subject chưa có loại yếu tố này. | Đề nghị yếu tố khác. Chỉ mời đăng ký khi user có session đầy đủ, và phải qua step-up nếu user đã có yếu tố. Nếu không, người chỉ biết mật khẩu có thể tự đăng ký PIN rồi qua luôn 2FA. Đăng nhập chỉ bằng passkey thì trả đúng câu bạn dùng cho username không tồn tại. |
| `400 registration_failed` | Response của passkey không hợp lệ, thường do `rpId` hoặc `origins` không khớp với trang. | Làm lại registration từ đầu. |
| `429 rate_limited` + `Retry-After` | Client của bạn đã vượt rate limit. Limit tính chung cho mọi call của bạn, không tính riêng từng user. | Báo user lát nữa thử lại. Chờ ít nhất `Retry-After` giây rồi mới gọi lại call đó. |

## Lỗi do bug hoặc cấu hình

| Status và mã | Chuyện gì xảy ra | Nên làm gì |
|---|---|---|
| `401 unauthorized` | Key thiếu, sai, hoặc là key cũ đã quá thời gian còn dùng được sau khi đổi key. Cũng có thể client của bạn đang bị tắt, hoặc AuthGate không tra được key. Body không bao giờ nói rõ lý do. | Kiểm tra key đang cấu hình. Key đúng thì thử lại trước khi xin key mới. |
| `400 invalid_json` | Body không phải JSON hợp lệ, có field sai kiểu hoặc lớn quá 1 MiB. Cũng có thể call finish thiếu `credential`, hoặc call verify không gửi đúng một trong hai `pin` và `credential`. | Sửa request. |
| `400 invalid_id` | `subjectId` hoặc `purpose` bị thiếu hay rỗng, một id dài quá 256 byte hay chứa `#`, hoặc `subjectId` của registration passkey dài quá 64 byte. | Sửa request. |
| `400 wrong_factor` | `factor` không phải `pin` hay `webauthn`, hoặc body của call verify không khớp với loại challenge. Gửi sai loại thì mất một lượt thử. | Sửa request. |

## Lỗi phía AuthGate

| Status | Chuyện gì xảy ra | Nên làm gì |
|---|---|---|
| `500 internal`, 5xx khác hoặc lỗi mạng | AuthGate không hoàn tất được call. | Hiện thông báo chung, đừng lộ chi tiết từ upstream. Lỗi xảy ra ở call verify thì mở challenge mới. |

## Các lỗi này hoạt động ra sao

- Số lần sai tính theo subject. Mở challenge mới không reset số lần sai PIN, còn `attemptsRemaining`
  chỉ tính trong challenge hiện tại. Vì vậy sau khi mở challenge mới, user có thể bị khoá sớm hơn con
  số đó. Đừng coi con số này là cam kết.
- Có hai cách hết khoá: qua thời điểm `lockedUntil`, hoặc bạn đăng ký PIN mới. Đăng ký PIN xoá khoá,
  nên nhớ [bảo vệ route đó](/docs/enroll).
- Nhập đúng PIN thì số lần sai được reset.
- Passkey không bị khoá. Lần sai thứ ba trên challenge passkey trả `400` kèm `attemptsRemaining: 0`,
  mọi call sau đó trả `410`.
- `subjectId` dài quá 64 byte thì không đăng ký được passkey. Call bắt đầu registration trả
  `400 invalid_id`, dù id đó vẫn dùng được cho PIN. Xem [Đăng ký PIN hoặc passkey](/docs/enroll).
- `429` không làm thay đổi gì. AuthGate từ chối call trước khi chạy, nên không mất lượt thử PIN, không
  dùng hết registration, và challenge vẫn mở cho tới khi hết hạn. Chờ hết `Retry-After`, tính bằng số
  giây nguyên, rồi gọi lại đúng call đó.
- Token verify fail thì bạn tự xử lý, lúc đó AuthGate không còn liên quan. Trả `401` hoặc `403` của
  riêng bạn.
