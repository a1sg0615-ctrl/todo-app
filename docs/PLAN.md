# 할 일 관리 앱 구현 계획

> 상태: **pending approval** (승인 전에는 구현을 시작하지 않음)
> 근거 문서: `docs/PRD.md`
> 작성일: 2026-10-31

## 1. 요구사항 요약

할 일(일) → 주간 계획(주) → 1년 목표(연) 3단계 구조를 가진 개인용 할 일 앱을 만든다.
- 칸반 보드(todo / doing / done)에서 드래그 앤 드롭으로 상태를 바꾼다 (PRD 4-2, 4-3)
- 할 일이 바뀌면 주간 진행률에 바로 반영된다 (PRD 4-6)
- 연결은 선택 사항이다. 상위 항목을 삭제하면 하위 항목은 남기고 연결만 해제한다 (PRD 4-5)

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript | 사용자 지정 |
| 백엔드 | Next.js API Routes (App Router의 Route Handler, `app/api/**/route.ts`) | 사용자 지정. 별도 서버 없이 한 프로젝트에서 화면과 API를 함께 운영 |
| DB | MongoDB | 사용자 지정. 로컬 `mongod` 또는 Atlas를 `MONGODB_URI`로 연결 |
| ODM | Mongoose | 스키마 검증과 TS 타입 지원. Next.js에서 가장 흔히 쓰는 조합 |
| 입력 검증 | Zod | API 경계에서 요청 본문 검증 |
| 드래그 앤 드롭 | @dnd-kit/core (+ @dnd-kit/sortable, P1) | React 18/19 지원, 유지보수 중, 컬럼 간 이동과 컬럼 내 정렬 모두 지원 |
| 스타일 | Tailwind CSS | create-next-app 기본 옵션 |
| 디자인 | `src/app/globals.css`의 `@theme` 토큰 | 흰 바탕 + 잉크(#222222) 글자 + 강조색 하나(primary #ff385c)를 아껴 쓰는 사진 중심 마켓플레이스 스타일 가이드를 적용. 둥근 모서리(8/14/32px, 알약), 그림자는 `shadow-float` 한 단계만, 다크 모드 없음. 서체는 전용 서체 대신 권장 대체 서체 Inter + 시스템 한글 서체, 한국어는 `word-break: keep-all`. 공통 클래스: `.btn`, `.btn-primary`, `.btn-text`, `.input`, `.card`, `.chip`, `.page-title` |
| 테스트 | Vitest + mongodb-memory-server (단위/통합), Playwright (E2E) | 실제 MongoDB 없이 서비스 로직 테스트 가능 |

**범위에서 제외**: 로그인/인증, 다중 사용자 (PRD 타깃이 "개인 사용자"이므로 단일 사용자로 가정)

## 3. 핵심 설계 결정

1. **날짜는 `YYYY-MM-DD` 문자열로 저장**: `Date` 타입은 시간대 때문에 날짜가 하루씩 밀리는 문제가 생긴다. 일 단위 비교에는 문자열 정렬로 충분하다.
2. **`progress`는 저장하지 않고 조회할 때 계산한다** (PRD 4-7과 다름, 의도된 변경). 저장 필드로 두면 갱신 경로(생성·삭제·상태 변경·연결 변경·날짜 변경) 중 하나만 누락돼도 실제 값과 어긋난다. `calcWeeklyProgress(weeklyPlanIds)`가 연결된 Task를 집계(aggregate)해 계산하고, API 응답에는 `progress` 필드를 그대로 포함하므로 화면 입장에서는 PRD와 같다. 이렇게 하면 PRD 4-6의 "갱신 시점"은 별도 재계산 없이 자동으로 충족된다.
3. **트랜잭션이 필요 없다.** 파생 값을 저장하지 않으므로 여러 문서를 함께 맞출 일이 없다. MongoDB 트랜잭션(replica set 필요) 없이 로컬 단일 `mongod`에서 그대로 동작한다.
4. **주간 계획은 월요일 시작 7일로 고정한다** (PRD 4-4). `startDate`는 월요일이어야 하고 `endDate = startDate + 6일`(일요일)이어야 하며, 아니면 400. 같은 주에 주간 계획은 하나만 허용한다(기간 중복 금지, `startDate` unique, 위반 시 409).
5. **할 일 날짜는 연결된 주간 계획 기간 안에 있어야 한다.** 범위를 벗어난 연결 시도는 400으로 거부한다. 할 일 날짜를 바꿔 범위를 벗어나는 경우도 같은 규칙으로 거부하며, 화면에서는 "주간 계획 연결을 해제하거나 다른 주로 옮기세요" 안내를 보여준다. 연결을 자동으로 해제하지 않는 이유는 사용자가 모르는 사이 진행률이 바뀌지 않게 하기 위해서다. 주간 계획은 월요일 고정·7일 고정이므로 기간을 바꿀 수 없다(`startDate`/`endDate` 수정 불가, 제목과 1년 목표 연결만 수정).
6. **API는 Route Handler + 서비스 계층으로 나눈다.** 비즈니스 로직은 `src/services/`에 두고 Route Handler는 검증과 응답만 맡는다. 서비스는 HTTP 없이 단위 테스트할 수 있다.
7. **보드는 기본으로 이번 주(월~일) 할 일만 보여준다.** 범위가 없으면 할 일이 쌓일수록 과거 done 카드까지 모두 보드에 노출되므로, 주 단위 이동(이전 주 / 이번 주 / 다음 주)을 P0에 포함한다. 보드 조회는 `GET /api/tasks?from=&to=`로 한다. 주간 계획 기준 필터는 P1으로 남긴다.
8. **드래그 앤 드롭은 낙관적 업데이트 + 롤백**: 드롭하면 화면부터 바꾸고 `PATCH`를 보낸다. 실패하면 원래 컬럼으로 되돌리고 오류 토스트를 띄운다 (PRD 4-3).

9. **로그인은 GitHub OAuth를 직접 구현한다** (docs/LOGIN.md가 `/auth/github`, `/auth/github/callback` 경로를 지정하므로 Auth.js 기본 경로 대신 Route Handler로 만든다).
   - `/auth/github`: 랜덤 `state`를 httpOnly 쿠키(10분, path=/auth/github)에 넣고 GitHub authorize로 리다이렉트. `/auth/github/callback`: state 비교(timingSafeEqual) → code를 토큰으로 교환 → `/user` 조회 → `githubId` 기준 User upsert → 세션 생성 → `/board`.
   - 세션은 DB(`sessions`)에 저장하고 쿠키에는 랜덤 토큰, DB에는 sha256 해시만 둔다. 만료 30일, TTL 인덱스로 자동 삭제. 로그아웃(`POST /auth/logout`)은 세션 문서 삭제 + 쿠키 만료.
   - `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`은 환경 변수에서만 읽는다. `GITHUB_CALLBACK_URL`(선택)이 없으면 요청 주소 기준으로 callback URL을 만든다. `GITHUB_OAUTH_URL`/`GITHUB_API_URL`은 E2E 모의 서버용이며 기본값은 실제 GitHub.
10. **사용자 범위는 서비스 함수의 첫 인자 `userId`로 건다.** 모든 조회·수정·삭제 조건에 `userId`를 더하고 생성 시 넣는다. 검증·진행률·연결 해제 규칙은 그대로다(기존 테스트가 기대값 변경 없이 통과). Route Handler는 `authRoute()` 래퍼로 세션을 확인해 401을 돌려준다. 남의 항목은 404, 남의 상위 항목 연결은 400.
11. **화면 보호는 middleware + 401 처리 두 겹이다.** middleware(Edge)는 세션 쿠키가 없으면 /login으로 보낸다(DB 조회 불가). 쿠키가 만료·위조면 API가 401을 주고 `api()` 헬퍼가 /login으로 보낸다.

## 4. 데이터 모델 (PRD 4-7 기준, `progress`만 제외)

```ts
Task       { _id, title: string*, date: 'YYYY-MM-DD'*, status: 'todo'|'doing'|'done' = 'todo',
             weeklyPlanId: ObjectId | null, memo: string = "", order?: number /* P1 */, createdAt, updatedAt }
WeeklyPlan { _id, title*, startDate* /* 월요일 */, endDate* /* 일요일 */, yearlyGoalId: ObjectId | null, memo: string = "" }
           // progress는 저장하지 않음. 응답 시 계산해서 포함
YearlyGoal { _id, title*, year: number*, memo: string = "" }
User       { _id, githubId: number* (unique), username*, avatarUrl, createdAt, updatedAt }
Session    { _id, tokenHash* (unique, sha256), userId*, expiresAt* (TTL) }
// Task / WeeklyPlan / YearlyGoal 모두 userId: ObjectId* 추가
```
- `createdAt` / `updatedAt`는 Mongoose `timestamps: true`로 자동 기록한다 (PRD 4-2 "상태 변경 시점 기록")
- 인덱스: `Task.weeklyPlanId`, `Task.date`, `Task.userId`, `WeeklyPlan.yearlyGoalId`, `WeeklyPlan (userId, startDate)` (unique), `YearlyGoal.userId`
- 마이그레이션 `scripts/migrate-user-id.mjs`: `startDate_1` unique 인덱스를 지우고 `(userId, startDate)` unique로 교체, userId 없는 문서를 `--assign-to <username>` 사용자에게 할당. 재실행 안전
- 응답에서는 `_id`를 `id` 문자열로 바꿔 내보낸다
- `memo`는 선택 항목(최대 2000자). 생성·수정 API 모두 받으며, 화면에서는 "추가" 폼과 "수정" 폼 모두에서 입력한다. memo 필드가 없는 기존 문서는 응답에서 빈 문자열로 채운다

## 5. 파일 구조

```
src/
  lib/db.ts                 # MongoDB 연결 캐시 (dev 핫리로드 시 연결 중복 방지)
  lib/validation.ts         # Zod 스키마
  lib/date.ts               # YYYY-MM-DD 유틸, 월요일/7일 검증, 주 시작일 계산
  models/Task.ts | WeeklyPlan.ts | YearlyGoal.ts
  services/progress.ts      # calcWeeklyProgress (조회 시 집계), (P1) calcYearlyProgress
  services/tasks.ts | weeklyPlans.ts | yearlyGoals.ts
  app/api/tasks/route.ts            # GET(?date=, ?from=&to=, ?weeklyPlanId=, ?unlinked=1), POST
  app/api/tasks/[id]/route.ts       # PATCH, DELETE
  app/api/weekly-plans/route.ts, [id]/route.ts
  app/api/yearly-goals/route.ts, [id]/route.ts
  app/board/page.tsx        # 칸반 보드 (기본: 이번 주, ?week=YYYY-MM-DD)
  app/tasks/page.tsx        # 일일 목록
  app/weekly/page.tsx       # 주간 계획 + 진행률
  app/yearly/page.tsx       # 1년 목표 + 연결된 주간 계획
  components/Board/*, forms/*, ConfirmDialog.tsx, Toast.tsx
tests/unit/*, tests/e2e/*
```

## 6. 구현 단계

### 1단계: 프로젝트 세팅
- `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`), mongoose, zod, @dnd-kit, vitest, mongodb-memory-server, playwright 설치
- `src/lib/db.ts` 연결 캐시, `.env.example`에 `MONGODB_URI`
- **완료 조건**: `npm run dev` 실행 후 `/api/health`가 DB 연결 상태를 200으로 응답

