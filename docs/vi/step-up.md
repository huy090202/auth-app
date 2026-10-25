---
title: Step-up trước thao tác nhạy cảm
tryIt: /app/home
---
# Step-up trước thao tác nhạy cảm

User đã đăng nhập rồi, nhưng muốn đổi email thì nên bắt xác thực lại. Vẫn là challenge
như lúc login, chỉ khác `purpose` là tên của thao tác đó.

```text
browser               backend                        auth-gate
  │ start ─────────────► POST /api/challenges {subjectId, purpose: "change-email", factor}
  │ pin | credential ──► POST /api/challenges/{id}/verify
  │ ◄── stepUpToken ◄─── {token}; verify it
  │ new email + stepUpToken ──► verify again, sub + purpose, then update
```

**Vì sao token phải đi kèm thao tác.** Mỗi token chỉ chứng minh một lần xác thực, cho
một user, cho một purpose. Nếu verify xong bạn chỉ set `steppedUp = true` vào session
thì coi như bỏ hết mấy ràng buộc đó: cái flag này dùng được cho mọi thao tác, miễn
session còn hạn. Cách đúng là trả token về frontend, để frontend gửi nó kèm chính
request thực hiện thao tác. Handler của thao tác verify token ngay tại đó:

```ts
await verifyAuthGateToken(typeof b.stepUpToken === 'string' ? b.stepUpToken : '', {
  jwks,
  issuer: config.authGateBaseUrl,
  audience: config.authGateClientId,
  subject: userId,
  purpose: 'change-email',
});
```

Chỉ mở step-up cho những purpose bạn đã khai báo (`bff` có một allow-list), để purpose
bịa ra không bao giờ đi tới AuthGate.

Ở v1, token dùng lại lần hai vẫn được chấp nhận cho tới `exp`. Nếu bạn cần chặn chuyện
này thì lưu `jti` lại và từ chối token nào đã gặp rồi.
