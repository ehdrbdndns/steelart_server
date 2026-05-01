# 추천 코스 스탬프 진행률 구현 계획

## 문서 목적
- `docs/research.md`에서 확정한 `stampProgress` 계약을 실제 코드베이스에 반영하기 위한 상세 구현 계획이다.
- 이 계획은 현재 `src/domains/home`, `src/domains/courses`, `src/lambdas/*`, `tests/*` 구조를 읽고 작성했다.
- 구현 목표는 앱이 추천 코스 카드, 코스 상세, 체크인 성공 직후에 `1/5` 같은 스탬프 카운트를 바로 표시할 수 있게 하는 것이다.

## 확정 계약
- 진행률 표기는 카운트만 필요하다.
- 서버 응답 필드는 `stampProgress`를 사용한다.
- `stampProgress` 타입:
```ts
{
  checkedInCount: number;
  totalCount: number;
}
```
- 적용 API:
  - `GET /v1/home/recommended-courses`
  - `GET /v1/courses/recommended`
  - `GET /v1/courses/mine`
  - `GET /v1/courses/{courseId}`
  - `POST /v1/courses/{courseId}/checkins`
- 공식 코스는 `stampProgress` 객체를 내려준다.
- 사용자 생성 코스는 `stampProgress: null`을 내려준다.
- 내 코스 목록의 사용자 생성 코스도 `stampProgress: null`을 내려준다.
- 기존 `stamped`는 새 응답 계약에서 제거한다.
- 체크인 여부가 필요한 화면은 `stampProgress.checkedInCount > 0`으로 계산한다.
- `ratio`, `completed`는 서버 응답에 넣지 않는다.
- DB 스키마 변경은 하지 않는다.

## 현재 코드 기준 요약

### `courses` 도메인
- 타입: `src/domains/courses/types.ts`
  - `CourseListItem`에는 `stamped`만 있고 `stampProgress`가 없다.
  - `CourseDetail`에는 `items[].checkedIn`과 `stamped`만 있고 `stampProgress`가 없다.
  - `CourseCheckinResponse`는 `{ checkedIn, courseId, courseItemId, stamped }`만 반환한다.
- 매퍼: `src/domains/courses/mapper.ts`
  - `mapCourseListItem`, `mapCourseDetail`, `mapCourseCheckinResponse`가 새 필드를 전달하지 않는다.
- 서비스: `src/domains/courses/service.ts`
  - `checkInCourse`는 체크인 insert 후 최신 진행률을 다시 조회하지 않는다.
  - `listRecommendedCourses`, `getCourseDetail`은 repository 결과를 mapper로 감싸는 구조다.
- 리포지토리: `src/domains/courses/repository.ts`
  - `buildCourseListMetaSql`이 현재 `liked`, `stamped`, 출발/도착 장소, 썸네일만 조회한다.
  - `findCourseDetail`은 summary query에서 `stamped`, item query에서 `checked_in`을 조회한다.
  - active item 기준은 상세 item query가 `artworks`, `artists`, `places`의 `deleted_at IS NULL` join으로 이미 잡고 있다.
  - 체크인 성공 후 재조회용 진행률 메서드는 없다.

### `home` 도메인
- 타입: `src/domains/home/types.ts`
  - `RecommendedCourseCard`에는 `stamped`만 있고 `stampProgress`가 없다.
- 매퍼: `src/domains/home/mapper.ts`
  - `mapRecommendedCourseCard`가 새 필드를 전달하지 않는다.
- 리포지토리: `src/domains/home/repository.ts`
  - `listRecommendedCourses`가 공식 코스 전체를 조회한다.
  - 현재 `course_stamp` subquery는 사용자의 해당 코스 체크인 존재 여부만 조회한다.
  - 전체 아이템 수와 체크인 아이템 수는 조회하지 않는다.

