---
title: AuthGate cho bạn những gì
---
# AuthGate cho bạn những gì

AuthGate lo phần yếu tố thứ hai cho user của bạn: PIN hoặc passkey. Backend của bạn mở một
challenge, chuyển câu trả lời của user sang AuthGate, và nhận về một token có hạn ngắn, ký sẵn,
xác nhận rằng "user này vừa qua yếu tố này cho đúng việc này". Bạn verify token đó rồi tự quyết
cho user làm gì tiếp.

```text
browser ──► your backend ──► AuthGate
                 │  POST /api/challenges             {subjectId, purpose, factor}
                 │  POST /api/challenges/{id}/verify {pin | credential}
                 │◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
browser ◄── your session or your action
```

## AuthGate lo những gì

- **PIN:** lưu dạng hash, áp policy về độ dài, từ chối PIN quá dễ đoán, khoá sau nhiều lần sai.
- **Passkey:** tạo WebAuthn options cho browser và verify kết quả trả về, gồm cả `rpId` và origin.
- **Challenge:** chỉ dùng một lần, sống năm phút, và chỉ client của bạn mới thấy.
- **Token:** JWT ký ES256, mặc định sống 5 phút (tối đa 15 phút), kèm bộ public key để verify.

## Bạn tự lo những gì

- **User, mật khẩu và session.** AuthGate chỉ biết `subjectId` mà bạn đưa, và không hiểu gì về nó.
- **Một backend đứng ra gọi mọi call.** Browser không bao giờ gọi thẳng AuthGate.
- **Toàn bộ màn hình:** form nhập PIN, prompt passkey, trang cài đặt.
- **Verify từng token** và quyết định token đó cho phép làm gì.
- **Quyết định khi nào cần hỏi:** thao tác nào cần xác thực, chấp nhận yếu tố nào.
- **Khôi phục tài khoản.** AuthGate không có flow reset. User mất PIN hoặc passkey thì bạn tự xác
  minh họ theo cách của bạn, rồi cho đăng ký lại.
- **Mọi thứ xung quanh:** email, audit log, rate limit cho endpoint của bạn.

AuthGate v1 chưa có discoverable credential, nên login bằng passkey vẫn phải nhập username trước.

## Làm gì tiếp

Đi theo [checklist tích hợp](/docs/checklist).

Một số trang có nút **Chạy thử** ở cuối. Nút này mở một app demo chạy đúng flow đó và hiện các call
gửi sang AuthGate. Không bắt buộc, và nội dung ở đây không phụ thuộc vào nó.
