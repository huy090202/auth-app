---
title: auth-gate là gì
---
# auth-gate là gì

auth-gate kiểm tra yếu tố thứ hai của người dùng: PIN hoặc passkey. Bạn nhờ nó tạo một
challenge, chuyển câu trả lời của người dùng sang, rồi nhận về một token ký số, sống
ngắn, nói rằng "subject này đã qua yếu tố này cho mục đích này". Bạn tự verify token và
tự quyết nó mở khoá được gì.

Nó không biết gì về user, mật khẩu hay session của bạn. Mấy thứ đó backend của bạn giữ,
và chỉ backend mới nói chuyện với auth-gate. Trình duyệt thì không bao giờ.

```text
browser ──► your backend ──► auth-gate
   │             │  POST /api/challenges            {subjectId, purpose, factor}
   │             │  POST /api/challenges/{id}/verify {pin | credential}
   │             ◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
   ◄── your session / your action
```

Trang này gồm hai phần: tài liệu bạn đang đọc, và một app demo có backend (`bff`) là
một client chạy thật để bạn chép. Mỗi nút "Thử ngay" mở demo kèm bảng trace, cho thấy
đúng các request `bff` đã gửi tới auth-gate. Trace chỉ để demo, đừng đưa nó vào client
thật.
