---
title: Đăng ký PIN hoặc passkey
tryIt: /app/security
---
# Đăng ký PIN hoặc passkey

User phải đăng ký PIN hoặc passkey trước thì bạn mới mở challenge được. `subjectId`
là id user bên bạn; chọn giá trị nào cố định, đừng dùng username.

**PIN** chỉ cần một call: `POST /api/factors/pin` với `{subjectId, pin}`. Muốn gỡ thì
gọi `DELETE /api/factors/pin/{subjectId}`.

**Passkey** cần hai call, ở giữa là bước của browser:

```text
browser          backend                       auth-gate
  │ add passkey ──► POST /api/webauthn/registrations {subjectId}
  │ ◄── publicKey ◄── {registrationId, publicKey}
  │ navigator.credentials.create(...)
  │ credential ───► POST /api/webauthn/registrations/{id} {credential}
  │                 ◄── {credentialId}
```

Options trả về là JSON, các field nhị phân encode base64url, trong khi WebAuthn lại
đòi `ArrayBuffer`. Phần convert chỉ có chừng này (`app/src/lib/webauthn.ts`):

```ts
export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
```

`toCreationOptions` decode `challenge`, `user.id` và `excludeCredentials`;
`serializeCredential` encode kết quả ngược lại để gửi lên. Muốn xem user đã gắn
PIN/passkey nào thì gọi `GET /api/factors/{subjectId}`.
