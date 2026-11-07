# Nexus Compliance & Public-Launch Roadmap

**Purpose:** Track the privacy, legal, consumer-protection, accessibility, and operational work needed before Nexus is opened to the public or accepts payments.

**Rule:** Verify the current implementation before changing it. A feature mentioned in planning or a previous conversation is not considered complete until it is found in the current code/configuration and tested in the deployed environment.



## Phase 0 audit results — 2026-11-07

**Audit scope:** Static review of the default `main` branch source files available in GitHub. This is a code/configuration review, not a live penetration test or a verification of Render environment variables, database contents, vendor dashboards, or browser behavior. Do not mark production controls complete until those checks are performed.

### 0.1 Repository and deployment inventory — Partially verified
- [x] Repository identified: `arcticice723/pokemon-move-battle`, default branch `main`.
- [x] Runtime/config files found: `server.js.js`, `package.json`, `render.yaml`, `index.html`, `account.html`, `legal.html`, `styles.css`, `pokemon.html`, and `character-guess.html`.
- [x] Runtime dependencies in `package.json`: Express, Socket.IO, and pg. The server also calls Resend's email API directly using built-in `fetch`.
- [ ] Verify actual Render service, deployed commit, `DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_BASE_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` in the hosting dashboard. Values were not accessible from repository source.
- [ ] Confirm whether any analytics, monitoring, CDN, image, or other providers are configured outside the checked dependency manifest.

### 0.2 Existing legal pages — Found, explicitly draft only
- [x] `index.html`, `account.html`, and game pages link to `/legal.html#privacy`, `#terms`, `#community`, and `#purchases`.
- [x] `legal.html` exists and prominently says its sections are preliminary drafts and not final legal documents.
- [ ] Draft privacy policy does not yet name the operator, contact channel, actual hosting/vendor list, retention periods, or full applicable user-rights process.
- [ ] Terms still need operator identity, age requirements, governing law, support contact, finalized moderation/account-action process, and effective date.
- [ ] No standalone cookie policy section was found.

### 0.3 User data inventory — Partially mapped from source
- [x] Account fields in the PostgreSQL schema include username, email, password hash, creation time, avatar data, online-visibility preference, and email-verification flag.
- [x] Session cookie contains a signed account identifier and expiry; game state includes room codes, player names, moves, character assignments, questions/answers, and chat messages in server memory.
- [x] Friend relationship records and presence state are implemented; profile images are stored as data URLs in the account record.
- [ ] No complete data-flow/retention inventory exists yet for hosting logs, database backups, email provider, browser storage, and any external game-data API.

### 0.4 Account lifecycle and security — Partially implemented; several launch blockers
- [x] Account registration/login/logout endpoints, password hashing with Node crypto scrypt, signed HttpOnly session cookie, account deletion endpoint with password confirmation, and account deletion UI are present.
- [x] Account deletion removes the account row; the friendship schema uses cascading foreign keys. Connected sockets for that account are disconnected.
- [x] Authentication rate limits exist for login, registration, deletion, and friend requests.
- [ ] **Critical verification/fix:** registration currently inserts accounts with `email_verified=TRUE` and returns `verificationRequired:false`; the account page explicitly says email verification is temporarily disabled. Verification-email code and a verification endpoint exist, but the registration path does not issue a token or send the email. Do not describe email verification as active.
- [ ] **Critical configuration check:** production login/registration are disabled without PostgreSQL, but the actual Render `DATABASE_URL` and persistence configuration are unverified.
- [ ] **Security hardening:** `SESSION_SECRET` falls back to a random process-start value; production logs a warning if it is missing. Confirm a stable secret is configured in production.
- [ ] Rate-limit buckets are process-local memory, so limits reset on restart and are not shared across multiple instances. Review a persistent/shared limiter before launch.
- [ ] Review CSRF protections and all state-changing HTTP endpoints; the session cookie uses `SameSite=Lax`, but no explicit CSRF token mechanism was found in the inspected routes.
- [ ] No password-reset/change workflow was found in the inspected account UI/routes. Decide whether this is needed for launch and implement a secure recovery process.
- [ ] Verify account deletion against database backups, hosting logs, and all processors. The UI acknowledges backups may retain limited copies but gives no retention duration.
- [ ] PostgreSQL connection configuration sets `rejectUnauthorized:false` for non-local DATABASE_URL connections. Review and replace with certificate verification where supported before production use.

