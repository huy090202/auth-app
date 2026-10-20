---
title: Đăng ký backend
---
# Đăng ký backend

Backend của bạn là một *client* của auth-gate. Đăng ký một lần bằng admin key, bạn nhận
về `clientId` và `accessKey`. Key chỉ hiện đúng một lần: cất ngay vào chỗ giữ secret.
Lỡ mất thì rotate bằng `POST /api/clients/{id}/keys`.

`rpId` và `origins` dành cho passkey: domain mà trình duyệt thấy, và chính xác các
origin phục vụ trang của bạn. Sai một cái là mọi lệnh WebAuthn đều hỏng.

Trong repo này chỉ cần một script:

```bash
AUTHGATE_BASE_URL=https://auth-gate.example.com AUTHGATE_ADMIN_KEY=... \
  scripts/setup-and-deploy/02-register-client.sh local   # or: stg
```

Lệnh `curl` bên dưới (secret đi qua file, không bao giờ qua argv):

```bash
printf 'x-internal-access-key: %s\n' "$AUTHGATE_ADMIN_KEY" >"$tmpdir/headers"
jq -n --arg name "$name" --arg rp "$rp_id" --arg origin "$origin" \
  '{name: $name, rpId: $rp, origins: [$origin]}' >"$tmpdir/body"
status="$(curl -sS -o "$tmpdir/resp" -w '%{http_code}' -X POST "$base/api/clients" \
  -H @"$tmpdir/headers" -H 'content-type: application/json' \
  --data-binary @"$tmpdir/body")" || die "POST $base/api/clients: network error"
```

Kết quả đúng là `201` với `{clientId, accessKey}`. Từ đó, mọi request backend gửi đi
đều kèm `x-internal-access-key: <accessKey>`, và token bạn nhận được có
`aud = clientId`.
