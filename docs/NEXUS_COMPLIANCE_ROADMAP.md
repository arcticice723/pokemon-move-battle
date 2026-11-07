# Nexus Compliance & Public-Launch Roadmap

**Purpose:** Track the privacy, legal, consumer-protection, accessibility, and operational work needed before Nexus is opened to the public or accepts payments.

**Rule:** Verify the current implementation before changing it. A feature mentioned in planning or a previous conversation is not considered complete until it is found in the current code/configuration and tested in the deployed environment.

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
