# SteelArt Server API 명세

## 문서 목적
- `steelart_server`에서 사용하는 API를 path, method 기준으로 한 번에 확인하기 위한 전용 명세 문서다.
- 루트 계약 문서인 [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)를 기준으로 하되, 현재 구현 상태는 서버 코드 기준으로 함께 반영한다.
- `auth`, `users` 영역은 현재 구현과 테스트 기준으로 맞춰져 있고, 나머지 영역은 초안 상태다.

## 기준 문서
- 루트 계약 초안: [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)
- DB 기준: [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)
- 구현 코드:
  - [src/lambdas/auth/handler.ts](../src/lambdas/auth/handler.ts)
  - [src/lambdas/users/handler.ts](../src/lambdas/users/handler.ts)

## 공통 규약

### Base Path
- `/v1`

### 인증 방식
- 로그인 성공 시 서버가 앱용 `access token`과 `refresh token`을 발급한다.
- `access token` TTL은 `1시간`이다.
- `refresh token` TTL은 `30일`이다.
- 보호 API는 `Authorization: Bearer {accessToken}` 헤더가 필요하다.

### 공통 성공 응답 형태
```json
{
  "data": {},
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```

### 공통 실패 응답 형태
```json
{
  "data": null,
  "meta": {
    "method": "PATCH",
    "path": "/v1/users/me",
    "requestId": "aws-request-id"
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "설명"
  }
}
```

### 주요 에러 코드
- `UNAUTHORIZED`
- `ACCESS_TOKEN_EXPIRED`
- `REFRESH_TOKEN_EXPIRED`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `METHOD_NOT_ALLOWED`
- `INTERNAL_ERROR`

## 구현 상태 요약

| Method | Path | 상태 | 비고 |
| --- | --- | --- | --- |
| `POST` | `/v1/auth/kakao` | 구현 완료 | 실제 integration test 통과 |
| `POST` | `/v1/auth/apple` | 구현 완료 | provider smoke test 필요 |
| `POST` | `/v1/auth/refresh` | 구현 완료 | 실제 integration test 통과 |
| `GET` | `/v1/auth/me` | 구현 완료 | 실제 integration test 통과 |
| `PATCH` | `/v1/users/me/onboarding` | 구현 완료 | 실제 integration test 통과 |
| `GET` | `/v1/users/me` | 구현 완료 | 실제 integration test 통과 |
| `PATCH` | `/v1/users/me` | 구현 완료 | unit test 기준 동작 확인 |
| `PATCH` | `/v1/me/notifications` | 구현 완료 | 실제 integration test 통과 |
| `PATCH` | `/v1/me/language` | 구현 완료 | 실제 integration test 통과 |
| `GET` | `/v1/home/banners` | 초안만 존재 | 미구현 |
| `GET` | `/v1/home/zones` | 초안만 존재 | 미구현 |
| `GET` | `/v1/home/artworks` | 초안만 존재 | 미구현 |
| `GET` | `/v1/home/recommended-courses` | 초안만 존재 | 미구현 |
| `GET` | `/v1/search/artworks` | 초안만 존재 | 미구현 |
| `GET` | `/v1/artworks` | 초안만 존재 | 미구현 |
| `GET` | `/v1/artworks/{artworkId}` | 초안만 존재 | 미구현 |
| `GET` | `/v1/artworks/filters` | 초안만 존재 | 미구현 |
| `POST` | `/v1/artworks/{artworkId}/like` | 초안만 존재 | 미구현 |
| `DELETE` | `/v1/artworks/{artworkId}/like` | 초안만 존재 | 미구현 |
| `GET` | `/v1/map/artworks` | 초안만 존재 | 미구현 |
| `GET` | `/v1/courses/recommended` | 초안만 존재 | 미구현 |
| `GET` | `/v1/courses/mine` | 초안만 존재 | 미구현 |
| `GET` | `/v1/courses/{courseId}` | 초안만 존재 | 미구현 |
| `POST` | `/v1/courses` | 초안만 존재 | 미구현 |
| `PATCH` | `/v1/courses/{courseId}` | 초안만 존재 | 미구현 |
| `POST` | `/v1/courses/{courseId}/like` | 초안만 존재 | 미구현 |
| `DELETE` | `/v1/courses/{courseId}/like` | 초안만 존재 | 미구현 |
| `POST` | `/v1/courses/{courseId}/checkins` | 초안만 존재 | 미구현 |