### 0.5 Cookies and browser storage — Partial source evidence
- [x] A first-party `nexus_session` cookie is set with `HttpOnly`, `SameSite=Lax`, `Path=/`, a seven-day max age, and `Secure` in production.
- [x] Game pages use browser `localStorage` to save temporary room-resume tokens/session details.
- [ ] No cookie banner, consent manager, analytics tag, or cookie inventory was identified in the reviewed HTML/CSS and package manifest.
- [ ] Verify actual browser requests/cookies in production and determine legal consent requirements. A banner should only be added if the actual technologies and applicable law call for it.

### 0.6 Third-party SDKs and assets — Partially inventoried
- [x] Declared npm dependencies are limited to Express, Socket.IO, and pg. Resend is called via HTTP API, not an installed SDK.
- [ ] Server code calls Resend for verification email, but current registration flow does not invoke the sender. Verify provider configuration and data transfer if email is enabled.
- [ ] Inspect full transitive dependency tree, external API calls (including game-data sources), hosting/CDN services, fonts, and every image/audio/icon asset. No asset-license register was found in the reviewed files.

### 0.7 Forms and email — Needs work
- [x] Registration form collects username, email, and password; account page has profile/friend/privacy/delete controls.
- [ ] No privacy notice or separate optional marketing consent was visible beside registration in the inspected account page.
- [ ] No newsletter/marketing signup or unsubscribe flow was found in the inspected files. Mark unsubscribe **Not applicable yet** unless marketing email is introduced.
- [ ] Verification-email implementation is incomplete as described in 0.4. No password-reset email flow was found.

### 0.8 Payments — Not applicable yet (source evidence)
- [x] No payment processor or checkout dependency was present in the declared dependencies, and `legal.html` says cosmetics and membership are future features and purchases should remain disabled until ready.
- [ ] Verify no live payment links, external checkout, or provider configuration exists outside the checked source files. Keep sales disabled until purchase disclosures, cancellation, refunds, and support are ready.

### 0.9 Age and audience — Not implemented/decision required
- [x] Community guidelines describe a general-audience experience.
- [ ] No minimum-age statement, age gate, parental consent workflow, or age-specific privacy controls were found in the inspected account/legal pages.
- [ ] Decide the intended minimum age and permitted audience before public launch. Obtain qualified legal review of applicable children's/youth privacy requirements before permitting children to use the service.

### 0.10 Accessibility — Partial source evidence; manual testing outstanding
- [x] HTML pages declare a document language and viewport. Several controls have explicit labels/ARIA names; status/chat regions use live/status semantics; navigation landmarks are present.
- [ ] The account form does not show a privacy notice; labels and keyboard flows need a full pass across all games.
- [ ] `styles.css` removes the default input outline and changes border color on focus; a consistent, high-visibility focus indicator for all interactive controls was not verified.
- [ ] No contrast measurements, screen-reader results, zoom/reflow results, or keyboard-only test evidence exists in the repository.
- [ ] Review the Pokémon page's embedded CSS/HTML separately; it does not use the shared stylesheet for its main layout.

### 0.11 Claims, reviews, and communications — Partial
- [x] No reviews/testimonials or public user-rating system were found on the inspected home page.
- [x] Home page describes two games; the README also lists two games.
- [ ] Verify every public feature claim against current production behavior, including room capacity, refresh/rejoin behavior, account persistence, and friend presence.
- [ ] No marketing email program was identified; unsubscribe remains **Not applicable yet** unless one is added.

