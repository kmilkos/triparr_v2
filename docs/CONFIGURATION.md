# Configuration

All app settings are managed from `/settings`.

Secret provider values are encrypted in SQLite with `APP_SECRET`. If you change `APP_SECRET`, previously saved secrets cannot be decrypted and must be re-entered.

## TMDB

Triparr uses TMDB as the only metadata provider for MVP.

Use the **API Read Access Token**, not the shorter v3 API key.

Steps:

1. Log in to https://www.themoviedb.org/
2. Open `Profile -> Settings -> API`.
3. Request API access if needed.
4. Copy `API Read Access Token`.
5. Paste it into `TMDB API token`.
6. Click `Test TMDB`.

The token usually starts with:

```text
eyJhbGciOi...
```

## Prowlarr / Torznab

Triparr expects a Torznab XML endpoint. Prowlarr is the highly recommended manager for this.

See the [Prowlarr Setup Guide](PROWLARR_SETUP.md) for detailed installation and configuration instructions.

Use a Prowlarr indexer API URL like:

```text
http://PROWLARR_HOST:9696/INDEXER_ID/api
```

Use the Prowlarr API key from:

```text
Settings -> General -> Security -> API Key
```

Do not include `?apikey=...` in the URL field. Triparr adds the API key itself.

Correct:

```text
Prowlarr / Torznab URL:
http://192.168.1.50:9696/1/api

Prowlarr / Torznab API key:
your-prowlarr-api-key
```

Wrong:

```text
http://192.168.1.50:9696/1/api?apikey=your-prowlarr-api-key
```

Click `Test Torznab` after saving.

## Real-Debrid

Triparr uses a user-provided Real-Debrid API token for MVP.

Paste the token into:

```text
Real-Debrid API token
```

Then click:

```text
Test Real-Debrid
```

## Folders

Use paths writable by the Triparr process.

Example:

```text
Movie output folder:
/outer/Movies

TV output folder:
/outer/TVSeries

Temporary download folder:
./data/tmp
```

Movie output format:

```text
{movieRoot}/{Movie Title} ({Year})/{Movie Title} ({Year}).{ext}
```

TV output format:

```text
{tvRoot}/{Series Title}/Season 01/{Series Title} - S01E01 - Episode Title.{ext}
```

## Release Selection

Triparr uses hybrid release selection:

- auto-grab high-confidence matches
- ask for manual selection when confidence is low
- automatically try the next candidate if Real-Debrid rejects a release as unavailable/infringing/invalid

## Quality Profiles

Initial profiles:

- `Balanced`
- `High Quality`
- `Small Size`

The scoring system considers title/year matching, episode matching, resolution, quality terms, size, and seeders.
