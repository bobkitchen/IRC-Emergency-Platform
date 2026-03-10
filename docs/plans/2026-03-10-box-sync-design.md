# Box → Supabase Classification Sync

**Status:** Planning
**Date:** 2026-03-10
**Context:** Classifications are managed in an Excel spreadsheet stored at a fixed Box folder location. We want to automatically ingest new rows into Supabase.

---

## Architecture

```
Box (Excel file) → Supabase Edge Function → Supabase DB (classifications)
                   triggered by pg_cron or manual button
```

The Edge Function downloads the Excel file, parses it with SheetJS (same logic as admin import), diffs against existing DB rows, and upserts new/changed records.

---

## Route A: Shared Link (Simplest)

**How:** If the Excel file has a Box shared link, we can derive a direct download URL and fetch it without any authentication.

**Pros:**
- Zero auth setup — just store the download URL as an Edge Function secret
- Can prototype in an hour

**Cons:**
- Fragile — if the shared link changes or expires, sync breaks silently
- No audit trail on Box side
- File must remain publicly shared (or password-shared)

**Implementation:**
1. Edge Function fetches `https://api.box.com/2.0/shared_items` with the shared link header
2. Gets file ID → downloads content via `/files/{id}/content`
3. Parses with SheetJS, diffs, upserts

---

## Route B: Client Credentials Grant (Recommended)

**How:** Create a Box Custom App with CCG auth. The Edge Function exchanges `client_id` + `client_secret` for an access token, then uses the Box API to download the file by its known file ID.

**Pros:**
- Stable — uses file ID, not a shared link
- Secure — server-to-server, no user session needed
- Auditable — Box logs API access
- Token auto-refreshes (2-legged OAuth)

**Cons:**
- Requires Box admin to create and authorize a Custom App
- One-time setup of ~30 minutes in Box Developer Console

**Implementation:**
1. Box admin creates Custom App → gets `client_id` + `client_secret`
2. Box admin authorizes the app for the enterprise
3. Store credentials as Supabase Edge Function secrets
4. Edge Function: POST `https://api.box.com/oauth2/token` with CCG grant → get access token
5. GET `https://api.box.com/2.0/files/{FILE_ID}/content` → download Excel
6. Parse, diff, upsert

**Box setup steps:**
- Go to https://app.box.com/developers/console
- Create New App → Custom App → Client Credentials Grant
- Note the Client ID and Client Secret
- Under Authorization, submit for admin approval
- Once approved, note the Enterprise ID

---

## Route C: JWT App (Most Robust)

**How:** Similar to CCG but uses RSA keypair for authentication. More common in enterprise Box integrations.

**Pros:**
- Most battle-tested auth method for Box server-to-server
- Can impersonate users if needed

**Cons:**
- More complex setup (RSA keypair generation, JSON config file)
- Requires Box admin authorization
- Overkill for a single-file sync

**Recommendation:** Skip this unless CCG is unavailable for policy reasons.

---

## Route D: Box Webhook (Real-time)

**How:** Box sends a webhook to our Edge Function URL whenever the file is modified. The function then downloads and syncs.

**Pros:**
- Near-instant sync — no polling delay
- No cron schedule needed

**Cons:**
- Requires Box admin to configure webhook
- Need to handle webhook verification (Box sends a challenge)
- Must combine with one of Routes A/B/C for the actual file download
- Webhook URL must be publicly accessible (Edge Functions are, so this works)

**Best as:** An add-on to Route B, not a standalone approach.

---

## Scheduling Options

### pg_cron (Recommended)
```sql
-- Run daily at 6:00 UTC
select cron.schedule(
  'sync-classifications',
  '0 6 * * *',
  $$ select net.http_post(
    'https://qykjjfbdvwqxqmsgiebs.supabase.co/functions/v1/sync-classifications',
    '{}',
    'application/json'
  ) $$
);
```

### Manual trigger from Admin Dashboard
- "Sync Now" button on the Dashboard tab
- Calls the same Edge Function on demand
- Shows last sync time + result

### Both (Recommended)
- pg_cron for daily automated sync
- Manual button for on-demand sync after known spreadsheet updates

---

## Diff/Dedup Strategy

Reuse the existing logic from `admin/index.html` `performImport()`:

1. **Primary key:** `classification_id` + `reclassification_number`
2. **Fallback key:** `country` + `date` + `emergency_name`
3. **New rows:** Insert with generated UUID
4. **Changed rows:** Compare key fields (stance, severity, type) — upsert if different
5. **Deleted rows:** Do NOT delete from Supabase (spreadsheet may have filtered views)

---

## Edge Function Structure

```
supabase/functions/sync-classifications/
├── index.ts          — Entry point, auth, orchestration
├── box-client.ts     — Box API auth + file download
└── excel-parser.ts   — SheetJS parsing (port from admin handleExcelFile)
```

**Secrets needed:**
- `BOX_CLIENT_ID` (for Route B)
- `BOX_CLIENT_SECRET` (for Route B)
- `BOX_FILE_ID` — the stable file ID of the Excel spreadsheet
- Or `BOX_SHARED_LINK` (for Route A)

---

## Admin Dashboard Integration

Add to Dashboard tab:
- **Last Sync:** timestamp of most recent successful sync
- **Sync Result:** "142 new, 3 updated, 0 errors"
- **Sync Now** button (calls Edge Function)
- **Sync History** (last 10 runs, stored in a `sync_log` table)

---

## Recommended Path

1. **Quick win (Route A):** If the file has a shared link, build the Edge Function + manual "Sync Now" button in an afternoon
2. **Production (Route B + cron):** Set up Box CCG app, add pg_cron schedule, add sync logging
3. **Optional (Route D):** Add Box webhook for real-time sync on top of Route B

---

## Open Questions

- [ ] Is the Box file shared via a link? What's the URL?
- [ ] Do we have Box admin access to create a Custom App?
- [ ] Is the file always the same file ID, or does a new file get uploaded periodically?
- [ ] Should sync run daily, or more frequently?
- [ ] Should we sync deletions (rows removed from spreadsheet)?
