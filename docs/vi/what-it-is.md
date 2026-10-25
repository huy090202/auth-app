---
title: AuthGate là gì
---
# AuthGate là gì

AuthGate lo bước xác thực yếu tố thứ hai (PIN hoặc passkey) cho user của bạn, tức phần
thứ hai của xác thực 2 yếu tố (2FA). Backend của bạn mở một challenge, chuyển câu trả lời của user sang AuthGate, và nhận về một token
có hạn ngắn, ký sẵn, xác nhận rằng "user này vừa qua PIN/passkey cho đúng việc này".
Bạn verify token đó rồi tự quyết cho user làm gì tiếp.

AuthGate không biết gì về user, mật khẩu hay session của bạn. Mấy thứ đó backend giữ
hết, và chỉ backend mới gọi AuthGate. Browser không bao giờ gọi thẳng.

```text
browser ──► your backend ──► auth-gate
   │             │  POST /api/challenges            {subjectId, purpose, factor}
   │             │  POST /api/challenges/{id}/verify {pin | credential}
   │             ◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
   ◄── your session / your action
```

Site này gồm hai phần: bộ docs bạn đang đọc, và một app demo có backend (`bff`) là
client chạy thật, cần gì cứ copy. Mỗi nút "Chạy thử" mở demo kèm panel trace, hiện đúng
các request `bff` đã gửi sang AuthGate. Trace chỉ có trong demo, đừng mang nó lên
client thật.