### 2단계: 모델과 서비스 (P0 4-1, 4-2, 4-4, 4-5, 4-6, 4-7)
- Mongoose 모델 3개, Zod 스키마
- `calcWeeklyProgress`: 주간 계획 id 목록을 받아 `$group`으로 한 번에 집계, `round(done / total * 100)`, total이 0이면 0. 주간 계획 조회 서비스가 이 값을 붙여 반환
- WeeklyPlan 생성: 월요일 시작·7일·기간 중복 검증
- Task 생성/수정: `weeklyPlanId`가 있으면 `date`가 해당 주간 계획 기간 안인지 검증
- WeeklyPlan 삭제 → 연결된 Task의 `weeklyPlanId = null`
- YearlyGoal 삭제 → 연결된 WeeklyPlan의 `yearlyGoalId = null`
- **완료 조건**: 7장의 단위 테스트 전부 통과

### 3단계: API Route Handler
- 위 5장의 엔드포인트. 검증 실패는 400, 존재하지 않는 id는 404, 존재하지 않는 상위 id로 연결하려 하면 400, 주간 계획 기간 중복은 409
- **완료 조건**: 엔드포인트별 정상·실패 경로 통합 테스트 통과

### 4단계: 기간별 CRUD 화면
- `/yearly`: 목표 CRUD, 목표별 연결된 주간 계획 목록 (User flow 1, 8)
- `/weekly`: 주간 계획 CRUD(시작일은 월요일만 선택 가능), 1년 목표 선택, 진행률 바 표시 (User flow 2, 7)
- `/tasks`: 날짜를 골라 일일 목록 보기, 할 일 CRUD, 주간 계획 선택(해당 날짜가 포함된 주의 계획만 선택지로 표시) (User flow 3)
- 모든 삭제는 확인 대화상자를 거친다 (PRD 4-1)
- **완료 조건**: User flow 1~3, 7~9를 브라우저에서 직접 수행 가능

