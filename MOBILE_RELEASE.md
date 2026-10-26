# FastTract mobile release

FastTract uses Capacitor to package the existing Vite app for Android and iOS.
The production apps bundle the web build; they do not depend on a remote preview
URL.

## Application identity

- Display name: `FastTract`
- Bundle/application ID: `org.fasttract.app`
- Web directory: `dist`
- Production website: `https://fasttract.org`

The application ID must remain unchanged after either store listing is created.

## Build and synchronize

```powershell
npm install
npm run mobile:assets
npm run mobile:sync
```

Use `npm run mobile:android` to open Android Studio. Android builds require
Android Studio, its current SDK, and the JDK version supported by Capacitor.

Use `npm run mobile:ios` on a Mac with Xcode 26 or later to open Xcode. Apple signing, archiving, and
App Store upload require macOS, Xcode, an Apple Developer account, and a unique
signing team/profile.

See `IOS_SUBMISSION_CHECKLIST.md` for the current evidence, signing steps,
native companion policy, deletion operations, and remaining submission gates.
`scripts/ios-archive.sh` builds an archive on a signed-in Mac; it never uploads.

## Store information still supplied outside the repository

- Apple Developer and Google Play Console accounts
- Legal company/seller name and contact details
- Privacy-policy URL: `https://fasttract.org/privacy`
- Support URL: `https://fasttract.org/contact`
- Store description, category, age/content questionnaire, screenshots, and
  promotional copy
- Signing keys and certificates (never commit these)

## Permissions

FastTract asks for microphone access when the user chooses voice input or speaks
with an assistant. Camera access is optional and supports taking estimate photos.
Location access supports job-site selection and recording the clock-in location;
the app does not request background location access.
The iOS purpose descriptions are in `ios/App/App/Info.plist` and are checked by
the unit suite. On a physical iPhone, test both granting and denying camera,
microphone, and location access, including retrying after a denial. These static
checks do not verify runtime permission handling.
Before store submission, verify that every declared native permission is used
and that its explanation matches the in-app consent screen.

## Release checklist

1. Set production Supabase and public client environment variables.
2. Run `npm run test`, `npm run lint`, and `npm run mobile:sync`.
3. Test account creation, Google authentication, five-question onboarding,
   voice input/output, website crawl, logout, existing subscription access, and
   account deletion on physical Android and iPhone devices.
4. Confirm safe areas, keyboard behavior, external links, offline messaging,
   and interruption recovery.
5. Create signed release builds in Android Studio and Xcode.
6. Upload screenshots and privacy disclosures in both store consoles.

The native release opens directly to sign-in and excludes marketing purchase
routes, new subscription checkout, and Google advertising tracking. Web pricing
and existing customer billing remain unchanged. This is a proposed free business
companion release; Apple must still assess whether its payment model qualifies.

Native email confirmation and password reset use HTTPS pages at
`https://fasttract-app.vercel.app`, then users return to the native sign-in screen.
Allow both `/onboarding` and `/reset-password` callbacks in Supabase Auth and test
the received emails on a physical iPhone. Do not allow a broad wildcard merely
to make a test pass. Google login is not present in the current routed login UI;
the earlier generic checklist is not evidence that it is enabled.