### 테스트
- 단위 테스트:
  - `tests/unit/courses/courses-mapper.test.ts`
  - `tests/unit/courses/courses-handler.test.ts`
  - `tests/unit/courses/courses-service.test.ts`
  - `tests/unit/home/home-mapper.test.ts`
  - `tests/unit/home/home-handler.test.ts`
- 통합 테스트:
  - `tests/integration/content/content-read.integration.test.ts`
  - `tests/integration/courses/courses-handler.integration.test.ts`
- 기존 통합 시드에는 공식 코스 2개 아이템 중 1개 체크인이 이미 들어가 있어 `checkedInCount=1`, `totalCount=2` 케이스 검증에 바로 사용할 수 있다.
- 체크인 성공 통합 테스트는 두 번째 아이템 체크인 후 `checkedInCount=2`, `totalCount=2`를 검증하도록 확장할 수 있다.

## 구현 원칙
- 핸들러는 수정하지 않는 것을 목표로 한다. 핸들러는 서비스 응답을 그대로 `ok()`로 감싸는 얇은 구조를 유지한다.
- 비즈니스/계약 정합성은 도메인 타입, mapper, repository, service에서 처리한다.
- `stamped`는 응답에서 제거하고, 기존 내부 계산이 필요하면 `stampProgress.checkedInCount > 0`으로 대체한다.
- 진행률 분모는 상세 화면에 실제 노출되는 유효 코스 아이템 기준으로 잡는다.
  - `course_items`
  - `artworks.deleted_at IS NULL`
  - `artists.deleted_at IS NULL`
  - `places.deleted_at IS NULL`
- DB schema, SAM template, 환경변수는 변경하지 않는다.

## 1단계. API 계약 문서 최종 상태 확인

### 대상 파일
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- `docs/research.md`

### 확인 항목
- API draft에 적용 API 5곳 모두 `stampProgress`가 반영되어 있는지 확인한다.
- API draft의 각 섹션에 `진행률 확장: stampProgress 계약 확정, 구현 필요` 표시가 있는지 확인한다.
- `docs/research.md`의 `확정 사항`이 다음과 일치하는지 확인한다.
  - 카운트만 응답
  - 사용자 생성 코스는 `null`
  - 적용 API 5곳 모두 확장
  - 체크인 성공 응답에도 최신 카운트 포함

### 산출물
- 추가 문서 수정 없이 구현으로 넘어갈 수 있는 계약 고정 상태.

## 2단계. 공통 진행률 타입 추가

### 대상 파일
- `src/domains/courses/types.ts`

### 변경 내용
- `StampProgress` 타입을 추가한다.
```ts
export interface StampProgress {
  checkedInCount: number;
  totalCount: number;
}
```
- `CourseListItem`에 추가한다.
```ts
stampProgress: StampProgress | null;
```
- `CourseDetail`에 추가한다.
```ts
stampProgress: StampProgress | null;
```
- `CourseCheckinResponse`에 추가한다.
```ts
stampProgress: StampProgress;
```
- 기존 `stamped` 필드는 `CourseListItem`, `CourseDetail`, `CourseCheckinResponse`에서 제거한다.
- `CourseListItem`은 현재 `recommended`와 `mine` 양쪽에서 쓰인다.
  - 공식 추천 코스는 객체를 가진다.
  - 내 코스는 체크인 대상이 아니므로 `stampProgress: null`을 가진다.
  - 확정 계약은 사용자 생성 코스 `null`이므로 `CourseListItem.stampProgress`도 `StampProgress | null`로 둔다.

### 권장 타입 형태
```ts
export interface StampProgress {
  checkedInCount: number;
  totalCount: number;
}

export interface CourseListItem {
  ...
  stampProgress: StampProgress | null;
  ...
}
```

### 이유
- `listMyCourses`가 같은 `CourseListItem` 타입을 쓰고 있고, 사용자 생성 코스는 `stampProgress: null`이어야 한다.
- 코스 상세도 공식/사용자 생성 코스를 모두 표현하므로 `StampProgress | null`이 맞다.

