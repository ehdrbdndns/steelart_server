# Style and conventions
- Follow `AGENTS.md`: keep handlers thin, put business logic in domain services, SQL in repositories.
- Prefer raw `mysql2` SQL and `zod`; do not introduce API behavior that conflicts with root app docs or API draft.
- Local docs under `docs/` should be Korean. Root exceptions: `AGENTS.md`, `README.md`.
- Keep terminology aligned across dashboard/app/server.
- Before schema-affecting changes, consider dashboard admin flows and seed data.
- TypeScript code uses ESM, named exports, explicit domain DTO/types, and shared helpers for API response, auth, DB, validation, and errors.