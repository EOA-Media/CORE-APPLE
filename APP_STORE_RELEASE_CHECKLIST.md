# CORE App Store Release Checklist

## Native iOS
- Install dependencies with `npm install`.
- Build and sync with `npm run cap:sync`.
- Add iOS with `npx cap add ios` on macOS.
- Open Xcode with `npm run cap:open:ios`.
- Set Bundle ID to `com.corefitness.app` or your final Apple Developer Bundle ID.
- Add app icon, splash screen, signing team, and provisioning profile.

## Push Notifications
- Enable Push Notifications in Apple Developer and Xcode capabilities.
- Create an APNs auth key and connect it to Firebase Cloud Messaging.
- Replace the placeholder token registration with native Capacitor Push Notifications registration.
- Store push tokens in `users/{userId}.pushTokens`.
- Send workout reminders at 9 AM local time only when today's scheduled workout is still `scheduled`.

## Ads
- Home ad slot: below the main workout card.
- Social ad slot: below the league panel.
- Post-workout video: after `Save Workout`, before streak celebration.
- Keep test ads until AdMob and App Store review are ready.

## App Store Connect
- Create app record, screenshots, description, keywords, support URL, and privacy policy URL.
- Complete App Privacy labels for Firebase, push notifications, and ads.
- Provide a demo account in App Review notes if login is required.
