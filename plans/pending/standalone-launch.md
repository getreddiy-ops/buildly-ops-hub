# FastTract standalone launch: consolidate, own the backend, Stripe, bring-your-own AI

Ticket: none yet. This plan is the source of truth until tickets exist.
Status: **approved by Morgan 2026-11-09**; Phase 1 in progress

## Where things stand (verified 2026-11-09)

- `main` = `2dc058b` (Oct 12). 36 branches; nothing after Oct 12 is merged.
- Vercel production (`fasttract-app`) runs `6150b94` from `codex/invoice-live-editor` (Oct 29). It was deployed by hand, not from `main`.
- Production is a stack: `working-web-release` ⊂ `fasttract-chatgpt-connection`; `manual-job-time` ⊂ `invoice-live-editor`. The stack does **not** contain `fasttract-chatgpt-connection` or `ios-submission-prep-20261026`.
- Merges onto `invoice-live-editor`: `fasttract-chatgpt-connection`, `remove-gohighlevel`, `prices-197-297-397-main` and `finish-release-deployment` merge cleanly. `ios-submission-prep` conflicts in `package.json`, `package-lock.json` and `src/integrations/supabase/types.ts`. `hyperagent/critical-security-and-ios-blockers` conflicts in `index.html` and `Info.plist`.
- `hyperagent/critical-security-and-ios-blockers` holds two tenant-isolation migrations, recorded as "applied" to the live DB, that are **missing from every current branch**:
  `20260918084720_close_critical_tenant_isolation_defects.sql` and `20260918085300_restrict_isolation_helper_execute_grants.sql`.
- Backend: Supabase project `qjusjfdrtposrthlcjeu`, which runs on Lovable Cloud and is not in Morgan's Supabase account. Lovable provides:
  the database, auth, storage and edge functions; AI (`ai.gateway.lovable.dev`); auth and transactional email (`@lovable.dev/email-js`, with a partial Resend path in `process-email-queue`); and Paddle (`connector-gateway.lovable.dev/paddle`). All of these run on `LOVABLE_API_KEY`.
- Subscriptions: Paddle, 7-day trial. Stripe is used only for Connect (customer pays an invoice or estimate). `codex/stripe-migration` (Jul 19, 195 commits behind) already sketches the Paddle → Stripe swap: checkout, portal, webhook and migration.
- AI call sites: `ai-assistant`, `ai-form-fill`, `estimate-from-photos`, `fasttract-message`, `phone-assistant-provision`.

## Phases

### Phase 1: One source of truth (main = production)
Verified when: `main` contains everything production runs plus the security migrations; a Vercel preview of `main` passes the smoke checklist; production deploys from `main` through the Git integration.
Files to touch: merge only, plus conflict files and the two migration files.

#### Step 1.1: Build `release/consolidation` from the production commit (Size: M)
- Acceptance criteria:
  - Branch starts at `6150b94` and merges `fasttract-chatgpt-connection`, `finish-release-deployment` and `ios-submission-prep-20261026` (conflicts resolved: `package.json` takes the union of dependencies; `types.ts` is regenerated, not hand-merged).
  - `npm test`, `npm run lint` and `npm run build` pass.
- Verification command: `npm ci && npm test && npm run lint && npm run build`
- Files likely touched: `package.json`, `package-lock.json`, `src/integrations/supabase/types.ts`
- Test seams: existing vitest suite (38 test files)
- Blocked by: none

#### Step 1.2: Recover the hyperagent security and correctness commits (Size: S)
- Acceptance criteria:
  - Both tenant-isolation migrations, the email sender-name fix and the iOS usage strings are cherry-picked onto `release/consolidation`.
  - Brand-token, font and theme commits are **not** taken (see Not yet specified).
- Verification command: `npm test && npm run build`; `grep -c tenant_isolation supabase/migrations/*`
- Files likely touched: `supabase/migrations/20260918*.sql`, `index.html`, `ios/App/App/Info.plist`, email sender config
- Test seams: build; migration replay in Phase 3.1
- Blocked by: 1.1

#### Step 1.3: Prove the older branches hold nothing unique (Size: S)
- Acceptance criteria:
  - For each of the other 27 branches, record "superseded" (its patch is already in `main` or the release branch) or "unique: <what>" in this plan's execution record.
  - Nothing is deleted. Branch cleanup is a separate decision for Morgan.
- Verification command: `git cherry -v release/consolidation origin/<branch>` per branch
- Files likely touched: this plan file
- Test seams: n/a
- Blocked by: 1.1

#### Step 1.4: PR to `main`, then deploy production from `main` (Size: S)
- Acceptance criteria:
  - The PR merges after Morgan's OK; the Vercel preview passes the smoke checklist (sign up, log in, create customer, estimate, invoice, public estimate link `/e/:token`, time clock).
  - Production is promoted from `main` (Morgan approves the promote).
