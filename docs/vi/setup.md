---
title: Lấy credentials
---
# Lấy credentials

Với AuthGate, backend của bạn là một *client*. Mỗi client có key, user và cấu hình riêng.

## Xin cấp client

Client do team vận hành AuthGate của bạn tạo. Gửi cho họ các thông tin sau:

| Field | Bắt buộc | Quy tắc |
|---|---|---|
| `name` | có | Tên app của bạn. Browser có thể hiện tên này trong prompt passkey. |
| `rpId` | có | Domain mà passkey thuộc về, ví dụ `example.com`. Chạy local thì dùng `localhost`. |
| `origins` | có | Mọi origin serve trang của bạn, ví dụ `https://app.example.com`: scheme, host và port nếu có, không có path. Host phải là `rpId` hoặc subdomain của nó. |
| `pinPolicy.length` | không | 4 đến 8 chữ số. Mặc định 6. |
| `pinPolicy.maxAttempts` | không | Sai 1 đến 10 lần thì khoá. Mặc định 5. |
| `pinPolicy.lockoutSec` | không | 1 đến 86400 giây. Mặc định 900. |
| `tokenTtlSec` | không | Thời gian sống của token, 1 đến 900 giây. Mặc định 300. |

Chọn `rpId` cho kỹ. Passkey gắn chặt với nó, nên chuyển sang domain khác là mọi user phải đăng ký
lại. `rpId` hoặc `origins` không khớp với trang thì các call passkey sẽ fail.

Liệt kê đủ các origin bạn sẽ cần ngay từ đầu, và trao đổi với team vận hành trước khi cần thay đổi.
Yếu tố của user thuộc về một client, nên chuyển sang client thay thế là mọi user phải đăng ký lại.

Mỗi môi trường nên có một client riêng. Local, staging và production có origin khác nhau, và tách
ra thì user với key của chúng không lẫn vào nhau.

## Bạn nhận lại gì

- **Base URL:** địa chỉ backend của bạn gọi tới, trong docs này viết là `https://<authgate-host>`.
- **`clientId`:** token cấp cho bạn sẽ mang giá trị này ở `aud`.
- **`accessKey`:** secret bắt đầu bằng `ag_`. Key chỉ hiện đúng một lần, nên lưu ngay vào secret
  store.

## Gọi AuthGate

Mọi call đều gửi key trong header `x-internal-access-key`, trừ call lấy bộ public key. Một helper là
đủ, và các trang flow đều dùng helper này:

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

Thiếu key hoặc sai key thì nhận `401 {"error":"unauthorized"}`, không kèm lý do. Nếu key chắc chắn
đúng mà thỉnh thoảng vẫn gặp `401` thì có thể do lỗi phía AuthGate, nên thử lại trước khi xin key mới.

## Rotate key

Key mới do team vận hành cấp. Key mới dùng được ngay, còn key cũ vẫn chạy thêm 24 giờ để bạn kịp
deploy mà không bị gián đoạn.

Điều đó cũng có nghĩa là chỉ rotate thì không chặn được key đã lộ. Nếu key bị lộ, báo team vận hành
ngay. Team vận hành có thể:

- **Thay key ngay:** cấp key mới rồi chấm dứt luôn 24 giờ của key cũ. Backend của bạn sẽ nhận `401`
  cho tới khi deploy key mới.
- **Disable client của bạn:** mọi key của client ngừng hoạt động ngay và nhận `401` giống hệt key sai,
  cho tới khi team vận hành bật lại client.

Dù theo cách nào, token đã cấp vẫn hợp lệ đến khi hết hạn, tối đa 15 phút.
