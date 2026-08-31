# FastTract inside HighLevel

FastTract is the contractor-facing product. HighLevel supplies the CRM, communications, calendars, estimates, invoices, payments, workflows, and location tenancy behind it.

## Product rule

A contractor enters FastTract through one HighLevel Custom Page menu item. Internal FastTract navigation stays inside that page:

- Home
- Leads
- Jobs
- Money
- AI

Do not create a separate HighLevel menu item for every FastTract module. The embedded workspace must retain the FastTract evergreen/silver design, contractor language, Ava assistant, mobile bottom navigation, and single-scroll layout.

## Storage map

| FastTract feature | HighLevel record |
| --- | --- |
| Customers | Contacts tagged `fasttract-customer` |
| Leads | Contact + Opportunity in `FastTract Sales` |
| Calls, SMS, email | Conversations |
| Appointments | Calendars |
| Estimates | Native Estimates |
| Invoices and payments | Native Invoices / Payments |
| Jobs | `custom_objects.jobs` |
| Time entries | `custom_objects.time_entries` |
| Materials | `custom_objects.materials` |

Supabase stores backend-only HighLevel OAuth installation records and legacy FastTract records that have not yet been intentionally migrated. Browser clients never receive HighLevel access tokens, refresh tokens, the Supabase service-role key, or the credential-encryption key.

## Embedded authentication

1. HighLevel loads `/highlevel` in its Custom Page iframe.
2. The browser requests encrypted user context from the parent window with `REQUEST_USER_DATA`.
3. The encrypted payload is sent to FastTract APIs in `X-FastTract-GHL-Context`.
4. The server decrypts the payload with `GHL_APP_SHARED_SECRET`.
5. The server reads the signed `companyId`, `userId`, and `activeLocation`.
6. The server loads the OAuth installation for that company/location from `ghl_connections`.
7. Every HighLevel API request runs with a location-scoped token for the signed active location.

A `location_id` URL parameter is never authentication and must never be used to authorize data access.

## OAuth credential encryption

OAuth credentials are encrypted before storage with AES-256-GCM and a versioned envelope beginning with:

```text
ft-ghl:v1:
```

The encryption contract is shared by the Vercel Node runtime and the Supabase Edge OAuth callback:

- the configured `GHL_TOKEN_ENCRYPTION_KEY` is hashed with SHA-256 to derive the 256-bit key;
- each credential gets a new 12-byte random IV;
- the authentication tag is stored with the ciphertext;
- the envelope is base64url encoded;
- decryption happens only in server memory;
- plaintext credentials are never returned to a browser or logged.

Legacy plaintext rows remain readable only for controlled migration. They are encrypted on first backend use or by the one-time backfill script. `credential_version = 1` marks the encrypted envelope.

## OAuth lifecycle

`ghl_connections` is backend-only and contains:

- company and location identifiers;
- encrypted access token;
- encrypted rotating refresh token;
- token expiration;
- granted scopes;
- HighLevel user and installation metadata;
- encryption-envelope version and timestamp.

The server refreshes credentials before expiration, stores both the new access token and the rotated refresh token as new ciphertext, and retries one failed HighLevel request after a `401`. Concurrent refreshes are serialized in-process. Database updates use optimistic concurrency so a losing server instance reloads the newest rotated credentials instead of overwriting them.

A company-level bulk installation is exchanged for a location-scoped token when a signed active location first opens FastTract. On a signed HighLevel `UNINSTALL` webhook, location or company credentials are deleted.

## Required production configuration

Vercel server variables:

```text
GHL_APP_SHARED_SECRET=
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GHL_TOKEN_ENCRYPTION_KEY=
FASTTRACT_READINESS_SECRET=
```

AI requires one server-side provider configuration:

```text
LOVABLE_API_KEY=
# or
OPENAI_API_KEY=

# optional overrides
FASTTRACT_AI_GATEWAY_URL=
FASTTRACT_AI_MODEL=
```

Supabase Edge function secrets:

```text
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_TOKEN_ENCRYPTION_KEY=
```

`GHL_TOKEN_ENCRYPTION_KEY` and `FASTTRACT_READINESS_SECRET` must each contain at least 32 characters. The same encryption key must be configured in Vercel and the Supabase OAuth callback.

Single-location development mode is explicitly opt-in and must be disabled for the SaaS deployment:

```text
GHL_SINGLE_LOCATION_MODE=false
```

Local testing only:

```text
GHL_SINGLE_LOCATION_MODE=true
GHL_LOCATION_ID=
GHL_LOCATION_TOKEN=
```

## HighLevel scopes

The embedded build currently needs:

```text
contacts.readonly
contacts.write
opportunities.readonly
opportunities.write
locations.readonly
invoices/estimate.readonly
invoices/estimate.write
invoices.readonly
invoices.write
objects/schema.readonly
objects/schema.write
objects/record.readonly
objects/record.write
locations/customFields.readonly
locations/customFields.write
oauth.write
```