- Verification command: Vercel `list_deployments target=production` shows the `main` SHA
- Files likely touched: none
- Test seams: preview smoke checklist
- Blocked by: 1.2, 1.3

### Phase 2: Remove GoHighLevel, set launch prices
Verified when: no `ghl`/`highlevel` code remains outside migrations and history; pricing shows $197 / $297 / $397.

#### Step 2.1: Merge `remove-gohighlevel` and `prices-197-297-397-main` (Size: S)
- Acceptance criteria:
  - Both merge into `main` through one PR; `git grep -il "ghl\|highlevel" -- src supabase/functions` returns only tests or migrations.
  - `tiers.ts` prices are 197/297/397. The checkout pause added in `remove-gohighlevel` stays in place until Phase 4 replaces it.
- Verification command: `npm test && npm run build && git grep -il "highlevel" -- src supabase/functions`
- Files likely touched: the 22 files in `remove-gohighlevel` plus `src/lib/tiers.ts`, pricing pages
- Test seams: `SalesPricing.test.tsx`, `Billing.test.tsx`
- Blocked by: 1.4

### Phase 3: Move the backend to Morgan's own Supabase (highest risk)
Verified when: the new project serves production; every user can log in; record counts per table match the export; no `LOVABLE_API_KEY` dependency remains for auth or email.

#### Step 3.1: Stand up the new project from repo migrations (Size: M)
- Acceptance criteria:
  - New Supabase project in Morgan's account (Morgan approves creation; free tier unless he says otherwise), region `us-west`.
  - All `supabase/migrations` apply cleanly in order.
  - The schema diff against a Lovable-side schema dump is empty or explained.
- Verification command: `supabase db push` then `supabase db diff` against the dump
- Files likely touched: `supabase/config.toml` (`project_id`), any migration that fails to replay
- Test seams: migration replay; Supabase advisors (`get_advisors` security) show no critical RLS findings
- Blocked by: 1.4, **3.0 (human)**

#### Step 3.0 (human): Morgan exports the Lovable Cloud data
- Morgan exports the database (schema and data), the auth users and the storage files from Lovable Cloud, then confirms each export file exists in the session.
- Blocked by: none. This can start right after approval.

#### Step 3.2: Replace Lovable email with Resend (Size: M)
- Acceptance criteria:
  - `auth-email-hook`, `process-email-queue`, `send-transactional-email`, `preview-transactional-email` and `handle-email-suppression` send through Resend with `RESEND_API_KEY`; no `@lovable.dev/email-js` imports remain.
  - Signup confirmation, password reset and a sent invoice email arrive from a `fasttract.org` sender (DNS records set by Morgan).
- Verification command: `git grep -l "@lovable.dev" -- supabase/functions` returns nothing; a test email is received
- Files likely touched: those five functions, `_shared/` email helper
- Test seams: function-level test of payload → Resend request; live send to Morgan's inbox
- Blocked by: 3.1

#### Step 3.3: Import data, auth users and storage; deploy functions (Size: M)
- Acceptance criteria:
  - Row counts per table match the export.
  - Storage buckets and objects are copied, and all edge functions deploy with secrets set (Stripe Connect, ElevenLabs, Twilio, Resend).
  - Auth users are imported. Without password hashes, every user gets a reset email at cutover.
- Verification command: per-table `count(*)` script vs export manifest; `supabase functions list`
- Files likely touched: `scripts/migrate-data.*` (new, one-off)
- Test seams: count script; log in as a test user
- Blocked by: 3.1, 3.0

#### Step 3.4: Cut production over (Size: S)
- Acceptance criteria:
  - Vercel env vars point to the new project (Morgan approves); the smoke checklist passes on production.
  - The Stripe Connect webhook URL is updated to the new functions URL (Morgan approves the Stripe change).
  - Lovable Cloud stays untouched for 14 days as a rollback.
- Verification command: production smoke checklist; `get_runtime_errors` is clean for 24h
- Files likely touched: none (environment only)
- Test seams: production smoke
- Blocked by: 3.2, 3.3

### Phase 4: Stripe subscriptions replace Paddle
Verified when: in Stripe test mode, the full path works (signup → 7-day trial → card → active → tier gates unlock → cancel through the portal → access ends at period end); no Paddle code remains.

#### Step 4.1: Port `codex/stripe-migration` onto current `main` (Size: M)
- Acceptance criteria:
  - Adds `create-stripe-checkout`, `stripe-customer-portal`, `stripe-webhook` and the `billing_provider` migration, adapted to current tables and the 197/297/397 tiers with a 7-day trial.
  - Removes `_shared/paddle.ts`, `usePaddleCheckout`, `paddle-customer-portal`, `get-paddle-price` and `payments-webhook` (Paddle). Lifts the checkout pause.
