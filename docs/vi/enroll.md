---
title: Đăng ký PIN hoặc passkey
tryIt: /app/security
---
# Đăng ký PIN hoặc passkey

Người dùng phải có yếu tố trước thì mới challenge được. `subjectId` là id user của bạn;
chọn thứ gì ổn định, đừng dùng username.

**PIN** chỉ một lời gọi API: `POST /api/factors/pin` với `{subjectId, pin}`. Gỡ bằng
`DELETE /api/factors/pin/{subjectId}`.

**Passkey** cần hai lời gọi API, trình duyệt đứng giữa:

```text
browser          backend                       auth-gate
  │ add passkey ──► POST /api/webauthn/registrations {subjectId}
  │ ◄── publicKey ◄── {registrationId, publicKey}
  │ navigator.credentials.create(...)
  │ credential ───► POST /api/webauthn/registrations/{id} {credential}
  │                 ◄── {credentialId}
```

Options trả về dạng JSON với chuỗi base64url, còn WebAuthn lại cần `ArrayBuffer`. Toàn
bộ phần chuyển đổi chỉ có vậy (`app/src/lib/webauthn.ts`):

```ts
export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
```

`toCreationOptions` giải mã `challenge`, `user.id` và `excludeCredentials`;
`serializeCredential` mã hoá kết quả ngược lại. Xem danh sách yếu tố bằng
`GET /api/factors/{subjectId}`.