## 3단계. `courses` mapper에서 진행률 전달

### 대상 파일
- `src/domains/courses/mapper.ts`

### 변경 내용
- `mapCourseListItem` 반환에 `stampProgress: course.stampProgress`를 추가한다.
- `mapCourseDetail` 반환에 `stampProgress: detail.stampProgress`를 추가한다.
- `mapCourseCheckinResponse` 시그니처를 변경한다.
- `stamped`를 반환 객체에서 제거한다.

### 현재 형태
```ts
export function mapCourseCheckinResponse(
  courseId: number,
  courseItemId: number,
): CourseCheckinResponse
```

### 변경 후 권장 형태
```ts
export function mapCourseCheckinResponse(
  courseId: number,
  courseItemId: number,
  stampProgress: StampProgress,
): CourseCheckinResponse
```

### 반환 형태
```ts
return {
  checkedIn: true,
  courseId,
  courseItemId,
  stampProgress,
};
```

### 주의 사항
- `mapCourseLikeResponse`는 변경하지 않는다.
- `mapCourseDetailItem`은 이미 `checkedIn`을 전달하므로 변경하지 않는다.

## 4단계. `courses` repository 진행률 집계 추가

### 대상 파일
- `src/domains/courses/repository.ts`

### 4-1. row/type 추가
- `CourseListMetaRow`에 추가한다.
```ts
checked_in_count: number;
total_count: number;
```
- `CourseDetailSummaryRow`에는 직접 추가하지 않는 것을 권장한다.
  - 상세는 itemRows에서 바로 계산할 수 있기 때문이다.
  - 공식/사용자 여부는 summary에 이미 `is_official`이 있다.
- 진행률 전용 row 타입을 추가한다.
```ts
interface CourseStampProgressRow extends RowDataPacket {
  checked_in_count: number;
  total_count: number;
}
```

### 4-2. mapper helper 추가
- repository 안에 작은 helper를 둔다.
```ts
function mapStampProgress(
  checkedInCount: number,
  totalCount: number,
): StampProgress {
  return {
    checkedInCount,
    totalCount,
  };
}
```
- SQL row 숫자는 `Number(row.checked_in_count ?? 0)`처럼 숫자로 정규화한다.

### 4-3. `mapCourseListRow` 수정
- 현재는 `stamped`를 `metaRow?.stamped`에서 읽는다.
- 변경 후에는 `stampProgress`만 만들고 응답 객체에는 `stamped`를 넣지 않는다.
- 추천 형태:
```ts
const stampProgress = metaRow
  ? mapStampProgress(Number(metaRow.checked_in_count ?? 0), Number(metaRow.total_count ?? 0))
  : null;

return {
  ...
  stampProgress,
  ...
};
```
- 이렇게 하면 `stamped`와 `stampProgress` 불일치 가능성을 제거할 수 있다.

### 4-4. `buildCourseListMetaSql` 수정
- 현재 `stampedSql`은 `EXISTS(course_checkins)`만 만든다.
- 확장 후에는 `checked_in_count`, `total_count`를 같이 조회해야 한다.
- 추천 구조는 page에 포함된 `courseIds`만 대상으로 집계하는 현재 구조를 유지한다.
- SQL 내부에 progress subquery를 추가한다.

### 추천 SQL 개념
```sql
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
```
- SELECT에는 다음을 추가한다.
```sql
COALESCE(progress.checked_in_count, 0) AS checked_in_count,
COALESCE(progress.total_count, 0) AS total_count
```

### 파라미터 순서 주의
- 현재 `hydrateCourseListMetaRows`의 params는:
  - 추천 코스: `[userId, userId, ...courseIds]`
  - 내 코스: `[userId, ...courseIds]`
- progress subquery가 `cc.user_id = ?`를 추가로 사용한다.
- 추천 코스의 경우 `liked`, `progress` 모두 userId가 필요하다.
- 내 코스는 `stampProgress: null`로 할 수 있으므로 progress 집계를 굳이 조회하지 않는 선택지도 있다.

