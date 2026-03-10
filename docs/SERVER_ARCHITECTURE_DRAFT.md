# SteelArt Server Architecture Draft

## Purpose
- This document proposes the initial backend architecture for `steelart_server`.
- It is a working draft for discussion before code bootstrap.
- It is based on the current app product docs, API draft, and DB summary maintained at the workspace root.

## Goals
- Expose stable `/v1` APIs for `steelart_app`.
- Reuse the same DB model already visible in `steelart_dashboard`.
- Keep auth, geolocation, likes, and course check-in behavior consistent across app and admin.
- Start with a structure that is simple enough for MVP, but not so thin that it collapses when writes and check-ins are added.

## Non-Goals For Initial Bootstrap
- Building a CMS for notices or external links
- Building server-managed recent search history
- Building a separate map-only detail API
- Building a server API for location permission state
- Over-optimizing deployment topology before the domain boundaries are stable

## Recommended Stack
- Runtime: `Node.js`
- Language: `TypeScript`
- Package manager: `pnpm`
- Validation: `zod`
- DB access: `mysql2/promise` with parameter binding
- AWS SDK: v3 modules only
- Infra as code recommendation: `AWS CDK` in TypeScript

## Why This Stack
- `steelart_dashboard` already uses `TypeScript`, `mysql2`, and `zod`.
- Reusing the same validation and SQL style reduces mental overhead and schema drift.
- Raw SQL is acceptable here because the current dashboard also operates close to the DB model and the table set is still easy to reason about.

## Proposed AWS Shape
- `API Gateway HTTP API`
- `Lambda` functions grouped by domain
- `RDS MySQL`
- `Secrets Manager` for DB and auth secrets
- `CloudWatch Logs` for runtime logs and basic operational visibility

## RDS Access Recommendation
- Start with direct `mysql2` connection management only if concurrency is small and controlled.
- Prefer adding `RDS Proxy` when Lambda concurrency becomes non-trivial.
- Treat `RDS Proxy` as recommended infrastructure, especially once map traffic, search, and check-ins are live together.

## Domain-Based Lambda Recommendation
- Use a small set of domain Lambdas instead of one giant Lambda.
- Also avoid one Lambda per endpoint for the first bootstrap because it creates too much routing and deployment overhead too early.

## Proposed Route Ownership
- `/v1/auth/*` -> `auth` Lambda
- `/v1/users/*` and `/v1/me/*` -> `users` Lambda
- `/v1/home/*` -> `home` Lambda
- `/v1/search/*` -> `search` Lambda
- `/v1/artworks/*` -> `artworks` Lambda
- `/v1/map/*` -> `map` Lambda
- `/v1/courses/*` -> `courses` Lambda

## Internal Request Flow
1. API Gateway receives HTTP request.
2. Domain Lambda handler normalizes request and runs auth guard if needed.
3. Zod schema parses path, query, and body input.
4. Domain service executes business logic.
5. Repository layer runs SQL through `mysql2`.
6. Mapper layer shapes DB rows into API response DTOs.
7. Shared response helper returns the common `{ data, meta, error }` shape.

## Recommended Code Layers
- `handler`
  - HTTP event parsing
  - auth guard wiring
  - request validation
  - response formatting
- `service`
  - business rules
  - orchestration
  - transaction boundaries
- `repository`
  - SQL queries
  - row fetching
  - persistence updates
- `mapper`
  - DB row -> API response mapping
- `schema`
  - zod validators for request and response-adjacent DTOs

## Domain Responsibilities

### `auth`
- Kakao login exchange
- Apple login exchange
- token/session validation via `/v1/auth/me`
- provider identity to internal user mapping

### `users`
- onboarding save
- profile read/update
- notification setting update
- language setting update

### `home`
- home banner list
- home zone list
- zone-based artwork card lists
- official recommended course list

### `search`
- artwork search by artwork title, artist name, or place name
- shared search logic for home and map

### `artworks`
- archive list
- multi-value filters
- artwork detail
- artwork like/unlike

### `map`
- nearby artwork marker query
- server-side distance calculation
- zone and keyword aware marker retrieval
- no separate map detail contract

### `courses`
- official course list
- my course list
- course detail
- create/update user course
- like/unlike
- official-course check-in with distance validation

## Auth Direction
- The API draft already assumes the server issues an app token after Kakao or Apple login.
- Keep the first implementation simple and aligned with the draft.
- Do not add logout behavior unless product requirements change.
- Confirm token lifetime and refresh strategy before production hardening, but do not block skeleton bootstrap on that decision.

## Data Rules Already Fixed
- Home region model uses `zones`.
- `artistType` filter uses `artists.type`.
- artwork detail returns the full `artwork_festivals` list.
- recent searches stay in app-local `AsyncStorage`.
- notices and external links stay app-hardcoded.
- map favorite-only filtering stays client-side.
- map bottom sheet uses the existing artwork detail API.

## Geolocation Rules
- Map marker responses should include server-calculated distance when `lat/lng` is provided.
- Course check-in uses a 10m base rule.
- Slight GPS tolerance is allowed around that threshold.
- Exact tolerance number should be decided during implementation and kept explicit in code and docs.

## Security And Ops Baseline
- Validate every input with `zod`.
- Keep SQL parameterized with `?` bindings.
- Centralize auth guard logic instead of re-implementing it per handler.
- Standardize error codes for auth failure, validation failure, not found, conflict, and check-in distance failure.
- Add request correlation or request ID logging from the first bootstrap.

## Media Handling Assumption
- Artwork images, audio URLs, and banner images are treated as stored URLs from the DB.
- Initial server scope does not need to own binary upload flows unless the user asks for admin upload integration later.

## Implementation Recommendation
- Bootstrap infra and shared runtime first.
- Then implement auth and users.
- Then read-heavy domains: home, artworks, search, map.
- Then courses write flows and likes.
- Then official course check-in with GPS tolerance rules.

## Documents To Keep In Sync
- If API shapes change, update `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`.
- If schema assumptions change, update `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md` or the raw DDL source.
- If app-facing behavior changes, cross-check root app docs before finalizing.
