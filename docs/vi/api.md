---
title: Tham chiếu API
---
# Tham chiếu API

Đây là các call backend của bạn sẽ gọi. Tạo client và cấp key là việc của team vận hành, không nằm
trong API này. Xem [Lấy credentials](/docs/setup).

## Quy ước

- **Base URL:** `https://<authgate-host>`, nhận cùng với credentials.
- **Xác thực:** gửi `x-internal-access-key: <accessKey>` ở mọi call, trừ call lấy bộ public key.
  Không có key hợp lệ thì nhận `401 {"error":"unauthorized"}`.
- **Body:** JSON, tối đa 1 MiB. Field lạ sẽ bị bỏ qua.
- **Id:** `subjectId`, `purpose` và các id trong path dài 1 đến 256 byte, không chứa `#`. Sai quy tắc
  thì nhận `400 invalid_id`. `subjectId` dùng với passkey phải dài tối đa 64 byte, nếu không call đăng
  ký sẽ trả `500 internal`. `subjectId` nên chỉ gồm chữ cái, chữ số, `-` và `_`, và nhớ encode id khi
  đưa vào URL.
- **Thời gian:** chuỗi RFC 3339, theo UTC.
- **Lỗi:** status kèm `{"error": "<code>"}`. Call nào cũng có thể trả `500 internal`. Từng mã được giải
  thích ở trang [Xử lý lỗi](/docs/errors).

## Factors

### POST /api/factors/pin

Đặt hoặc thay PIN của subject, đồng thời xoá trạng thái khoá.

- **Request:** `{subjectId, pin}`
- **Thành công:** `201 {}`
- **Lỗi:** `invalid_json`, `invalid_id`, `pin_rejected`

### DELETE /api/factors/pin/{subjectId}

Gỡ PIN của subject.

- **Thành công:** `204`, kể cả khi không có PIN
- **Lỗi:** `invalid_id`

### GET /api/factors/{subjectId}

Liệt kê các yếu tố subject đã đăng ký. Subject chưa từng thấy thì nhận `pin: false` và danh sách rỗng.

- **Thành công:** `200`

```json
{
  "pin": true,
  "webauthn": [
    { "credentialId": "base64url", "createdAt": "2026-11-06T10:00:00Z", "lastUsedAt": null }
  ]
}
```

- **Lỗi:** `invalid_id`

## Đăng ký passkey

### POST /api/webauthn/registrations

Bắt đầu một registration, có hiệu lực năm phút.

- **Request:** `{subjectId, displayName?}`. `displayName` mặc định là `subjectId`, và dù thế nào thì
  `subjectId` vẫn được gửi tới browser dưới dạng `user.name`.
- **Thành công:** `201 {registrationId, publicKey}`. `publicKey` chứa options cho
  `navigator.credentials.create`, giá trị binary ở dạng base64url. Các passkey subject đã có nằm trong
  `excludeCredentials`.
- **Lỗi:** `invalid_json`, `invalid_id`

### POST /api/webauthn/registrations/{registrationId}

Hoàn tất registration. Call đầu tiên có body đúng định dạng sẽ dùng hết registration, kể cả khi fail.

- **Request:** `{credential}`, response của browser với giá trị binary ở dạng base64url
- **Thành công:** `201 {credentialId}`
- **Lỗi:** `invalid_json`, `invalid_id`, `registration_failed`, `challenge_gone`

### DELETE /api/webauthn/credentials/{credentialId}?subjectId={subjectId}

Gỡ một passkey. Bắt buộc có `subjectId`.

- **Thành công:** `204`, kể cả khi không có passkey đó
- **Lỗi:** `invalid_id`

## Challenge

### POST /api/challenges

Mở một challenge dùng một lần, có hiệu lực năm phút.

- **Request:** `{subjectId, purpose, factor}`. `factor` là `pin` hoặc `webauthn`.
- **Thành công:** `201 {challengeId, expiresAt, publicKey?}`. `publicKey` chỉ có với `webauthn`, chứa
  options cho `navigator.credentials.get`, giá trị binary ở dạng base64url.
- **Lỗi:** `invalid_json`, `invalid_id`, `wrong_factor`, `factor_not_found`, `locked`

### POST /api/challenges/{challengeId}/verify

Kiểm tra câu trả lời và cấp token nếu đúng. Challenge PIN có số lượt thử bằng `maxAttempts` trong PIN
policy của bạn, challenge passkey có ba lượt.

- **Request:** đúng một trong hai: `{pin}` hoặc `{credential}`
- **Thành công:** `200 {token, expiresAt, factor}`. Xem [Verify token](/docs/verify-token).
- **Lỗi:** `invalid_json`, `invalid_id`, `verification_failed`, `wrong_factor`, `factor_not_found`,
  `locked`, `challenge_gone`

## Public key

### GET /.well-known/jwks.json

Bộ key dùng để verify token. Không cần credential.

- **Thành công:** `200 {keys: [...]}`, kèm `Cache-Control: public, max-age=300`. Mỗi key có `kty` là
  `EC`, `crv` là `P-256`, `alg` là `ES256`, `use` là `sig`, cùng `kid`, `x` và `y`.
