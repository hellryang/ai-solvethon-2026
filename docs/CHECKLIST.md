# 팀 체크리스트 (5조)

> 끝낸 항목은 `- [x]`로 바꿔 커밋한다. 제출 마감은 **10/31(토) 12:00**.
> **팀 서버와 계정은 10/31(토) 20:00에 삭제된다.** 코드는 이 GitHub 저장소에 남긴다.

## 0. 역할

운영진 특강의 역할 예시를 따른다. 폴더 단위로 나눠 같은 파일을 동시에 고치는 일을 줄인다.
심사위원은 **개인별 역할**을 중요하게 본다. 각자 본인 GitHub 계정으로 커밋해 기록이 남게 한다.

| 역할 | 이름 | 맡는 곳 | 발표·제출 담당 |
|---|---|---|---|
| 문서·시연 (팀장) | 임혜량 | `product.md`, spec 검토, `docs/` | 발표자료, 5분 발표 |
| 통합·배포 | | 합친 코드 빌드, `deploy.ps1` Check/Deploy, 서버 상태 확인 | 팀 서버 시연 환경 |
| 화면 | | `frontend/src/` | 시연 화면 흐름 |
| API·데이터 | | `backend/app/team/` 테이블·API, 가상 데이터 20건 | API 테스트 |
| AI·검증 | | AI 지시문(300자 이내), 테스트 입력, 서버에서 실제 응답 평가 | `verification.md`, 데모 영상 |

PEM 키와 배포는 **통합·배포 담당 1명만** 다룬다.

## 1. 시간표

| 시각 | 공식 일정 | 팀이 끝낼 것 |
|---|---|---|
| 10/30 12:00 | 점심 | 전원 Python 3.12·Node 24 설치 확인 · GitHub 초대 수락 |
| 13:00 | Kiro 특강 | 전원 Kiro 로그인 · 이 저장소를 clone해서 Kiro로 열기 · `setup-local.ps1` · 5173에서 mock 확인 |
| 14:00 | 주제·범위 확정 | 멘토 방향 제안 반영 → `product.md` 갱신 · 역할 확정 |
| 15:00 | 아이디어 피치 (5분) | `docs/pitch.md` 대본. 멘토 피드백을 `pitch.md` 맨 아래와 `product.md`에 반영 |
| 16:00 | Spec Design | 기능별 spec 생성(아래 2절) · **팀 테이블 컬럼 확정** · API 형식 합의 |
| 19:30 | 자율 개발 | P0 구현 · **22:00 전에 팀 서버에 한 번 배포해 실제 AI 확인** (멘토: "서버에 빨리 올려라") |
| 10/31 09:00 | Full-stack Dev | P0 마무리 → 남으면 P1 · 10:30 기능 동결 |
| 11:00 | 최종 제출 | 3절 제출 체크리스트 |
| 13:00 | 발표 준비 | 시연 리허설 1회 · 실패 대비 영상 준비 |

## 2. Kiro 사용 순서 (배점 20점)

1. **처음 열 때**: File → Open Folder → 저장소 최상위 폴더. 첫 요청은 "이 프로젝트의 .kiro/steering과 README를 읽고, 로컬 실행 방법과 수정 가능한 파일을 확인해 주세요. 기존 규칙은 유지하고 아직 코드는 수정하지 말아 주세요."
2. **Specs**: Kiro 패널 Specs `+` → requirements → design → tasks 순서로 검토하며 만든다. 폴더는 `.kiro/specs/<기능>/`, `_template`의 항목을 채운다
3. **구현**: tasks.md의 작업 하나씩 실행. Kiro가 바꾸려는 파일이 범위를 벗어나면 승인하지 않는다
4. **Hooks**: 이미 2개 있음(구조 검사, 비밀값 차단). AI·검증 담당은 테스트가 생기면 "백엔드 .py 저장 시 pytest" hook을 Kiro 패널에서 추가한다
5. **기록**: mock 통과와 서버 실제 AI 검증을 구분해 `verification.md`에 남긴다. 의미 있는 Kiro 대화는 `docs/kiro-log/<이름>-<주제>.md`로 저장

## 3. 제출 체크리스트 (10/31 11:00 ~ 12:00)

- [ ] GitHub 저장소 **Public** · URL 제출
- [ ] README: 서비스 개요 · 실행 방법 · AWS 아키텍처 다이어그램 채움
- [ ] `.kiro/` (specs · steering · hooks)와 `docs/kiro-log/`가 커밋돼 있음
- [ ] 팀 서버에 최신 코드 Deploy 완료 · release ID 기록
- [ ] 발표자료 PPT/PDF — 문제 정의 → Kiro 활용 개발 과정 → 서비스 데모 → 기대 효과 · **개인별 역할 슬라이드**
- [ ] 데모 영상 3분 이내 · YouTube 또는 Google Drive 링크 (라이브 데모 실패 대비)
- [ ] `py -3.12 scripts/check_structure.py` 통과

## 4. Git 규칙

- 브랜치는 `main` 하나 + 작업 브랜치 `feat/<이름>-<기능>` (예: `feat/hs-matching`)
- PR로 합치고 **Squash merge**. 리뷰 승인은 필수가 아니지만 CI는 통과해야 한다
- 2~3시간마다 합친다. 통합·배포 담당은 `main`을 기준으로 Check → Deploy 한다
- 커밋 메시지: `feat:` `fix:` `docs:` `chore:` + 한국어 한 줄
- `product.md`, `team/models.py`(테이블 컬럼), spec의 `design.md`를 고치면 팀 채널에 알린다

## 5. 고치지 않는 것 (운영진 파일)

`backend/app/models.py`·`database.py`, `requirements*.lock`, `package-lock.json`, `ops/`, `scripts/*.ps1`.
새 패키지나 추가 AWS 서비스(S3·Location·Textract·SNS 중 팀당 1개)는 멘토에게 신청한다.

## 6. 배점별로 점수를 받는 곳

| 배점 | 항목 | 증거 |
|---|---|---|
| 25 | 기술 구현 완성도 | 팀 서버에서 데모 시나리오가 끝까지 동작 |
| 20 | Kiro 활용도 | `.kiro/specs`·`steering`·`hooks`, `verification.md`, `docs/kiro-log` |
| 15 | 문제 정의 | `product.md` → README 1절 → 발표 첫 장 |
| 10 | AWS 활용 | README 2절 아키텍처 + 서비스별 쓰는 이유 |
| 10 | 창의성 | "막연한 요구 → 프로젝트 범위"를 발표에 한 장 |
| 10 | 실용성·확장성 | 사업단·산학협력단 운영 시나리오를 발표에 한 장 |
| 10 | 발표·시연 | 리허설 1회, 영상 백업 |
| (30%) | 학생 상호 투표 | 첫 화면에서 무엇을 하는 서비스인지 보이게 |
