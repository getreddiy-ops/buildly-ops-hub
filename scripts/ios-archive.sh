#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == Darwin ]] || { echo 'Run on a Mac with Xcode.' >&2; exit 1; }
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID to your Apple Developer team ID}"
: "${BUILD_NUMBER:?Set BUILD_NUMBER to a new positive integer}"
RELEASE_VERSION="${RELEASE_VERSION:-1.0}"
[[ "$APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]] || { echo 'Invalid team ID.' >&2; exit 1; }
[[ "$BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid build number.' >&2; exit 1; }
[[ "$RELEASE_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || { echo 'Invalid version.' >&2; exit 1; }
XCODE_MAJOR="$(xcodebuild -version | awk '/^Xcode / {split($2,v,"."); print v[1]}')"
[[ "$XCODE_MAJOR" -ge 26 ]] || { echo 'Xcode 26 or later required.' >&2; exit 1; }
OUT="$PWD/build/ios/$RELEASE_VERSION-$BUILD_NUMBER"
[[ ! -e "$OUT" ]] || { echo 'Archive output already exists; use a new build number.' >&2; exit 1; }
mkdir -p "$OUT"
npm ci
npm test
npm run build
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -resolvePackageDependencies
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/FastTract.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$RELEASE_VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates archive
/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:SigningIdentity' "$OUT/FastTract.xcarchive/Info.plist"
echo "Archive created: $OUT/FastTract.xcarchive"
echo 'Open in Xcode Organizer, validate, then select Distribute App > App Store Connect when approved.'
echo 'This script does not upload or submit the app.'
