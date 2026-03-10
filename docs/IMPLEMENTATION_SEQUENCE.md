# SteelArt Server Implementation Sequence

## Purpose
- This document defines the recommended build order for `steelart_server`.
- The sequence is optimized for getting the mobile app unblocked with minimal rework.

## Phase 0. Bootstrap
- Create the basic TypeScript project.
- Add `pnpm`, `tsconfig`, lint/test placeholders, and `.env.example`.
- Set up shared modules for env parsing, DB pool, common response shape, and error handling.
- Set up AWS infra skeleton for API Gateway, Lambda, and environment wiring.

## Phase 0 Output
- project can build
- Lambda entrypoints exist
- shared DB and response helpers exist
- deployment skeleton exists

## Phase 1. Auth And User Foundation
- Implement `POST /v1/auth/kakao`
- Implement `POST /v1/auth/apple`
- Implement `GET /v1/auth/me`
- Implement `PATCH /v1/users/me/onboarding`
- Implement `GET /v1/users/me`
- Implement `PATCH /v1/users/me`
- Implement `PATCH /v1/me/notifications`
- Implement `PATCH /v1/me/language`

## Why Phase 1 Comes First
- The app cannot move past login and onboarding without these APIs.
- Other features depend on a stable user identity and profile shape.

## Phase 2. Read-Heavy Content APIs
- Implement `GET /v1/home/banners`
- Implement `GET /v1/home/zones`
- Implement `GET /v1/home/artworks`
- Implement `GET /v1/home/recommended-courses`
- Implement `GET /v1/search/artworks`
- Implement `GET /v1/artworks`
- Implement `GET /v1/artworks/{artworkId}`
- Implement `GET /v1/artworks/filters`
- Implement `GET /v1/map/artworks`

## Why Phase 2 Comes Second
- These APIs unblock most of the app browsing experience.
- They are mostly read-only, so they stabilize response contracts before write logic is added.

## Phase 3. Engagement And Course Authoring
- Implement `POST /v1/artworks/{artworkId}/like`
- Implement `DELETE /v1/artworks/{artworkId}/like`
- Implement `GET /v1/courses/recommended`
- Implement `GET /v1/courses/mine`
- Implement `GET /v1/courses/{courseId}`
- Implement `POST /v1/courses`
- Implement `PATCH /v1/courses/{courseId}`
- Implement `POST /v1/courses/{courseId}/like`
- Implement `DELETE /v1/courses/{courseId}/like`

## Phase 4. Check-In And GPS Validation
- Implement `POST /v1/courses/{courseId}/checkins`
- Add 10m base check with slight GPS tolerance.
- Standardize check-in failure codes and retry behavior.
- Verify official-course-only rule.

## Phase 5. Hardening
- Add integration tests for auth, artworks, courses, and check-in flows.
- Add structured logging and request correlation.
- Review SQL indexes needed for search, map distance retrieval, and likes.
- Decide whether `RDS Proxy` is required for expected Lambda concurrency.

## Data Work That May Be Needed Alongside Phases
- confirm `users` table shape in the real DB
- confirm `artwork_likes` and `course_likes` persistence shape
- verify all `artwork_festivals` rows are returned consistently
- verify `zones` values are suitable for home UI ordering

## Definition Of Done For First Usable Backend
- app login works with Kakao and Apple through server token issuance
- onboarding and profile reads/writes work
- home, artwork, search, and map reads work against real data
- official and user course reads work
- likes work
- official course check-in works with GPS tolerance

## What To Avoid During Early Implementation
- changing app behavior without updating root docs
- inventing extra APIs for notices, recent searches, or map detail
- adding DB abstractions that hide SQL too early
- mixing infra code and business code into the same folders