### 5단계: 칸반 보드 (PRD 4-3)
- `/board`: todo / doing / done 3개 컬럼, @dnd-kit `DndContext` + 컬럼별 droppable
- 기본 범위는 이번 주(월~일). 이전 주 / 이번 주 / 다음 주 이동 버튼, 선택한 주는 URL 쿼리(`?week=`)로 유지
- 다른 컬럼에 드롭하면 `PATCH {status}`, 같은 컬럼에 드롭하면 요청을 보내지 않음
- 센서: 마우스는 5px 움직이면 드래그 시작, 터치는 0.2초 길게 눌러야 드래그 시작(바로 쓸어 넘기면 화면 스크롤)
- 실패 시 롤백 + 토스트
- **완료 조건**: E2E 시나리오(7장) 통과

### 7단계: GitHub 로그인 (docs/LOGIN.md)
- `src/lib/auth.ts`(세션), `src/lib/github.ts`(OAuth), `src/models/{User,Session}.ts`, `src/services/users.ts`
- `src/app/auth/github/route.ts`, `src/app/auth/github/callback/route.ts`, `src/app/auth/logout/route.ts`, `src/app/api/me/route.ts`, `src/app/login/page.tsx`, `src/middleware.ts`
- 테스트: `tests/unit/auth.test.ts`(401, 사용자 격리, OAuth state/콜백, 로그아웃, 마이그레이션, secret 하드코딩 검사), `tests/e2e/auth.spec.ts` + `tests/e2e/mock-github.mjs`(모의 GitHub)

