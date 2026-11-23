---
title: Lấy credentials
signUp: true
---
# Lấy credentials

Backend của bạn là một *client* của AuthGate. Mỗi client có key, user và cấu hình riêng.

## Tạo client

Bạn tự đăng ký trên AuthGate Portal rồi tự tạo client:

1. Đăng ký tại <https://portal.authgatehq.com/sign-up> và đặt mật khẩu.
2. Mở thư Portal gửi để xác nhận địa chỉ email. Bước này hỏi lại mật khẩu vừa đặt.
3. Thiết lập PIN hoặc passkey.
4. Tạo client với các thông tin dưới đây. Key chỉ hiện một lần.

| Field | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | có | Tên app của bạn. Browser có thể hiện tên này trong prompt passkey. |
| `rpId` | có | Domain mà passkey thuộc về, ví dụ `example.com`. Chạy local thì dùng `localhost`. |
| `origins` | có | Mọi origin serve trang của bạn, ví dụ `https://app.example.com`: scheme, host và port nếu có, không có path. Mỗi host phải là `rpId` hoặc subdomain của `rpId`. |
| `pinPolicy.length` | không | 4 đến 8 chữ số. Mặc định 6. |
| `pinPolicy.maxAttempts` | không | Sai 1 đến 10 lần thì khoá. Mặc định 5. |
| `pinPolicy.lockoutSec` | không | 1 đến 86400 giây. Mặc định 900. |
| `tokenTtlSec` | không | Thời gian sống của token, 1 đến 900 giây. Mặc định 300. |

Chọn `rpId` cho kỹ. Passkey gắn chặt với `rpId`, nên đổi sang domain khác là mọi user phải đăng ký
lại. Nếu `rpId` hoặc `origins` không khớp với trang, các call passkey sẽ fail.

Sau này bạn vẫn sửa được tên, origin, PIN policy và thời gian sống của token ngay trên Portal.
Riêng `rpId` thì không đổi được. Yếu tố của user thuộc về một client, nên chuyển sang client thay
thế là mọi user phải đăng ký lại.

Mỗi môi trường nên dùng một client riêng. Local, staging và production có origin khác nhau, tách
client thì user và key của từng môi trường không lẫn vào nhau.

## Bạn nhận lại gì

- Base URL: địa chỉ backend của bạn gọi tới, trong docs này viết là `https://<authgate-host>`.
- `clientId`: token cấp cho bạn mang giá trị này ở `aud`.
- `accessKey`: secret bắt đầu bằng `ag_`. Key chỉ hiện đúng một lần, nên lưu ngay vào secret store.

## Gọi AuthGate

Mọi call đều gửi key trong header `x-internal-access-key`, trừ call lấy bộ public key. Chỉ cần một
helper, các trang flow đều dùng helper này:

```ts
const AUTHGATE_URL = process.env.AUTHGATE_URL!;
const ACCESS_KEY = process.env.AUTHGATE_ACCESS_KEY!;

export async function authGate(method: string, path: string, body?: unknown) {
  const res = await fetch(AUTHGATE_URL + path, {
    method,
    headers: { 'x-internal-access-key': ACCESS_KEY, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
```

Thiếu key hoặc sai key thì nhận `401 {"error":"unauthorized"}`, không kèm lý do. Key chắc chắn
đúng mà thỉnh thoảng vẫn gặp `401` thì có thể do lỗi phía AuthGate. Thử lại trước khi xin key mới.

## Đổi key

Bạn tự đổi key trên trang của client trong Portal, bằng nút "Xoay khóa". Portal hỏi yếu tố thứ hai
của bạn để xác nhận. Key mới dùng được ngay, còn key cũ vẫn chạy thêm 24 giờ để bạn kịp deploy mà
không bị gián đoạn.

Vì vậy, chỉ đổi key thì chưa chặn được key đã lộ. Key bị lộ thì đổi key xong, bấm tiếp "Thu hồi
các khóa cũ" ngay trên trang đó để cắt luôn 24 giờ của key cũ. Backend của bạn sẽ nhận `401` cho
tới khi deploy key mới.

Cách khác là tắt client ngay trên trang đó, bằng nút "Vô hiệu hóa ứng dụng khách". Mọi key của
client ngừng ngay và nhận `401` giống hệt key sai, cho tới khi bạn bấm "Bật ứng dụng khách". Client
do quản trị viên khoá thì vẫn bị khoá cho tới khi team vận hành mở lại.

Dù chọn cách nào, token đã cấp vẫn hợp lệ tới khi hết hạn, tối đa 15 phút.