- Verification command: `npm test && npm run build`; Stripe CLI `stripe trigger customer.subscription.created` against the webhook
- Files likely touched: the 19 files on `codex/stripe-migration`, `src/lib/tiers.ts`, `useSubscription.ts`, legal pages (Paddle → Stripe wording)
- Test seams: `subscription-access.test.ts`, webhook handler unit test (new)
- Blocked by: 3.4

#### Step 4.2: Create Stripe products and switch to live (Size: S)
- Acceptance criteria:
  - Products and prices are created in test mode, then in live mode with Morgan's approval for each Stripe change.
  - Live keys are set as function secrets; one real $197 subscription is run end to end and refunded.
- Verification command: Stripe dashboard shows the subscription; the `organizations` row has `tier=base`
- Files likely touched: none (configuration)
- Test seams: live test transaction
- Blocked by: 4.1

### Phase 5: Bring-your-own AI
Verified when: with no key, every non-AI workflow works and AI surfaces say "Connect your AI"; with an OpenAI, Anthropic or Google key, the assistant, form fill and photo estimate each work; the key is never readable from the browser.

#### Step 5.1: Store the provider key server-side (Size: S)
- Acceptance criteria:
  - New `org_ai_connections` table (org_id, provider, model, encrypted key in Supabase Vault, last-4 only readable).
  - RLS: owners and admins of the org can write; no role can select the secret.
  - A `connect-ai` edge function validates the key with a 1-token test call before saving.
- Verification command: `npm test`; an SQL check that `select` on the secret as `authenticated` fails
- Files likely touched: new migration, `supabase/functions/connect-ai/`
- Test seams: RLS test via `execute_sql` as the authenticated role
- Blocked by: 3.4

#### Step 5.2: One provider adapter, all call sites through it (Size: M)
- Acceptance criteria:
  - `_shared/ai-provider.ts` exposes `chat()` and `vision()` for OpenAI, Anthropic and Google.
  - `ai-assistant`, `ai-form-fill`, `estimate-from-photos` and `fasttract-message` use it; no `ai.gateway.lovable.dev` remains.
  - With no key, the call returns 409 `ai_not_connected`.
- Verification command: `git grep -l "ai.gateway.lovable" -- supabase/functions` returns nothing; adapter unit tests per provider (mocked fetch)
- Files likely touched: `_shared/ai-provider.ts`, `_shared/ai-usage.ts`, the 4 functions
- Test seams: adapter unit tests; one live call per provider with Morgan's own keys
- Blocked by: 5.1

#### Step 5.3: Connect-AI screen and empty states (Size: S)
- Acceptance criteria:
  - Settings → AI: pick a provider, paste a key, see last-4 and status, disconnect.
  - Assistant, photo estimate and AI form helper show a "Connect your AI" prompt on 409 instead of an error.
- Verification command: `npm test` (new `AiConnection.test.tsx`); manual check at 390px width
- Files likely touched: `src/pages/app/Settings.tsx`, `FloatingAssistant.tsx`, `PhotoEstimateDialog.tsx`, `AiFormHelper.tsx`
- Test seams: component tests
- Blocked by: 5.2

### Phase 6: Launch check
Verified when: a fresh account on production completes, in order: signup → trial → connect AI → customer → photo estimate → send estimate → client pays the invoice through Stripe Connect → time entry → subscription charge. Runtime errors stay clean for 48h.
- Blocked by: 4.2, 5.3

## Decision log
| Decision | Chosen option | Why |
| --- | --- | --- |
| Plan scope | Consolidate, then launch | Morgan, 2026-11-09 |
| Subscription billing | Stripe; remove Paddle | Morgan: one provider, Stripe-only launch |
| AI | Bring-your-own at launch (OpenAI, Anthropic, Google) | Morgan, 2026-11-09 |
| Prices | $197 / $297 / $397 per month | Morgan; matches the latest branch |
| Backend | Move off Lovable Cloud to Morgan's own Supabase | Morgan: full control |
| Existing Paddle subscribers | None, so no customer migration | Morgan |
| Launch surface | Web first; app-store release is a later plan | Morgan |
| Base for consolidation | The production commit `6150b94`, not `main` | It is what customers run today; it avoids regressing production |
| Email after Lovable | Resend | A partial Resend path already exists in `process-email-queue` |

## Assumptions (correct any of these before approving)
1. Tier gates stay as they are: assistant on Plus and Premium, phone assistant on Premium. Bring-your-own AI does not unlock AI on the base tier.
2. The phone assistant keeps running on FastTract's own ElevenLabs and Twilio accounts. Bring-your-own covers text and vision AI only.
3. The brand-token, font and theme commits on `hyperagent/*` are left out of launch.
4. The new Supabase project starts on the free tier. Upgrading is Morgan's call.
5. If Lovable can't export password hashes, users reset their password once at cutover.

