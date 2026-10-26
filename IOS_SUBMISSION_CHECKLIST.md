# FastTract iOS release checklist — October 26, 2026

## Decision

Not ready for TestFlight distribution or App Store submission yet. The repository
has an iOS project and a successful unsigned Simulator build. A signed device
archive, Apple membership, App Store Connect record, upload, physical-device test,
and complete privacy/metadata review have not been verified.

This release preparation preserves the deployed release branch
`codex/working-web-release` at `bd7a221ff18ee13834ca9395b9eda8286bd71484`, including
its crew-access and workflow changes beyond main commit
`2dc058bbc400056d41236d97fbc41e85392e145f`. The existing older local checkout was
`82d2ce11f8b4f5cae0bdb16599a3a182dd4337c0`; it was preserved.

## Verified evidence

- Repository: https://github.com/getreddiy-ops/buildly-ops-hub
- Main's iOS job passed tests, web build, Capacitor sync, package resolution and
  unsigned Debug Simulator compilation:
  https://github.com/getreddiy-ops/buildly-ops-hub/actions/runs/38246814426
- Main's backend deployment failed while linking the project: `Invalid access
  token`; function deployment steps were skipped:
  https://github.com/getreddiy-ops/buildly-ops-hub/actions/runs/38246814380
- Vercel project `fasttract-app` (`prj_89P35G2ZVL6lcTDXr3rSK4WslCZb`) reports
  production deployment `dpl_6emzkNYGFLCiHxf76eX58t4PvZ1X` READY. Its metadata
  identifies branch `codex/working-web-release`, commit
  `bd7a221ff18ee13834ca9395b9eda8286bd71484`, different from current main.
  Its project response also says `live: false`; HTTP checks are reported
  separately rather than treating this field as proof of public availability.
- HTTP GET: https://fasttract-app.vercel.app returns 200 and a FastTract app shell.
  `/privacy` and `/contact` on that host also return 200 app shells; browser
  rendering and authenticated functionality were not verified. Browser tooling
  timed out, so no screenshot or successful browser inspection is claimed.
- HTTP GET: https://app.fasttract.org, https://fasttract.org/privacy and
  https://fasttract.org/contact return 404. These cannot be submitted as working
  URLs. No DNS changes were made.
- Supabase project `qjusjfdrtposrthlcjeu` reports ACTIVE_HEALTHY. A schema lookup
  found no existing deletion-request table. Health does not prove app flows work.

## Prepared code changes

- Native companion entry redirects marketing/sales pages to sign-in; the existing
  billing screen omits new subscription purchase links on native. Paddle startup
  refuses native checkout. Web purchases and $197/$297/$397 pricing are preserved.
- Native Google advertising loading, pageviews and conversion calls are disabled.
- Native email callbacks use the reachable HTTPS Vercel host rather than a local
  Capacitor origin. Browser completion followed by native sign-in is explicit;
  this is not an implemented universal-link login flow.
- `/account` is accessible to authenticated owners and crew, even without a company.
  Settings, field Profile and login link to it. It saves a permanent-deletion
  request only after confirmation and reports server failure without claiming success.
- The additive deletion migration uses invoker functions, RLS, a unique user key,
  restricted insert columns and a pending-due index. Duplicate requests preserve
  the original request time. Clients cannot change status or see another user's
  request. It has NOT been applied to production.
- Privacy notice now describes optional photos/voice, the existing payment
  providers, deletion intake and native advertising behavior. Seller identity,
  processors and legal retention still require business verification.
- Capacitor's vulnerable 8.4.2 native runtime is replaced with patched 8.4.3;
  confirm the resolved Swift package also says 8.4.3 after sync.
- CI explicitly selects Xcode 26.3 and checks Xcode 26+. The first preparation
  job exposed the runner's old Xcode 16.4 default; a rerun must validate this fix.
  The iOS quality job now also runs for pull requests.
- Archive script validates team ID, build number and version, then builds a signed
  Release archive. It does not upload, export an IPA or submit for review.

## Required release order

Initial main-based verification: 115 tests passed; production web build,
TypeScript check and Capacitor iOS sync passed. The new migration passed isolated
PostgreSQL (PGlite) checks for idempotency, cross-user isolation, client status
protection, anonymous denial and Auth deletion cascade. The changed release UI
files passed targeted lint. Main-based repository-wide lint reported 280 existing findings
(239 errors, 41 warnings). Repeat verification on the final branch that includes
the deployed source; this preparation does not claim a clean global lint.

The production dependency audit dropped from 16 findings (including 4 critical)
to 7 (0 critical, 4 high, 3 moderate) after the native runtime and compatible
transitive patches. Remaining packages include Lovable/MCP SDK, Zod, Vite/esbuild
and React Router. Some fixes require major upgrades and the Lovable chain has no
automatic fix. Evaluate actual release-bundle reachability and migrate/test the
affected integrations; a zero-critical count is not proof that these are safe.

1. Review the prepared changes and resolve outstanding dependency/lint findings.
   Run the iOS job on the final commit; the historic Simulator result does not
   cover this change. Inspect the Release device archive as well.
2. In the existing Apple account, verify active Developer membership, Account
   Holder agreements and the intended legal seller. Reuse the existing app record
   if present. Verify bundle ID `org.fasttract.app` belongs to that team; do not
   invent or change it just to bypass a signing conflict.
3. Repair CI's invalid Supabase access token using the owner's secure GitHub
   secret settings. Never paste or commit the token. Re-run the backend workflow
   and verify the exact functions and migrations actually deployed. A successful
   web job alone cannot prove backend deployment.
4. Review and deploy the additive deletion migration BEFORE deploying the new
   `/account` UI. Verify it with two disposable test identities in a test
   environment. Check security advisors and actual Supabase grants.
5. Establish the deletion operator and daily queue review before showing the
   30-day commitment to customers. Run a complete disposable-account deletion,
   including downstream data and completion confirmation. See procedure below.
6. Verify explicit Supabase email callback allowlist entries:
   `https://fasttract-app.vercel.app/onboarding` and
   `https://fasttract-app.vercel.app/reset-password`. Test new signup, confirmation,
   expired link, resend, reset, logout and relaunch on iPhone. No emails were sent
   by this audit.
