# Native Service Setup

Triparr can run natively with two systemd units:

- `triparr-web.service`
- `triparr-worker.service`

The web service runs the Next.js production server. The worker service runs the background request/download pipeline.

## Files

Templates live in:

```text
deploy/systemd/triparr-web.service
deploy/systemd/triparr-worker.service
```

Installed locations:

```text
/etc/systemd/system/triparr-web.service
/etc/systemd/system/triparr-worker.service
```

## Environment

Services read:

```text
/opt/triparr/.env
```

Required values:

```env
APP_SECRET=...
DATABASE_PATH=/opt/triparr/data/triparr.sqlite
PORT=3002
HOSTNAME=0.0.0.0
TRIPARR_BASE_URL=http://192.168.1.41:3002
```

Important: `APP_SECRET` is used to decrypt saved provider settings. If it changes, encrypted provider settings must be re-entered from the UI.

## Commands

```bash
cd /opt/triparr
npm install
npm run build

cp deploy/systemd/triparr-web.service /etc/systemd/system/triparr-web.service
cp deploy/systemd/triparr-worker.service /etc/systemd/system/triparr-worker.service

systemctl daemon-reload
systemctl enable --now triparr-web.service
systemctl enable --now triparr-worker.service
```

Check status:

```bash
systemctl status triparr-web.service
systemctl status triparr-worker.service
```

Follow logs:

```bash
journalctl -u triparr-web.service -f
journalctl -u triparr-worker.service -f
```
