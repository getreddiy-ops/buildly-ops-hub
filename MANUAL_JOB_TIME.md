# Manual past job time

Owners and company admins can open **Time Tracking → Add past time**, select
themselves or a current company member, select a job (including completed jobs),
and enter past start/end dates and times plus an optional note. Times use the
device timezone shown in the form and are saved as UTC timestamps.

Entries are pending and use the existing Approvals process. The table switches
to All time after saving so an older entry is visible. Manual entries show the
recorder and note and do not claim a GPS location.

The database checks the acting user's owner/admin membership, target worker
membership and job company. It rejects future/reversed/nonfinite times and
overlap with an existing non-rejected entry (including an open shift). Adjacent
shifts are allowed. A request ID makes retrying the same save idempotent. Source
and recorder are immutable; recorder becomes null if its Auth user is deleted.
Workers cannot create or modify manual entries through the API. Existing personal
clock inserts and the separate Studio `time_entries` table are preserved.

## Deployment order

1. Review and apply only the new migration
   `supabase/migrations/20261028084743_add_manual_job_time_entries.sql` to the
   intended FastTract environment. Do not apply unrelated pending migrations
   automatically. No customer time records need to be modified or seeded.
2. Deploy the matching web source after the migration succeeds.
3. On a test company, sign in as owner, record past time for yourself and a worker
   on a completed job, verify recorder/date/hours, and approve it. Verify worker
   denial, cross-company denial, an overlapping shift, and a retry. Repeat on a
   phone or the iOS build before releasing that build.

## Verification

`npm test` runs UI and date/time tests. `npm run test:manual-time-db` exercises
the real migrations inside an isolated PGlite PostgreSQL database with owner,
admin, worker, outsider, and anonymous roles. It does not contact production.
The PR quality workflow also runs TypeScript, targeted lint, and the web build.

This feature requires registered company members. Pending invitations cannot
receive hours until their FastTract account has joined the company. Time is not
automatically approved or exported to payroll by this form.