Do not request calendar, conversation, payment, phone, snapshot, company-management, custom-menu-link, or SaaS-management scopes until a shipped FastTract feature actually calls those APIs.

## Bootstrap

`POST /api/highlevel/bootstrap` is idempotent and prepares the active signed location:

- creates the `FastTract Sales` pipeline when missing;
- creates Jobs, Time Entries, and Materials custom-object schemas when missing;
- creates the FastTract custom-field folders and fields when missing.

Bootstrap failures are returned per module so a partial setup cannot masquerade as a complete installation.

## API surface

```text
GET  /api/highlevel/context
GET  /api/highlevel/readiness        # protected operational check
POST /api/highlevel/bootstrap
POST /api/highlevel/ai-form-fill

GET/POST/PUT/DELETE       /api/highlevel/contacts
GET/POST/PATCH/PUT/DELETE /api/highlevel/leads
GET/POST                  /api/highlevel/opportunities
GET/POST/PUT/DELETE       /api/highlevel/estimates
POST                      /api/highlevel/estimate-actions
GET/POST                  /api/highlevel/invoices
GET/POST/PUT/DELETE       /api/highlevel/records?object=jobs|time_entries|materials
```

The browser calls only FastTract APIs. It never calls `services.leadconnectorhq.com` with a secret token.

## Protected readiness check

`GET /api/highlevel/readiness` requires:

```text
X-FastTract-Readiness-Secret: <FASTTRACT_READINESS_SECRET>
```

An unauthorized request returns `404`. An authorized request verifies production secrets, database connectivity, the credential schema, and the ability to decrypt every stored HighLevel credential. It returns only aggregate counts:

- total connections;
- encrypted connections;
- legacy connections awaiting backfill;
- invalid/decryption failures;
- whether backfill is required.

It never returns credential values.

## Ava and estimates

The embedded AI form endpoint authenticates with the same signed HighLevel context as the rest of the workspace. It does not require a second Supabase login.

Ava may extract and organize user-provided information, but it must not silently invent:

- customer identity;
- measurements;
- dates;
- labor rates;
- material prices;
- tax rates.

Unknown prices remain zero and are visibly flagged for review. Sending, deleting, or otherwise changing customer-facing records requires an explicit user action.

FastTract estimate rules include:

- customer-facing work phases;
- no separate Project Management line item;
- supervision and coordination carried inside the work phases;
- scope, assumptions, exclusions, timeline, payment terms, and change-order language;
- native HighLevel estimate storage and delivery tracking.

## Responsive UX requirements

- no horizontal page scrolling;
- mobile bottom navigation: Home, Leads, Jobs, Money, AI;
- cards rather than wide CRM tables inside the embedded workspace;
- every button either performs an action or explains why the browser cannot support it;
- loading, empty, partial-error, and retry states for every data screen;
- job details open directly from the job list;
- HighLevel location changes cause FastTract to request fresh signed context.

## Repository verification

The branch release gate is:

```bash
npm ci
npm audit --omit=dev --audit-level=critical
npm run typecheck:highlevel
npm run lint:highlevel
npm test
npm run build
node --check scripts/encrypt-ghl-connections.mjs
node --check scripts/test-highlevel-isolation.mjs
```

The repository still contains unrelated legacy lint debt outside the HighLevel workspace. The focused lint command is the enforced gate for this release; tests and the production build still cover the whole application.

## Ordered production activation

After this branch is approved and merged to the default branch, run the manual workflows in this exact order:

1. **Apply Supabase production migrations** — enter `MIGRATE`.
2. **Deploy FastTract production** — enter `DEPLOY`.
3. **Activate HighLevel production credentials** — enter `ACTIVATE`.
4. Install the private Marketplace app into two App Test sub-accounts.
5. Save two different encrypted signed contexts as `GHL_TEST_CONTEXT_A` and `GHL_TEST_CONTEXT_B` in the `highlevel-app-test` GitHub environment.
6. **Test HighLevel location isolation** — enter `TEST`.

The activation workflow refuses to encrypt legacy tokens until the protected Vercel readiness endpoint proves that the new application code, database schema, secrets, and decryption layer are live.

## Two-location release gate

The write-mode isolation harness creates temporary records in both locations:

- customer;
- lead/opportunity;
- job custom-object record;
- native estimate.

It then verifies in both directions that:

- each location can see its own records;
- neither location lists the other location's records;
- cross-location direct reads fail;
- cross-location direct writes fail;
- temporary estimates, jobs, opportunities, and FastTract customer visibility are cleaned up in `finally`.

Do not make the Marketplace app public and do not merge/deploy additional production changes after a failed isolation result. Fix the failure and repeat the gate first.
