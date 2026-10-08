# Nexus data inventory and privacy-readiness plan

**Status:** Internal planning document, not a legal opinion or a public privacy policy. Confirm actual deployment settings and data flows before publication.

## 1. Current data inventory (based on repository code reviewed on 2026-10-08)

| Data | Current use/storage | Important gaps or risks |
|---|---|---|
| Username | Stored in account record; also supplied independently by game clients and held in in-memory rooms | Game identity is not yet linked to authenticated account identity; users may choose names that differ from their account username |
| Email address | Stored in account record; used for login | No email verification or account recovery flow is visible in the reviewed code; must remain private |
| Password | Submitted during registration/login; stored as a salted scrypt hash | No visible login/register rate limiting; monitor resource use and add throttling before public growth |
| Session token | Signed token in an HttpOnly, SameSite=Lax cookie, valid for seven days | Production requires a stable SESSION_SECRET; a random fallback invalidates sessions on restart and is not suitable for reliable production operation |
| Profile picture | Resized image data URL stored in PostgreSQL avatar_data or local accounts.json fallback | Stored as image data in the account database; decide retention/deletion behavior and consider object storage if scale makes database rows too large |
| Game room state | Room codes, usernames, moves, turn/timer state, character assignments, question/answer state, solved state | Mostly in server memory; expected to disappear on restart; no durable game-history feature is visible |
| In-game chat | Character-game messages emitted to room members | No persistent chat storage was found in the reviewed server flow; hosting/provider operational logs may still exist and need separate review |
| Friend relationships / online status | Not implemented in the reviewed account model | Do not promise these features or their privacy controls until implemented and tested |
| Payments / membership / cosmetics | Not implemented in the reviewed account model | Do not collect payment data or advertise paid entitlements until provider, disclosures, refunds, and entitlement logic are designed |
| Logs and hosting metadata | May be collected by the host or platform | Confirm provider log retention, access, and subprocessors from actual hosting settings and provider terms |

## 2. Storage modes and deployment risks

- **PostgreSQL:** enabled when DATABASE_URL is configured. Confirm that production uses a managed persistent database, credentials are kept in environment secrets, backups are configured, and database access is restricted.
- **Local JSON fallback:** account records are written to accounts.json beside the server. This is not an appropriate durable production store on an ephemeral hosting filesystem. It also creates concurrency and operational risks.
- **Session secret:** set a long, stable, private SESSION_SECRET in the production environment. Do not commit it to GitHub or publish it.
- **Static file hosting:** the server uses a root-directory static host. Private data and server/config files must never be exposed through that middleware. Verify the deployed service after each change.
- **Transport security:** production session cookies are marked Secure when NODE_ENV is production. Confirm production sets NODE_ENV=production and serves HTTPS.
- **Abuse protection:** registration and login currently have no visible rate limiter. Add request throttling, input-size limits, and monitoring before broader public launch.

## 3. Data minimization and retention decisions

Recommended defaults, to be confirmed against legal requirements and actual operational needs:

1. Collect only the account and gameplay information required to run the service.
2. Never display account email addresses in public profiles, game rooms, friend lists, or Socket.IO payloads.
3. Keep online status hidden from non-friends by default; provide an explicit invisible/offline option.
4. Avoid collecting precise location, contacts, advertising identifiers, or cross-site tracking data for the initial release.
5. Decide and disclose how long security logs, abuse reports, and support records are retained.
6. Provide an account-deletion workflow that removes or de-identifies account data and avatar data, invalidates sessions, and handles applicable backup-retention constraints.
7. Document each hosting, database, payment, email, analytics, and moderation provider before enabling it.

## 4. Legal review checklist before public launch

- Determine whether COPPA applies to the actual service, audience, and data flows; if it applies, implement the required notices, parental consent, rights, and safeguards before collecting covered information.
- Review comprehensive state privacy laws and youth-specific laws for Nexus's expected user locations, business size, processing, and applicable thresholds.
- Prepare accurate Privacy Policy and Terms of Service that match actual code and providers.
- Create workflows for applicable access, correction, deletion, and other privacy requests.
- Document incident response and state/federal breach-notification obligations.
- Review consumer-protection, subscription-renewal, cancellation, refund, sales-tax, and business-registration obligations before charging users.
- Obtain qualified legal review before public launch and before introducing targeted advertising, under-13 accounts, or paid subscriptions.

Useful starting points:
- FTC Children's Privacy: https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- IAPP US State Privacy Legislation Tracker: https://iapp.org/resources/article/us-state-privacy-legislation-tracker/
- FTC business guidance: https://www.ftc.gov/business-guidance

## 5. Recommended engineering sequence

1. Protect static hosting and production secrets; confirm persistent PostgreSQL is configured.
2. Add account deletion and session invalidation; decide whether email verification and account recovery are needed for launch.
3. Link authenticated accounts to game sockets safely without exposing email or session tokens to other players.
4. Build friend relationships, presence privacy, blocking, and reporting with server-side authorization.
5. Add automated tests for private endpoints, account ownership, deletion, room reconnects, and unauthorized access.
6. Draft public policies only after the actual data inventory and vendor list are confirmed.
7. Add cosmetic purchases with a payment provider; implement auditable ownership, refunds, and deletion handling.
8. Introduce Nexus Plus only after recurring billing, renewal disclosures, cancellation, and entitlement handling are tested.

## 6. Verification still required

This review is based on repository source, not a penetration test or a live production audit. After deployment, verify that requests for /accounts.json, /server.js.js, /package.json, /render.yaml, and /README.md return 404; verify authenticated APIs cannot be accessed without a valid session; and confirm that production PostgreSQL, SESSION_SECRET, HTTPS, and backups are configured.