## 1. 인증 / 세션 API

### `POST /v1/auth/kakao`
- 상태: 구현 완료
- 목적:
  - 카카오 access token을 서버 세션으로 교환한다.
  - 내부 사용자 생성 또는 기존 사용자 매핑을 수행한다.
  - 앱용 `access token`, `refresh token`을 발급한다.
- 인증:
  - 불필요
- 요청 body:
```json
{
  "accessToken": "kakao-access-token"
}
```
- 필수값:
  - `accessToken`
- 성공 반환값:
```json
{
  "data": {
    "token": "app-access-token",
    "refreshToken": "app-refresh-token",
    "user": {
      "id": 1,
      "nickname": null,
      "residency": null,
      "age_group": null,
      "language": "ko",
      "notifications_enabled": true
    },
    "onboardingCompleted": false
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `INTERNAL_ERROR`

### `POST /v1/auth/apple`
- 상태: 구현 완료
- 목적:
  - 애플 `identityToken`과 `authorizationCode`를 받아 앱 세션으로 교환한다.
  - 현재 1차 구현은 `identityToken` 검증이 중심이고, `authorizationCode`는 계약 유지용 입력값이다.
- 인증:
  - 불필요
- 요청 body:
```json
{
  "identityToken": "apple-identity-token",
  "authorizationCode": "apple-auth-code"
}
```
- 필수값:
  - `identityToken`
  - `authorizationCode`
- 성공 반환값:
  - `POST /v1/auth/kakao`와 동일
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `INTERNAL_ERROR`

### `POST /v1/auth/refresh`
- 상태: 구현 완료
- 목적:
  - 유효한 refresh token으로 새 access token을 재발급한다.
- 인증:
  - 불필요
- 요청 body:
```json
{
  "refreshToken": "app-refresh-token"
}
```
- 필수값:
  - `refreshToken`
- 성공 반환값:
```json
{
  "data": {
    "token": "new-app-access-token"
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `REFRESH_TOKEN_EXPIRED`

### `GET /v1/auth/me`
- 상태: 구현 완료
- 목적:
  - 앱 시작 시 현재 세션 유효성, 사용자 프로필, 온보딩 완료 여부를 반환한다.
- 인증:
  - 필요
- 요청값:
  - `Authorization: Bearer {accessToken}`
- 성공 반환값:
```json
{
  "data": {
    "authenticated": true,
    "onboardingCompleted": true,
    "user": {
      "id": 1,
      "nickname": "steelwalker",
      "residency": "POHANG",
      "age_group": "30S",
      "language": "ko",
      "notifications_enabled": true
    }
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실패 가능 코드:
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

## 2. 온보딩 / 사용자 프로필 API

### `PATCH /v1/users/me/onboarding`
- 상태: 구현 완료
- 목적:
  - 닉네임, 거주 여부, 연령대를 저장한다.
  - 저장 후 최신 사용자 정보와 `onboardingCompleted`를 반환한다.
- 인증:
  - 필요
- 요청 body:
```json
{
  "nickname": "포항산책러",
  "residency": "POHANG",
  "age_group": "20S"
}
```
- 필수값:
  - `nickname`
  - `residency`
  - `age_group`
- 성공 반환값:
```json
{
  "data": {
    "onboardingCompleted": true,
    "user": {
      "id": 1,
      "nickname": "포항산책러",
      "residency": "POHANG",
      "age_group": "20S",
      "language": "ko",
      "notifications_enabled": true
    }
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

### `GET /v1/users/me`
- 상태: 구현 완료
- 목적:
  - 현재 로그인 사용자의 프로필을 조회한다.
- 인증:
  - 필요
- 요청값:
  - `Authorization: Bearer {accessToken}`
- 성공 반환값:
```json
{
  "data": {
    "onboardingCompleted": true,
    "user": {
      "id": 1,
      "nickname": "steelwalker",
      "residency": "POHANG",
      "age_group": "30S",
      "language": "ko",
      "notifications_enabled": true
    }
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실패 가능 코드:
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

### `PATCH /v1/users/me`
- 상태: 구현 완료
- 목적:
  - 닉네임, 거주 여부, 연령대를 수정한다.
- 인증:
  - 필요
- 요청 body:
```json
{
  "nickname": "포항산책러",
  "residency": "POHANG",
  "age_group": "20S"
}
```
- 필수값:
  - `nickname`
  - `residency`
  - `age_group`
- 성공 반환값:
  - `GET /v1/users/me`와 동일한 형태의 `user` + `onboardingCompleted`
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

### `PATCH /v1/me/notifications`
- 상태: 구현 완료
- 목적:
  - 알림 수신 여부를 수정한다.
- 인증:
  - 필요
- 요청 body:
```json
{
  "notifications_enabled": false
}
```
- 필수값:
  - `notifications_enabled`
- 성공 반환값:
  - `GET /v1/users/me`와 동일한 형태의 `user` + `onboardingCompleted`
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

### `PATCH /v1/me/language`
- 상태: 구현 완료
- 목적:
  - 앱 언어 설정을 수정한다.
- 인증:
  - 필요
- 요청 body:
```json
{
  "language": "ko"
}
```
- 필수값:
  - `language`
- 성공 반환값:
  - `GET /v1/users/me`와 동일한 형태의 `user` + `onboardingCompleted`
- 실패 가능 코드:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `ACCESS_TOKEN_EXPIRED`

## 3. 홈 API

### `GET /v1/home/banners`
- 상태: 초안만 존재
- 목적:
  - 활성 홈 배너를 정렬 순서대로 조회한다.
- 필요한 값:
  - 없음
- 반환값:
  - 배너 목록

### `GET /v1/home/zones`
- 상태: 초안만 존재
- 목적:
  - 홈 지역별 작품 리스트용 `zones` 목록을 조회한다.
- 필요한 값:
  - 없음
- 반환값:
  - 존 목록

### `GET /v1/home/artworks`
- 상태: 초안만 존재
- 목적:
  - 선택된 존 기준으로 홈 작품 리스트를 조회한다.
- 필요한 값:
  - query: `zoneId`
- 반환값:
  - 홈 작품 카드 목록

### `GET /v1/home/recommended-courses`
- 상태: 초안만 존재
- 목적:
  - 공식 추천 코스를 조회한다.
- 필요한 값:
  - 없음
- 반환값:
  - 추천 코스 목록

## 4. 공용 검색 API

### `GET /v1/search/artworks`
- 상태: 초안만 존재
- 목적:
  - 작품명, 작가명, 장소명 기준 공용 검색을 수행한다.
- 필요한 값:
  - query: `q`
- 반환값:
  - 작품 검색 결과 카드 목록

## 5. 작품 API

### `GET /v1/artworks`
- 상태: 초안만 존재
- 목적:
  - 작품 목록을 필터와 정렬 기준으로 조회한다.
- 필요한 값:
  - query:
    - `sort`
    - `placeId` 복수 허용
    - `artistType` 복수 허용
    - `festivalYear` 복수 허용
    - `page`
    - `size`
- 반환값:
  - 작품 목록

### `GET /v1/artworks/{artworkId}`
- 상태: 초안만 존재
- 목적:
  - 작품 상세를 조회한다.
- 필요한 값:
  - path: `artworkId`
- 반환값:
  - 대표 이미지, 설명, 위치, 출품 연도 목록, 오디오, 좋아요 여부 등

### `GET /v1/artworks/filters`
- 상태: 초안만 존재
- 목적:
  - 작품 필터 옵션을 제공한다.
- 필요한 값:
  - 없음
- 반환값:
  - 설치 장소, 제작 주체, 축제 연도 옵션

### `POST /v1/artworks/{artworkId}/like`
- 상태: 초안만 존재
- 목적:
  - 작품 좋아요를 추가한다.
- 필요한 값:
  - path: `artworkId`
- 반환값:
  - 성공 여부 또는 최신 좋아요 상태

### `DELETE /v1/artworks/{artworkId}/like`
- 상태: 초안만 존재
- 목적:
  - 작품 좋아요를 취소한다.
- 필요한 값:
  - path: `artworkId`
- 반환값:
  - 성공 여부 또는 최신 좋아요 상태

## 6. 지도 API

### `GET /v1/map/artworks`
- 상태: 초안만 존재
- 목적:
  - 지도 마커용 작품 목록을 조회한다.
- 필요한 값:
  - query:
    - `q`
    - `zoneId`
    - `lat`
    - `lng`
- 반환값:
  - 좌표, 대표 이미지, 작품명, 작가명, 위치명, `distance_m`

## 7. 코스 API

### `GET /v1/courses/recommended`
- 상태: 초안만 존재
- 목적:
  - 공식 추천 코스 목록을 조회한다.
- 필요한 값:
  - 없음
- 반환값:
  - 코스 목록

### `GET /v1/courses/mine`
- 상태: 초안만 존재
- 목적:
  - 내가 만든 코스 목록을 조회한다.
- 필요한 값:
  - 없음
- 반환값:
  - 코스 목록

### `GET /v1/courses/{courseId}`
- 상태: 초안만 존재
- 목적:
  - 코스 상세와 작품 순서를 조회한다.
- 필요한 값:
  - path: `courseId`
- 반환값:
  - 코스 상세, 아이템 목록, 지도용 좌표

### `POST /v1/courses`
- 상태: 초안만 존재
- 목적:
  - 사용자 생성 코스를 생성한다.
- 필요한 값:
  - body:
    - `title_ko`
    - `title_en`
    - `description_ko`
    - `description_en`
    - `items`
- 반환값:
  - 생성된 코스 정보

### `PATCH /v1/courses/{courseId}`
- 상태: 초안만 존재
- 목적:
  - 내가 만든 코스를 수정한다.
- 필요한 값:
  - path: `courseId`
  - body: 수정할 코스 필드
- 반환값:
  - 수정된 코스 정보

### `POST /v1/courses/{courseId}/like`
- 상태: 초안만 존재
- 목적:
  - 코스 좋아요를 추가한다.
- 필요한 값:
  - path: `courseId`
- 반환값:
  - 성공 여부 또는 최신 좋아요 상태

### `DELETE /v1/courses/{courseId}/like`
- 상태: 초안만 존재
- 목적:
  - 코스 좋아요를 취소한다.
- 필요한 값:
  - path: `courseId`
- 반환값:
  - 성공 여부 또는 최신 좋아요 상태

### `POST /v1/courses/{courseId}/checkins`
- 상태: 초안만 존재
- 목적:
  - 공식 코스 아이템에 체크인을 수행한다.
- 필요한 값:
  - path: `courseId`
  - body:
    - `course_item_id`
    - `lat`
    - `lng`
- 반환값:
  - `checkedIn`
  - `stampEarned`
  - `course_item_id`

## 8. 비고
- 공지사항과 외부 링크는 서버 API로 제공하지 않는다.
- 최근 검색어는 서버 API가 아니라 앱 로컬 저장소로 관리한다.
- 지도 bottom sheet는 별도 API 없이 `GET /v1/artworks/{artworkId}`를 재사용한다.
- 지도 검색은 `GET /v1/search/artworks`를 재사용한다.
- 이 문서에서 `구현 완료`로 표시한 항목은 현재 서버 코드와 테스트 기준이다.
