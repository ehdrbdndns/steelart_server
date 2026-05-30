# steelart_server overview
- Backend workspace for the SteelArt platform, exposing stable `/v1` APIs that align with `steelart_dashboard`, `steelart_app`, and root docs.
- Stack: Node.js 24+, TypeScript ESM, AWS SAM/API Gateway HTTP API/Lambda, RDS MySQL via `mysql2`, validation with `zod`.
- Structure: `src/domains/*` holds domain services/repositories/types; `src/lambdas/*` holds thin Lambda handlers; `src/shared/*` holds common API/auth/db/env/geo/logger/validation utilities; tests live in `tests/unit` and `tests/integration`; local Korean docs live under `docs/`.
- Key product/API sources: root `STEELART_SERVER_API_DRAFT.md` for contract, root `STEELART_DB_TABLES.md` and dashboard SQL for schema details.