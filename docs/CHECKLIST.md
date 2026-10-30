# 팀 체크리스트

> 끝낸 항목은 `- [x]`로 바꿔 커밋한다. 제출 마감은 **10/31(토) 12:00**.

## 0. 역할 (11:00 팀 배정 직후 확정)

폴더 단위로 나눠 같은 파일을 동시에 고치는 일을 줄인다.

| 역할 | 이름 | 맡는 폴더 | 발표·제출 담당 |
|---|---|---|---|
| 팀장 · PM | 임혜량 | `.kiro/steering/product.md`, spec 검토 | 발표자료, 5분 발표 |
| 프론트엔드 | | `frontend/` | 시연 화면 |
| 백엔드 | | `backend/src/handlers`, `services` | API 테스트 |
| AI | | `backend/src/ai` | Bedrock 프롬프트, 응답 품질 |
| 인프라 · QA | | `infra/`, Amplify | 배포 URL, 데모 영상, README 아키텍처 |

## 1. 시간표

| 시각 | 공식 일정 | 팀이 끝낼 것 |
|---|---|---|
| 10/30 11:00 | 팀 배정 | 역할 확정 · 전원 저장소 초대 수락 · `git clone` |
| 13:00 | Kiro 특강 | 전원 Kiro에서 저장소 열기 · steering 3개가 보이는지 확인 |
| 14:00 | 주제 선택 | `product.md` 채우기 (문제·데모 시나리오·P0 기능) → main에 push |
| 15:00 | 아이디어 피치 (5분) | 피치 자료 = `product.md` 내용. 멘토 피드백을 `product.md`에 반영 |
| 16:00 | Spec Design | 기능별 spec 생성 (아래 2절) · `design.md`의 API 형식 합의 |
| 19:30 | 자율 개발 | P0 구현 · **22:00 전에 배포 URL에서 한 번이라도 동작** |
| 10/31 09:00 | Full-stack Dev | P0 마무리 → 남으면 P1 · 10:30 기능 동결 |
| 11:00 | 최종 제출 | 3절 제출 체크리스트 |
| 13:00 | 발표 준비 | 시연 리허설 1회 · 실패 대비 영상 준비 |

## 2. Kiro 사용 순서 (배점 20점)

1. **Steering**: 주제 확정 후 `product.md`부터 채운다. `tech.md`의 스택을 바꿀 거면 이때 고친다
2. **Specs**: 기능마다 Kiro에서 spec을 만든다 → `requirements.md` 검토 → `design.md` 검토 → `tasks.md` 순서로 구현
3. **Hooks**: 이미 2개가 있다 (구조 검사, 비밀값 차단). 백엔드 담당은 테스트가 생기면 Kiro 패널 Agent Hooks에서 "백엔드 .py 저장 시 pytest 실행" hook을 하나 더 만든다
4. **기록**: 의미 있는 대화(spec 생성, 큰 버그 해결, 설계 변경)는 복사해서 `docs/kiro-log/<이름>-<주제>.md`로 저장한다. 발표의 "Kiro 활용 개발 과정" 슬라이드 소재가 된다

## 3. 제출 체크리스트 (10/31 11:00 ~ 12:00)

- [ ] GitHub 저장소 **Public** · URL 제출
- [ ] README: 서비스 개요 · 실행 방법 · AWS 아키텍처 다이어그램 채움
- [ ] `.kiro/` (specs · steering · hooks)와 `docs/kiro-log/`가 커밋돼 있음
- [ ] 배포 URL이 다른 사람 휴대폰에서도 열림
- [ ] 발표자료 PPT/PDF — 문제 정의 → Kiro 활용 개발 과정 → 서비스 데모 → 기대 효과
- [ ] 데모 영상 3분 이내 · YouTube 또는 Google Drive 링크 (라이브 데모 실패 대비)
- [ ] `python scripts/check_structure.py` 통과

## 4. Git 규칙

- 브랜치는 `main` 하나 + 작업 브랜치 `feat/<이름>-<기능>` (예: `feat/hy-upload`)
- PR로 합치고 **Squash merge**. 리뷰 승인은 필수가 아니지만 CI는 통과해야 한다
- 2~3시간마다 합친다. 오래 들고 있을수록 충돌이 커진다
- 커밋 메시지: `feat:` `fix:` `docs:` `chore:` + 한국어 한 줄
- `product.md`, `tech.md`, `design.md`를 고치면 팀 채널에 알린다 (전원 영향)

## 5. 배점별로 점수를 받는 곳

| 배점 | 항목 | 증거 |
|---|---|---|
| 25 | 기술 구현 완성도 | 배포 URL에서 데모 시나리오가 끝까지 동작 |
| 20 | Kiro 활용도 | `.kiro/specs`·`steering`·`hooks`, `docs/kiro-log` |
| 15 | 문제 정의 | `product.md` → README 1절 → 발표 첫 장 |
| 10 | AWS 활용 | README 2절 아키텍처 + 서비스별 쓰는 이유 |
| 10 | 창의성 | 기존 서비스와 다른 점을 발표에 한 장 |
| 10 | 실용성·확장성 | 실제 사용자·확장 계획을 발표에 한 장 |
| 10 | 발표·시연 | 리허설 1회, 영상 백업 |
| (30%) | 학생 상호 투표 | 시연이 직관적일 것 — 첫 화면에서 무엇을 하는 서비스인지 보이게 |
