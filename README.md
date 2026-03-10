# steelart_server

## Status
- This directory is a documentation-first bootstrap for the SteelArt backend.
- The goal is to let a new thread start from agreed context instead of rebuilding product and API decisions from scratch.

## Read First
1. `AGENTS.md`
2. `docs/README.md`
3. `docs/SERVER_ARCHITECTURE_DRAFT.md`
4. `docs/FOLDER_STRUCTURE_DRAFT.md`
5. `docs/IMPLEMENTATION_SEQUENCE.md`
6. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
7. `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`

## Documentation Rule
- Keep local documentation files under `docs/`.
- Root-level `AGENTS.md` and `README.md` stay at the workspace root as entry documents.

## Recommended Starting Point
- Runtime: `Node.js + TypeScript`
- Package manager: `pnpm`
- Infra shape: `API Gateway HTTP API + Lambda + RDS`
- DB access: `mysql2` raw SQL
- Validation: `zod`
- API base path: `/v1`
- Lambda grouping: domain-based, not one Lambda per endpoint

## What Should Happen In The Next Server Thread
- Confirm the initial architecture choices in `docs/SERVER_ARCHITECTURE_DRAFT.md`.
- Confirm the code layout in `docs/FOLDER_STRUCTURE_DRAFT.md`.
- Bootstrap the actual server project skeleton.
- Start implementation in the order defined by `docs/IMPLEMENTATION_SEQUENCE.md`.
