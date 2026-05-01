# 추천 코스 스탬프 진행률 API 확장 조사

## 조사 목적
- 추천 코스 카드에서 스탬프 진행률을 바로 보여줄 수 있도록 서버 API 확장 범위를 정리한다.
- 현재 구현, API 명세, DB 스키마, 앱 화면 요구를 기준으로 변경 대상과 안전한 응답 형태를 제안한다.
- 조사 기준일: 2026-04-26

## 결론
- 현재 API는 추천 코스 진행률 숫자를 직접 내려주지 않는다.
- 현재 제공되는 값은 `stamped: boolean`과 코스 상세의 `items[].checkedIn`이다.
- 추천 코스 카드에서 `1/5` 같은 체크인 카운트를 바로 보여주려면 추천 코스 목록 계열 API에 집계 필드를 추가해야 한다.
- DB 스키마 변경은 필요 없다. `course_items`와 `course_checkins`를 집계하면 된다.
- 추천 확장 방향은 `stampProgress`에 카운트만 내려주고, 기존 `stamped`는 새 계약에서 제거하는 방식이다.

## 현재 API 상태

### 홈 추천 코스
- 엔드포인트: `GET /v1/home/recommended-courses`
- 현재 응답: `courses[].stamped: boolean`
- 현재 의미: 사용자가 해당 공식 코스에서 체크인한 기록이 하나라도 있는지 여부
- 진행률 숫자, 전체 스탬프 수, 완료 스탬프 수는 없다.
- 관련 명세:
  - `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - 섹션: `3-4. 공식 추천 코스 조회`
- 관련 구현:
  - `src/domains/home/types.ts`
  - `src/domains/home/mapper.ts`
  - `src/domains/home/repository.ts`

### 코스 탭 추천 코스
- 엔드포인트: `GET /v1/courses/recommended?page=1&size=20`
- 현재 응답: `courses[].stamped: boolean`
- 현재 의미: 사용자가 해당 공식 코스에서 체크인한 기록이 하나라도 있는지 여부
- 진행률 숫자, 전체 스탬프 수, 완료 스탬프 수는 없다.
- 관련 명세:
  - `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - 섹션: `7-1. 추천 코스 목록 조회`
- 관련 구현:
  - `src/domains/courses/types.ts`
  - `src/domains/courses/mapper.ts`
  - `src/domains/courses/repository.ts`

### 코스 상세
- 엔드포인트: `GET /v1/courses/{courseId}`
- 현재 응답:
  - `stamped: boolean`
  - `items[].checkedIn: boolean`
- 현재 앱은 상세 응답만 받으면 `items.filter(item => item.checkedIn).length / items.length`로 진행률을 계산할 수 있다.
- 다만 추천 코스 목록 카드에서 진행률을 보여주려면 상세 API를 코스마다 호출해야 하므로 비효율적이다.

### 체크인 성공 응답
- 엔드포인트: `POST /v1/courses/{courseId}/checkins`
- 현재 응답:
```ts
{
  checkedIn: true;
  courseId: number;
  courseItemId: number;
  stamped: true;
}
```
- 체크인 후 최신 진행률은 응답하지 않는다.
- 앱이 체크인 성공 직후 진행률을 갱신하려면 현재는 상세 API를 다시 호출해야 한다.

## 앱 요구 확인
- MVP brief는 사용자가 체크인과 스탬프를 통해 참여 진행감을 얻어야 한다고 정의한다.
- 코스 시작 후 진행 상태가 잘 보이는 구조가 요구된다.
- 화면 구조 문서에는 `CourseRunScreen`에서 현재 진행 중 코스 상태와 다음 체크인 대상이 필요하다고 적혀 있다.
- 화면 스펙은 방문 인증 결과를 스탬프 적립으로 정의한다.
- 따라서 목록 카드, 상세, 진행 화면에서 같은 진행률 모델을 공유하는 것이 앱 구현에 유리하다.

## DB 기준

### 사용 테이블
- `courses`
  - 공식 추천 코스는 `is_official = 1`
  - soft delete는 `deleted_at`
- `course_items`
  - 코스 안의 순서화된 작품 목록
  - `course_id`, `seq`, `artwork_id`
  - `UNIQUE(course_id, seq)`
