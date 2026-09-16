# FastTract

FastTract is a personal AI business operating system covering customers, work,
money, company operations, and AI-assisted everyday workflows.

## Revenue funnel

1. Visitor chooses a plan or starts from the landing page.
2. Account creation confirms the user will review pricing before payment.
3. Company onboarding creates an owner-scoped organization.
4. The owner returns to pricing and starts a 7-day Paddle trial.
5. The Paddle webhook writes the organization subscription to Supabase.
6. Subscription gates unlock the plan's features.

## Local verification

```powershell
npm install
npm run test
npm run lint
npm run build
```

## Deployment

FastTract is a Vite + React single-page app (`vercel.json` declares
`"framework": "vite"`) backed by Supabase (Postgres, Auth, Storage, Edge
Functions). There is no Next.js server and no `/api` directory -- all
backend logic lives in `supabase/functions/`.

**Frontend**: connect this GitHub repo to a Vercel project (Vercel
auto-detects the Vite framework from `vercel.json`) and every push to `main`
deploys automatically -- no custom build config needed. The `.env` /
`.env.production` files already committed to this repo contain the real,
non-secret `VITE_*` values (an anon Supabase key and a publishable Paddle
token), so a from-scratch Vercel import builds correctly with zero extra
environment configuration. `.github/workflows/deploy-vercel-production.yml`
is an alternative, manual, confirmation-gated path for pushing a specific
commit to production on demand (useful if native Git integration isn't set
up, or you want an auditable one-off deploy).

**Backend**: two separate, manually-triggered GitHub Actions workflows own
the Supabase side, since Vercel deploying the frontend has no effect on
Supabase:
- `.github/workflows/deploy-supabase-production.yml` -- applies pending
  database migrations (`supabase db push`).
- `.github/workflows/deploy-supabase-functions.yml` -- syncs Edge Function
  secrets from GitHub Actions secrets and deploys every function under
  `supabase/functions/`.

Run migrations before deploying functions that depend on new columns/tables.
Both require `SUPABASE_ACCESS_TOKEN` (personal access token from
supabase.com/dashboard/account/tokens); the migrations workflow additionally
needs `SUPABASE_DB_PASSWORD` (project Settings -> Database).

### Production environment variables

| Variable | Where used | Required? | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Frontend build | Required (already committed) | Supabase client connection. Anon key -- safe client-side, RLS enforces access. |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Frontend build | Required (already committed) | Paddle.js client-side checkout token. |
| `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` | `ghl-oauth-start`, `ghl-oauth-callback` | Required for GHL | From your GoHighLevel Marketplace App (marketplace.gohighlevel.com -> My Apps). |
| `GHL_STATE_SECRET` | `ghl-oauth-start`, `ghl-oauth-callback` | Required for GHL | Any random string (`openssl rand -hex 32`) -- internal only, signs the OAuth handoff. Never sent to GHL. |
| `GHL_REDIRECT_URI` | `ghl-oauth-start` | Optional | Override if your Marketplace App's redirect URI differs from `https://<project-ref>.supabase.co/functions/v1/ghl-oauth-callback`. |
| `GHL_SCOPES` | `ghl-oauth-start` | Optional | Override the default OAuth scope list. |
| `GHL_SUCCESS_URL`, `GHL_ERROR_URL` | `ghl-oauth-callback` | Optional | Where to redirect after connect; default is `app.fasttract.org/app/preferences`. |
| `GHL_USER_TYPE` | `ghl-oauth-callback` | Optional | Defaults to `Location`. |
| `LOVABLE_API_KEY` | `ai-assistant`, `estimate-from-photos`, Paddle/Twilio gateway calls | Required unless `OPENAI_API_KEY` is set | Lovable's connector gateway key -- used as the AI/Paddle/Twilio proxy when no direct provider key is configured. |
| `OPENAI_API_KEY` | `ai-assistant`, `estimate-from-photos` | Optional | If set, calls OpenAI directly instead of the Lovable AI Gateway. |
| `PADDLE_SANDBOX_API_KEY`, `PADDLE_LIVE_API_KEY` | `get-paddle-price`, `paddle-customer-portal` | Required for billing | Paddle dashboard -> Developer Tools -> Authentication. FastTract's own SaaS subscription billing only -- never customer invoices. |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `PAYMENTS_LIVE_WEBHOOK_SECRET` | `payments-webhook` | Required for billing | Paddle dashboard -> Developer Tools -> Notifications -> your webhook destination. |
| `TWILIO_AUTH_TOKEN` | `twilio-voice-webhook` | Required for phone | Twilio Console -> Account -> verifies inbound webhook signatures. |
| `TWILIO_API_KEY` | `phone-assistant-provision`, `send-document` | Required for phone | Lovable connector API key for outbound Twilio calls (buying numbers, sending SMS) via the Lovable gateway. |
| `ELEVENLABS_API_KEY` | `phone-assistant`, `phone-assistant-token` | Required for phone | ElevenLabs Voice AI agent (Premium tier). |
| `ELEVENLABS_VOICE_ID` | `phone-assistant` | Optional | Default voice for new phone assistants. |
| `ELEVENLABS_WEBHOOK_SECRET` | `elevenlabs-postcall` | Required for phone | Verifies the post-call webhook signature. |
| `PUBLIC_APP_URL` | `send-document` | Optional | Base URL used to build customer-facing estimate links (`/e/:token`); defaults to `https://app.fasttract.org`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | every Edge Function | Auto-provided | Injected automatically by the Supabase Edge Functions runtime -- never set these manually. |

Deploy-only secrets (GitHub Actions, not read by the app itself):
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (Vercel dashboard ->
Settings -> Tokens / project settings), `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`.

## Android and iPhone

Native packaging is configured with Capacitor. See
[MOBILE_RELEASE.md](./MOBILE_RELEASE.md) for build, signing, device-test, and
store-submission requirements.

Do not commit Supabase service-role keys, Paddle secrets, Twilio credentials, or
other production secrets. Public client tokens belong only in the documented
frontend environment variables; server secrets belong in Supabase function
secrets or the hosting provider.

