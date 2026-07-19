# FastTract

FastTract is a contractor operating system covering lead intake, customers,
estimates, contracts, jobs, crews, time tracking, invoices, and AI-assisted
office workflows.

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

Do not commit Supabase service-role keys, Paddle secrets, Twilio credentials, or
other production secrets. Public client tokens belong only in the documented
frontend environment variables; server secrets belong in Supabase function
secrets or the hosting provider.

