# garmin-dashboard

Personal health and training dashboard built on top of Garmin Connect data.

Pulls daily health metrics and activities from Garmin, stores them in PostgreSQL, and exposes them through a typed REST API — so the history is mine, queryable, and not bound to what the official app decides to show.

## Status

Work in progress. Current state:

- [x] Ingestion script (Python) — extracts and normalizes Garmin data
- [x] Data model — Prisma schema and initial migration
- [x] Type layer — ingestion, domain and API contracts
- [ ] Seed — populate the database from an ingestion dump
- [ ] REST API endpoints
- [ ] Web dashboard
- [ ] Deployment

## Why this exists

The Garmin Connect app shows plenty, but it decides what and for how long. Historical windows are fixed, cross-domain questions aren't answerable, and the data isn't mine in any practical sense.

The questions I actually wanted to ask were things like: how does sleep quality on the previous night relate to pace on tempo runs? Does strength training volume show up in next-day recovery? What does HRV look like across a full training block, not just the last four weeks?

None of that is a feature request — it's a data problem. So the data goes into a database I control, and the analysis becomes a query instead of a screenshot.

## Architecture

```
Garmin Connect (behind Cloudflare)
        │
        ▼
Python ingestion script  ──►  JSON dump (raw, SI units)
        │
        ▼
PostgreSQL  ──►  Node/TypeScript API  ──►  React dashboard
```

### Why ingestion is Python and the API is TypeScript

Garmin has no public API. The community libraries that work do so by impersonating a browser's TLS fingerprint, and as of the March 2026 Cloudflare change, `python-garminconnect` is the only one maintaining that reliably. The Node equivalents either fail authentication or require driving a headless browser.

Rather than fight that in TypeScript, ingestion stays in Python and writes to the database. The API reads from the database and never talks to Garmin.

This is a boundary, not a workaround. It means the API and dashboard keep working when the unofficial integration breaks — which it will, since Garmin owes it nothing. The failure is contained to one replaceable component.

## Stack

| Layer      | Choice                          | Why                                                                                                   |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Ingestion  | Python + `python-garminconnect` | Only ecosystem with working Cloudflare bypass                                                         |
| API        | Node.js + TypeScript (ESM)      | End-to-end type safety from schema to response                                                        |
| Framework  | Fastify                         | First-class TypeScript support, schema-based validation, lower overhead than Express                  |
| ORM        | Prisma                          | Generated client stays in sync with the schema; migrations are versioned SQL you can read             |
| Validation | Zod                             | Runtime validation at the boundaries, with types inferred from the schemas rather than declared twice |
| Database   | PostgreSQL 17                   | Relational, time-series friendly, aggregate-heavy queries                                             |
| Frontend   | React                           | Planned                                                                                               |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- Docker
- Python 3.10+ (only for ingestion)

### Database and API

```bash
git clone <repo-url>
cd garmin-dashboard/api

cp .env.example .env       # fill in DATABASE_URL
docker compose up -d       # starts PostgreSQL
pnpm install
pnpm prisma migrate dev    # creates the schema
pnpm dev                   # http://localhost:3000
```

### Ingestion

```bash
cd ingestion

cp .env.example .env       # fill in Garmin credentials
pip install -r requirements.txt
python garmin_insights.py
```

Writes `output/garmin_data.json`. The file contains personal health data and is git-ignored — the seed reads it from disk, it is never committed.

Range is controlled by `SYNC_DEFAULT_DAYS` in `.env`. Note that request volume scales linearly with the window; `REQUEST_DELAY_SECONDS` throttles calls to stay clear of rate limiting.

## Project structure

```
garmin-dashboard/
├── api/          Node/TypeScript — REST API, Prisma schema, migrations
├── ingestion/    Python — Garmin extraction
├── web/          React dashboard (planned)
└── docs/         SPEC.md — requirements, data model, API contract
```

Separate `.env` files per component, by design: the API has no business holding Garmin credentials, and never receives them.

## API

Planned contract. See `docs/SPEC.md` for full request/response rules.

| Method | Route                | Description                                                |
| ------ | -------------------- | ---------------------------------------------------------- |
| `GET`  | `/health`            | Service and database status                                |
| `GET`  | `/v1/metrics/daily`  | Daily health metrics over a date range                     |
| `GET`  | `/v1/activities`     | Activities, filterable by sport and date, cursor-paginated |
| `GET`  | `/v1/activities/:id` | Single activity detail                                     |
| `GET`  | `/v1/summary/week`   | Weekly aggregates and week-over-week comparison            |
| `POST` | `/v1/sync/trigger`   | Trigger ingestion on demand                                |

Interactive documentation is served at `/docs` via Swagger.

## Design decisions

**No derived values are stored.** An earlier version of the ingestion script persisted a pre-computed pace. It was wrong — Garmin returns average _speed_ in m/s, and the code formatted it as if it were seconds per meter, producing paces of 37:59/km for an 8 km run. Every affected record had to be discarded. Distance and duration are now stored raw, in SI units, and pace is derived at read time. A wrong number in a database outlives the bug that produced it.

**Three type layers, on purpose.** Ingestion types describe the Python script's output (snake_case, no generated fields). Prisma types describe the database rows. Domain types describe what the API returns. Explicit mappers translate between them. This looks like duplication and isn't: each layer answers to a different owner, and collapsing them would let a rename in the ingestion script become a breaking change in the public API.

**Garmin vocabularies are stored as text, not enums.** `activity_type`, `hrv_status` and `readiness_level` come from Garmin, which adds values whenever it likes. A native Postgres enum would need a migration for each one, and ingestion would fail until then. The closed union lives in TypeScript, where changing it costs nothing. `sport` — a field this project owns — is the one that stays strictly constrained, and it's what filtering and aggregation use.

**Null, not zero, for activities without displacement.** A strength session reports `distance: 0` and `speed: 0`. Those aren't measurements, they're non-applicability, and leaving them as zeros would quietly drag down any distance or pace average.

**Partial failure is tolerated between records, not within one.** A malformed activity is logged and skipped; the rest of the sync proceeds and is recorded as `partial`. A malformed _split_ invalidates its whole activity — a run missing one kilometre produces silently wrong aggregates, which is worse than not having the run at all.

**Heart-rate zone boundaries are stored per activity.** They change when max HR is recalculated. Over a 60-day window this already happened — computing today's percentages against tomorrow's thresholds would misrepresent past training.

## Scope

Out of scope: authentication and multi-user support (single-user by design), writing data back to Garmin, mobile app, notifications.

Planned next: strength training as a first-class domain — session logging, cross-referencing volume against recovery metrics, and training suggestions derived from both.
