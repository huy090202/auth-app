---
title: Đăng ký backend với AuthGate
---
# Đăng ký backend với AuthGate

Với AuthGate, backend của bạn là một *client*. Bạn đăng ký nó một lần bằng admin key
và nhận về `clientId` cùng `accessKey`. Key chỉ hiện đúng một lần, nên lưu ngay vào
chỗ cất secret. Lỡ làm mất thì rotate bằng `POST /api/clients/{id}/keys`.

`rpId` và `origins` là để chạy passkey: `rpId` là domain browser thấy, `origins` là
chính xác các origin serve trang của bạn. Khai sai là mọi call WebAuthn đều fail.

Trong repo này chỉ cần chạy một script:

```bash
AUTHGATE_BASE_URL=https://auth-gate.example.com AUTHGATE_ADMIN_KEY=... \
  scripts/setup-and-deploy/02-register-client.sh local   # or: stg
```

Bên dưới là lệnh `curl` này (secret đi qua file, không bao giờ nằm trên argv):

```bash
printf 'x-internal-access-key: %s\n' "$AUTHGATE_ADMIN_KEY" >"$tmpdir/headers"
jq -n --arg name "$name" --arg rp "$rp_id" --arg origin "$origin" \
  '{name: $name, rpId: $rp, origins: [$origin]}' >"$tmpdir/body"
status="$(curl -sS -o "$tmpdir/resp" -w '%{http_code}' -X POST "$base/api/clients" \
  -H @"$tmpdir/headers" -H 'content-type: application/json' \
  --data-binary @"$tmpdir/body")" || die "POST $base/api/clients: network error"
```

Thành công thì nhận `201` kèm `{clientId, accessKey}`. Từ đó mọi request backend gửi
sang AuthGate đều mang header `x-internal-access-key: <accessKey>`, và token trả về
có `aud = clientId`.
