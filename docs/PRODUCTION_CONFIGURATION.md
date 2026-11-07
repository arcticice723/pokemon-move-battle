# Nexus Production Configuration & Verification

This guide records required production settings. It does not contain secret values; never commit credentials.

## Required Render environment

| Variable | Required | Purpose | Verification |
|---|---:|---|---|
| `NODE_ENV` | Yes | Set to `production` | Confirm in Render service settings |
| `DATABASE_URL` | Yes for accounts/friends | Persistent PostgreSQL connection string | Confirm database is attached and data survives deploy/restart |
| `SESSION_SECRET` | Yes | Signs account session cookies | Generate a random secret of at least 32 characters; keep stable across deploys |
| `PUBLIC_BASE_URL` | Yes | Canonical HTTPS origin used in email verification links and origin checks | Set to the exact public HTTPS origin, with no trailing slash |
| `RESEND_API_KEY` | Yes for registration | Sends verification emails through Resend | Configure a verified sender/domain and test delivery |
| `EMAIL_FROM` | Yes for registration | Verified sender address | Must be accepted by the configured email provider |

Do not paste secret values into GitHub issues, source code, screenshots, or chat.

## Deployment behavior

- The server now refuses to start in production if `SESSION_SECRET` is absent or shorter than 32 characters.
- PostgreSQL TLS certificate verification is enabled for non-local database URLs. If the provider's certificate chain is invalid, fix the provider/connection configuration rather than disabling verification.
- Production account registration requires PostgreSQL and working email verification configuration.
- Registration sends a one-time verification link that expires after 24 hours. The raw token is not stored in the database; only its SHA-256 hash is stored.
- Existing accounts created by the earlier registration path are marked unverified during migration because that path incorrectly marked accounts verified without sending a verification email. Those users must verify again.
- Authentication rate limits are stored in PostgreSQL when it is configured. Local development uses in-memory limits.
- Cross-origin state-changing browser requests are rejected. Set `PUBLIC_BASE_URL` correctly so legitimate same-origin requests pass.
- Do not enable paid checkout or marketing email until the associated policy and operational work is complete.

## Manual production verification

- [ ] Confirm the deployed commit is the reviewed release commit.
- [ ] Confirm all required environment variables are set in Render without exposing their values.
- [ ] Confirm database TLS succeeds and account data survives a restart/redeploy.
- [ ] Register a test account and verify the email arrives.
- [ ] Confirm an unverified account cannot sign in.
- [ ] Confirm an expired or reused verification token is rejected.
- [ ] Confirm a verified account can sign in and receives a Secure, HttpOnly, SameSite=Lax cookie.
- [ ] Confirm account deletion removes the live account and cascades friendship and verification rows.
- [ ] Confirm no secrets, database files, project docs, package metadata, or dependency directories are served as static files.
- [ ] Confirm health endpoint reports healthy only after checking whether database availability should be part of readiness.
- [ ] Check Render logs for startup errors and unexpected email/database failures.

## Operational decisions still required

- Operator's legal identity and privacy/support contact.
- Intended minimum age and whether the service will knowingly accept children under 13.
- Hosting/database backup retention and log retention periods.
- Final third-party provider list and applicable vendor terms.
- Incident response and user privacy-request handling.
- Qualified legal review of policies for the jurisdictions in which Nexus will be offered.
