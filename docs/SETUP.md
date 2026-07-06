# Setup

## Requirements

- Node.js 24+
- npm 11+
- A TMDB account/API token
- A configured Prowlarr Torznab endpoint (See [Prowlarr Setup](PROWLARR_SETUP.md))
- A Real-Debrid API token
- Writable local folders for downloads and final media

## Automated Install & Update (Linux)

For Debian or Fedora-based systems, you can use the provided automated script to handle system dependencies, repository setup, building, and systemd service installation.

Run as root or with sudo:

```bash
sudo ./scripts/install.sh
```

This script will:
- Detect your OS (Debian or Fedora)
- Install Node.js, Git, SQLite, and build tools
- Clone or update the repository in `/opt/triparr`
- Install npm dependencies and build the project
- Generate an `.env` with a secure `APP_SECRET` if missing
- Create the `data/tmp` directory for temporary downloads
- Install and start the `triparr-web` and `triparr-worker` systemd services

## Manual Install
...

Set a real `APP_SECRET` before saving provider tokens:

```bash
openssl rand -base64 48
```

Example `.env`:

```env
APP_SECRET=replace-with-a-long-random-secret
DATABASE_PATH=./data/triparr.sqlite
TRIPARR_BASE_URL=http://localhost:3000
```

## Start Development Server

```bash
npm run dev
```

Next may choose another port if `3000` is already in use. The console prints both local and network URLs.

## First Login

Open the app and create the first local admin account. Triparr is single-user, so there are no roles or invites.

## Worker

In development, Triparr starts an automatic worker loop after an authenticated app page loads.

You can also run a dedicated worker process:

```bash
npm run worker
```

Or process a single queued job from a request detail page with `Run worker`.

## Validate

```bash
npm run typecheck
npm run build
```
