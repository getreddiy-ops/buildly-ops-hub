# FastTract — HighLevel Primary Backend

FastTract uses HighLevel as the primary system of record for contractor business data.

## Storage map

| FastTract feature | HighLevel storage |
| --- | --- |
| Customers | Contacts |
| Leads / sales | Opportunities + Pipelines |
| Calls / SMS / email | Conversations |
| Appointments | Calendars |
| Invoices / payments | HighLevel native payments/invoices |
| Jobs | Custom Object: `custom_objects.jobs` |
| Estimates | Custom Object: `custom_objects.estimates` |
| Time tracking | Custom Object: `custom_objects.time_entries` |
| Materials / job costs | Custom Object: `custom_objects.materials` |

The browser and mobile app never receive a HighLevel access token. FastTract calls `/api/highlevel/*`, and the server-side Vercel functions call HighLevel.

## Initial connection

For the first FastTract location, add these Vercel environment variables:

```text
GHL_LOCATION_ID=<FastTract HighLevel sub-account/location id>
GHL_PRIVATE_INTEGRATION_TOKEN=<sub-account private integration token>
```

`GHL_LOCATION_TOKEN` is also supported and takes precedence over `GHL_PRIVATE_INTEGRATION_TOKEN`.

Never put a HighLevel token in a `VITE_*` environment variable; Vite browser variables are public.

## Required HighLevel permissions for the first connection

Start with the minimum scopes FastTract needs:

- `contacts.readonly`
- `contacts.write`
- `opportunities.readonly`
- `opportunities.write`
- `objects/schema.readonly`
- `objects/schema.write`
- `objects/record.readonly`
- `objects/record.write`

Add calendar, conversations, invoices/payments, workflows, users and custom-field scopes as those FastTract screens are moved to HighLevel.

## Bootstrap FastTract objects

After the environment variables are present on a deployment, call:

```text
POST /api/highlevel/bootstrap
```

The bootstrap is idempotent. It checks the location first and creates only missing FastTract custom objects.

## App endpoints

```text
GET  /api/highlevel/contacts
POST /api/highlevel/contacts

GET  /api/highlevel/opportunities
POST /api/highlevel/opportunities

GET  /api/highlevel/records?object=jobs
POST /api/highlevel/records?object=jobs

GET  /api/highlevel/records?object=estimates
POST /api/highlevel/records?object=estimates

GET  /api/highlevel/records?object=time_entries
POST /api/highlevel/records?object=time_entries

GET  /api/highlevel/records?object=materials
POST /api/highlevel/records?object=materials
```

The React app uses `src/integrations/highlevel/client.ts` rather than calling HighLevel directly.

## SaaS rollout

The private integration token is the fastest way to wire and test the first FastTract sub-account. The SaaS production model should use a HighLevel OAuth Marketplace app so FastTract can be installed across sub-accounts without exposing or manually distributing tokens.

Recommended final distribution:

1. Create FastTract as a private HighLevel Marketplace app while developing.
2. Target Agency for the LynchAI/FastTract SaaS installation model.
3. Request only FastTract scopes.
4. Bulk-install to the FastTract SaaS sub-accounts and future locations.
5. Use the agency installation to obtain/generate location access tokens server-side.
6. Add FastTract as a HighLevel Custom Menu item so the FastTract UI can run inside each location as well as from the standalone web/mobile app.

HighLevel remains the business-data source of truth. Any external persistence used later should be limited to technical secrets/session/token-vault data that cannot safely live in browser-visible or business CRM fields.