- `course_checkins`
  - 사용자별 코스 아이템 체크인 이력
  - `user_id`, `course_id`, `course_item_id`
  - `UNIQUE(user_id, course_item_id)`
  - `idx_course_checkins_user_course(user_id, course_id)` 존재

### 진행률 계산 소스
- 분모: 해당 코스의 현재 유효한 `course_items` 개수
- 분자: 해당 사용자와 해당 코스에서 체크인된 `course_item_id` 개수
- 권장 계산:
  - `checkedInCount = COUNT(DISTINCT course_checkins.course_item_id)`
  - `totalCount = COUNT(course_items.id)`
- 앱에서 필요한 표기는 `checkedInCount / totalCount` 형태다.
- 퍼센트, progress bar, 완료 여부가 필요하면 앱에서 `checkedInCount`와 `totalCount`로 계산할 수 있다.

### 주의할 점
- 상세 API는 `course_items`를 조회할 때 `artworks`, `artists`, `places`의 `deleted_at IS NULL` 조건을 함께 사용한다.
- 진행률 분모도 상세 화면에 실제 노출되는 아이템 수와 일치해야 한다.
- 따라서 단순히 `course_items`만 세기보다 상세 조회와 같은 active join 조건을 재사용하는 편이 안전하다.
- `course_checkins`는 `course_item_id` 기준 unique라 중복 체크인은 DB 차원에서도 방지된다.
- 공식 코스의 체크인 이력은 `course_item_id`에 묶여 있으므로 대시보드에서 공식 코스 아이템을 재정렬할 때 기존 `course_items.id`를 보존해야 진행률이 유지된다.

## 권장 API 응답 확장

### 공통 타입
```ts
type StampProgress = {
  checkedInCount: number;
  totalCount: number;
};
```

### 필드 의미
- `checkedInCount`: 현재 사용자가 체크인한 코스 아이템 수
- `totalCount`: 현재 코스에서 체크인 가능한 전체 아이템 수
- 화면 표기는 앱에서 `${checkedInCount}/${totalCount}` 형태로 만든다.
- 기존 `stamped`는 기능적으로 더 필요하지 않다.
  - `stamped`는 `stampProgress.checkedInCount > 0`으로 앱에서 계산할 수 있다.
  - 서버가 `stamped`와 `stampProgress`를 동시에 내려주면 두 값이 어긋날 수 있는 계약 리스크가 생긴다.
  - 기존 배포 앱 호환이 꼭 필요한 상황이면 1개 릴리즈 동안만 deprecated 필드로 유지하고, MVP 구현에서는 제거하는 방향을 기본값으로 둔다.

### 홈 추천 코스 응답
대상: `GET /v1/home/recommended-courses`

```ts
{
  courses: Array<{
    id: number;
    title_ko: string;
    title_en: string;
    description_ko: string | null;
    description_en: string | null;
    is_official: true;
    stampProgress: StampProgress;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
  }>;
}
```

### 코스 탭 추천 코스 응답
대상: `GET /v1/courses/recommended?page=1&size=20`

```ts
{
  courses: Array<{
    id: number;
    title_ko: string;
    title_en: string;
    description_ko: string | null;
    description_en: string | null;
    is_official: true;
    liked: boolean;
    stampProgress: StampProgress;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
    start_place_name_ko: string | null;
    start_place_name_en: string | null;
    end_place_name_ko: string | null;
    end_place_name_en: string | null;
  }>;
  page: number;
  size: number;
  total: number;
}
```

### 코스 상세 응답
대상: `GET /v1/courses/{courseId}`

```ts
{
  id: number;
  title_ko: string;
  title_en: string;
  description_ko: string | null;
  description_en: string | null;
  is_official: boolean;
  liked: boolean;
  stampProgress: StampProgress | null;
  editable: boolean;
  items: Array<{
    id: number;
    seq: number;
    artwork_id: number;
    checkedIn: boolean;
    // existing fields omitted
  }>;
}
```

- 공식 코스는 `stampProgress` 객체를 내려준다.
- 사용자 생성 코스는 체크인이 허용되지 않으므로 `stampProgress: null`로 내려준다.
- 대안으로 사용자 생성 코스도 `checkedInCount: 0`, `totalCount: items.length`를 내려줄 수 있지만, 공식 코스 전용 기능이라는 의미가 약해진다.

### 체크인 성공 응답
대상: `POST /v1/courses/{courseId}/checkins`