### 6단계: P1 기능 (P0 완료 후)
- 1년 목표 진행률 = 연결된 주간 계획 progress 평균 (연결 0개면 0%). 조회 시 계산
- 보드 필터: 주간 계획 기준 (URL 쿼리로 유지). 날짜(주 단위) 범위는 P0에서 처리
- 미연결 할 일 목록 (`?unlinked=1`)
- 컬럼 내 카드 순서: `Task.order` + @dnd-kit/sortable

## 7. 수용 기준 (테스트 가능)

**진행률 (단위 테스트)**
- [ ] 연결 Task 0개 → progress 0
- [ ] 4개 중 done 1개 → 25, 3개 중 done 1개 → 33 (반올림)
- [ ] Task 생성, 삭제, 상태 변경 직후 주간 계획을 조회하면 바뀐 progress가 나옴
- [ ] Task를 주간 A에서 B로 옮기면 A와 B 조회 결과가 모두 바뀜
- [ ] 연결을 해제하면(`weeklyPlanId: null`) 이전 주간 계획 조회 결과가 바뀜
- [ ] WeeklyPlan 문서에 `progress` 필드가 저장되지 않음

**연결과 삭제 (단위 테스트)**
- [ ] WeeklyPlan 삭제 후 Task는 남아 있고 `weeklyPlanId === null`
- [ ] YearlyGoal 삭제 후 WeeklyPlan은 남아 있고 `yearlyGoalId === null`
- [ ] 미연결 Task와 WeeklyPlan 생성 허용

