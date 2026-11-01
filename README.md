# 할 일 관리 앱

할 일 → 주간 계획 → 1년 목표를 연결해 관리하는 개인용 앱입니다. 요구사항은 `docs/PRD.md`, 구현 계획은 `docs/PLAN.md`를 참고하세요.

- Next.js 15 (App Router) + TypeScript, API는 Route Handler (`src/app/api`)
- MongoDB + Mongoose, 입력 검증은 Zod
- 칸반 보드 드래그 앤 드롭은 @dnd-kit

## 실행

```bash
npm install
cp .env.example .env   # MONGODB_URI 설정 (기본: mongodb://127.0.0.1:27017/todo-app)
```

MongoDB가 설치되어 있지 않다면 개발용 DB를 띄울 수 있습니다. 데이터는 `.data/db`에 보관됩니다.

```bash
npm run db:dev   # 터미널 1: 개발용 MongoDB (포트 27017)
npm run dev      # 터미널 2: http://localhost:3000
```

Atlas 등 다른 MongoDB를 쓰려면 `.env`의 `MONGODB_URI`만 바꾸면 됩니다.

### GitHub 로그인

앱은 GitHub 계정으로 로그인해야 쓸 수 있습니다. GitHub OAuth App을 만들고 `.env`에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`을 넣으세요. 자세한 순서는 [`docs/GITHUB_OAUTH.md`](docs/GITHUB_OAUTH.md)에 있습니다.

로그인 기능 전에 만든 데이터는 한 번 로그인한 뒤 `npm run migrate:user-id -- --assign-to <GitHub아이디>`로 내 계정에 옮기세요.

## 화면

| 경로 | 내용 |
|---|---|
| `/board` | todo / doing / done 칸반 보드. 기본은 이번 주, 이전/다음 주 이동, 주간 계획 필터, 카드 드래그로 상태 변경과 순서 변경 |
| `/tasks` | 날짜별 할 일 목록과 생성/수정/삭제, 미연결 할 일 목록 |
| `/weekly` | 주간 계획(월요일 시작 7일)과 진행률 |
| `/yearly` | 1년 목표, 진행률(연결된 주간 계획 평균), 연결된 주간 계획 목록 |

## 규칙

- 주간 진행률 = 연결된 할 일 중 done 수 / 전체 수 × 100 (반올림, 할 일이 없으면 0%). 저장하지 않고 조회할 때 계산합니다.
- 주간 계획은 월요일에 시작하는 7일이고, 같은 주에는 하나만 만들 수 있습니다. 기간은 수정할 수 없습니다.
- 할 일 날짜는 연결된 주간 계획 기간 안에 있어야 합니다.
- 주간 계획이나 1년 목표를 삭제하면 하위 항목은 남고 연결만 해제됩니다.
- 모든 데이터는 로그인한 사용자 본인 것만 보이고 수정할 수 있습니다.
- 할 일, 주간 계획, 1년 목표 모두 추가할 때나 "수정"을 눌러 메모(최대 2000자)를 적을 수 있습니다.

## 테스트

```bash
npm run lint
npm run typecheck
npm test          # Vitest: 서비스와 API (mongodb-memory-server 사용, 첫 실행 때 MongoDB 바이너리를 내려받음)
npm run test:e2e  # Playwright: 포트 27018(DB), 3200(모의 GitHub), 3100(앱)을 직접 띄움. 처음에는 npx playwright install chromium 필요
```

E2E 서버는 `.next-e2e` 폴더를 따로 쓰므로 `npm run dev`를 켜 둔 채로 실행해도 됩니다.