```ts
{
  checkedIn: true;
  courseId: number;
  courseItemId: number;
  stampProgress: StampProgress;
}
```

- 체크인 성공 직후 앱이 상세 API를 재호출하지 않고도 진행률 UI를 갱신할 수 있다.
- 구현은 체크인 insert 후 같은 코스의 progress aggregate를 다시 조회하는 방식이 안전하다.

## 구현 영향 범위

### API 명세
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - `3-4. 공식 추천 코스 조회`
  - `7-1. 추천 코스 목록 조회`
  - `7-2. 내 코스 목록 조회`
  - `7-3. 코스 상세 조회`
  - `7-8. 코스 방문 인증 / 체크인`

### 서버 타입
- `src/domains/home/types.ts`
  - `RecommendedCourseCard`에 `stampProgress` 추가
- `src/domains/courses/types.ts`
  - 공통 `StampProgress` 타입 추가
  - `CourseListItem`, `CourseDetail`, `CourseCheckinResponse`에 반영
  - home 도메인에서도 재사용할 수 있게 별도 shared 타입으로 뺄지 검토

### 매퍼
- `src/domains/home/mapper.ts`
  - `mapRecommendedCourseCard`에서 `stampProgress` 전달
- `src/domains/courses/mapper.ts`
  - list/detail/checkin 응답에 `stampProgress` 전달
  - `stamped`는 새 응답 계약에서 제거한다.
  - 내부 분기에서 필요하면 `checkedInCount > 0`을 직접 계산하고 응답에는 포함하지 않는다.

### 리포지토리
- `src/domains/home/repository.ts`
  - 추천 코스 조회 SQL에 `checked_in_count`, `total_count` 추가
- `src/domains/courses/repository.ts`
  - `CourseListMetaRow`에 `checked_in_count`, `total_count` 추가
  - `buildCourseListMetaSql`에서 추천 코스 진행률 집계 추가
  - `findCourseDetail` summary 또는 itemRows 기반으로 progress 계산 추가
  - 체크인 성공 후 최신 진행률 조회용 메서드 추가 검토

### 서비스
- `src/domains/courses/service.ts`
  - `checkInCourse` 성공 후 최신 `stampProgress`를 포함한 응답 반환
  - 목록/상세는 repository 결과를 mapper로 넘기는 현재 구조 유지 가능

### 테스트
- `tests/unit/home/home-mapper.test.ts`
- `tests/unit/home/home-handler.test.ts`
- `tests/unit/courses/courses-mapper.test.ts`
- `tests/unit/courses/courses-handler.test.ts`
- `tests/unit/courses/courses-service.test.ts`
- `tests/integration/content/content-read.integration.test.ts`
- `tests/integration/courses/courses-handler.integration.test.ts`

검증할 항목:
- 체크인 0개인 공식 코스: `checkedInCount=0`, `totalCount=N`
- 일부 체크인한 공식 코스: `0<checkedInCount<N`, `totalCount=N`
- 모두 체크인한 공식 코스: `checkedInCount=N`, `totalCount=N`
- 아이템이 없는 비정상 코스: `checkedInCount=0`, `totalCount=0`
- 사용자 생성 코스 상세: `stampProgress=null`
- 체크인 성공 응답이 갱신된 진행률을 반환

## SQL 구현 메모

### 추천 목록 집계 예시
페이지에 포함된 코스만 대상으로 집계하는 현재 구조를 유지한다.

```sql
SELECT
  c.id AS course_id,
  COALESCE(progress.checked_in_count, 0) AS checked_in_count,
  COALESCE(progress.total_count, 0) AS total_count
FROM courses c
LEFT JOIN (
  SELECT
    ci.course_id,
    COUNT(ci.id) AS total_count,
    COUNT(DISTINCT cc.course_item_id) AS checked_in_count
  FROM course_items ci
  INNER JOIN artworks a
    ON a.id = ci.artwork_id
   AND a.deleted_at IS NULL
  INNER JOIN artists ar
    ON ar.id = a.artist_id
   AND ar.deleted_at IS NULL
  INNER JOIN places p
    ON p.id = a.place_id
   AND p.deleted_at IS NULL
  LEFT JOIN course_checkins cc
    ON cc.course_item_id = ci.id
   AND cc.user_id = ?
  GROUP BY ci.course_id
) progress
  ON progress.course_id = c.id
WHERE c.id IN (...);
```

