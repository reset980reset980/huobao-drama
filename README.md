# 화보 드라마

AI를 활용해 숏폼 드라마 제작 흐름을 자동화하는 TypeScript 풀스택 프로젝트입니다. 소설 또는 원문을 극본으로 바꾸고, 캐릭터/장면 추출, 스토리보드 분해, 이미지/영상/TTS 생성, 샷 합성, 회차 병합까지 한 화면에서 이어서 작업할 수 있습니다.

이 포크는 화면 문구, 메뉴, 진행 상태, 결과, 설정, Agent 프롬프트와 Skill 문서를 한국어 기준으로 정리했습니다. 텍스트 Agent는 API 키가 없어도 로컬 Codex CLI를 사용할 수 있도록 확장되어 있습니다.

## 주요 기능

- 극본 수정: 원문을 숏폼 드라마용 형식화 극본으로 변환
- 캐릭터/장면 추출: 회차 극본에서 캐릭터와 장면을 추출하고 중복 제거
- 스토리보드 분해: 극본을 샷 단위로 나누고 이미지/영상 프롬프트 생성
- 이미지 생성: 캐릭터, 장면, 샷 이미지와 그리드 이미지 생성
- 영상 생성: 이미지 기반 영상 생성, TTS 더빙, 자막 포함 샷 합성
- 회차 내보내기: 완성된 샷 영상을 하나의 회차 영상으로 병합
- 한국어 UI: 메뉴, 설정, 진행 상태, 결과 메시지, Agent 설정 문구 한국어화
- Codex CLI 텍스트 Agent: 텍스트 AI API 설정이 없으면 로컬 Codex CLI로 Agent 실행

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Nuxt 3, Vue 3, TypeScript, CSS |
| Backend | Hono, Drizzle ORM, better-sqlite3, TypeScript |
| Agent | Mastra, AI SDK, Codex CLI fallback |
| Media | FFmpeg, Sharp |
| Database | SQLite |

## 디렉터리 구조

```text
frontend/   Nuxt 3 프론트엔드
backend/    Hono API 서버와 Agent/미디어 처리 로직
configs/    설정 파일 예시
data/       SQLite DB와 생성 리소스 저장소
skills/     Agent별 SKILL.md 규칙
```

## 요구 사항

- Node.js 20 이상
- npm 9 이상
- FFmpeg 4 이상
- 텍스트 Agent를 API 키 없이 쓰려면 로컬 Codex CLI 로그인 필요

FFmpeg 확인:

```bash
ffmpeg -version
```

Codex CLI 확인:

```bash
codex --version
codex exec --help
```

## 설치

```bash
git clone https://github.com/reset980reset980/huobao-drama.git
cd huobao-drama

cd backend
npm install

cd ../frontend
npm install
```

## 설정

기본 설정 파일을 복사합니다.

```bash
cp configs/config.example.yaml configs/config.yaml
```

기본 포트:

- Frontend: `http://localhost:3013`
- Backend API: `http://localhost:5679/api/v1`
- Static: `http://localhost:5679/static`

AI 이미지/영상/TTS API 키는 웹 화면의 `설정` 페이지에서 등록합니다.

## API 키와 Codex CLI

텍스트 Agent 기능은 두 가지 방식으로 동작합니다.

1. 웹 설정에 활성 텍스트 AI 서비스가 있으면 기존 OpenAI 호환 API 경로를 사용합니다.
2. 활성 텍스트 AI 서비스가 없거나 `TEXT_AGENT_PROVIDER=codex`이면 로컬 Codex CLI를 사용합니다.

즉, 극본 수정, 캐릭터/장면 추출, 스토리보드 분해, 음색 배정, 프롬프트 생성 같은 텍스트 Agent 작업은 Codex CLI로 실행할 수 있습니다.

이미지 생성, 영상 생성, TTS 생성은 기본적으로 외부 생성 모델을 호출하므로 해당 provider의 API 키가 필요합니다. 다만 비용이 커질 수 있는 미디어 작업은 아래 하이브리드 생성 모드로 프롬프트만 추출한 뒤 사용자가 구독형 서비스에서 반자동으로 생성하고 결과 파일 또는 URL을 등록하는 흐름을 사용할 수 있습니다.

Codex CLI를 강제로 사용하려면 backend 실행 환경에 아래 값을 지정합니다.