### 권장 구현 선택
- `buildCourseListMetaSql(courseIdsCount, includeStampProgress)`로 의미를 바꾼다.
- `includeStampProgress=true`는 추천 코스에만 사용한다.
- `includeStampProgress=false`는 내 코스에 사용하고 `checked_in_count=0`, `total_count=0` 또는 null 로우를 반환한다.
- 타입 계약상 내 코스는 `stampProgress: null`이므로 mapper에서 `includeStampProgress` 여부를 알 수 있어야 한다.
- 더 명확한 방법은 `CourseListMetaRow`에 `stamp_progress_enabled`를 넣는 대신 `hydrateCourseListMetaRows`에 `includeStampProgress`를 유지하고, `mapCourseListRow(baseRow, metaRow, includeStampProgress)`로 인자를 추가하는 것이다.

### 권장 함수 변경
```ts
function mapCourseListRow(
  baseRow: CourseListBaseRow,
  metaRow: CourseListMetaRow | undefined,
  includeStampProgress: boolean,
): CourseListItem
```
- `includeStampProgress`가 false면:
```ts
stampProgress: null,
```
- true면:
```ts
stampProgress: mapStampProgress(...),
```

### 4-5. `findCourseDetail` 진행률 추가
- 상세 item query는 이미 실제 노출 가능한 active item만 조회한다.
- `itemRows`를 받은 뒤 TypeScript에서 계산하는 방법을 권장한다.
```ts
const checkedInCount = itemRows.filter((row) => row.checked_in === true || row.checked_in === 1).length;
const totalCount = itemRows.length;
```
- `summaryRow.is_official`이 true면 `stampProgress` 객체를 넣고, false면 `null`을 넣는다.
- 응답에는 `stamped`를 넣지 않는다.
- 이를 위해 `mapCourseDetailRows(summaryRow, itemRows)` 내부에서 계산한다.

### 4-6. 체크인 성공 후 최신 진행률 조회 메서드 추가
- `CoursesRepository` 인터페이스에 추가한다.
```ts
findCourseStampProgress(courseId: number, userId: number): Promise<StampProgress>;
```
- 구현은 상세 item query와 같은 active item 기준으로 집계한다.
- SQL은 특정 course 하나만 대상으로 한다.
```sql
SELECT
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
  ON cc.user_id = ?
 AND cc.course_item_id = ci.id
WHERE ci.course_id = ?
```
- 결과가 없으면 `{ checkedInCount: 0, totalCount: 0 }`을 반환한다.
- 이 메서드는 체크인 성공 응답에서만 필수로 사용한다.

## 5단계. `courses` service 체크인 흐름 확장

### 대상 파일
- `src/domains/courses/service.ts`

### 변경 내용
- `CoursesRepository`에 추가한 `findCourseStampProgress`를 서비스에서 사용한다.
- `checkInCourse` 성공 흐름을 다음 순서로 바꾼다.
1. `findCourseRecord`로 코스 존재와 공식 코스 여부 확인
2. `findCourseCheckinTarget`으로 아이템 소속/중복/좌표 확인
3. 거리 검증
4. `createCourseCheckin(userId, courseId, input.course_item_id)`
5. `findCourseStampProgress(courseId, userId)`
6. `mapCourseCheckinResponse(courseId, input.course_item_id, stampProgress)`

### 주의 사항
- 체크인 insert 이후 최신 카운트를 조회해야 한다.
- 중복 체크인, 거리 실패, 비공식 코스 실패에서는 progress 조회가 일어나면 안 된다.
- 현재 `createCourseCheckin`과 progress 조회는 같은 transaction에 있지 않다.
  - 현 구조에서는 `createCourseCheckin`도 단일 insert이고 이후 읽기라 문제 없다.
  - 강한 일관성이 필요하면 후속으로 transaction화할 수 있지만 이번 변경 범위에서는 과하다.

