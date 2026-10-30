---
inclusion: always
---

# 파일 배치 규칙

5명이 이틀 동안 Kiro로 코드를 생성한다. 지난 프로젝트에서는 에이전트가 만든 확인용 스크립트가
루트에 쌓여 파일을 찾을 수 없게 됐다. 아래 규칙은 그 일을 막기 위한 것이며, 파일을 만들기 전에 항상 따른다.

## 절대 규칙

1. **루트에 새 파일을 만들지 않는다.** 허용 목록은 `scripts/check_structure.py`의 `ROOT_ALLOWED`가 유일한 기준이다.
2. **확인용·실험용·일회성 스크립트는 `scratch/`에 만든다.** gitignore되어 커밋되지 않는다.
   팀이 계속 써야 하는 스크립트만 `scripts/`로 옮기고, 첫 줄에 용도를 주석으로 적는다.
3. 새 폴더가 필요해 보이면 먼저 아래 표에서 자리를 찾는다. 맞는 자리가 없으면 만들지 말고 사용자에게 묻는다.
4. 같은 역할의 파일을 둘 만들지 않는다. `utils2.py`, `helpers_new.js` 대신 기존 파일을 고친다.
5. `_v2`, `_new`, `_final`, `_backup`이 붙은 파일을 만들지 않는다. 버전은 git이 관리한다.
6. 새 파일을 만들었으면 턴 마지막에 **만든 파일의 경로 목록**을 사용자에게 보고한다.

## 어디에 무엇을

| 무엇 | 위치 |
|---|---|
| 웹 화면 (React) | `frontend/` |
| API·비즈니스 로직 (Lambda) | `backend/` |
| AWS 리소스 정의 (SAM 템플릿 등) | `infra/` |
| 기능 명세 (requirements·design·tasks) | `.kiro/specs/<기능-이름>/` — Kiro Generate Specs가 만든다 |
| 에이전트 규칙 | `.kiro/steering/` |
| 자동화 hook | `.kiro/hooks/` |
| 팀 체크리스트, 발표 소재 | `docs/` |
| Kiro 대화 기록 (제출 필수) | `docs/kiro-log/<이름>-<주제>.md` |
| 팀이 계속 쓰는 스크립트 | `scripts/` |
| 한 번 쓰고 버릴 코드 | `scratch/` (커밋 안 됨) |

## backend 내부

```
backend/
  src/                 ← Lambda CodeUri. import는 src 기준 (from services.foo import bar)
    handlers/          ← Lambda 진입점. 엔드포인트 하나에 파일 하나
    services/          ← 비즈니스 로직, DynamoDB·S3 호출
    ai/                ← Bedrock 호출과 프롬프트. 프롬프트 문자열은 여기에만 둔다
  tests/               ← pytest. src 구조를 그대로 따른다
  requirements.txt
```

## frontend 내부

```
frontend/              ← Vite 기본 구조 (package.json, vite.config.js, index.html은 여기)
  src/
    pages/             ← 화면 단위
    components/        ← 재사용 컴포넌트
    api/               ← 백엔드 호출. fetch는 여기서만 한다
```

## infra 내부

`infra/template.yaml`(SAM)과 `infra/samconfig.toml`만 둔다. 배포 명령은 `infra/`에서 실행한다.

## 이름 규칙

- Python 파일·함수: `snake_case`
- React 컴포넌트 파일: `PascalCase.jsx`
- 그 밖의 파일·폴더: `kebab-case`
- spec 폴더: 기능을 나타내는 영어 kebab-case (예: `.kiro/specs/report-upload/`)
