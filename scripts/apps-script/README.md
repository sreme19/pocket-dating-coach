# Snap lead sheet → Supabase sync (Apps Script)

The delivery path of record for **Snap lead-form** leads. Snap's Marketing API
webhook never fires (see `ad-management-agent/rules/lead-delivery.md`), so its
only working integration is the native **Google Sheets "Direct integration"**,
connected per form in Ads Manager. This pushes one row per submission into a
per-form sheet. This folder is how those rows reach `marketing_leads`.

```
Snap lead form ──► Google Sheet (per form) ──► Apps Script (every 30 min)
                                                     │  POST {rows:[…]}
                                                     ▼
              /api/marketing/snap-sheet-sync ──► recordAdLead() ──► marketing_leads
                                              └─► recordLeadSubmission() ──► marketing_lead_submissions (audit)
```

## Pieces

- **`snap-sheet-sync.gs`** — the tracked copy of the script that runs *inside the
  sheet*. Paste it into the sheet's Apps Script editor.
- **`src/routes/api/marketing/snap-sheet-sync/+server.ts`** — the receiver. Auth
  by shared secret, idempotent (dedupes on lead-id / phone / email), skips Snap
  test rows, and counts every delivered row in `marketing_lead_submissions`.

## Setup (per lead sheet)

1. **Server secret** — set `SNAP_SHEET_SYNC_SECRET` in the Vercel project env
   (all environments). Generate one with:
   ```bash
   openssl rand -hex 32
   ```
2. **Verify the endpoint** is deployed and configured:
   ```bash
   curl -s https://www.riteangle.dating/api/marketing/snap-sheet-sync   # → "ok"
   ```
3. **In the sheet** → Extensions → Apps Script → paste `snap-sheet-sync.gs`.
4. **Script properties** (Project Settings → Script properties):
   - `ENDPOINT_URL` = `https://www.riteangle.dating/api/marketing/snap-sheet-sync`
   - `SYNC_SECRET`  = the same value as `SNAP_SHEET_SYNC_SECRET`
5. Run **`installTrigger()`** once (grants perms, creates the 30-min trigger).
6. Run **`syncSnapLeads()`** once to backfill; check the execution log for the
   server's summary line (`{received, stored, duplicate, …}`).

## Notes

- **Idempotent.** Re-sending a row is safe; the server keeps one row per person.
  `resetSyncPointer()` forces a full re-send (e.g. after fixing a column mapping).
- **One sheet per form.** Each new Snap lead ad gets its own sheet and its own
  copy of the script + properties. The receiver is shared.
- **Column matching is by header text**, not position, so reordering columns in
  the sheet is fine. If Snap renames a header, update `COLUMN_MAP` in the `.gs`.
- **Reconciliation still stands.** This closes the delivery gap, but the daily
  readout must still compare `marketing_lead_submissions` (our echo of Snap's
  count) against the Ads Manager number — see `ad-leads-daily`.
