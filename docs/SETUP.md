# JOWI AI setup

## Current foundation
- Responsive dashboard and Firebase Authentication sign-in.
- YouTube Data API channel/video retrieval.
- YouTube Analytics 28-day summary.
- Topic-frequency signals from existing video metadata.
- Manual, per-video title/description editing with an explicit confirmation before publishing.
- No fake engagement, paid promotion, auto-commenting, or background publishing.

## 1. Firebase web configuration
In Firebase Console, open Project settings → General → Your apps → JOWI AI web app → SDK setup and configuration. Copy the web app configuration into `public/firebase-config.js`. Replace the placeholder values only. The Firebase web config is intended to be public; do not put service-account keys or private credentials in this file.

In Firebase Authentication → Sign-in method, enable Google. Add the Firebase Hosting domain to Authorized domains if it is not already listed.

## 2. Google OAuth client
Create an OAuth client ID of type Web application in Google Cloud project `kidoo-tv`.
- Authorized JavaScript origins: your Firebase Hosting origin, for example `https://kidoo-tv.web.app` (use the actual Hosting domain shown in Firebase Console).
- This first browser-popup implementation uses Google Identity Services token flow; it does not use a redirect callback URI. Do not invent a callback URL.
- Copy the client ID into `googleOAuthClientId` in `public/firebase-config.js`.
- Keep the OAuth app in Testing and add your own YouTube Google account as a test user.

The app requests YouTube read, Analytics read and YouTube write scopes. Google may show a sensitive-scope warning during testing. Only approve access if you recognize the app and intended account.

## 3. Enable APIs
In the same Google Cloud project as Firebase `kidoo-tv`, enable:
- YouTube Data API v3
- YouTube Analytics API

## 4. Hosting
This repository includes `firebase.json` configured to serve the `public/` directory. Deploy from a trusted environment with Firebase CLI after installing and signing in:
```sh
firebase use kidoo-tv
firebase deploy --only hosting
```
The repository intentionally does not contain Firebase credentials. Do not commit `.env`, service-account JSON, refresh tokens, or OAuth client secrets.

## Important limitations
- YouTube access tokens are short-lived and currently held only in browser memory. Reconnect when Google authorization expires.
- This version does not run unattended monitoring or scheduled automatic changes. A secure backend or scheduled worker with server-side token storage is needed for that; do not store refresh tokens in browser storage.
- Title suggestions are conservative local heuristics, not generated predictions. Thumbnail generation, automated A/B testing, retention cohorts and discovery-source reporting are future work.
- YouTube controls its recommendation system. JOWI AI cannot force impressions or guarantee views.
- Metadata changes are always reviewed and confirmed individually. No video deletion is implemented.