## 6단계. `home` 도메인 타입/매퍼/SQL 확장

### 대상 파일
- `src/domains/home/types.ts`
- `src/domains/home/mapper.ts`
- `src/domains/home/repository.ts`

### 6-1. 타입 확장
- `RecommendedCourseCard`에 추가한다.
```ts
stampProgress: StampProgress;
```
- `StampProgress`는 `courses/types.ts`에서 import하는 방식을 권장한다.
```ts
import type { StampProgress } from '../courses/types.js';
```
- home 추천 코스는 공식 코스만 반환하므로 `StampProgress | null`이 아니라 `StampProgress`로 충분하다.

### 6-2. 매퍼 확장
- `mapRecommendedCourseCard` 반환에 추가한다.
```ts
stampProgress: course.stampProgress,
```

### 6-3. repository row 확장
- `RecommendedCourseRow`에 추가한다.
```ts
checked_in_count: number;
total_count: number;
```

### 6-4. SQL 확장
- 현재 `course_stamp` subquery를 progress aggregate subquery로 바꾼다.
- 썸네일을 위해 `first_course_item` join은 유지한다.
- progress subquery는 active item 기준으로 계산한다.
- SELECT:
```sql
COALESCE(progress.checked_in_count, 0) AS checked_in_count,
COALESCE(progress.total_count, 0) AS total_count
```
- row mapping:
```ts
const stampProgress = {
  checkedInCount: Number(row.checked_in_count ?? 0),
  totalCount: Number(row.total_count ?? 0),
};
```
- `stamped`는 응답에서 제거한다. 내부에서 필요하면 `stampProgress.checkedInCount > 0`로 계산한다.

### 주의 사항
- `GET /v1/home` aggregate에는 추천 코스가 포함되지 않는다. 수정 대상이 아니다.
- `GET /v1/home/recommended-courses`만 변경한다.

## 7단계. 단위 테스트 갱신

### 7-1. `tests/unit/courses/courses-mapper.test.ts`
- `mapCourseListResponse` 입력/기대값에 `stampProgress` 추가.
- `mapCourseCheckinResponse` 호출에 progress 인자를 추가.
- 기대값:
```ts
stampProgress: {
  checkedInCount: 1,
  totalCount: 2,
}
```

### 7-2. `tests/unit/courses/courses-handler.test.ts`
- `createCoursesServiceStub`의 모든 `CourseListItem`, `CourseDetail`, `CourseCheckinResponse` fixture를 새 타입에 맞춘다.
- 추천 코스 fixture:
```ts
stampProgress: { checkedInCount: 1, totalCount: 2 }
```
- 내 코스 fixture:
```ts
stampProgress: null
```
- 코스 상세 fixture:
  - 공식 상세 테스트가 있으면 객체
  - 사용자 생성 상세 fixture는 `null`
- 체크인 응답 fixture:
```ts
stampProgress: { checkedInCount: 2, totalCount: 2 }
```
- handler는 서비스 응답 passthrough이므로 라우팅 로직 추가는 필요 없다.

### 7-3. `tests/unit/courses/courses-service.test.ts`
- `createCoursesRepositoryStub`에 `findCourseStampProgress` 기본 구현을 추가한다.
```ts
async findCourseStampProgress() {
  return { checkedInCount: 1, totalCount: 2 };
}
```
- `findCourseDetail` fixture에 `stampProgress` 추가.
- 체크인 성공 테스트에서 호출 순서 검증을 확장한다.
  - `insert`
  - `progress`
- 성공 응답 기대값에 `stampProgress` 추가.
- 실패 테스트에서는 `findCourseStampProgress`가 호출되지 않는지까지 검증하면 좋지만 필수는 아니다.

### 7-4. `tests/unit/home/home-mapper.test.ts`
- 추천 코스 mapper 입력/기대값에 `stampProgress` 추가.

