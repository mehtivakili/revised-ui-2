# Android Capacitor Setup

This project uses Capacitor as an Android WebView shell for the hosted Next.js app.

## Configure the Hosted URL

Create or update `.env.local`:

```env
CAPACITOR_SERVER_URL=https://your-production-domain.com
```

For local device testing, use a LAN URL that the Android device can reach, not `localhost`.

## Sync Android

```bash
npm run cap:sync:hosted
```

This reads `CAPACITOR_SERVER_URL`, writes the Capacitor config into the Android project, and syncs plugins/assets.

## Open Android Studio

```bash
npm run cap:open
```

## Development Model

- Keep developing the Next.js web app as the single source of truth.
- Deploy the web app to your server.
- Run `npm run cap:sync:hosted` when Capacitor config, native plugins, app icon, splash, or Android files change.
- Normal web UI/calculator/auth changes do not require rebuilding the APK if the Android app points to the hosted URL.

## Native Plugins Included

- `@capacitor/status-bar`
- `@capacitor/splash-screen`

Push notifications are intentionally not configured yet because they require Firebase credentials and backend notification logic.
