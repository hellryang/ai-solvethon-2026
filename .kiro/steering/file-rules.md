---
inclusion: always
---

# 파일 배치 규칙 (팀 추가)

운영진 규칙(`structure.md`·`tech.md`·`deployment.md`·`data-policy.md`·`aws.md`)이 우선이다. 이 파일은 그 위에 팀이 더한 규칙이다.
5명이 이틀 동안 Kiro로 코드를 생성한다. 지난 프로젝트에서는 에이전트가 만든 확인용 스크립트가 루트에 쌓여 파일을 찾을 수 없게 됐다.

## 절대 규칙

1. **루트에 새 파일을 만들지 않는다.** 허용 목록은 `scripts/check_structure.py`의 `ROOT_ALLOWED`가 유일한 기준이다.
2. **확인용·실험용·일회성 스크립트는 `scratch/`에 만든다.** gitignore되어 커밋되지 않는다.
3. 새 폴더가 필요해 보이면 아래 표에서 자리를 먼저 찾는다. 맞는 자리가 없으면 만들지 말고 사용자에게 묻는다.
4. 같은 역할의 파일을 둘 만들지 않는다. `utils2.py`, `helpers_new.ts` 대신 기존 파일을 고친다.
5. `_v2`, `_new`, `_final`, `_backup`이 붙은 파일을 만들지 않는다. 버전은 git이 관리한다.
6. 새 파일을 만들었으면 턴 마지막에 **만든 파일의 경로 목록**을 사용자에게 보고한다.

## 어디에 무엇을

| 무엇 | 위치 |
|---|---|
| 팀 주제 테이블 (인재·프로젝트·관심 저장) | `backend/app/team/models.py` |
| 팀 주제 API | `backend/app/team/routes.py` |
| 매칭 점수 계산, 기술 사전 | `backend/app/team/` 안에 모듈로 (예: `matching.py`, `skills.py`) — `team/models.py`에서 import해 등록 |
| 백엔드 테스트 | `backend/tests/test_team_*.py` |
| 화면 | `frontend/src/` — 화면이 커지면 `frontend/src/pages/`, 재사용 조각은 `frontend/src/components/` |
| 기능 명세 | `.kiro/specs/<기능-이름>/` — `_template`을 참고해 Kiro Spec으로 만든다 |
| 검증 기록 | `.kiro/specs/<기능-이름>/verification.md` |
| 팀 체크리스트, 피치, 발표 소재 | `docs/` |
| Kiro 대화 기록 (제출 필수) | `docs/kiro-log/<이름>-<주제>.md` |
| 한 번 쓰고 버릴 코드 | `scratch/` (커밋 안 됨) |

`backend/app/models.py`·`database.py`, 잠금 파일(`requirements*.lock`, `package-lock.json`), `ops/`, `scripts/*.ps1`은 운영진 파일이므로 고치지 않는다.

## 이름 규칙

- Python 파일·함수: `snake_case`
- React 컴포넌트 파일: `PascalCase.tsx`
- spec 폴더: 영어 kebab-case (예: `.kiro/specs/talent-matching/`)