```bash
TEXT_AGENT_PROVIDER=codex npm run dev
```

Windows PowerShell:

```powershell
$env:TEXT_AGENT_PROVIDER='codex'
npm run dev
```

## 하이브리드 생성 모드

웹 화면의 `설정 > AI 서비스 > 생성 방식`에서 생성 방식을 선택합니다.

- `API 자동 생성`: 설정에 저장한 provider API 키를 사용해 이미지, 영상, TTS를 자동 생성합니다.
- `수동/구독형 생성`: 앱이 프롬프트를 만들고, 사용자는 외부 구독형 LLM/이미지/영상/TTS 서비스에서 생성한 결과 파일 또는 URL을 등록합니다.

Codex의 `$imagegen`은 앱 백엔드 API가 아니라 Codex 세션에서 사용할 수 있는 이미지 생성 스킬입니다. 따라서 앱에서는 이미지 프롬프트를 복사하고, Codex 또는 다른 구독형 서비스로 생성한 이미지 파일을 다시 등록하는 방식으로 연결합니다.

현재 체크포인트:

- 생성 방식 토글을 설정 화면에 추가하고 브라우저에 저장합니다.
- 수동 파일 업로드와 URL 등록용 backend API를 추가했습니다.
- 캐릭터/장면/스토리보드 결과 필드에 수동 생성 결과를 연결할 수 있는 backend API를 추가했습니다.

다음 작업:

- 회차 작업대의 생성 버튼을 토글 상태에 따라 `자동 생성` 또는 `프롬프트 복사/결과 등록` 흐름으로 전환합니다.
- 수동 등록 모달을 실제 버튼에 연결하고 이미지, TTS, 영상의 end-to-end 흐름을 검증합니다.

## 개발 실행

터미널 1:

```bash
cd backend
npm run dev
```

터미널 2:

```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:3013`으로 접속합니다.

## 단일 서버 실행

프론트엔드를 빌드한 뒤 backend가 정적 파일까지 제공합니다.

```bash
cd frontend
npm run generate

cd ../backend
npm start
```

접속 주소는 `http://localhost:5679`입니다.

## Docker 실행

```bash
docker compose up -d
docker compose logs -f
```

중지:

```bash
docker compose down
```

데이터는 `data/` 디렉터리에 저장되므로 운영 환경에서는 이 디렉터리를 백업하세요.

## Agent 목록

| Agent | 역할 |
|---|---|
| `script_rewriter` | 원문을 형식화 극본으로 수정 |
| `extractor` | 캐릭터와 장면 추출 및 중복 제거 |
| `storyboard_breaker` | 극본을 스토리보드 샷으로 분해 |
| `voice_assigner` | 캐릭터별 TTS 음색 배정 |
| `grid_prompt_generator` | 캐릭터/장면/그리드 이미지 프롬프트 생성 |

## 검증 명령

Backend 타입 검사:

```bash
cd backend
npm run typecheck
```

Frontend 빌드:

```bash
cd frontend
npm run build
```

Backend 헬스 체크:

```bash
curl http://localhost:5679/api/v1/health
```

## 자주 묻는 질문

### 텍스트 작업에도 API 키가 필요한가요?

필수는 아닙니다. 로컬 Codex CLI가 설치되어 있고 로그인되어 있으면 텍스트 Agent는 Codex CLI로 실행할 수 있습니다.

### 이미지/영상/TTS도 Codex CLI로 되나요?

아닙니다. Codex CLI는 텍스트 Agent 실행에만 사용됩니다. 이미지, 영상, TTS 생성에는 각 생성 서비스의 API 키가 필요합니다.

### DB는 직접 생성해야 하나요?

아닙니다. backend 최초 실행 시 SQLite DB와 테이블이 자동으로 준비됩니다.

### FFmpeg가 꼭 필요한가요?

영상 합성, 자막 삽입, 회차 병합에는 필요합니다. Docker 이미지는 FFmpeg 포함을 전제로 합니다.

## 라이선스

원본 프로젝트의 라이선스를 따릅니다. 상업적 사용 전 원본 저장소의 라이선스와 고지 사항을 확인하세요.

## 원본 프로젝트

- 원본: https://github.com/chatfire-AI/huobao-drama
- 포크: https://github.com/reset980reset980/huobao-drama
