# Eneclez Watch Party Mobile Apps

The mobile app uses the same responsive Watch Party interface served from Render:

`https://eneclez-watch-party.onrender.com/mobile`

## Android

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create/sync Android project:
   ```bash
   npm run mobile:android
   ```

3. Open Android Studio:
   ```bash
   npx cap open android
   ```

4. Build an APK or AAB from Android Studio.

## iOS

iOS builds require macOS, Xcode, and an Apple Developer account.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create/sync iOS project:
   ```bash
   npm run mobile:ios
   ```

3. Open Xcode:
   ```bash
   npx cap open ios
   ```

4. Build for TestFlight or App Store from Xcode.
