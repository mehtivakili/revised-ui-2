# Migration Plan

## P0: Security And Auth

- Rotate the exposed legacy database password from `auth/db.php`.
- Move all secrets to `.env.local`; keep only `.env.example` in source control.
- Replace phone-only login with SMS OTP:
  - `POST /api/auth/otp/request`
  - `POST /api/auth/otp/verify`
  - short OTP lifetime
  - per-phone and per-IP rate limits
  - one-time code consumption
- Regenerate sessions after successful login.
- Set cookies with `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`, and a shorter default lifetime.
- Add CSRF protection for state-changing form/API actions.
- Add user roles: `user`, `admin`.
- Add admin-only middleware and route protection.
- Stop returning database exception details to clients.

## P1: Structure And Routing

- Use App Router pages instead of toggling many `<main>` sections with JavaScript.
- Planned routes:
  - `/`
  - `/login`
  - `/calculators`
  - `/calculators/capacity`
  - `/calculators/dori`
  - `/calculators/lens`
  - `/calculators/view-angle`
  - `/calculators/raid`
  - `/calculators/ipv4`
  - `/calculators/ip`
  - `/calculators/wireless`
  - `/calculators/fresnel`
  - `/calculators/ack`
  - `/calculators/mw-dbm`
  - `/calculators/sensitivity`
  - `/calculators/planner`
  - `/admin`
- Remove the duplicate public `index.html` app copy.
- Replace hardcoded `/hamyardoorbin` paths with framework routes.

## P2: Data Model

- Suggested tables:
  - `users`: id, phone, full_name, role, created_at, updated_at
  - `otp_challenges`: id, phone, code_hash, expires_at, consumed_at, attempts, request_ip
  - `devices`: id, user_id, name, payload_json, created_at, updated_at
  - `audit_events`: id, actor_user_id, action, metadata_json, created_at
- Save calculator/device state server-side for signed-in users.
- Keep anonymous local draft state only as a temporary convenience.

## P3: Calculator Correctness

- Move formulas into `src/lib/calculators/*`.
- Add unit tests for storage, RAID, IPv4/IP, wireless, Fresnel, ACK, lens, DORI, and sensitivity.
- Decide and document unit conventions:
  - network Kbps/Mbps: decimal, unless explicitly binary
  - storage GB/TB: decimal or binary, shown clearly
- Replace silent `0` results with validation messages.
- Include `/0`, `/31`, and `/32` behavior intentionally for IPv4.

## P4: UI, UX, I18n

- Use the bundled Persian font consistently across all pages.
- Normalize Persian and Arabic digits from input before calculation.
- Use Latin digits for technical calculation fields unless the UI explicitly asks for localized display.
- Replace alert/confirm flows with inline messages and dialogs.
- Fix mobile layout:
  - collapse all 2/3/4-column forms
  - remove fixed-width input assumptions
  - add `min-width: 0`, `overflow-wrap`, and predictable grid sizing
- Replace clickable `div`s with buttons/links.
- Add keyboard focus states and ARIA labels.
- Persist theme and language preferences.

## P5: Production Hardening

- Add security headers.
- Use hashed Next.js assets instead of manual one-year caching.
- Rebuild PWA service worker so it never serves authenticated pages from stale public fallbacks.
- Add lint, typecheck, and automated tests to CI.
