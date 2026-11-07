# Nexus Data Inventory & Asset Register

Last reviewed: 2026-11-07
Scope: Static source review of the `compliance/phase-0-hardening` branch. This is an initial inventory, not a complete production data map.

## Data inventory

| Data | Source | Purpose | Storage/visibility observed in source | Retention status |
|---|---|---|---|---|
| Username | Registration / player entry | Account identity and gameplay display | PostgreSQL account row; room state in server memory; visible to room players | Account retention and room cleanup require production verification |
| Email address | Registration | Account identity and verification | PostgreSQL; sent to Resend for verification when configured; not intended for other players | Account deletion exists; backup/log retention unknown |
| Password | Registration/login | Authentication | Hashed with Node scrypt and salt; password itself is not intentionally stored | Password reset/recovery process not found |
| Session identifier | Successful login | Maintain signed-in session | Signed, HttpOnly, SameSite=Lax cookie; seven-day configured lifetime | Browser expiry; server-side revocation is not separately implemented |
| Avatar image | Account profile | Display profile image | Data URL stored in PostgreSQL; shared to game/friend UI where applicable | Removed with account row; backups unknown |
| Online visibility preference | Account setting | Let user hide online status | PostgreSQL boolean | Account deletion cascades |
| Friend relationships | Friend actions | Friend list and requests | PostgreSQL table with account foreign keys and cascade deletion | Account deletion cascades; verify backups |
| Terms acceptance / privacy acknowledgement | Registration form | Record acceptance/notice acknowledgement | Version and timestamp fields in PostgreSQL | Account deletion removes row; backup retention unknown |
| Email verification token hash | Registration email flow | Verify email address | SHA-256 hash and 24-hour expiry in PostgreSQL; raw token sent by email | Expired rows are not yet automatically purged |
| Rate-limit key hash | Authentication/friend endpoints | Abuse prevention | HMAC of IP+route, count, and expiry in PostgreSQL; raw IP is not stored in this table | Expired rows are periodically purged |
| Room code / player name / resume token | Game client | Rejoin after refresh | Browser localStorage and server in-memory room state | Local storage remains until cleared/overwritten; room cleanup is in-memory |
| Moves, guesses, questions, answers, chat | Gameplay | Run multiplayer games | Server memory and Socket.IO broadcasts | No durable game history observed; process restart clears room state |
| Network/hosting logs | Infrastructure | Operations/security | Provider-controlled; exact fields and retention not accessible in source | Must be confirmed in Render/provider settings |
| Pokémon move catalog request | Pokémon game browser | Load move names from PokéAPI | Direct browser request to `https://pokeapi.co/api/v2/move?limit=10000` | Provider's own logs/retention; review PokéAPI terms and privacy notice |

## Third-party services found in source

| Service | Use | Data potentially shared | Current verification |
|---|---|---|---|
| PokéAPI | Browser-side move catalog request | Browser request metadata such as IP address; no Nexus account credentials are intentionally sent | Source call confirmed; terms/provider privacy details still need review |
| Resend | Verification email API | Recipient email address and verification-link content | Code exists; production environment configuration and delivery are unverified |
| Render | Deployment is configured through `render.yaml` | App requests, network metadata, and potentially logs | Actual live service, logs, region, and retention must be checked in dashboard |
| PostgreSQL provider | Account, friend, verification, and rate-limit data | Data stored in configured database | Actual provider, backups, region, and retention must be confirmed |

No advertising or analytics SDK was identified in the declared direct npm dependencies or inspected page source. This is not proof that no provider-side tracking exists; verify live browser requests and hosting configuration.

## Asset register

| Asset/source | Use | Rights status | Required action |
|---|---|---|---|
| Nexus-authored HTML/CSS/JS | Website and game UI | Presumed original project code; ownership should be confirmed | Record authorship and review any copied snippets |
| PokéAPI | Pokémon move data | API terms/attribution and underlying Pokémon IP rights are separate questions | Review PokéAPI terms; do not assume API access grants rights to Pokémon names, marks, or franchise assets |
| Pokémon name and game concept | Pokémon Move Battle | Third-party franchise intellectual property | Obtain appropriate legal review; consider licensing or changing branding/content if needed |
| Fictional characters/franchise names | Who Am I? character catalog | Third-party intellectual property | Review each character/name/mark and distribution context |
| Emoji/system fonts | Decorative UI | Depends on platform/font source | Avoid copying proprietary icon packs; document any external fonts |
| User-uploaded profile pictures | Profile avatars | User must have rights to upload; rights/consent and moderation terms need definition | Add clear upload rules and moderation/takedown process |

## Open data/asset actions

- [ ] Confirm Render service, database provider, database region, backup policy, and log retention.
- [ ] Confirm Resend is configured and review its data processing/privacy terms.
- [ ] Review PokéAPI terms and document the direct browser request in the privacy policy.
- [ ] Inventory all images, icons, audio, fonts, and any copied code across the complete repository.
- [ ] Review third-party game IP, including Pokémon and character/franchise names, with qualified legal guidance.
- [ ] Define account deletion effects on backups, logs, and processor-held data.
- [ ] Define retention/purge jobs for expired verification tokens and rate-limit rows.
- [ ] Review whether gameplay chat needs reporting/moderation and what safety records are retained.
