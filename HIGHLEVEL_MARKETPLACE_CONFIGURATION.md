# FastTract HighLevel Marketplace configuration

This is the production configuration for the FastTract Marketplace app. Keep the app private while completing the two-location and Money release gates.

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
6. Enable microphone access for Ava voice input only when the user invokes it.

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
| Estimates | Original estimates plus separate change-order approval estimates |
| Invoices | Native invoice list, create from accepted estimates, send, and record manual invoice payments |
| Object schema/records | Jobs, Time Entries, Materials, and Change Orders |
| Custom fields | Custom-object folders and fields during bootstrap |
| OAuth write | Convert a bulk-install company token into a location-scoped token |

Manual invoice payment recording is performed through the native invoice-write API. Do not add broad payment/order scopes unless a shipped FastTract feature starts using the separate HighLevel Payments APIs.

Do not add calendar, conversation, phone, snapshot, company-management, custom-menu-link, or SaaS-management scopes until a shipped FastTract screen actually calls those APIs.

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

The current workspace reads estimate and invoice state directly when the user opens or refreshes FastTract. Do not subscribe to broad contact, opportunity, estimate, invoice, payment, or message events until FastTract intentionally consumes those events and has replay/idempotency tests for them.

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

Run these manual workflows from the default branch in this exact order. Until PR #15 passes the live gate, select `chatgpt/fasttract-ghl-flawless` as the workflow ref:

1. **Apply Supabase production migrations** — enter `MIGRATE`.
2. **Deploy FastTract production** — enter `DEPLOY`.
3. **Activate HighLevel production credentials** — enter `ACTIVATE`.
4. **Test HighLevel location isolation** — enter `TEST` after two private App Test installs.

The third workflow refuses to encrypt legacy tokens unless the protected Vercel readiness endpoint confirms the application, database schema, secrets, and decryption layer are live.

## Private app installation test

1. Create two HighLevel App Test sub-accounts under the same agency, named clearly as Location A and Location B.
2. Install the private FastTract app directly into Location A.
3. Install it into Location B, or bulk-install both from the agency to exercise the company-token path.
4. Confirm the `FASTTRACT` Custom Page appears in each sub-account's left navigation.
5. Open FastTract inside each location and run bootstrap once.
6. Confirm FastTract creates only these location-owned records and schemas:
   - `FastTract Sales` pipeline;
   - Jobs;
   - Time Entries;
   - Materials;
   - Change Orders.
7. Complete the automated two-location isolation test before changing the app from private to public.

## Money and change-order App Test gate

Complete the following in both App Test sub-accounts. Use different customers and unmistakably different job names in each location.

### Original work

1. Create a customer and original estimate in FastTract.
2. Review and send the estimate through the native HighLevel estimate API.
3. Accept the estimate from the customer-facing link.
4. Confirm FastTract shows it under Accepted Work.
5. Create the linked FastTract job.
6. Confirm the job stores the correct customer and original estimate IDs.
7. Create the primary invoice from the accepted estimate.
8. Confirm the job stores the correct invoice ID.
9. Send the invoice.
10. Record a partial manual payment using a test method and confirm amount paid and amount due update.
11. Record the final balance and confirm the native invoice becomes paid.

### Change orders

1. Create a change-order draft from the linked job.
2. Confirm the price and tax are explicit and were not invented by Ava.
3. Create the separate native approval estimate.
4. Review and send it to the customer.
5. Decline one test change and verify the declined estimate remains in HighLevel history.
6. Revise that change into a new draft without rewriting the original estimate.
7. Accept another change-order approval estimate.
8. Convert it into a separate native invoice.
9. Record a partial and final payment against the change-order invoice.
10. Confirm original scope, change scope, job costs, and each invoice balance stay distinct but linked.

### Tenant isolation

1. Save two different encrypted signed contexts as `GHL_TEST_CONTEXT_A` and `GHL_TEST_CONTEXT_B` in the `highlevel-app-test` GitHub environment.
2. Run **Test HighLevel location isolation** with confirmation `TEST` and workflow ref `chatgpt/fasttract-ghl-flawless`.
3. Require a pass for customer, lead, job, change-order, and estimate list isolation.
4. Require `403` or `404` for every direct cross-location read and write attempt.
5. Confirm a child time, material, or change-order record cannot reference a job from the other location.
6. Confirm all temporary test records clean up successfully.

## Public-release prohibition

Do not make the Marketplace app public until all of these are true:

- the production migration, deployment, activation, and readiness workflows are green;
- both private App Test installations use the documented scopes and Shared Secret;
- the two-location isolation workflow passes;
- token refresh and rotation pass under forced expiration;
- original estimate → job → invoice → payment passes;
- change order → approval → invoice → payment passes;
- desktop, tablet, and phone iframe QA passes without horizontal overflow;
- PR #15 is merged only after the live gate, followed by a final deployment and smoke test from `main`.
