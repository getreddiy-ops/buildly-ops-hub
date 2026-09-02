# FastTract — HighLevel Primary Backend

FastTract uses HighLevel as the primary system of record for contractor business data. FastTract is the simplified AI-first interface; HighLevel owns the CRM, communications, sales and billing records behind it.

## Storage map

| FastTract feature | HighLevel storage |
| --- | --- |
| Customers | Native Contacts |
| Leads / sales | Native Opportunities + Pipelines |
| Calls / SMS / email | Native Conversations |
| Appointments | Native Calendars |
| Estimates | Native Estimates |
| Invoices / payments | Native Invoices / Payments |
| Jobs | Custom Object: `custom_objects.jobs` |
| Time tracking | Custom Object: `custom_objects.time_entries` |
| Materials / job costs | Custom Object: `custom_objects.materials` |

Supabase remains in the existing app only where it is still needed for legacy FastTract authentication or features that have not yet been migrated. It is no longer the intended business-data source of truth.

## Production SaaS connection

FastTract should run as a HighLevel Marketplace/Custom Menu app inside each customer sub-account.

1. HighLevel embeds FastTract in an iframe.
2. The FastTract browser requests HighLevel's encrypted user context from the parent frame.
3. The encrypted value is forwarded to `/api/highlevel/*` as `X-FastTract-GHL-Context`.
4. The server decrypts the context with `GHL_APP_SHARED_SECRET` and reads `activeLocation`.
5. The server uses an agency-level token to request a location-scoped access token from HighLevel.
6. Every business-data request executes with the token for that active location.

The browser never receives the HighLevel agency token, location token, client secret or app shared secret.

## Required server secrets

Configure these only as server-side Vercel environment variables. Never prefix them with `VITE_`.

```text
GHL_APP_SHARED_SECRET=<Marketplace app Advanced Settings shared secret>
GHL_AGENCY_TOKEN=<agency OAuth access token capable of generating location tokens>
```

`GHL_AGENCY_ACCESS_TOKEN` is accepted as an alternate variable name.

For a temporary one-location development connection only, FastTract also supports:

```text
GHL_SINGLE_LOCATION_MODE=true
GHL_LOCATION_ID=<test HighLevel location id>
GHL_LOCATION_TOKEN=<test location access token>
```

`GHL_PRIVATE_INTEGRATION_TOKEN` can be used instead of `GHL_LOCATION_TOKEN` in this explicit single-location mode. Do not enable single-location mode for the multi-customer SaaS deployment.

## HighLevel scopes

Current FastTract HighLevel code needs these scopes for the migrated features:

- `contacts.readonly`
- `contacts.write`
- `opportunities.readonly`
- `opportunities.write`
- `locations.readonly`
- `invoices/estimate.readonly`
- `invoices/estimate.write`
- `objects/schema.readonly`
- `objects/schema.write`
- `objects/record.readonly`
- `objects/record.write`

The agency installation also needs `oauth.write` to generate a location access token for the active sub-account.

Add the appropriate invoice, calendar, conversation and payment scopes as those remaining FastTract screens are migrated.

## FastTract Sales pipeline

`POST /api/highlevel/bootstrap` checks the active sub-account and creates a `FastTract Sales` pipeline if it is missing. The initial open stages are:

- New
- Contacted
- Qualified

Won and Lost use HighLevel's native opportunity status instead of duplicate stages.

## Contractor custom objects

The same bootstrap creates only the contractor records HighLevel does not already model natively:

- `custom_objects.jobs`
- `custom_objects.time_entries`
- `custom_objects.materials`

The bootstrap is intended to be idempotent and skips schemas that already exist.

## API surface

```text
GET  /api/highlevel/context
POST /api/highlevel/bootstrap

GET/POST/PUT/DELETE /api/highlevel/contacts
GET/POST/PATCH/PUT/DELETE /api/highlevel/leads
GET/POST /api/highlevel/opportunities

GET/POST/PUT/DELETE /api/highlevel/estimates
POST /api/highlevel/estimate-actions

GET/POST /api/highlevel/records?object=jobs
GET/POST /api/highlevel/records?object=time_entries
GET/POST /api/highlevel/records?object=materials
```

The React app uses `src/integrations/highlevel/client.ts`. It requests the encrypted HighLevel iframe context and passes that context to the server; it never calls HighLevel with a secret token directly.

## Customer lifecycle

A FastTract lead is a HighLevel Contact plus an Opportunity in `FastTract Sales`.

- New lead: Contact + Opportunity + `fasttract-lead` tag.
- Progress: Opportunity moves through New / Contacted / Qualified.
- Convert to customer: Opportunity status becomes Won, the same Contact receives `fasttract-customer`, and `fasttract-lead` is removed.
- Customer notes: native HighLevel contact notes.

This avoids duplicate lead/customer identities and makes the same contact immediately usable by HighLevel workflows, phone, SMS, email and calendars.

## Estimates

FastTract estimates are native HighLevel Estimate records, not a custom object.

The FastTract estimate UI can:

- List HighLevel estimates.
- Create and update drafts.
- Delete estimates.
- Send by SMS, email, or both through HighLevel.
- Reflect HighLevel's native lifecycle statuses such as draft, sent, viewed, accepted, declined and invoiced.

Accepted-estimate-to-invoice conversion should also remain a native HighLevel action when wired into the FastTract UI.

## Remaining migration work

The current HighLevel-first branch establishes the tenant-safe foundation and migrates Customers, Leads and Estimates. Remaining business screens should be moved incrementally rather than deleting the existing Supabase integration all at once:

- Jobs -> HighLevel Job custom object
- Time Tracking -> HighLevel Time Entry custom object
- Materials / Costing -> HighLevel custom objects
- Invoices / Payments -> native HighLevel invoices/payments
- Calendar -> native HighLevel calendars/events
- Phone / Conversations -> native HighLevel communications
- AI actions -> call the same FastTract HighLevel service layer

Keep FastTract authentication separate until the standalone web/mobile login strategy is intentionally replaced. This prevents a storage migration from breaking TestFlight or standalone sign-in.
