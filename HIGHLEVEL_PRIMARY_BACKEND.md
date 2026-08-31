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

Supabase stores backend-only HighLevel OAuth credentials and legacy FastTract records that have not yet been intentionally migrated. Browser clients never receive HighLevel access or refresh tokens.

## Embedded authentication

1. HighLevel loads `/highlevel` in its Custom Page iframe.
2. The browser requests encrypted user context from the parent window with `REQUEST_USER_DATA`.
3. The encrypted payload is sent to FastTract APIs in `X-FastTract-GHL-Context`.
4. The server decrypts the payload with `GHL_APP_SHARED_SECRET`.
5. The server reads the signed `companyId`, `userId`, and `activeLocation`.
6. The server loads the OAuth installation for that company/location from `ghl_connections`.
7. Every HighLevel API request runs with a location-scoped token for the signed active location.

A `location_id` URL parameter is never authentication and must never be used to authorize data access.

## OAuth lifecycle

`ghl_connections` is backend-only and contains:

- company and location identifiers
- access token
- rotating refresh token
- token expiration
- granted scopes
- HighLevel user and installation metadata

The server refreshes credentials before expiration, stores both the new access token and the rotated refresh token, and retries one failed HighLevel request after a `401`. Concurrent refreshes are serialized in-process. If another server instance wins a refresh-token race, the losing instance reloads the newest database row and continues with the rotated credentials.

Required server variables:

```text
GHL_APP_SHARED_SECRET=
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
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

Single-location development mode is explicitly opt-in and must not be enabled for the SaaS deployment:

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

Add the matching payment, calendar, conversation, and association scopes as those screens are completed.

## Bootstrap

`POST /api/highlevel/bootstrap` is idempotent and prepares the active signed location:

- creates the `FastTract Sales` pipeline when missing
- creates Jobs, Time Entries, and Materials custom-object schemas when missing
- creates the FastTract custom-field folders and fields when missing

Bootstrap failures are returned per module so a partial setup cannot masquerade as a complete installation.

## API surface

```text
GET  /api/highlevel/context
POST /api/highlevel/bootstrap
POST /api/highlevel/ai-form-fill

GET/POST/PUT/DELETE /api/highlevel/contacts
GET/POST/PATCH/PUT/DELETE /api/highlevel/leads
GET/POST /api/highlevel/opportunities
GET/POST/PUT/DELETE /api/highlevel/estimates
POST /api/highlevel/estimate-actions
GET/POST /api/highlevel/invoices
GET/POST /api/highlevel/records?object=jobs|time_entries|materials
```

The browser calls only FastTract APIs. It never calls `services.leadconnectorhq.com` with a secret token.

## Ava and estimates

The embedded AI form endpoint authenticates with the same signed HighLevel context as the rest of the workspace. It does not require a second Supabase login.

Ava may extract and organize user-provided information, but it must not silently invent:

- customer identity
- measurements
- dates
- labor rates
- material prices
- tax rates

Unknown prices remain zero and are visibly flagged for review. Sending, deleting, or otherwise changing customer-facing records requires an explicit user action.

FastTract estimate rules include:

- customer-facing work phases
- no separate Project Management line item
- supervision and coordination carried inside the work phases
- scope, assumptions, exclusions, timeline, payment terms, and change-order language
- native HighLevel estimate storage and delivery tracking

## Responsive UX requirements

- no horizontal page scrolling
- mobile bottom navigation: Home, Leads, Jobs, Money, AI
- cards rather than wide CRM tables inside the embedded workspace
- every button either performs an action or explains why the browser cannot support it
- loading, empty, partial-error, and retry states for every data screen
- job details open directly from the job list
- HighLevel location changes cause FastTract to request fresh signed context

## Release gate

Do not merge or deploy until all of the following pass:

```bash
npm ci
npm run lint
npm test
npm run build
```

Then test at least two separate HighLevel sub-accounts:

1. Open FastTract from Location A and create a lead, customer, job, and estimate.
2. Open Location B and verify none of Location A's records or IDs can be fetched or changed.
3. Switch locations and verify the embedded workspace refreshes its signed context.
4. Force token expiration and verify refresh plus retry without user interruption.
5. Generate an estimate through Ava, review it, save it natively, and send it.
6. Accept the estimate, create its native HighLevel invoice, and send the invoice.
7. Confirm desktop, tablet, and phone have no horizontal overflow.
