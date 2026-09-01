# Ava Approval Center

Ava is allowed to prepare work. Ava is not allowed to silently execute business changes.

The Approval Center is the human-control boundary for FastTract inside HighLevel. It preserves the original FastTract feeling—plain contractor language, fast handoffs, and one continuous workflow—while keeping customer records, communications, estimates, invoices, payments, and job operations under explicit human control.

## User experience

The Approval Center lives inside the FastTract **AI** workspace.

1. The contractor describes the work in normal language or by voice.
2. Ava creates a structured proposal using only information supplied by the contractor and the signed location's aggregate business pulse.
3. FastTract deterministically chooses the action type, minimum risk, final workspace route, and approval requirement.
4. The contractor reviews the proposal, target, proposed values, warnings, and missing information.
5. The contractor may save the proposal to the location-owned approval queue.
6. A proposal with missing information cannot be approved.
7. Approval opens the real FastTract workspace for final review; approval does not itself save, send, charge, delete, or record payment.
8. The contractor completes the final action in the appropriate Leads, Jobs, Estimates, Money, or customer workflow.
9. The approval may then be marked handled or dismissed, preserving the audit history.

## Supported action categories

- Create lead
- Create customer
- Create estimate
- Send estimate
- Create job
- Update job
- Add labor
- Add material
- Create change order
- Convert accepted estimate
- Send invoice
- Record payment
- Draft invoice follow-up
- Read-only review of leads, jobs, money, or customers

## Risk levels

FastTract assigns a minimum risk by action. The AI provider may raise the risk, but it cannot lower it.

| Risk | Meaning |
| --- | --- |
| `review` | Read-only navigation or business review |
| `record_change` | Creates or changes a business record |
| `customer_communication` | Sends or prepares customer-facing communication |
| `financial` | Pricing, estimates, change orders, invoices, conversions, or payments |

A proposal below the deterministic minimum risk is rejected server-side.

## HighLevel storage

Approval history is stored in the active location's custom object:

```text
custom_objects.ava_actions
```

The object records:

- action title and deterministic action type;
- status and minimum risk;
- original user request;
- proposal summary and final review step;
- unsent customer draft, when applicable;
- human-readable target label without an internal record identifier;
- validated proposed values;
- missing information that blocks approval;
- signed requester, approver, handler, or dismissing user;
- server-recorded dates for each state transition.

No access token, refresh token, secret, password, executable route, URL, location ID, company ID, user ID, or internal record ID may be stored in proposed changes.

## State machine

```text
draft ───────→ approved ───────→ completed
  │                │
  └────────────→ dismissed ←────┘
```

Rules:

- new actions must begin as `draft`;
- a draft with missing information cannot become `approved`;
- approval records the signed HighLevel user and server date;
- an approved proposal cannot be rewritten during the state transition;
- completed and dismissed actions are terminal and immutable;
- ordinary users cannot delete approval history;
- only the isolated automated test may delete its own unmistakably marked temporary records during cleanup.

## Tenant isolation

Every create, list, read, update, transition, and cleanup operation resolves the signed HighLevel user context and active location on the server.

The live isolation harness verifies two genuine App Test sub-accounts and requires that:

- each location sees its own approval and not the other location's approval;
- direct cross-location reads return `403` or `404`;
- direct cross-location writes return `403` or `404`;
- a low-risk financial or record-changing proposal is rejected;
- an action with missing information cannot be approved or completed;
- an approved proposal cannot be rewritten;
- signed audit fields and dates are added by the server;
- temporary records clean up successfully.

## Automated verification

Normal branch CI runs:

```bash
npm ci
npm audit --omit=dev --audit-level=critical
npm run typecheck:highlevel
npm run lint:highlevel
npm test
npm run build
node --check scripts/test-highlevel-isolation.mjs
node --check scripts/test-highlevel-ava-approval-isolation.mjs
```

The Ava approval model is covered for:

- deterministic intent and minimum-risk selection;
- sanitization of proposed values;
- missing-information blocking;
- immutable terminal states;
- waiting-first queue ordering;
- duplicate proposal detection;
- safe workspace routing.

## Live release gate

The manual workflow is:

```text
Test Ava approval isolation
```

For every pre-merge run:

1. Keep the Marketplace app private/App Test.
2. Install the current FastTract candidate in two different HighLevel sub-accounts.
3. Save their different signed contexts as `GHL_TEST_CONTEXT_A` and `GHL_TEST_CONTEXT_B` in the protected `highlevel-app-test` GitHub environment.
4. Set `FASTTRACT_PRODUCTION_URL` in that environment.
5. Open the workflow in GitHub Actions.
6. Select **Use workflow from: `chatgpt/fasttract-ghl-flawless`**.
7. Enter confirmation `TEST_AVA`.
8. Require a green result and successful cleanup before merging or making the Marketplace app public.

A green unit test or build does not replace this live two-location test.
