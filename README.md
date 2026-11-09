# FastTract

FastTract is a personal AI business operating system covering customers, work,
money, company operations, and AI-assisted everyday workflows.

## Revenue funnel

1. Visitor picks a plan on `/pricing` and signs up.
2. Company onboarding creates an owner-scoped organization.
3. The office app sends a business with no active plan to Plan & billing (`/app/billing`).
4. The owner starts a 7-day Stripe trial (card required, one trial per business) through `create-stripe-checkout`.
5. `stripe-webhook` writes the subscription row; the office app unlocks.
6. Pro and Enterprise unlock the AI features, which run on the business's own AI key (Settings → AI).

## Local verification

```powershell
npm install
npm run test
npm run lint
npm run build
```

## AI is optional to the core Contractor OS

Customer, job, estimate, invoice, scheduling, and team workflows must remain
usable without an AI provider. Ask AI, photo estimating, and phone-assistant
features may require separately configured providers. Treat customer-owned
AI provider connections as a later milestone; keep provider credentials on the
server and never store them in browser storage.

## Deployment

FastTract is a Vite + React single-page app (`vercel.json` declares
`"framework": "vite"`) backed by Supabase (Postgres, Auth, Storage, Edge
Functions). There is no Next.js server and no `/api` directory -- all
backend logic lives in `supabase/functions/`.

**Frontend**: connect this GitHub repo to a Vercel project (Vercel
auto-detects the Vite framework from `vercel.json`) and every push to `main`
deploys automatically -- no custom build config needed. The `.env` /
`.env.production` files already committed to this repo contain the real,
non-secret `VITE_*` values (an anon Supabase key and the Stripe test/live
mode flag), so a from-scratch Vercel import builds correctly with zero extra
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
| `VITE_STRIPE_ENV` | Frontend build | Required (committed) | `sandbox` while Stripe runs on test keys, `live` after launch. Must match `STRIPE_ENV`. |
| `STRIPE_SECRET_KEY` | billing functions, `admin-support`, `stripe-connect` | Required for billing | Stripe dashboard -> Developers -> API keys. Test key (`sk_test_`) until launch. |
| `STRIPE_ENV` | billing functions | Required for billing | `sandbox` or `live`; tags subscription rows so test and live never mix. |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Required for billing | Stripe -> Developers -> Webhooks -> endpoint `/functions/v1/stripe-webhook`, events `customer.subscription.created/updated/deleted`. |
| `STRIPE_PRICE_BASIC_MONTHLY`, `STRIPE_PRICE_BASIC_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_YEARLY` | billing functions | Required for billing | Stripe price ids (`price_...`) for $197/$1,970, $297/$2,970, $397/$3,970. Catalog: `supabase/functions/_shared/plans.ts`. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | email functions | Required for email | Resend API key and a verified sender, e.g. `FastTract <noreply@fasttract.org>`. |
| `SEND_EMAIL_HOOK_SECRET` | `auth-email-hook` | Required for sign-up/reset emails | Supabase -> Authentication -> Hooks -> Send Email (HTTPS) pointing at `/functions/v1/auth-email-hook`; paste the generated `v1,whsec_...` secret. |
| `RESEND_WEBHOOK_SECRET` | `handle-email-suppression` | Recommended | Resend -> Webhooks -> endpoint `/functions/v1/handle-email-suppression`, events `email.bounced`, `email.complained`. |
| `EMAIL_PREVIEW_SECRET` | `preview-transactional-email`, `auth-email-hook/preview` | Optional | Any long random string; lets staff preview email templates. |
| (none) | AI features | -- | Bring-your-own AI: each business connects its own OpenAI, Anthropic or Google key in Settings -> AI. Keys are stored in Supabase Vault (`org_ai_connections`), never in an env var, and FastTract never pays for customer AI usage. |
| `TWILIO_AUTH_TOKEN` | `twilio-voice-webhook` | Required for phone | Twilio Console -> Account -> verifies inbound webhook signatures. |
| `TWILIO_ACCOUNT_SID` | `phone-assistant-provision`, `send-document`, `fasttract-message` | Required for phone/SMS | Twilio Console -> Account info. With `TWILIO_AUTH_TOKEN`, FastTract calls Twilio directly (the Lovable Twilio gateway is not used off Lovable Cloud). |
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

## Connect ChatGPT to native FastTract

The native MCP endpoint is
`https://qjusjfdrtposrthlcjeu.supabase.co/functions/v1/mcp`.
It uses FastTract sign-in and the caller's existing database RLS permissions;
it does not use the old white-label CRM connection or a shared admin key.

Production setup (the code alone does not enable the authorization server):

1. In Supabase **Authentication → OAuth Server**, enable OAuth and set the
   authorization path to `/.lovable/oauth/consent`.
2. Ensure **Authentication → URL Configuration → Site URL** is the live
   FastTract frontend (`https://fasttract-app.vercel.app` until custom-domain
   DNS has been verified). The consent page must be served from that origin.
3. Register the ChatGPT OAuth client using its exact callback URL, or enable
   dynamic registration if using ChatGPT's automatic registration flow.
   Client registration does not itself approve data access; each person must
   sign in and approve the connection.
4. Add the MCP endpoint as a custom ChatGPT connection and choose OAuth.
   Morgan and Branden each authorize their own FastTract account.
5. Test `list_organizations`, choose the intended business, then test a
   read-only query before previewing any writes.

OAuth resource metadata and tool descriptions are public; all data calls
validate the user with Supabase Auth. Missing or invalid tokens receive a
401 with OAuth discovery metadata. The `mcp` function intentionally performs
its own authentication so discovery can work before sign-in. Every data call
rechecks business membership, and office writes require owner/admin access.
If someone belongs to multiple businesses, calls must supply `organization_id`
from `list_organizations`; the server refuses to guess. No server-wide active
business or shared user session is stored.

Available tools cover businesses, customers, jobs, estimates, invoices,
clock-in/out, and customer messages. Writes use a preview/confirmation step.
`mark_invoice_paid` records a payment already received; it does not transfer
funds. Payroll processing and bank transfers are not implemented by these tools.

Do not commit Supabase service-role keys, Stripe secrets, Twilio credentials, or
other production secrets. Public client tokens belong only in the documented
frontend environment variables; server secrets belong in Supabase function
secrets or the hosting provider.