### Immediate findings to address after the audit
1. Confirm production Render/database/session-secret settings and deployed commit.
2. Resolve the email-verification mismatch: either implement verification end-to-end or remove misleading verification-related code/copy and accurately disclose the account flow. Do not claim verified email today.
3. Complete the data-flow and retention inventory, including backups, logs, Resend, and game-data APIs.
4. Add an appropriate privacy notice to account registration and decide age eligibility/handling before launch.
5. Review session/CSRF/rate-limit/database TLS hardening.
6. Complete accessibility and asset-license audits.
7. Keep paid features and marketing email marked not applicable until actually introduced.



## Phase 1 implementation update — branch `compliance/phase-0-hardening` (2026-11-07)

These changes are committed to a review branch and are **not deployed to production**. Automated and live-environment tests have not yet run. A draft pull request is intended for review before merge.

### Implemented in source on this branch
- [x] Production startup now requires a stable `SESSION_SECRET` of at least 32 characters.
- [x] PostgreSQL TLS certificate verification is enabled for non-local database connections.
- [x] Production health check verifies database readiness and returns 503 when production persistence is missing or unavailable.
- [x] Authentication rate limits use a PostgreSQL table when configured, so counts are shared across instances; local development retains in-memory limits.
- [x] Cross-origin state-changing HTTP requests are rejected using Origin and Fetch Metadata checks.
- [x] New account registration creates unverified accounts, generates a one-time token, stores only its SHA-256 hash, and sends a 24-hour verification link through Resend.
- [x] Login rejects unverified production accounts; verification sets a verified timestamp.
- [x] Legacy accounts created by the old path are marked unverified unless a verified timestamp exists; affected users must verify again.
- [x] A privacy-preserving resend-verification endpoint and account-page form were added.
- [x] Registration requires an explicit Terms acceptance and Privacy Policy acknowledgement; version/timestamp fields are stored.
- [x] Registration UI no longer claims email verification is disabled.
- [x] Static hosting blocks project metadata, dependency directories, and documentation paths.
- [x] Shared styling and Pokémon game styling now provide visible keyboard focus; primary button text was changed to a high-contrast dark foreground; reduced-motion preferences are respected.
- [x] Cookie/local-storage policy draft added and linked from site footers.
- [x] Privacy draft expanded to disclose observed account/game data, local storage use, and the browser-side PokéAPI request.
- [x] Age eligibility and operator-contact sections now explicitly identify unresolved decisions rather than inventing details.
- [x] Added `docs/PRODUCTION_CONFIGURATION.md` and `docs/DATA_AND_ASSET_INVENTORY.md`.
- [x] Added `npm test` syntax-check command and a GitHub Actions workflow for pull requests and pushes to main.

### Still blocked or requiring verification
- [ ] Run `npm test` and review the GitHub Actions result; this environment did not execute the repository's Node runtime.
- [ ] Verify Render environment variables and deployment settings. Required values are listed in `docs/PRODUCTION_CONFIGURATION.md`; never put secret values in GitHub.
- [ ] Verify PostgreSQL TLS connectivity and database persistence against the actual configured provider.
- [ ] Test Resend delivery, sender-domain verification, expired tokens, resend behavior, and legacy-account re-verification in a staging environment.
- [ ] Review the email-verification migration with care before production: it intentionally requires legacy accounts without a verified timestamp to verify again.
- [ ] Review Origin checks with the exact production `PUBLIC_BASE_URL`; a wrong value can reject legitimate same-origin writes.
- [ ] Complete password reset/change flow or document the recovery path before opening accounts to the public.
- [ ] Add deletion retention details only after confirming provider backups/logs and processor deletion behavior.
- [ ] Confirm live cookie/storage behavior and whether any provider sets additional cookies. No cookie banner was added because the reviewed source showed only essential session/resume storage; reassess if analytics or advertising is introduced.
- [ ] Complete manual screen-reader, keyboard-only, zoom/reflow, and WCAG contrast testing across all pages and game flows.
- [ ] Complete asset-by-asset license review, including Pokémon and other third-party character/franchise IP. The inventory records risks but does not grant rights.
- [ ] Set the minimum permitted age and determine whether parental consent is required. Do not treat an age checkbox as a substitute for legally required parental consent.
- [ ] Supply responsible operator legal identity and a dedicated privacy/support contact. Do not publish a personal home address without appropriate guidance.
- [ ] Obtain qualified legal review of Privacy, Terms, Community, Cookie, and future Purchase/Refund policies before calling them final or relying on them.

