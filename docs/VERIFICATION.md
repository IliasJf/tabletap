# Verification

## Passed

- TypeScript: `npm run typecheck` (no errors).
- Automated tests: `npm test` — 14 passed, 0 failed.
- Local browser bundle: `npm run build:preview`.
- Design source lint: 0 failures, 0 warnings on the customer component and stylesheet.
- SQLite migration generated from the Drizzle schema; the local adapter applied it and saved/read a real restaurant catalog.
- Browser: menu loaded with all 11 dishes and no broken images.
- Browser: two green toasts with egg totaled 160 MAD; delivery added 15 MAD and the order preview totaled 175 MAD.
- Browser: WhatsApp sending remained disabled for a blank business number; no message was sent.
- Browser: local owner sign-in, initial catalog save, and reading the saved customer menu.
- Browser: QR SVG rendered and table 5 appeared in its encoded destination link and customer menu.
- Browser: French customer copy, Arabic menu/checkout labels, and RTL direction.
- Responsive measurements: 1440, 768, 390, and 320 pixel viewports; document widths stayed within the viewport. Desktop, mobile, and dashboard screenshots are included.

## Not verified

- Production Worker build: blocked by Windows sandbox errors when Vite/esbuild launched subprocess pipes (`spawn EPERM`). The independent local preview bundle succeeded.
- Production D1 and real ChatGPT identity: source integration is included, but no hosted version was deployed.
- Public hosting: automatic approval review blocked passing the source repository credential to the publishing helper. The created Site has no published version and its expected address must not be treated as live.
- Actual WhatsApp delivery and restaurant acceptance: deliberately not performed. The app prepares a message for the customer to send.
- Physical phone QR scan and printed output: QR generation/link parameters were checked in-browser; a customer must use a deployed address rather than loopback.

The raw browser inspector could not be used in this environment; checks used the supported in-app browser, screenshots, DOM measurements, and interaction testing. No unsupported browser automation was installed.

## Local preview data

Local menu records are stored under `.sites-runtime/preview.sqlite`, outside the source archive and ignored by Git. Local sessions are development-only, generated per server run, HttpOnly, and restricted to loopback. Hosted production uses trusted Sites-dispatched identity and per-owner D1 rows. Never publish the development HTTP adapter as an Internet-facing server.
