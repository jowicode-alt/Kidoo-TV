# JOWI AI — YouTube Creator Intelligence

JOWI AI is being built as an organic-growth workspace for the YouTube channel **@jowicode**. It helps a creator understand channel performance, improve video packaging and make deliberate metadata changes.

## Current web application
The first dashboard foundation is in `public/` and is configured for Firebase Hosting.

- Firebase Authentication sign-in (Google provider).
- Connect a YouTube channel through Google authorization.
- Read channel details and recent uploads with YouTube Data API v3.
- Show 28-day views, watch time and subscribers gained with YouTube Analytics API.
- Surface recurring topic words from existing video metadata.
- Review title and description text and apply changes to one selected video only after an explicit confirmation.
- Responsive desktop and mobile interface.
- No paid promotion, fake views, fake subscribers, engagement manipulation, automated comments, or video deletion.

## Setup
Follow **[docs/SETUP.md](docs/SETUP.md)** for Firebase web configuration, Google OAuth setup and Hosting deployment.

The public Firebase web configuration placeholders are in `public/firebase-config.js`. Replace them with the values from Firebase Console. These client configuration values are not server secrets. Never commit OAuth client secrets, service-account JSON, refresh tokens or private API credentials.

## Current limitations — important
- This is an initial connected-dashboard foundation, not a completed unattended growth agent.
- YouTube OAuth access tokens currently live only in browser memory and expire. Reconnect when prompted.
- Scheduled monitoring, secure refresh-token storage, fully automated metadata optimization, thumbnail generation, and robust traffic-source reporting are not implemented yet.
- Title suggestions are conservative local heuristics, not a claim of AI-predicted performance.
- YouTube decides what appears in Home and Suggested. No external app can force recommendations or guarantee views.
- Metadata updates require a separate confirmation for each video.

## Repository notes
The earlier automation prototype's `android/`, `backend/`, `docs/` legacy material and workflow files have not yet been removed. The new web app is being added without destroying the repository's history. Review before any legacy cleanup.

## Free-first deployment
The intended first deployment target is Firebase Hosting on the Spark plan. Do not enable billing or deploy paid infrastructure as part of setup. Firebase Hosting deployment requires a trusted Firebase CLI session; no credentials are stored in this repository.