**검증 (통합 테스트)**
- [ ] 제목이나 날짜가 없는 Task 생성 → 400
- [ ] status가 todo/doing/done 이외의 값 → 400
- [ ] `startDate`가 월요일이 아닌 WeeklyPlan → 400
- [ ] `endDate - startDate !== 6일`인 WeeklyPlan → 400
- [ ] 이미 주간 계획이 있는 주에 다시 생성 → 409
- [ ] 주간 계획 기간 밖 날짜의 Task를 그 계획에 연결 → 400
- [ ] 연결된 Task의 날짜를 기간 밖으로 변경 → 400, 기존 값 유지
- [ ] 상태를 바꾸면 `updatedAt`이 이전 값보다 커짐
- [ ] status 생략 시 `todo`로 생성

**보드 (Playwright E2E)**
- [ ] 첫 진입 시 이번 주 할 일만 보이고, 지난주 할 일은 보이지 않음
- [ ] "이전 주"를 누르면 지난주 할 일이 보이고, 새로고침 후에도 같은 주가 유지됨
- [ ] todo 카드를 done 컬럼에 드롭 → 새로고침 후에도 done
- [ ] 같은 컬럼에 드롭 → PATCH 요청 0건
- [ ] API가 500을 돌려주도록 막은 상태에서 드롭 → 카드가 원래 컬럼으로 돌아가고 오류 표시
- [ ] 보드에서 상태를 바꾼 뒤 `/weekly`로 가면 진행률에 반영되어 있음

## 8. 위험 요소와 대응

| 위험 | 대응 |
|---|---|
| 시간대 때문에 날짜가 하루 밀림 | 날짜를 `YYYY-MM-DD` 문자열로 저장·비교. "이번 주" 계산은 사용자 로컬 날짜 기준 |
| 주간 계획 목록 조회 때 progress 집계가 느려짐 | 목록의 id를 모아 한 번의 aggregate로 계산(N+1 금지), `Task.weeklyPlanId` 인덱스 사용 |
| dev 핫리로드 때 MongoDB 연결이 계속 늘어남 | `global`에 연결을 캐시 (`src/lib/db.ts`) |
| Mongoose 모델 중복 등록 오류 (`OverwriteModelError`) | `mongoose.models.X ?? model(...)` 패턴 |
| 드래그 중 빠르게 연속 드롭하면 응답 순서가 꼬임 | 카드별로 요청 중인 동안 다시 드래그하지 못하게 막음 |
| Windows에서 mongodb-memory-server 바이너리 다운로드 실패 | 첫 실행 시 다운로드 확인. 실패하면 로컬 `mongod`를 대상으로 하는 테스트 DB로 대체 |

## 9. 검증 절차

1. `npm run lint` 및 `npx tsc --noEmit` 오류 0건
2. `npm run test` (Vitest): 7장의 단위·통합 테스트 전부 통과
3. `npm run test:e2e` (Playwright): 보드 시나리오 6개 통과
4. 직접 확인: PRD User flow 1~9를 순서대로 수행

## 10. 확인이 필요한 가정

- ~~인증 없는 단일 사용자 앱으로 가정~~ → GitHub 로그인 추가로 사용자별 데이터 (7단계)
- 진행률은 정수로 반올림해 표시
- `progress`를 저장하지 않고 조회 시 계산 (PRD 4-7 데이터 모델과 다름. PRD 수정 필요)
- 주 시작 요일은 월요일로 고정, 같은 주에 주간 계획은 하나만 허용
- 할 일 날짜가 연결된 주간 계획 기간을 벗어나면 저장을 거부 (자동 연결 해제 안 함)
- 보드 기본 범위는 이번 주, 주 단위 이동은 P0 (PRD에서는 필터 전체가 P1)
