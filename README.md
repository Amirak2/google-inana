# Inana Gold on Sites

The React storefront is retained. `worker.ts` provides the Fetch entry point,
and `server.ts` retains the existing API routes and pricing/checkout rules.

## Persistence and concurrent orders

Each API request loads a consistent D1 snapshot into request-scoped factories.
Users, sessions, OTP attempts, revoked tokens, reservations, quotes, products,
orders, settings and logs are stored as individual records. There is no mutable
process-wide business state or local-file persistence.

Mutating requests take a short D1 lease before running, including before SMS
delivery. The revision guard and all changed records commit atomically in one
D1 batch before sending the HTTP response. Conflicts return 409 with a retry
message; mutating requests are never automatically replayed. Idempotency keys
prevent duplicate orders. A failed business transaction restores its snapshot.
Reads may return their consistent snapshot when an optional cache write loses a
race. This snapshot design targets a small shop: loading all records per API
request is a known scaling limit; high-volume use needs targeted queries.

Product images and payment receipts use R2. Receipts require the order owner's
session or an administrator session. Orders keep metadata and image references
in D1. Failed commits can leave an unreferenced R2 object, never an exposed receipt.

Prices refresh on demand when viewing rates or requesting/submitting an order;
manual prices remain persistent. No always-running timer is required.

## Configuration

Sites supplies `DB`, `BUCKET` and static assets. Runtime secrets belong in Sites:

- `SESSION_SECRET`: required, at least 32 characters.
- `ADMIN_EMAIL`, `ADMIN_DEFAULT_PASSWORD`: initialize the administrator once.
- `SMS_OTP_API_KEY`: required for real SMS; missing configuration fails closed.
- `GOLD_API_KEY`: optional Navasan key; existing TGJU/mirror fallbacks remain.
- Firebase web configuration is retained. Its authorized domains may need the
  deployed Sites hostname for Google sign-in.

New production storage seeds the repository's product catalog, without the
sample orders or sample audit logs. The repository contains a WAL file but no
complete `inana_gold.sqlite` database; existing live customer/order data must be
exported from its original server for a separate verified import.

## Build and checks

Use Bun and the committed `bun.lock`. Run `bun install --frozen-lockfile`,
`bun run build`, and `bun run lint`. `scripts/build.mjs` emits a bundled Worker,
client assets and generated Drizzle migrations. `esbuild-wasm` avoids a native
filesystem resolver issue in restricted Windows environments.

`node --require ./scripts/windows-os.cjs scripts/verify.mjs` exercises the Worker
in Miniflare: authentication, checkout, idempotency, concurrent last-unit orders,
receipt authorization, restart persistence and logout revocation. Test storage
is isolated from production. `wrangler.jsonc` is local-preview configuration;
production deployment uses only Sites and `.openai/hosting.json`.
