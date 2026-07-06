# Prowlarr Setup Guide

Prowlarr is the recommended indexer manager for Triparr. It allows you to manage multiple trackers in one place and provides a unified Torznab interface.

## 1. Installation (Native Linux)

For Debian or Fedora-based systems, you can use the provided automated script to install Prowlarr natively as a systemd service.

Run as root or with sudo:

```bash
sudo ./scripts/install-prowlarr.sh
```

This script will:
- Install system dependencies (`libicu`, `libcurl`, etc.)
- Create a dedicated `prowlarr` system user
- Download and install the latest Prowlarr binary to `/opt/Prowlarr`
- Set up a systemd service and start it automatically

## 1b. Installation (Docker)

If you prefer Docker, you can use the example `deploy/docker-compose.yml` included in this repository.

```bash
cd deploy
docker-compose up -d
```

## 2. Initial Setup

1. Open Prowlarr in your browser at `http://YOUR_SERVER_IP:9696`.
2. Complete the initial setup (Security, etc.).
3. Go to **Settings -> General** and copy your **API Key**. You will need this for Triparr.

## 3. Adding Indexers

1. Go to **Indexers -> Add New**.
2. Search for the trackers you use (e.g., RARBG, 1337x, etc.).
3. Configure them with your credentials if required and save.

## 4. Connecting to Triparr

Triparr needs a **Torznab URL** and an **API Key**.

### Finding the Torznab URL

1. In Prowlarr, go to **Indexers**.
2. For the indexer you want to use, click the **Copy Torznab Endpoint** button (the small chain/link icon).
3. The URL will look like this: `http://YOUR_SERVER_IP:9696/1/api` (where `1` is the indexer ID).

### Configuring Triparr

1. Open Triparr and go to **Settings**.
2. Paste the **Prowlarr API Key**.
3. Paste the **Torznab URL** (e.g., `http://192.168.1.50:9696/1/api`).
4. Click **Test Torznab**.

## Pro Tip: Use a "Full" Search Indexer

If you want Triparr to search *all* your Prowlarr indexers at once, you can use the Prowlarr **aggregate** endpoint.

1. In Prowlarr, go to **Settings -> Apps**.
2. You won't find a direct "Triparr" app, but you can use any Torznab-compatible link.
3. However, the easiest way is to use the ID `0` (or sometimes `all`) in the URL:
   `http://YOUR_SERVER_IP:9696/0/api`
4. This will make Triparr search across all configured indexers in Prowlarr.
