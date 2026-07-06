# Revised UI 2

This folder is the migration target for fixing the issues found in the legacy PHP/static app.

The direction is a Next.js App Router project with:

- Real routes instead of one hidden-section page.
- API routes for auth, OTP/SMS, admin, users, and saved calculator data.
- Shared calculator libraries with tests instead of formulas scattered through UI code.
- Consistent number formatting and digit normalization.
- A responsive, accessible UI shell.
- Secrets loaded from environment variables only.

## Priority

1. Security and auth foundation.
2. Project structure and routing.
3. Data model, admin panel, and SMS/OTP.
4. Calculator correctness and tests.
5. Responsive UI, typography, accessibility, and i18n.
6. PWA/cache hardening and production build.

## Local commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
```

The project is scaffolded but not fully implemented yet. See `MIGRATION_PLAN.md` for the working checklist.
