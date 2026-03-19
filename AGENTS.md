# SteelArt Server Context

## Role
- `steelart_server` is the backend implementation workspace for the SteelArt platform.
- Work here must translate agreed app flows and dashboard-backed data into stable `/v1` APIs.
- This folder is not isolated. Always keep `steelart_dashboard`, `steelart_app`, and `steelart_server` terminology aligned.

## Read Order
- `/Users/donggyunyang/code/steelart/AGENTS.md`
- `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_MVP_BRIEF.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_STRUCTURE.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md`
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/README.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/README.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/SERVER_ARCHITECTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/MASTER_PLAN.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md`

## Source Of Truth
- UI behavior, page names, and flows: Figma first, then the root app docs.
- API contract: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- Persistence and schema: `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- Raw DDL when exact DB details matter: `/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql`
- Operational workflows and content admin behavior: `steelart_dashboard`

## Current Status
- This directory has completed the initial scaffold stage.
- 루트 `template.yaml`, 루트 `samconfig.toml`, 공통 런타임 모듈 `src/shared`, 도메인별 Lambda 핸들러 골격이 이미 존재한다.
- Continue implementation from the current codebase and local docs instead of treating this folder as empty.
- Keep local documentation files under `docs/`. Exceptions: root-level `AGENTS.md` and `README.md`.
- Manage local documentation in Korean.

## Confirmed API / Product Decisions
- Base path is `/v1`.
- There is no logout API.
- There is no nickname duplication-check API.
- Home data is not fetched via a single aggregate API.
- Home "region" should be interpreted as `zones`.
- Artwork search is one API and matches artwork title, artist name, and place name.
- Recent search history is app-local only using `AsyncStorage`.
- Artwork list filters accept multiple `placeId`, `artistType`, and `festivalYear` values.
- `artistType` maps to `artists.type`.
- Artwork detail should expose all festival years from `artwork_festivals`.
- Favorite-only filtering on the map is client-side, not server-side.
- Map bottom sheet reuses artwork detail API.
- Map search reuses the common artwork search API.
- Notices and external links are hardcoded in the app, not served by API.
- Location permission is handled in app state and OS permission flow, not by server API.
- Course check-in is allowed only for official courses.
- Check-in uses a 10m base rule with slight GPS tolerance.

## Server Working Rules
- Prefer `Node.js 24 + TypeScript` aligned with the rest of the workspace.
- Prefer `mysql2` raw SQL and `zod` validation unless the user explicitly asks for a different stack.
- Keep API handlers thin. Put business logic in domain services and SQL in repositories.
- Add new local documentation files under `docs/` and update references when paths change.
- Write new local documents in Korean, and keep updated documents in Korean as they evolve.
- Do not introduce product behavior that conflicts with root app docs or the server API draft.
- If implementation needs an API contract change, update the root draft first or together.
- Before schema changes, check whether `steelart_dashboard` admin flows and seed data are affected.

## Practical Expectations
- Identify whether a change belongs to auth, profile, home, search, artworks, map, or courses.
- Keep read APIs simple first. Add write flows after auth and core reads are stable.
- Treat geolocation, likes, and course check-ins as cross-cutting concerns with app impact.
