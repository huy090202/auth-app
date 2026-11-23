---
title: AuthGate cho bạn những gì
signUp: true
---
# AuthGate cho bạn những gì

AuthGate kiểm tra yếu tố thứ hai của user: PIN hoặc passkey. Backend của bạn mở challenge, chuyển
câu trả lời của user sang AuthGate, rồi nhận về một token ký sẵn, sống ngắn, ghi rằng "user này vừa
qua yếu tố này cho đúng việc này". Bạn verify token rồi tự quyết token đó cho user làm gì.

```text
browser ──► your backend ──► AuthGate
                 │  POST /api/challenges             {subjectId, purpose, factor}
                 │  POST /api/challenges/{id}/verify {pin | credential}
                 │◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
browser ◄── your session or your action
```

## AuthGate lo những gì

- PIN: lưu dạng hash, áp policy về độ dài, từ chối PIN quá dễ đoán, khoá sau nhiều lần sai.
- Passkey: tạo WebAuthn options cho browser, rồi verify kết quả trả về, kiểm cả `rpId` và origin.
- Challenge: chỉ dùng một lần, sống năm phút, và chỉ client của bạn thấy được.
- Token: JWT ký ES256, mặc định sống 5 phút (tối đa 15 phút), kèm bộ public key để verify.

## Bạn tự lo những gì

- User, mật khẩu và session: AuthGate chỉ biết `subjectId` bạn đưa, và không hiểu gì về nó.
- Một backend đứng ra gọi mọi call: browser không bao giờ gọi thẳng AuthGate.
- Mọi màn hình: form nhập PIN, prompt passkey, trang cài đặt.
- Verify từng token, rồi quyết định token đó cho làm gì.
- Lúc nào cần hỏi: thao tác nào phải xác thực, chấp nhận yếu tố nào.
- Khôi phục tài khoản: AuthGate không có flow reset. User mất PIN hoặc passkey thì bạn tự xác minh
  họ theo cách của bạn, rồi cho đăng ký lại.
- Mọi thứ xung quanh: email, audit log, rate limit cho endpoint của bạn.

AuthGate v1 chưa có discoverable credential, nên login bằng passkey vẫn phải nhập username trước.

## Làm gì tiếp

Làm theo [checklist tích hợp](/docs/checklist).

Một số trang có nút **Chạy thử** ở cuối. Nút này mở app demo chạy đúng flow đó và hiện các call gửi
sang AuthGate. Bạn không bắt buộc phải dùng, và nội dung ở đây không phụ thuộc vào nó.
