# SteelArt Server Folder Structure Draft

## Purpose
- This document proposes the first code layout for `steelart_server`.
- It is designed for domain-based Lambda ownership while keeping shared code explicit and easy to navigate.

## Proposed Top-Level Structure

```text
steelart_server/
  AGENTS.md
  README.md
  docs/
    README.md
    SERVER_ARCHITECTURE_DRAFT.md
    FOLDER_STRUCTURE_DRAFT.md
    IMPLEMENTATION_SEQUENCE.md
    research.md
  package.json
  tsconfig.json
  .env.example
  pnpm-lock.yaml
  infra/
    cdk/
      bin/
      lib/
      constructs/
  src/
    lambdas/
      auth/
        handler.ts
      users/
        handler.ts
      home/
        handler.ts
      search/
        handler.ts
      artworks/
        handler.ts
      map/
        handler.ts
      courses/
        handler.ts
    domains/
      auth/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      users/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      home/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      search/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      artworks/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      map/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      courses/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
    shared/
      api/
        errors.ts
        response.ts
        route.ts
      auth/
        guard.ts
        token.ts
        providers/
          kakao.ts
          apple.ts
      db/
        pool.ts
        tx.ts
      env/
        server.ts
      geo/
        distance.ts
      logger/
        logger.ts
      utils/
        pagination.ts
        time.ts
      validation/
        parse.ts
  tests/
    unit/
    integration/
  scripts/
    local/
```

## Documentation Rule
- Keep local documentation files under `docs/`.
- Reserve root-level `AGENTS.md` and `README.md` for workspace entry guidance only.
- When document paths change, update cross references in `AGENTS.md`, `README.md`, and related docs together.

## Why This Layout

### `src/lambdas`
- Keeps deployment units visible.
- Each folder owns one Lambda entrypoint and only HTTP translation logic.

### `src/domains`
- Keeps business logic grouped by domain instead of by technical layer only.
- Makes it easier to reason about API ownership when new routes are added.

### `src/shared`
- Prevents repeated auth, DB, response, and validation code.
- Keeps cross-domain concerns centralized.

### `infra`
- Keeps AWS deployment code separate from runtime logic.
- Makes it possible to evolve stacks, stages, and secrets without polluting API code.

### `tests`
- Unit tests target service and mapper logic.
- Integration tests target route-to-DB behavior.

## Lambda Entrypoint Rule
- Lambda handlers should stay thin.
- They should call shared route helpers, parse input, invoke service methods, and return standardized responses.
- They should not contain raw SQL or complicated business branching.

## Domain Folder Rule
- `service.ts` owns business rules.
- `repository.ts` owns SQL.
- `schemas.ts` owns zod input validation.
- `mapper.ts` owns response shaping.
- `types.ts` owns domain-level interfaces that should not depend on raw Lambda event types.

## Shared Folder Rule
- `shared/api` standardizes the `{ data, meta, error }` response shape.
- `shared/auth` standardizes token verification and provider-specific logic.
- `shared/db` standardizes MySQL connection and transaction handling.
- `shared/geo` centralizes distance calculation to avoid check-in and map drift.

## Routing Style Recommendation
- Keep HTTP route definitions near each Lambda handler.
- Avoid a global mega-router for every domain at once.
- Within each Lambda, route by method and path segment in a small, explicit way.

## Suggested First Files To Actually Create
- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/shared/env/server.ts`
- `src/shared/db/pool.ts`
- `src/shared/api/response.ts`
- `src/shared/api/errors.ts`
- `src/shared/auth/guard.ts`
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`
- `infra/cdk/bin/app.ts`
- `infra/cdk/lib/steelart-server-stack.ts`

## Files Not Needed On Day One
- separate upload modules
- search history persistence modules
- notices management modules
- external link management modules
- location permission persistence modules
