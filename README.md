# steelart_server

## Status
- This directory is the active SteelArt backend workspace.
- Initial scaffold is already in place, including root `template.yaml`, root `samconfig.toml`, `src/shared`, Lambda handlers, and docs under `docs/`.
- The goal is to let a new thread continue from the current backend baseline without rebuilding context from scratch.

## Read First
1. `AGENTS.md`
2. `docs/README.md`
3. `docs/SERVER_ARCHITECTURE_DRAFT.md`
4. `docs/FOLDER_STRUCTURE_DRAFT.md`
5. `docs/MASTER_PLAN.md`
6. `docs/IMPLEMENTATION_SEQUENCE.md`
7. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
8. `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`

## Documentation Rule
- Keep local documentation files under `docs/`.
- Root-level `AGENTS.md` and `README.md` stay at the workspace root as entry documents.
- Local documents are managed in Korean.

## Recommended Starting Point
- Runtime: `Node.js 24 + TypeScript`
- Package manager: `pnpm`
- Infra shape: `API Gateway HTTP API + Lambda + RDS`
- DB access: `mysql2` raw SQL
- Validation: `zod`
- API base path: `/v1`
- Lambda grouping: domain-based, not one Lambda per endpoint

## Environment Notes
- 운영 RDS가 `require_secure_transport=ON`이면 Lambda에 `DB_SSL_CA_PATH`를 주입해야 한다.
- 현재 권장 운영값은 `/var/runtime/ca-cert.pem`이다.
- 로컬 DB가 TLS를 강제하지 않으면 `DB_SSL_CA_PATH`를 비워도 된다.

## What Should Happen In The Next Server Thread
- Confirm the current implementation baseline against `docs/SERVER_ARCHITECTURE_DRAFT.md`.
- Continue implementation from `docs/MASTER_PLAN.md` and `docs/IMPLEMENTATION_SEQUENCE.md`.
- Use `docs/plan.md` and `docs/research.md` for the current working step when they exist.
