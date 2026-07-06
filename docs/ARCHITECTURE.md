# Architecture

Triparr is a single deployable Next.js app with server-side services and a SQLite database.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- SQLite
- Drizzle
- TMDB
- Prowlarr/Torznab
- Real-Debrid

## Main Areas

```text
src/app
  UI pages and route handlers

src/server/auth
  setup-first admin account and sessions

src/server/db
  SQLite connection, Drizzle schema, migration bootstrap

src/server/settings
  encrypted settings storage

src/server/metadata
  TMDB client and metadata cache

src/server/indexers
  Torznab XML client and release normalization

src/server/debrid
  Real-Debrid API client

src/server/requests
  request lifecycle and release scoring

src/server/downloads
  direct HTTP downloads and file organization

src/server/worker
  database-backed job runner
```

## Request Lifecycle

```text
REQUESTED
SEARCHING
CANDIDATES_FOUND
AWAITING_SELECTION
SUBMITTED_TO_DEBRID
WAITING_FILE_SELECTION
DOWNLOADING
AVAILABLE
DOWNLOADING_FILE
ORGANIZING
COMPLETED
FAILED
CANCELLED
```

## Worker Jobs

```text
SEARCH_RELEASES
SUBMIT_TO_DEBRID
POLL_DEBRID
SELECT_DEBRID_FILES
UNRESTRICT_LINKS
DOWNLOAD_FILES
ORGANIZE_FILES
```

The worker claims due jobs from `request_jobs`, runs one handler, updates the request state, and queues the next job.

## Provider Flow

```text
TMDB media details
-> request
-> Torznab search
-> release normalization
-> release scoring
-> Real-Debrid submit
-> Real-Debrid polling
-> unrestricted links
-> direct download
-> final file move
```

## Data Storage

SQLite stores:

- local admin account and sessions
- encrypted settings
- cached media metadata
- requests
- releases
- jobs
- downloaded file records

Provider tokens are encrypted with AES-256-GCM using `APP_SECRET`.

## Worker Modes

Development:

- automatic in-process worker starts after authenticated app layout loads
- manual `Run worker` button is available on request detail
- `npm run worker` can run a dedicated worker process

Production later:

- run web and worker as separate long-lived processes
- mount persistent SQLite and media folders
