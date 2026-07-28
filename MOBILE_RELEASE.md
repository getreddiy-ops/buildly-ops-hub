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

Use `npm run mobile:ios` on a Mac to open Xcode. Apple signing, archiving, and
App Store upload require macOS, Xcode, an Apple Developer account, and a unique
signing team/profile.

## Store information still supplied outside the repository

- Apple Developer and Google Play Console accounts
- Legal company/seller name and contact details
- Privacy-policy URL: `https://fasttract.org/privacy`
- Support URL: `https://fasttract.org/contact`
- Store description, category, age/content questionnaire, screenshots, and
  promotional copy
- Signing keys and certificates (never commit these)

## Permissions

FastTract asks for microphone access only when the user chooses voice input.
Camera access is optional and is not required by the current onboarding flow.
Before store submission, verify that every declared native permission is used
and that its explanation matches the in-app consent screen.

## Release checklist

1. Set production Supabase and public client environment variables.
2. Run `npm run test`, `npm run lint`, and `npm run mobile:sync`.
3. Test account creation, Google authentication, five-question onboarding,
   voice input/output, website crawl, logout, subscription management, and
   account deletion on physical Android and iPhone devices.
4. Confirm safe areas, keyboard behavior, external links, offline messaging,
   and interruption recovery.
5. Create signed release builds in Android Studio and Xcode.
6. Upload screenshots and privacy disclosures in both store consoles.