### 체크인 후 최신 진행률
체크인 insert 이후 아래와 같은 메서드를 두는 방식을 권장한다.

```ts
findCourseStampProgress(courseId: number, userId: number): Promise<StampProgress>
```

이 메서드는 상세/체크인에서 재사용할 수 있고, 목록 집계는 page 기반 batch query로 별도 유지한다.

## 성능 및 인덱스
- 현재 DDL 기준으로 `course_items.course_id` 인덱스와 `course_checkins(user_id, course_id)` 인덱스가 있다.
- 추천 코스 페이지 크기는 최대 100개라 page course IDs 기준 batch aggregate면 충분하다.
- 별도 스키마 변경은 필요 없어 보인다.
- 트래픽이 커지면 `course_checkins(user_id, course_id, course_item_id)` 복합 인덱스를 검토할 수 있지만, 현재 unique `(user_id, course_item_id)`와 `idx_course_checkins_user_course`로 기본 조회는 처리 가능하다.

## 계약 선택지

### 선택지 A: `stampProgress` 객체 추가
- 장점:
  - 의미가 명확하다.
  - 향후 `nextItemId`, `remainingCount` 같은 필드를 확장하기 쉽다.
  - 기존 `stamped`를 대체할 수 있다.
- 단점:
  - 기존 평면형 카드 DTO에 nested object가 추가된다.
- 추천 여부: 추천

### 선택지 B: flat 필드 추가
```ts
checkedInCount: number;
totalCount: number;
```
- 장점:
  - 현재 카드 DTO의 평면 구조와 맞는다.
- 단점:
  - 필드가 흩어져 의미 경계가 약하다.
  - 나중에 진행 관련 필드가 늘어나면 응답이 지저분해진다.
- 추천 여부: 보류

### 선택지 C: 목록은 그대로 두고 상세에서만 계산
- 장점:
  - 서버 변경이 가장 작다.
- 단점:
  - 추천 카드에서 진행률을 보여주려면 상세 API를 여러 번 호출해야 한다.
  - 홈/코스 목록 UX 요구와 맞지 않는다.
- 추천 여부: 비추천

## 권장 구현 순서
1. API 명세에 `StampProgress` 타입과 응답 필드를 먼저 추가한다.
2. `courses` 도메인 타입과 mapper에 `stampProgress`를 추가한다.
3. `courses` repository의 추천 목록 meta query에 진행률 집계를 추가한다.
4. `courses` 상세 응답에 같은 `stampProgress`를 추가한다.
5. 체크인 성공 응답에 최신 `stampProgress`를 추가한다.
6. `home` 도메인의 추천 코스 응답에도 같은 `stampProgress`를 추가한다.
7. 단위 테스트를 갱신한다.
8. 통합 테스트에서 0개, 일부, 전체 체크인 케이스를 검증한다.

## 확정 사항
- 앱 진행률 표기는 `1/5` 같은 카운트만 필요하다고 확인했다.
- `ratio`, `completed`는 현재 서버 응답에 넣지 않는다. 필요하면 앱에서 계산하거나 후속 확장으로 추가한다.
- 사용자 생성 코스 응답은 `stampProgress: null`로 내려주기로 확정했다.
- `stampProgress`는 홈 추천 코스, 코스 탭 추천 코스, 내 코스 목록, 코스 상세, 체크인 성공 응답에 추가하기로 확정했다.
- 체크인 성공 응답에도 최신 `stampProgress`를 포함하기로 확정했다.
- 홈 추천 코스와 코스 탭 추천 코스는 동일한 `stampProgress` 필드 구조를 사용한다.
- `stamped`는 `stampProgress.checkedInCount > 0`으로 대체 가능하므로 새 응답 계약에서는 제거한다.

## 최종 제안
- MVP 확장으로는 `stampProgress` 객체를 추천 코스 카드, 내 코스 목록, 코스 상세, 체크인 성공 응답에 추가한다.
- 사용자 생성 코스는 `stampProgress: null`로 응답한다.
- 체크인 성공 응답은 갱신된 최신 `stampProgress`를 함께 반환한다.
- 기존 `stamped`는 새 계약에서 제거한다.
- DB 스키마는 변경하지 않는다.
- 진행률 산출은 `course_items`와 `course_checkins`의 batch aggregate로 처리한다.
