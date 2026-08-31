# FastTract HighLevel Marketplace configuration

This is the production configuration for the FastTract Marketplace app. Keep the app private while completing the two-location release gate.

## Distribution

| Marketplace setting | Required value |
| --- | --- |
| Target user | **Sub-account** |
| Who can install | **Both Agency and Sub-account** |
| Agency bulk install | **Yes** |
| Initial visibility | **Private / App Test** |

This produces either a location token for a direct sub-account installation or a company token for an agency bulk installation. FastTract stores the company installation and creates a location-scoped token for the signed active sub-account when that location first opens the app.

## URLs

Use the production origin stored in the GitHub production variable `FASTTRACT_PRODUCTION_URL`.

| Marketplace field | Value |
| --- | --- |
| OAuth redirect URL | `https://ohqopzyggxmwentbgivb.supabase.co/functions/v1/ghl-oauth-callback` |
| Webhook URL | `https://ohqopzyggxmwentbgivb.supabase.co/functions/v1/highlevel-webhook` |
| Custom Page URL | `${FASTTRACT_PRODUCTION_URL}/highlevel` |
| Custom Page placement | Sub-account left navigation |
| Menu label | `FASTTRACT` |

Do not use `location_id` in the URL as authentication. The Custom Page requests encrypted signed context from HighLevel and the backend authorizes the signed `companyId`, `userId`, and `activeLocation`.

## Custom Page security

1. Generate the Marketplace **Shared Secret / SSO key** in the app Auth settings.
2. Store the value only as the production secret `GHL_APP_SHARED_SECRET`.
3. Do not place the Shared Secret, OAuth client secret, access token, refresh token, or Supabase service-role key in frontend code or URL parameters.
4. Keep the Custom Page on HTTPS.
5. Allow HighLevel to embed the page. Do not set `X-Frame-Options: DENY` or `SAMEORIGIN` and do not use a restrictive `frame-ancestors` policy that excludes HighLevel.

## OAuth scopes

Use only the scopes required by the current embedded workspace:

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

Why each group is required:

| Scope group | FastTract use |
| --- | --- |
| Contacts | Customers, lead identity, notes, and FastTract tags |
| Opportunities | FastTract Sales pipeline and lead stages |
| Locations | Business identity and address on native estimates |
| Estimates | Native estimate create, update, send, delete, and convert |
| Invoices | Native invoice list, create, and send |
| Object schema/records | Jobs, Time Entries, and Materials |
| Custom fields | Custom-object folders and fields during bootstrap |
| OAuth write | Convert a bulk-install company token into a location-scoped token |

Do not add calendar, conversation, payment, phone, snapshot, company-management, custom-menu-link, or SaaS-management scopes until a shipped FastTract screen actually calls those APIs.

## Webhooks

Enable the minimum installation lifecycle events:

```text
INSTALL
UNINSTALL
```

The receiver:

- verifies the raw body with HighLevel's `X-GHL-Signature` Ed25519 signature;
- deduplicates by `webhookId`;
- stores the event for auditability;
- deletes location credentials after a location uninstall;
- deletes all company/location credentials after a company or agency uninstall.

Do not subscribe to broad contact, opportunity, invoice, or message events merely for future use. Add events only when FastTract consumes them.

## Marketplace values that become production secrets

Configure these in the GitHub `production` environment before running the deployment workflows:

```text
GHL_APP_SHARED_SECRET
GHL_CLIENT_ID
GHL_CLIENT_SECRET
GHL_TOKEN_ENCRYPTION_KEY
FASTTRACT_READINESS_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
LOVABLE_API_KEY or OPENAI_API_KEY
```

Configure this production variable:

```text
FASTTRACT_PRODUCTION_URL
```

Optional production variables:

```text
GHL_SUCCESS_URL
GHL_ERROR_URL
FASTTRACT_AI_GATEWAY_URL
FASTTRACT_AI_MODEL
```

`GHL_TOKEN_ENCRYPTION_KEY` and `FASTTRACT_READINESS_SECRET` must each contain at least 32 characters. The same `GHL_TOKEN_ENCRYPTION_KEY` must be used by Vercel and the Supabase OAuth callback.

## Ordered activation

Run these manual workflows from the default branch in this exact order:

1. **Apply Supabase production migrations** — enter `MIGRATE`.
2. **Deploy FastTract production** — enter `DEPLOY`.
3. **Activate HighLevel production credentials** — enter `ACTIVATE`.

The third workflow refuses to encrypt legacy tokens unless the protected Vercel readiness endpoint confirms the application, database schema, secrets, and decryption layer are live.

## Private app installation test

1. Create two HighLevel App Test sub-accounts under the same agency, named clearly as Location A and Location B.
2. Install the private FastTract app directly into Location A.
3. Install it into Location B, or bulk-install both from the agency to exercise the company-token path.
4. Confirm the `FASTTRACT` Custom Page appears in each sub-account's left navigation.
5. Open FastTract inside each location and run bootstrap once.
6. Complete the automated two-location isolation test before changing the app from private to public.