### Policy publication status

**All policy pages remain drafts.** The Privacy and Cookie drafts have been expanded to match source-observed behavior, and the Terms/Community/Purchases sections remain preliminary. They are not final because the responsible operator, age eligibility, jurisdictions, provider/retention facts, and legal review are unresolved. No policy should be labelled finalized until those inputs are verified and counsel has reviewed the result.

## Phase 0 — Verify the current state first

Complete this audit before implementing fixes. Record evidence (file path, setting, test result, or screenshot) and mark each item as **Implemented**, **Partially implemented**, **Missing**, or **Not applicable**. Do not infer completion from the presence of a link or UI control alone.

- [ ] **0.1 Repository and deployment inventory**
  - Identify the production branch, current Render service, database, environment variables, email provider, analytics, external APIs, and all third-party packages/SDKs.
  - Confirm which repository version is actually deployed.
- [ ] **0.2 Existing legal pages**
  - Find and review the Privacy Policy, Terms of Service, Community Guidelines, and Purchases & Refunds pages/links.
  - Confirm each page is reachable, accurate, current, and consistent with actual product behavior.
- [ ] **0.3 User data inventory**
  - Trace every data field collected during registration, login, profile editing, friends, presence, gameplay, support, and purchases.
  - Record purpose, storage location, retention period, access, sharing, and deletion behavior for each category.
- [ ] **0.4 Account lifecycle and security**
  - Test registration, email verification, login, password reset, sessions, account deletion, and any confirmation step.
  - Verify deletion across the database, uploaded profile images, logs, backups (where feasible), and third-party services; document exceptions and retention periods.
  - Verify rate limiting and authorization checks on sensitive account endpoints.
- [ ] **0.5 Cookies and browser storage**
  - Inspect cookies, local/session storage, analytics tags, and other tracking technologies.
  - Classify what is strictly necessary and what is optional; determine whether consent is legally required for each jurisdiction and technology.
- [ ] **0.6 Third-party and asset audit**
  - Inventory SDKs, dependencies, APIs, fonts, icons, stock images, audio, and other externally sourced assets.
  - Record provider, data transmitted, purpose, privacy/security terms, and license/attribution requirements.
- [ ] **0.7 Forms and email**
  - Review registration, contact/support, newsletter, and purchase forms for clear notices and optional consent.
  - Identify all email types (verification, security, transactional, and marketing) and test unsubscribe handling for marketing.
- [ ] **0.8 Payments and monetization readiness**
  - Confirm whether any real purchases are enabled. Inventory cosmetic products, prices, taxes/fees shown, recurring billing, membership cancellation, refunds, and payment processor behavior.
  - If payments are not enabled, keep purchase-related requirements marked **Not applicable yet**, not complete.
- [ ] **0.9 Age and audience assessment**
  - Document intended audience, minimum age, age-screening approach, and whether children under 13 are permitted.
  - Assess COPPA and other applicable youth/privacy requirements with qualified legal guidance before allowing children to use the service.
- [ ] **0.10 Accessibility baseline**
  - Test representative pages and game flows using keyboard only, screen reader checks, zoom, and automated/manual contrast checks.
  - Include registration, navigation, dialogs, profile controls, and game interactions.
- [ ] **0.11 Content and claims review**
  - Check public feature descriptions, privacy/security statements, testimonials, ratings, reviews, and pricing claims against what Nexus actually does.
  - If reviews/ratings or marketing emails do not exist, record those items as not applicable yet.

## Phase 1 — Resolve verified gaps in launch order

