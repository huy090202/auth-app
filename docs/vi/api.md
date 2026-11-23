---
title: Tham chiếu API
---
# Tham chiếu API

Đây là các call backend của bạn gọi tới AuthGate. Client và key thì bạn tự tạo trên Portal, không qua
API này. Xem [Lấy credentials](/docs/setup).

## Quy ước

- Base URL là `https://<authgate-host>`, bạn nhận cùng với credentials.
- Mọi call đều gửi `x-internal-access-key: <accessKey>` để xác thực, trừ call lấy bộ public key.
  Không có key hợp lệ thì nhận `401 {"error":"unauthorized"}`.
- Body là JSON, tối đa 1 MiB. AuthGate bỏ qua field lạ.
- `subjectId`, `purpose` và các id trong path dài 1 đến 256 byte, không chứa `#`. Sai quy tắc này thì
  nhận `400 invalid_id`. `subjectId` dùng cho passkey thì tối đa 64 byte, dài hơn thì call đăng ký cũng
  trả `400 invalid_id`. `subjectId` nên chỉ gồm chữ cái, chữ số, `-` và `_`. Đưa id vào URL thì nhớ
  encode.
- Thời gian là chuỗi RFC 3339, theo UTC.
- Mọi call có key hợp lệ đều tính vào rate limit của client. Vượt limit thì call nào trong số này cũng
  có thể trả `429 {"error":"rate_limited"}`, kèm `Retry-After` tính bằng giây nguyên. Call lấy bộ public
  key không bị giới hạn.
- Lỗi trả về dạng status kèm `{"error": "<code>"}`. Call nào cũng có thể trả `500 internal`. Trang
  [Xử lý lỗi](/docs/errors) giải thích từng mã.

## Factors

### POST /api/factors/pin

Đặt PIN mới hoặc thay PIN cũ của subject, đồng thời xoá trạng thái khoá.

- Request: `{subjectId, pin}`
- Thành công: `201 {}`
- Lỗi: `invalid_json`, `invalid_id`, `pin_rejected`

### DELETE /api/factors/pin/{subjectId}

Gỡ PIN của subject.

- Thành công: `204`, kể cả khi không có PIN
- Lỗi: `invalid_id`

### GET /api/factors/{subjectId}

Liệt kê các yếu tố subject đã đăng ký. Subject AuthGate chưa biết thì nhận `pin: false` và danh sách
rỗng.

- Thành công: `200`

```json
{
  "pin": true,
  "webauthn": [
    { "credentialId": "base64url", "createdAt": "2026-11-06T10:00:00Z", "lastUsedAt": null }
  ]
}
```

- Lỗi: `invalid_id`

## Đăng ký passkey

### POST /api/webauthn/registrations

Bắt đầu registration, có hiệu lực năm phút.

- Request: `{subjectId, displayName?}`. `displayName` mặc định là `subjectId`. Có `displayName` hay
  không thì `subjectId` vẫn tới browser dưới dạng `user.name`.
- Thành công: `201 {registrationId, publicKey}`. `publicKey` chứa options cho
  `navigator.credentials.create`, giá trị binary ở dạng base64url. Các passkey subject đã có nằm trong
  `excludeCredentials`.
- Lỗi: `invalid_json`, `invalid_id`

### POST /api/webauthn/registrations/{registrationId}

Hoàn tất registration. Call đầu tiên có body đúng định dạng sẽ dùng hết registration, kể cả khi call
đó fail.

- Request: `{credential}`, tức response của browser, giá trị binary ở dạng base64url
- Thành công: `201 {credentialId}`
- Lỗi: `invalid_json`, `invalid_id`, `registration_failed`, `challenge_gone`

### DELETE /api/webauthn/credentials/{credentialId}?subjectId={subjectId}

Gỡ một passkey. Bắt buộc gửi kèm `subjectId`.

- Thành công: `204`, kể cả khi không có passkey đó
- Lỗi: `invalid_id`

## Challenge

### POST /api/challenges

Mở challenge dùng một lần, có hiệu lực năm phút.

- Request: `{subjectId, purpose, factor}`. `factor` là `pin` hoặc `webauthn`.
- Thành công: `201 {challengeId, expiresAt, publicKey?}`. `publicKey` chỉ có với `webauthn`, chứa
  options cho `navigator.credentials.get`, giá trị binary ở dạng base64url.
- Lỗi: `invalid_json`, `invalid_id`, `wrong_factor`, `factor_not_found`, `locked`

### POST /api/challenges/{challengeId}/verify

Kiểm tra câu trả lời, đúng thì cấp token. Challenge PIN cho thử `maxAttempts` lần, theo PIN policy của
bạn. Challenge passkey cho thử ba lần.

- Request: đúng một trong hai, `{pin}` hoặc `{credential}`
- Thành công: `200 {token, expiresAt, factor}`. Xem [Verify token](/docs/verify-token).
- Lỗi: `invalid_json`, `invalid_id`, `verification_failed`, `wrong_factor`, `factor_not_found`,
  `locked`, `challenge_gone`

## Public key

### GET /.well-known/jwks.json

Bộ key để verify token. Call này không cần credential.

- Thành công: `200 {keys: [...]}`, kèm `Cache-Control: public, max-age=300`. Mỗi key có `kty` là
  `EC`, `crv` là `P-256`, `alg` là `ES256`, `use` là `sig`, cùng `kid`, `x` và `y`.