## Not yet specified
- Phase 3.0: fog. What Lovable Cloud lets Morgan export (full `pg_dump`? auth hashes? storage?) is researched at pickup and decides the shape of 3.3.
- Phase 3.2: which sender address (`hello@fasttract.org`?) and whether Morgan already has a Resend account.
- Phase 4.2: whether Stripe Tax is turned on (Paddle handled sales tax; Stripe does not unless Stripe Tax is enabled).

## Always / Never
- Always: work on branches and land them through PRs Morgan approves; keep `main` green; verify each step with its named command.
- Always: get Morgan's approval before any production deploy, Stripe change, env-var change, paid service or email to customers.
- Never: delete branches, Lovable Cloud data or production data in this plan.
- Never: store an AI key where the browser can read it.
- Never in this plan: App Store or Play Store submission, the brand redesign, new product features.

## Progress
| Phase | Status |
| --- | --- |
| 1. One source of truth | 1.1–1.3 done; 1.4 PR open, awaiting Morgan's merge + promote |
| 2. Remove GHL, set prices | not started |
| 3. Own Supabase | not started |
| 4. Stripe subscriptions | not started |
| 5. Bring-your-own AI | not started |
| 6. Launch check | not started |

## Execution record

### Phase 1 (2026-11-09)
- **1.1** `release/consolidation` = `6150b94` (production) + merges of `codex/fasttract-chatgpt-connection`, `codex/finish-release-deployment` and `codex/ios-submission-prep-20261026`.
  - `src/lib/mcp-edge.test.ts`: kept the chatgpt-connection version, which already contains every finish-release case plus the authentication and business-selection tests.
  - `package.json`: union of both sides (`@capacitor/*` pinned at 8.4.3 per iOS prep, plus `@electric-sql/pglite`); lockfile rebuilt with `npm install`.
  - `types.ts`: union of `record_manual_job_time` and the account-deletion functions. **Deviation:** combined by hand rather than regenerated, because the Lovable-hosted database is not reachable from here. It gets regenerated in Phase 3.1.
  - Result: 41 test files, 149 tests pass; build passes.
  - **Lint is not green and was not green before:** 240 errors on production `6150b94`, 239 on `main`, 244 on this branch (+4 brought in by the merged branches). 228 of them are `no-explicit-any`. Lint cleanup is not in this plan; the bar is "no new errors from our own changes".
- **1.2** Cherry-picked from `hyperagent/critical-security-and-ios-blockers`:
  - Both tenant-isolation migrations. No later migration re-creates the removed policies or grants. Every `organizations` column the app writes (Onboarding, Branding, BusinessProfile) is inside the new column grant.
  - The email sender name fix.
  - The two iOS keys the release lacked (`NSPhotoLibraryUsageDescription`, `ITSAppUsesNonExemptEncryption`). The newer iOS-prep wording for camera, location and microphone was kept.
  - Brand, theme and font commits were left out, per Assumption 3.
  - **Finding for Phase 3:** the migration header says the repo's migration history and the live database's history are "two different lineages" (54 files vs 26 applied, with different version stamps), so `supabase db push` against the live DB is unsafe. Phase 3.1 already diffs the replayed schema against a dump; that diff is now expected to be non-empty and must be reconciled table by table.
- **1.3** Older branches (`git cherry` against `release/consolidation`). Nothing was deleted.
  - Fully included already: `feat/fasttract-business-assistant`, `feat/folder-workspace`, `fix/mobile-permission-descriptions`, `claude/zen-hopper-flgj7u`, `finish-fasttract`, `codex/fix-live-login-routing`, `codex/full-site-readiness`, `codex/self-time-location-main`, `codex/launch-readiness-100`.
  - GoHighLevel work, superseded by the decision to drop GHL: `fix/fasttract-mcp-estimate-write`, `claude/wonderful-euler-g4o0s2`, `codex/highlevel-oauth-callback`, `chatgpt/finish-fasttract-deployment`, `chatgpt/fasttract-ghl-flawless`, `chatgpt/highlevel-primary-backend`, `chatgpt/fasttract-release-workflows` (its HighLevel workflows; the release already has newer deploy workflows).
  - Not product code: `export-fasttract-zip`.
  - Used later: `codex/stripe-migration` (Phase 4.1).
  - Older wording superseded by the current signup and pricing pages: `launch-hardening`. Out of scope as the brand redesign: `codex/fasttract-brand-site`.
  - **Unique features that never shipped (Morgan to decide; not in this plan):**
    - "Screen Takeover" mode, from the `codex/developer-admin-only` family (108 commits on an August lineage).
    - Complimentary-subscription date handling, from `codex/fix-comp-dates`. **Relevant to Phase 4** if comp accounts are given out.
    - State-aware document compliance guardrails, from `codex/state-compliance-guardrails` (19 files).
