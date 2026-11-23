---
title: Đăng ký PIN hoặc passkey
tryIt: /app/security
---
# Đăng ký PIN hoặc passkey

User phải có yếu tố thì bạn mới mở challenge cho họ được. `subjectId` là user id bên bạn và phải cố
định, nên đừng dùng username. Chỉ nên dùng chữ cái, chữ số, `-` và `_`, tối đa 64 byte. AuthGate nhận
tới 256 byte, miễn không chứa `#`, nhưng id dài quá 64 byte thì đăng ký passkey trả `400 invalid_id`.
Id này còn tới browser và có thể hiện trong prompt passkey, nên đừng để thông tin riêng tư trong đó.

Chỉ cho đăng ký khi user đã đăng nhập. Lấy `subjectId` từ session, không bao giờ lấy từ request.
Đăng ký PIN thay PIN cũ và xoá trạng thái khoá, nên user nào đã có yếu tố thì phải
[step-up](/docs/step-up) trước.

## PIN

```ts
const { status } = await authGate('POST', '/api/factors/pin', { subjectId: user.id, pin });
```

Thành công thì nhận `201`. PIN phải đúng độ dài trong policy và chỉ gồm chữ số. PIN lặp một số
(`111111`) hoặc là dãy liền nhau (`123456`, `654321`) thì nhận `400 pin_rejected`.

## Passkey

Có hai call, browser làm phần ở giữa:

```text
browser              your backend                  AuthGate
  │ add passkey ───────► POST /api/webauthn/registrations {subjectId, displayName?}
  │                      ◄── {registrationId, publicKey}
  │ ◄── publicKey ─────  keep registrationId
  │ navigator.credentials.create(...)
  │ credential ────────► POST /api/webauthn/registrations/{registrationId} {credential}
  │                      ◄── {credentialId}
  │ ◄── done
```

Phía backend:

```ts
const begin = await authGate('POST', '/api/webauthn/registrations', {
  subjectId: user.id,
  displayName: user.email, // optional, defaults to subjectId
});
// Keep begin.data.registrationId in your session, send begin.data.publicKey to the browser.

const finish = await authGate('POST', `/api/webauthn/registrations/${registrationId}`, { credential });
```

Phía browser thì dùng các hàm ở phần tiếp theo:

```ts
const cred = (await navigator.credentials.create({
  publicKey: toCreationOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

Registration có hiệu lực năm phút. Call finish đầu tiên có body đúng định dạng sẽ dùng hết
registration, kể cả khi call đó fail. Gặp `400 registration_failed` hoặc `410 challenge_gone` thì làm
lại từ đầu.

## Chuyển đổi dữ liệu WebAuthn

AuthGate gửi và nhận chuỗi base64url, còn API của browser dùng `ArrayBuffer`. Copy các hàm này vào
frontend. Login bằng passkey và step-up cũng dùng chúng.

```ts
export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function toB64url(buf: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Desc = { id: string; type: string; transports?: string[] };
const descs = (list?: Desc[]) =>
  list?.map((d) => ({ ...d, id: fromB64url(d.id) }) as PublicKeyCredentialDescriptor);

export function toCreationOptions(publicKey: any): PublicKeyCredentialCreationOptions {
  return {
    ...publicKey,
    challenge: fromB64url(publicKey.challenge),
    user: { ...publicKey.user, id: fromB64url(publicKey.user.id) },
    excludeCredentials: descs(publicKey.excludeCredentials),
  };
}

export function toRequestOptions(publicKey: any): PublicKeyCredentialRequestOptions {
  return {
    ...publicKey,
    challenge: fromB64url(publicKey.challenge),
    allowCredentials: descs(publicKey.allowCredentials),
  };
}

export function serializeCredential(cred: PublicKeyCredential) {
  const r = cred.response as any;
  const response: Record<string, unknown> = { clientDataJSON: toB64url(r.clientDataJSON) };
  if (r.attestationObject) {
    response.attestationObject = toB64url(r.attestationObject);
    response.transports = r.getTransports?.();
  } else {
    response.authenticatorData = toB64url(r.authenticatorData);
    response.signature = toB64url(r.signature);
    response.userHandle = r.userHandle ? toB64url(r.userHandle) : null;
  }
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response,
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}
```

## Xem và gỡ yếu tố

| Call | Kết quả |
|---|---|
| `GET /api/factors/{subjectId}` | `200 {pin, webauthn: [{credentialId, createdAt, lastUsedAt}]}` |
| `DELETE /api/factors/pin/{subjectId}` | `204`, kể cả khi không có PIN |
| `DELETE /api/webauthn/credentials/{credentialId}?subjectId={subjectId}` | `204`, kể cả khi không có passkey đó |

Subject AuthGate chưa biết thì call xem danh sách vẫn trả `{pin: false, webauthn: []}`, không báo lỗi.
Đưa id vào path hoặc query thì encode bằng `encodeURIComponent`.

Xoá user bên bạn thì lấy danh sách yếu tố của họ rồi gỡ từng cái. AuthGate không biết user đó đã bị
xoá.