### 7-5. `tests/unit/home/home-handler.test.ts`
- `createHomeServiceStub().getRecommendedCourses()` fixture에 `stampProgress` 추가.
- 응답 기대값에 `stampProgress` 추가.

## 8단계. 통합 테스트 갱신

### 8-1. `tests/integration/content/content-read.integration.test.ts`
- 현재 `seedContentScenario`는 공식 코스에 2개 아이템을 만들고 첫 번째만 체크인한다.
- `recommended courses endpoint returns official courses only` 테스트에 추가한다.
```ts
assert.deepEqual(body.data.courses[0].stampProgress, {
  checkedInCount: 1,
  totalCount: 2,
});
```
- 기존 `stamped === true` 검증은 제거하고, `stampProgress.checkedInCount === 1`을 검증한다.

### 8-2. `tests/integration/courses/courses-handler.integration.test.ts`
- 추천 코스 목록 테스트에 추가한다.
```ts
assert.deepEqual(body.data.courses[0].stampProgress, {
  checkedInCount: 1,
  totalCount: 2,
});
```
- 내 코스 목록 테스트에는 `stampProgress: null`을 기대값에 추가한다.
  - API draft도 `GET /v1/courses/mine`에 `stampProgress: null`을 명시한다.
  - 사용자 생성 코스는 체크인 대상이 아니므로 null이 고정값이다.
- 코스 상세 공식 코스 테스트에 추가한다.
```ts
assert.deepEqual(body.data.stampProgress, {
  checkedInCount: 1,
  totalCount: 2,
});
```
- 코스 생성/수정 후 사용자 생성 코스 상세 응답에는 `stampProgress: null`을 기대값에 추가한다.
- 체크인 성공 테스트는 두 번째 아이템 체크인 후 최신 카운트 검증:
```ts
assert.deepEqual(JSON.parse(response.body as string).data, {
  checkedIn: true,
  courseId: seeded.officialCourseId,
  courseItemId: seeded.officialCourseItemIds.second,
  stampProgress: {
    checkedInCount: 2,
    totalCount: 2,
  },
});
```

### 8-3. 0개 체크인 케이스 추가 여부
- 현재 시드는 공식 코스에 이미 1개 체크인이 있다.
- `checkedInCount=0` 케이스까지 통합 테스트하려면 별도 user token을 만들거나 체크인이 없는 두 번째 사용자를 사용한다.
- `seedCoursesScenario`에는 `otherUserId`가 이미 있으므로 `signAccessToken(seeded.otherUserId)`로 추천 코스 목록을 호출하면:
```ts
stampProgress: { checkedInCount: 0, totalCount: 2 }
liked: false
```
- 이 테스트를 추가하면 0개/일부/전체 흐름을 모두 덮을 수 있다.

## 9단계. API draft 추가 정합성 반영

### 확정 결정
- `GET /v1/courses/mine` 응답에도 `stampProgress: null`을 포함한다.
- 기존 `stamped`는 `stampProgress.checkedInCount > 0`으로 대체 가능하므로 새 응답 계약에서 제거한다.

### 이유
- `CourseListItem` 타입을 추천/내 코스 목록에서 공유할 수 있다.
- 클라이언트가 추천/내 코스 카드 컴포넌트를 공유할 때 `stampProgress` 필드 존재 여부가 안정적이다.
- 사용자 생성 코스는 null이라는 확정 사항과 일치한다.
- `stamped`와 `stampProgress`가 동시에 존재할 때 생길 수 있는 불일치 리스크를 없앨 수 있다.

