# GitHub OAuth 로그인 설정 가이드

할 일 앱은 GitHub 계정으로 로그인합니다. 처음 한 번만 아래 순서대로 설정하면 됩니다.

## 1. GitHub OAuth App 만들기

1. GitHub에 로그인하고 **Settings → Developer settings → OAuth Apps → New OAuth App**으로 이동합니다.
   (바로가기: https://github.com/settings/applications/new)
2. 다음과 같이 입력합니다.

   | 항목 | 값 |
   |---|---|
   | Application name | 아무 이름 (예: `todo-app (local)`) |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |

3. **Register application**을 누릅니다.
4. 화면의 **Client ID**를 복사합니다.
5. **Generate a new client secret**을 눌러 **Client secret**을 만들고 복사합니다. 이 값은 다시 볼 수 없으니 바로 `.env`에 넣으세요.

> Authorization callback URL은 OAuth 표준의 Redirect URI와 같은 것입니다.
> 휴대폰 등 다른 주소(예: `http://192.168.0.28:3000`)로 접속해 로그인하려면 그 주소로 OAuth App을 하나 더 만들고
> `.env`의 `GITHUB_CALLBACK_URL`을 그 주소의 `/auth/github/callback`으로 지정해야 합니다. OAuth App 하나에는 callback URL을 하나만 등록할 수 있습니다.

## 2. 환경 변수 넣기

프로젝트 맨 위의 `.env`에 추가합니다. 값은 코드에 직접 쓰지 말고 반드시 `.env`에만 둡니다(`.env`는 git에 올라가지 않습니다).

```
GITHUB_CLIENT_ID=복사한_Client_ID
GITHUB_CLIENT_SECRET=복사한_Client_secret
# 선택: 접속 주소가 localhost:3000이 아닐 때만
# GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
```

환경 변수를 바꾼 뒤에는 `npm run dev`를 껐다 켜세요.

## 3. 로그인 확인

1. `npm run dev` 후 http://localhost:3000 접속 → `/login` 화면이 나옵니다.
2. **GitHub로 로그인** → GitHub 권한 허용 → 보드 화면으로 돌아오고, 오른쪽 위에 GitHub 아이디와 아바타가 보이면 성공입니다.

## 4. 기존 데이터 옮기기 (마이그레이션)

로그인 기능을 넣기 전에 만든 할 일, 주간 계획, 1년 목표에는 주인(`userId`)이 없어서 로그인하면 보이지 않습니다.
**한 번 로그인한 뒤** 다음 명령으로 내 계정에 할당하세요.

```bash
npm run migrate:user-id                              # 주인 없는 데이터 개수만 확인
npm run migrate:user-id -- --assign-to <GitHub아이디>   # 내 계정으로 할당
```

이 명령은 주간 계획의 "주당 하나" 규칙도 사용자별로 바꿉니다. 여러 번 실행해도 안전합니다.

## 동작 방식 요약

| 경로 | 설명 |
|---|---|
| `GET /auth/github` | CSRF 방지용 `state`를 쿠키에 저장하고 GitHub 인증 화면으로 보냄 |
| `GET /auth/github/callback` | `state` 확인 → code를 토큰으로 교환 → GitHub 사용자(`username`, `avatar_url`) 저장 → 세션 생성 → `/board` |
| `POST /auth/logout` | DB의 세션 문서 삭제 + 세션 쿠키 만료 → `/login` |
| `GET /api/me` | 현재 로그인한 사용자 |

- 세션은 MongoDB `sessions` 컬렉션에 저장하며 토큰은 sha256 해시로만 보관합니다. 30일 뒤 자동 만료됩니다.
- 로그인하지 않으면 화면은 `/login`으로 리다이렉트되고, API는 401을 돌려줍니다.
- 할 일, 주간 계획, 1년 목표는 로그인한 본인 것만 조회·수정·삭제할 수 있습니다. 다른 사람의 항목은 404로 응답합니다.

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 로그인 화면에 "GitHub OAuth 설정이 없습니다" | `.env`에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`이 없음 → 추가 후 서버 재시작 |
| GitHub에서 `redirect_uri is not associated with this application` | OAuth App의 callback URL과 접속 주소가 다름 → callback URL 확인 또는 `GITHUB_CALLBACK_URL` 지정 |
| 로그인 후 기존 데이터가 안 보임 | 4번 마이그레이션 실행 |
| "로그인 요청이 만료되었거나 올바르지 않습니다" | 로그인 버튼을 누른 뒤 10분이 지났거나 다른 탭에서 시작함 → 다시 로그인 |