Work through these in sequence. Each item remains open until its acceptance criteria are tested.

### A. Legal and policy foundations

- [ ] **1. Privacy policy**
  - Explain the data actually collected, purposes, legal bases where applicable, retention, recipients/service providers, international transfers where relevant, user rights, security practices, and contact method.
  - Keep the policy synchronized with the data inventory and actual product behavior.
  - **Done when:** the published policy is accurate, accessible, dated, and reviewed for the jurisdictions in which Nexus operates.
- [ ] **2. Terms of service**
  - Cover account eligibility, account responsibilities, acceptable use, prohibited conduct, user content, moderation/enforcement, service changes, intellectual property, disclaimers, liability, and dispute terms as legally appropriate.
  - **Done when:** users can find and review the terms before creating an account and the terms match actual enforcement and product behavior.
- [ ] **3. Refund and cancellation policy**
  - Explain refund eligibility, request process, timelines, digital cosmetic treatment, membership renewal/cancellation, and any legally required exceptions.
  - Do not promise a blanket no-refund rule where consumer law provides rights.
  - **Done when:** the policy matches the payment processor and every purchase flow; if sales are not enabled, publish only when ready to sell.
- [ ] **4. Cookie and tracking policy**
  - Describe cookies and similar technologies, their purposes, providers, duration, and how users can manage them.
  - **Done when:** the policy matches the Phase 0 browser-storage audit.

### B. Privacy controls and data handling

- [ ] **5. Cookie consent and preferences**
  - If optional cookies/tracking are used and consent is required, provide a clear consent interface with accept, reject, and preference controls of comparable prominence.
  - Do not load consent-dependent tracking before valid consent. Provide a way to change preferences later.
  - If only strictly necessary technologies are used, document why a consent banner is not required rather than adding a misleading banner.
  - **Done when:** behavior is verified in a clean browser session for each consent choice.
- [ ] **6. Form notices and consent**
  - Put concise privacy notices beside relevant forms. Separate optional marketing consent from account/service consent; do not pre-check optional boxes.
  - Collect parental consent only where required by the applicable age/legal assessment.
  - **Done when:** every form has an appropriate notice, consent is recorded where needed, and declining optional consent does not block unrelated core functionality.
- [ ] **7. Data minimization**
  - Remove fields and collection events that are not necessary for a documented purpose.
  - Set retention periods and restrict staff/admin access to data needed for their role.
  - **Done when:** each retained data category has a documented purpose, access rule, and retention/deletion rule.
- [ ] **8. Third-party SDK and provider audit**
  - Remove unnecessary SDKs and integrations. Review permissions, data sharing, security posture, privacy terms, and configuration for retained providers.
  - Update disclosures and vendor agreements where required.
  - **Done when:** every retained provider is documented and approved for its actual use.
- [ ] **9. Remove dark patterns**
  - Make privacy choices, account deletion, membership cancellation, and purchase decisions clear and straightforward.
  - Avoid preselected optional consent, misleading buttons, hidden costs, obstructive cancellation, or deceptive urgency.
  - **Done when:** representative user flows pass a documented usability review.
- [ ] **20. User data deletion**
  - Provide an accessible account/data deletion request path and explain what is deleted, what may be retained by law or for legitimate security purposes, and expected timing.
  - Propagate deletion to applicable processors and uploaded assets; document backup expiration.
  - **Done when:** a test account is deleted and the result is verified across all relevant systems.

### C. Consumer transparency and communications

- [ ] **10. No hidden fees**
  - Display the full price and material billing terms before confirmation, including recurring charges and renewal timing where applicable.
  - Disclose taxes or additional charges clearly when known/required.
  - **Done when:** test purchases show the complete price and billing terms before the user commits.
- [ ] **11. No fake reviews or ratings**
  - Do not fabricate reviews, endorsements, player counts, ratings, or testimonials.
  - If user reviews are added, use genuine feedback and disclose incentives or moderation practices where required.
  - **Done when:** all published social proof is authentic and supportable; otherwise omit it.