7. Align the chosen native source commit with the intended tested backend and
   public support/privacy content. Repair custom-domain routing only with the
   owner's release/DNS approval. Until then the Vercel URLs are candidates, not
   verified rendered policy pages for submission.
8. On a Mac, sign into Xcode with the intended Apple team and select supported
   Xcode. Use a fresh build number greater than all existing uploaded builds:

   ```bash
   export APPLE_TEAM_ID=YOUR_TEAM_ID
   export BUILD_NUMBER=2
   export RELEASE_VERSION=1.0
   bash scripts/ios-archive.sh
   ```

   `2` is an example, not a verified available number. Automatic provisioning may
   create/update Apple signing assets. Inspect the identity printed by the script
   and archive bundle/version before continuing. Distribution validation still
   happens in Xcode Organizer.
9. Validate the archive in Organizer. Generate its privacy report and inspect SDK
   manifests. Capacitor and Cordova already ship privacy manifests; absence of an
   app-owned manifest alone is not evidence of noncompliance. Add required-reason
   API entries only for APIs actually used by the final app/plugins. Do not submit
   a false 'no data collected' declaration. Review encryption/export questions;
   no blanket export exemption was added.
10. Upload through Organizer only after release approval. Wait for Apple processing,
    resolve validation warnings and export compliance, then test internally in
    TestFlight. External testers may require Beta App Review. Upload is not public
    App Store release, and neither upload nor approval has been done here.
11. Capture real iPhone/iPad screenshots for the supported device families. Provide
    an accessible review company with disposable owner and worker credentials,
    populated sample records, and all features described in the listing. Do not
    give reviewers production customer data or a personal admin account.
12. Complete privacy labels, age rating, support/privacy URLs, copyright, category,
    regions, content rights, review contact and reviewer notes. Select manual
    release if public launch should require a final decision. Submit only after
    all gates below have evidence.

## Physical iPhone/iPad acceptance gates

- Fresh install, email sign-in, signup, confirm, reset, session refresh, logout and
  relaunch. Verify worker goes to Field and owner to Office.
- Owner creates/updates disposable customer, estimate, job, invoice and crew
  assignment; worker sees only its company/assignments. Test cross-company denial.
- Clock in/out, repeated-open-shift rejection, timezone display, denied optional
  location, interrupted request, offline message and owner review.
- Keyboard, safe areas, navigation/back, portrait/landscape, small screen and iPad
  layouts. Info.plist declares iPad support and camera/microphone/location usage.
- Denied camera/microphone; optional voice/photo feature success and failure,
  network loss and foreground recovery. Verify customer-data transmission consent
  before any third-party AI processing; optional AI is not a launch prerequisite.
- No native subscription sales routes, Paddle overlay or advertising requests.
  Existing entitlements must not require a second purchase.
- Account deletion request success, retry, duplicate, offline failure, persistence
  after relaunch, operator fulfillment and completion confirmation.

## Deletion operator procedure — must be staffed and tested

Use trusted server access to list pending requests ordered by due date. Join the
request's user ID to Auth only in an authorized admin environment; do not expose
account emails in a public queue. Mark processing via service access. Notify the
person when necessary and give completion confirmation. No notification has been
sent and no customer record has been deleted by this preparation.

Inventory the individual's profile, organization ownership, crew/time data,
uploaded files, AI knowledge/history, messages, invitations, integrations and
processor records. Delete or anonymize personal data unless a documented law
requires retention. Shared company access is not a blanket reason to retain
personal data. Transfer company ownership or arrange closure without deleting
other members' data. Resolve non-cascading Auth foreign keys deliberately; never
disable constraints or indiscriminately cascade a shared organization. Revoke
sessions and remove the Auth user only after the data steps are complete. Auth
deletion alone does not immediately invalidate every already-issued JWT.

Record lawful retention and completion in an appropriate restricted compliance
system. This intake row cascades away with the deleted Auth identity; it is not
intended as a permanent personal-data archive. Confirm external subscription
cancellation separately. Do not claim this manual process is operational until
a named operator has completed an end-to-end test.

## Apple references checked

- SDK minimum, Xcode 26+/iOS 26 SDK:
  https://developer.apple.com/news/upcoming-requirements/?id=04282026a
- Payments, completeness, privacy, minimum functionality and login:
  https://developer.apple.com/app-store/review/guidelines/
- Manual deletion is allowed with disclosed timing and completion confirmation:
  https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion
- Capacitor requirements: https://capacitorjs.com/docs/ios
- Privacy manifests: https://capacitorjs.com/docs/ios/privacy-manifest
- Runtime patch: https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv

The companion/enterprise payment treatment is a submission proposal, not an
Apple eligibility ruling. Apple's enterprise exception requires the actual sales
model to meet its conditions; single-user sales can change the outcome. Removing
purchase links alone does not guarantee approval or eliminate IAP obligations.
