# Nexus Production Setup Checklist

This is an operational checklist, not legal advice. Do not treat Nexus as ready for a broad public launch until each item has been verified.

## Required production environment

Configure these in the hosting provider's private environment-variable settings, not in GitHub files:

- `NODE_ENV=production`
- `SESSION_SECRET`: a long, randomly generated secret that stays stable between deployments
- `DATABASE_URL`: a connection string for a managed, persistent PostgreSQL database
- `RESEND_API_KEY`: API key from your Resend account
- `EMAIL_FROM`: sender address verified/authorized in Resend (for initial testing, use the provider-approved sender shown in its dashboard)
- `PUBLIC_BASE_URL`: the canonical HTTPS site URL, e.g. `https://your-nexus-site.example` (use the actual deployed URL)

Do not paste secrets into public issues, screenshots, source code, or chat messages. If a secret is exposed, rotate it.

## Database

1. Create a managed PostgreSQL database with access limited to the application.
2. Set `DATABASE_URL` in the web service environment.
3. Confirm database backups and recovery procedures are enabled.
4. Deploy and confirm the server can create/update its Nexus tables.
5. Configure `RESEND_API_KEY`, `EMAIL_FROM`, and `PUBLIC_BASE_URL`; send a verification email to a real test mailbox. Nexus sends email through Resend HTTPS API, so it does not require outbound SMTP from the Render web service.
6. Create two test accounts and verify unverified accounts cannot sign in, verification links work and expire, and verified account data, profile pictures, privacy preferences, and friend relationships survive a service restart.
6. Confirm account deletion removes the live account and associated friend records.
7. Check backup retention and ensure the privacy policy explains it accurately.

The local `accounts.json` fallback is intended for development, not durable production accounts. Friend APIs require PostgreSQL and return a service-unavailable response when it is not configured. Account registration now requires persistent PostgreSQL plus configured Resend email API delivery. New accounts remain unable to sign in until the verification link is used; links expire after 24 hours.

## Deployment verification

- Confirm HTTPS is enabled and the production service sets `NODE_ENV=production`.
- Confirm `SESSION_SECRET` is stable across restarts.
- Confirm `/health` returns a healthy status.
- Confirm the home page still loads at `/`.
- Confirm requests for private paths such as `/accounts.json`, `/server.js.js`, `/package.json`, `/render.yaml`, and internal `/docs/` paths return 404.
- Test login, logout, account deletion, profile-picture upload/removal, friend request, accept, remove, and hidden-online status using separate test accounts.
- Test multiplayer in two browser sessions, including refreshing and reconnecting.
- Review host logs and set a process for security incidents and required notices.

## Before inviting the public

- Complete the legal operator and contact placeholders in the draft legal documents.
- Have a qualified adult and legal professional review privacy, child-safety, consumer, and state-law obligations.
- Ensure reporting/blocking and moderation procedures are staffed and functional.
- Do not activate purchases until a payment provider, clear prices, refunds, subscription cancellation, tax handling, and support are ready.