### 문서 작업
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`의 `7-2. 내 코스 목록 조회`에 `stampProgress: null`을 추가한다.
- API draft의 추천 코스, 내 코스, 코스 상세, 체크인 성공 응답 타입에서 `stamped`를 제거한다.
- `docs/research.md`에도 같은 계약을 유지한다.

## 10단계. 검증 명령

### 필수 로컬 검증
```bash
pnpm typecheck
pnpm test
```

### 통합 테스트
통합 DB 환경변수가 설정되어 있을 때:
```bash
pnpm test:integration
```

### SAM 영향 확인
이번 변경은 Lambda 코드 타입/SQL 변경이므로 SAM 템플릿 변경은 없지만, 빌드 검증은 권장한다.
```bash
pnpm sam:validate
pnpm sam:build
```

### 주의
- 로컬 sandbox에서 `pnpm test`가 `tsx` IPC pipe 권한 문제로 실패할 수 있다.
- 이 경우 동일 명령을 sandbox 밖 권한으로 재실행해 실제 테스트 결과를 확인한다.

## 구현 순서 체크리스트

1. `src/domains/courses/types.ts`
   - `StampProgress` 추가
   - `CourseListItem.stampProgress: StampProgress | null`
   - `CourseDetail.stampProgress: StampProgress | null`
   - `CourseCheckinResponse.stampProgress: StampProgress`
   - 기존 `stamped` 응답 필드 제거
2. `src/domains/courses/mapper.ts`
   - list/detail/checkin mapper에 `stampProgress` 전달
   - `mapCourseCheckinResponse` 인자 변경
3. `src/domains/courses/repository.ts`
   - progress row 타입 추가
   - `mapCourseListRow`에 `includeStampProgress` 인자 추가
   - 추천 코스 목록 meta SQL에 active item 기준 aggregate 추가
   - 상세 응답에서 itemRows 기반 progress 계산
   - `findCourseStampProgress` 추가
4. `src/domains/courses/service.ts`
   - 체크인 성공 후 최신 progress 조회
   - `mapCourseCheckinResponse` 호출 갱신
5. `src/domains/home/types.ts`
   - `RecommendedCourseCard.stampProgress` 추가
6. `src/domains/home/mapper.ts`
   - 추천 코스 mapper에 `stampProgress` 전달
7. `src/domains/home/repository.ts`
   - 공식 추천 코스 SQL에 progress aggregate 추가
8. 단위 테스트 갱신
9. 통합 테스트 갱신
10. API draft의 내 코스 목록 null 필드와 `stamped` 제거 반영
11. `pnpm typecheck`, `pnpm test`, 가능하면 `pnpm test:integration`

## 리스크와 대응

### 리스크 1. 기존 `stamped` 의존 클라이언트 영향
- 대응:
  - 현재 앱이 아직 MVP 개발 단계라면 응답에서 제거한다.
  - 이미 배포된 앱 호환이 필요해지면 1개 릴리즈 동안만 deprecated 필드로 유지하는 별도 호환 작업을 잡는다.

### 리스크 2. 상세과 목록의 `totalCount` 기준 불일치
- 대응:
  - 목록 aggregate SQL에도 상세 item query와 같은 active join 조건을 사용한다.
  - `artworks`, `artists`, `places` soft delete 조건을 빠뜨리지 않는다.

### 리스크 3. `GET /v1/courses/mine` 계약 누락
- 대응:
  - 구현 전에 API draft를 보정한다.
  - `stampProgress: null`을 내 코스에도 명시한다.

### 리스크 4. 체크인 성공 직후 최신 카운트 조회 누락
- 대응:
  - service 테스트에서 `createCourseCheckin` 이후 `findCourseStampProgress`가 호출되는 순서를 검증한다.
  - 통합 테스트에서 두 번째 체크인 후 `2/2`를 검증한다.

## 완료 기준
- 추천 코스, 내 코스, 코스 상세, 체크인 성공 API가 `stampProgress`를 반환한다.
- 공식 코스는 `{ checkedInCount, totalCount }`를 반환한다.
- 사용자 생성 코스 목록/상세는 `stampProgress: null`을 반환한다.
- 체크인 성공 응답은 insert 이후 최신 카운트를 반환한다.
- 기존 `stamped` 필드는 새 응답 계약에서 제거된다.
- 단위 테스트와 타입체크가 통과한다.
- 통합 DB가 준비된 환경에서는 통합 테스트가 통과한다.