- [ ] **12. No unsupported claims**
  - Verify claims about security, privacy, uptime, compatibility, player counts, features, and performance.
  - Avoid claiming certifications or protections that Nexus has not obtained or implemented.
  - **Done when:** public claims have evidence and are updated when product behavior changes.
- [ ] **16. Business/operator details**
  - Provide an appropriate operator name and contact method on relevant legal, privacy, and purchase pages, consistent with applicable law and the operator's privacy needs.
  - Do not publish a personal home address; obtain legal guidance on required business/contact disclosures.
  - **Done when:** required operator disclosures and a monitored contact channel are present.
- [ ] **18. Marketing unsubscribe**
  - Include a working unsubscribe mechanism in marketing emails and honor requests within the legally required timeframe.
  - Keep transactional/security messages separate from marketing.
  - **Done when:** unsubscribe is tested end-to-end and suppresses future marketing messages.
  - **Not applicable yet** if Nexus does not send marketing emails.

### D. Accessibility

- [ ] **13. Alt text and accessible names**
  - Add meaningful alt text to informative images; use empty alt text for decorative images. Give icon-only buttons, form controls, and game controls accessible names.
  - **Done when:** screen-reader review confirms images and controls communicate their purpose.
- [ ] **14. Color contrast**
  - Test the dark/purple theme, text, links, focus indicators, disabled states, and interactive controls against WCAG 2.2 AA contrast targets where applicable.
  - Do not use color alone to communicate state.
  - **Done when:** contrast failures are fixed and representative screens are retested.
- [ ] **15. Keyboard navigation**
  - Ensure all functionality is operable by keyboard, with visible focus, logical focus order, no keyboard traps, and accessible dialogs/menus.
  - Review game controls as well as general site navigation.
  - **Done when:** a keyboard-only pass can complete registration, navigation, account settings, and supported game flows.

### E. Age protection and intellectual property

- [ ] **17. Age policy and protections**
  - Set and publish a minimum-age policy based on the intended audience and legal review.
  - If Nexus is directed to or knowingly collects personal information from children under 13, implement COPPA-compliant parental notice/consent and related controls before collection; otherwise apply an appropriate age-screening and handling approach.
  - Review state and non-US youth privacy requirements as applicable.
  - **Done when:** age handling, notices, consent (if required), data practices, and enforcement are implemented and reviewed by qualified counsel.
- [ ] **19. Image, audio, font, and asset licensing**
  - Use original, public-domain, or properly licensed assets. Keep a register of source, creator, license, permitted use, attribution, and proof of purchase/permission.
  - Check game-related logos, characters, music, and other franchise material separately; a stock-image license does not grant rights to third-party IP.
  - **Done when:** every externally sourced asset has documented rights for the way Nexus uses it, or is replaced.

## Phase 2 — Final launch gate

- [ ] All Phase 0 audit results are recorded.
- [ ] All applicable Phase 1 items are complete and tested.
- [ ] Legal policies have been reviewed by a qualified attorney familiar with the relevant jurisdictions; this checklist is not legal advice.
- [ ] Production deployment has been tested, including account lifecycle, email delivery, privacy choices, accessibility, and error handling.
- [ ] Payment features remain disabled until pricing, refund, cancellation, and required disclosures are ready.
- [ ] A process exists to review this checklist whenever Nexus adds a new data field, SDK, email type, payment feature, audience, or major user-facing feature.

## Status key

- **Not started** — no work verified.
- **Needs verification** — implementation may exist, but evidence/testing is missing.
- **In progress** — work is underway.
- **Blocked** — depends on a decision, provider, or legal review.
- **Complete** — acceptance criteria have been tested and evidence recorded.
- **Not applicable** — feature is not used; reassess if the product changes.

**Important:** This is an engineering and launch-readiness checklist, not a legal certification. Requirements depend on where Nexus operates, who uses it, what data it collects, and whether it processes payments or sends marketing communications.
