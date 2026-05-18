# NSLS Solutions

Internal portal for capturing, triaging, and routing automation/solution ideas
across NSLS. Front-end is a small set of static HTML pages; back-end is Vercel
serverless functions backed by Airtable and Vercel Blob, gated by OIDC against
`auth.nsls.org`.

## Pages

| Page | Audience | Purpose |
|---|---|---|
| `index.html` | Internal (auth required) | Triage queue — list, filter, score, delete ideas |
| `intake.html` | Internal (auth required) | Submit a new idea (with attachments) |
| `triage.html` | Internal (auth required) | Open a single idea for review/assignment |
| `capacity.html` | Internal (auth required) | Builders set their capacity signal; overview table |
| `submit.html` | **Public** | External partners submit ideas without logging in |

All authenticated pages call `/api/auth/session` on load and redirect to
`/api/auth/login` if the session is missing or expired.

## API routes

All routes live under `api/` and run as Vercel serverless functions.

### Auth (OIDC + PKCE)

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | GET | Start OIDC flow; sets `_oidc_state` cookie with PKCE verifier + nonce |
| `/api/auth/callback` | GET | Exchange code, verify ID token via JWKS, mint 8h `nsls_session` JWT |
| `/api/auth/session` | GET | Returns `{ sub, email, name }` if cookie is valid; 401 otherwise |
| `/api/auth/logout` | GET | Clear session cookie + redirect |

### Data (Airtable base `appd1hcbJXgvVXF05`)

| Route | Method | Table | Reads | Writes |
|---|---|---|---|---|
| `/api/ideas` | GET | `Ideas` | List w/ `?status=`, `?source=`, `?limit=`, `?offset=` | — |
| `/api/idea?id=...` | GET / PATCH / DELETE | `Ideas` | Single record | Partial update or delete |
| `/api/intake` | POST | `Ideas` | — | New record (internal form) |
| `/api/external` | POST | `Ideas` | — | New record (public form) |
| `/api/builders` | GET | `Builders` | `Name`, `Email`, `Builder level`, `Department`, `Capacity signal`, `Capacity last updated` | — |
| `/api/capacity` | PATCH | `Builders` | — | `Capacity signal`, `Capacity last updated` |
| `/api/upload` | POST | `Ideas` | Existing `Attachments` | Appends to `Attachments` (after uploading file to Vercel Blob) |

#### `Ideas` fields written by intake routes

`Idea`, `Description`, `Intake source`, `Status`, `Submitter status`,
`Submitted on`, `Notify submitter on next status change?`, `Source`,
`Solution type`, `Affected teams`, `Reference links`, `Time saved`,
`Cost savings`, `Revenue impact`, `Notes`, `Submitted by`,
`Related NSLS contact`, `External submitter name`, `External submitter org`,
`Attachments`.

> **Note:** the API routes do **not** independently enforce auth — that is
> currently the page's responsibility. Treat `/api/intake`, `/api/ideas`,
> `/api/idea`, `/api/builders`, `/api/capacity`, and `/api/upload` as
> internal-only until a server-side session check is added.

## Environment variables

| Var | Used by | Purpose |
|---|---|---|
| `AIRTABLE_API_KEY` | all data routes | Airtable PAT with read/write on base `appd1hcbJXgvVXF05` |
| `SESSION_SECRET` | `auth/callback.js`, `auth/session.js` | HS256 key for the `nsls_session` JWT (required — missing value returns 500) |
| `OIDC_CLIENT_ID` | `auth/login.js`, `auth/callback.js` | OIDC client at `auth.nsls.org` |
| `OIDC_CLIENT_SECRET` | `auth/callback.js` | OIDC client secret |
| `OIDC_REDIRECT_URI` | `auth/callback.js` | Defaults to `https://nsls-solutions.vercel.app/api/auth/callback` |
| `BLOB_READ_WRITE_TOKEN` | `api/upload.js` (via `@vercel/blob`) | Vercel Blob write access for attachment storage |

## Scripts

| Script | Purpose |
|---|---|
| `setup_schema.py` | One-time: provision the Airtable base schema |
| `sync_builders.py` | Sync `Builders` table from the legacy NSLS base (`appd5oK1wLVPYZeia`) — matches on email, skips existing |

Both expect `AIRTABLE_API_KEY` in the environment.

## Deploy

Deployed via Vercel. Routes from `vercel.json`; runtime deps in `package.json`
(`jose`, `@vercel/blob`).

```sh
npx vercel --prod
```
