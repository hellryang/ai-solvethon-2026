# 설계 — 광주 AI 인재 ↔ 광주·전남 기업 프로젝트 매칭 (5조)

요구사항 번호(R1~R13)와 확인 항목(Q1~Q7)은 `requirements.md`를 가리킨다.

## 1. 한눈에 보는 구조

```
React (frontend/src) ── /api/team/* ──▶ FastAPI team 라우터 ──▶ SQLite (팀 전용 테이블 10개)
                                           │
                                           ├─ 순수 계산 모듈 (점수·시뮬레이션·서울 비교·팀 공백) ← AI 없음, DB 없음
                                           └─ ai_helpers ──▶ app/ai_service.generate_text ──▶ mock | Bedrock
```

원칙 네 가지.

1. **숫자는 코드가, 문장은 AI가.** 점수, 부족 역량, 월 저축, 자산은 순수 함수로 계산한다. AI는 이미 계산된 값을 설명하는 문장만 쓴다.
2. **AI가 죽어도 화면은 산다.** 모든 AI 결과에는 코드가 만든 대체 문장(fallback)이 있다.
3. **스키마는 첫 배포 전에 확정한다.** `schema_check.py`는 배포된 테이블의 컬럼이 바뀌면 앱 시작을 중단한다. 그래서 변하기 쉬운 데이터(지역 기준표)는 DB가 아니라 코드에 둔다.
4. **서울은 매칭과 완전히 분리한다.** 서울 비교 공고는 `Project`가 아니라 별도 테이블 `SeoulBenchmark`에 둔다. 추천·지원·목록 쿼리가 이 테이블을 읽지 않으므로 서울 공고가 매칭에 섞일 수 없다.

## 2. 주요 결정

| # | 결정 | 이유 | 대안과 기각 사유 |
|---|---|---|---|
| D1 | 기본 `Record` 모델·CRUD를 쓰지 않고 `team/models.py`에 새 테이블을 둔다 | 보호 파일(`models.py`, `database.py`)을 건드리지 않는다 (R12) | Record 재활용: 필드가 맞지 않고 보호 대상이다 |
| D2 | 적합도 점수는 순수 함수 `scoring.py`로 계산한다 | 같은 입력이면 같은 결과(R4.3), 설명 가능, 단위 테스트 용이 | AI 점수화: 숫자가 흔들리고 한도를 소모한다 |
| D3 | 월세·교통비·지원금·월 단가·공제율은 DB 테이블이 아니라 `region_data.py` 상수로 둔다 | 수치 수정이 잦아서 DB 컬럼으로 두면 배포 후 스키마 검사에 걸린다. 코드는 Git 이력이 남고 출처를 같은 줄에 적는다 | SQLite 표: 컬럼 변경 위험. S3 CSV: D4 |
| D4 | S3는 이번 MVP에 쓰지 않는다. 포트폴리오는 URL 문자열만 저장한다 | 로컬에는 AWS 자격 증명이 없어 로컬 개발이 막힌다. 핵심 기능 3개에 필요하지 않다. 버킷 `hackathon-e4-t05-data`는 확장용으로 비워 둔다 | 업로드/CSV 적재: 시간 대비 효과가 낮다. P2 |
| D5 | Lambda는 쓰지 않는다 | 멘토 신청이 필요하고 FastAPI로 같은 일을 할 수 있다 | - |
| D6 | AI 결과 캐시는 범용 테이블 `AiCache` 하나로 둔다 | 종류가 늘어도 컬럼 변경이 필요 없다 | 종류별 테이블: 첫 배포 후 변경 위험 |
| D7 | 시드는 `POST /api/team/seed`로만 실행한다 | steering의 "import 시점 운영 DB 쓰기 금지"를 지킨다. 멱등으로 만든다 | lifespan 자동 시드: `main.py` 수정과 운영 DB 자동 쓰기 |
| D8 | 로그인을 만들지 않는다. 화면에서 인재/기업 역할을 고른다 | 1박 2일 범위 밖. 서버는 Nginx Basic Auth 뒤에 있다 (A1) | 간이 인증: 시간 대비 효과가 낮다 |
| D9 | 프론트에 새 shadcn 컴포넌트나 패키지를 추가하지 않는다. 탭은 Button, 선택은 네이티브 `<select>`, 막대와 그래프는 Tailwind `div`와 인라인 SVG로 만든다 | 의존성 잠금 파일 보호 (R12.3) | 차트 라이브러리: 새 의존성 |
| D10 | 서울 비교 공고는 별도 테이블 `SeoulBenchmark`에 둔다 | 서울이 매칭에 섞이는 사고를 구조로 막는다. 필터 조건을 모든 쿼리에 넣는 방식은 하나라도 빠지면 새어 나온다 | `Project`에 `region=서울` 행 + 필터: 누락 위험, 지원 API에도 방어 코드가 필요하다 |
| D11 | 기본 생활비는 계산식에 넣지 않는다 (Q1) | 요청한 계산식과 데이터 표를 그대로 따른다. 화면에 "생활비 미반영"을 표시한다 | 생활비 표 추가: 표와 계산식 1항 증가. 팀이 원하면 `LIVING`을 추가한다 |
| D12 | 실수령액은 단일 공제율로 계산한다 (Q2) | 4대보험·간이세액표를 구현하면 시간이 크게 든다. 공제율을 상수 하나로 격리해 나중에 교체한다 | 간이세액표 구현: 범위 초과 |
| D13 | 청년 지원금은 해당 지역에서 총액이 가장 큰 1개만 적용한다 (Q4) | 중복 수혜 규정을 확인하기 전까지 과대 계산을 막는다 | 전부 합산: 과대 표시 위험 |

## 3. 백엔드 파일 구성

보호 파일은 수정하지 않는다. 신규 파일은 모두 `backend/app/team/` 아래에 둔다.

| 파일 | 역할 | 의존 | 비고 |
|---|---|---|---|
| `models.py` (기존, 채움) | SQLModel 테이블 10개 (§4, §14.2) | sqlmodel | **첫 배포 전 컬럼 확정** |
| `catalog.py` (신규) | 기술 태그, 분류, 직무군, 지역, 구, 근무 형태, 기업 유형·산업·특성 태그 상수 (§14.1) | 없음 | 프론트는 `GET /meta`로 받는다 |
| `region_data.py` (신규) | 월세, 교통 요금, 지원 제도, 월 단가 등급, 공제율 (§7.2), 지역 기술 수요 집계 `STACK_DEMAND` (§14.6) | 없음 | 항목마다 `source`, `is_assumption` |
| `scoring.py` (신규) | 필터와 적합도 점수 (§5) | 없음 (순수) | |
| `simulation.py` (신규) | 월 저축, 지원금, 자산 곡선, 시나리오 (§7) | `region_data` | 순수 |
| `benchmark.py` (신규) | 서울 비교 공고 선택·보수 결정·비교 근거 (§7.4) | 없음 (순수) | |
| `team_gap.py` (신규) | 팀 역량 합산·역할 공백 (§6) | `scoring` | 순수. P1 |
| `preference.py` (신규) | 선호 일치도, 관심 기업 유사도, 정렬 (§14.4) | `scoring` | 순수 |
| `insights.py` (신규) | 지역 기술 수요와 내 숙련도의 격차 (§14.6) | `region_data` | 순수 |
| `schemas.py` (신규) | 요청·응답 Pydantic 모델과 입력 검증 | pydantic | |
| `ai_helpers.py` (신규) | 프롬프트, 응답 파싱, 숫자 검증, 캐시 조회·저장 | `ai_service` | |
| `seed.py` (신규) | 가상 데이터와 멱등 시드 함수 | `models` | |
| `routes.py` (기존, 채움) | 라우터 조립. `prefix="/api/team"` 유지 | | 도메인별 `routes_*.py`를 `include_router`로 붙여도 된다 |

`main.py`는 이미 `team.models`를 import하고 `team.routes.router`를 등록하므로 수정하지 않는다.

계산 모듈(`scoring`, `simulation`, `benchmark`, `team_gap`)은 DB 세션과 AI를 import하지 않는다. 입력은 `dataclass` 또는 `dict`로 받는다. 담당자가 서로 기다리지 않고 병렬로 작업하고 단위 테스트를 쉽게 붙일 수 있다.

## 4. 데이터 모델 (SQLite, 10개 테이블)

모든 금액은 정수 만 원. 날짜는 `date`, 시각은 UTC `datetime`. 목록형 값은 쉼표로 이은 문자열(예: `"광주,나주"`). 표시명 외 개인 식별 정보 컬럼은 두지 않는다 (R1.4).

### TalentProfile

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | int PK | | |
| nickname | str(40) | N | 표시명. 실명 금지 |
| account_type | str | N | `individual` / `team` |
| team_id | int | Y | 팀 소속 (FK 제약은 두지 않음) |
| affiliation | str | N | `광주 소재 대학 재학` / `광주 거주 구직자` |
| desired_category | str | N | 개발/기획/퍼블리싱/디자인/기타 |
| work_mode_pref | str | N | 상주/재택/무관 |
| desired_regions | str | N | 광주,나주,광양 중 복수 |
| available_start | date | N | |
| available_end | date | N | |
| days_per_week | int | N | 1~5 |
| living_type | str | N | 자취/본가/기숙사 |
| home_district | str | N | 광주 구: 광산구/북구/서구/남구/동구 (표시용. 요금 계산에는 쓰지 않음) |
| commute_mode | str | N | 대중교통/자차 (자차도 대중교통 요금으로 계산, Q5) |
| move_willingness | str | N | `이사 가능` / `현재 거주지에서 통근` |
| housing_pref | str | Y | 원룸/투룸/셰어하우스 |
| fixed_expense | int | Y | 월 고정 지출 합계 |
| support_eligible | bool | N | 청년 주거 지원 대상 여부(본인 판단). 기본 false |
| narrative | str(1500) | N | 서술형 경험 |
| portfolio_url | str | Y | URL 문자열만 |
| card_mode | str | Y | 마지막 역량 카드 생성 모드 `mock`/`bedrock` |
| is_demo | bool | N | 시드 표시 |
| created_at | datetime | N | |

### TalentSkill

`id` PK, `talent_id` int N, `skill` str N (카탈로그 태그), `level` int N (1~5, 사용자 입력값), `evidence` str(200) Y (근거 문장), `evidence_source` str Y (`ai-mock` / `ai-bedrock` / `user`).

### TalentTeam

`id` PK, `name` str(40) N, `is_demo` bool N, `created_at` datetime N.

### TalentPreference (R15)

인재 1명당 최대 1행. 목록형 값은 쉼표로 이은 문자열이며, 비어 있으면 빈 문자열("상관없음").

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | int PK | | |
| talent_id | int | N | **고유**. FK 제약은 두지 않음 |
| org_types | str | N | 선호 기업 유형 |
| industries | str | N | 선호 산업 |
| style_tags | str | N | 선호 기업 특성 태그, 최대 3개 |
| preferred_skills | str | N | 선호 기술(카탈로그 태그) |
| favorite_companies | str | N | 관심 기업 이름, 최대 3개, **쉼표 앞이 우선순위가 높음**. 이름에 쉼표를 허용하지 않는다 |
| last_seen_at | datetime | N | 신규 공고 기준 시각(UTC). 최초 저장 시각, "확인했음"을 누를 때 갱신 |
| is_demo | bool | N | |
| updated_at | datetime | N | |

### Project (광주·나주·광양 기업 프로젝트만)

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | int PK | | |
| company_name | str(60) | N | |
| region | str | N | **광주/나주/광양만**. API가 다른 값을 422로 거부 |
| district | str(40) | N | 동 단위 상세 위치 |
| category | str | N | 개발/기획/퍼블리싱/디자인/기타 |
| job_family | str | N | 직무군(§4.1). 서울 비교 매칭 키. `category`에 속해야 함 |
| org_type | str | N | 기업 유형(§14.1). 카탈로그 값만 허용 (R14.1) |
| industry | str | N | 산업(§14.1). 카탈로그 값만 허용 |
| style_tags | str | N | 기업 특성 태그, 쉼표로 이은 문자열, 최대 3개. 없으면 빈 문자열. 가정값 (A12) |
| title | str(80) | N | |
| description | str(1500) | N | |
| work_mode | str | N | 상주/재택/혼합 |
| onsite_days_per_week | int | Y | 상주/혼합이면 1~5 필수 |
| meeting_per_month | int | Y | 재택이면 0 이상 |
| pay_monthly | int | N | 만 원/월 (월 단가) |
| pay_grade | str | N | KOSA 단가 등급 키 (`PAY_GRADES`의 키) |
| start_date | date | N | |
| end_date | date | N | |
| housing_support | bool | N | 숙소 제공 |
| commute_support | bool | N | 교통비 지원 |
| status | str | N | `open` / `closed` |
| is_demo | bool | N | |
| created_at | datetime | N | |

### ProjectSkill

`id` PK, `project_id` int N, `skill` str N, `min_level` int N (1~5), `is_required` bool N.

### ProjectRole

`id` PK, `project_id` int N, `role_name` str N, `headcount` int N (≥1), `skills` str N (쉼표 구분 기술명, 1개 이상, 해당 프로젝트의 `ProjectSkill`에 있는 기술).

### SeoulBenchmark (서울 비교 전용 공고)

`Project`와 같은 의미의 필드를 갖되 **별도 테이블**이다. 추천·지원·프로젝트 API는 이 테이블을 읽지 않는다.

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | int PK | | |
| district | str | N | 강남구/영등포구/중구 |
| category | str | N | |
| job_family | str | N | 비교 대상 프로젝트와 같은 직무군 |
| title | str(80) | N | |
| description | str(1500) | N | 비교 대상과 같은 업무 범위로 서술 |
| work_mode | str | N | 상주/재택/혼합 |
| onsite_days_per_week | int | Y | |
| meeting_per_month | int | Y | |
| duration_months | int | N | 기간. 비교 대상과 비슷하게 |
| skills | str | N | 요구 기술. `기술:최소숙련도:R또는P`를 `;`로 이음. 예: `Python:4:R;PyTorch:3:R;Docker:2:P` |
| pay_monthly | int | N | 가상 월 단가 (A11) |
| pay_grade | str | N | KOSA 단가 등급 키. 비교 대상과 같게 |
| source_note | str(120) | N | 예: `가상 공고. 나라장터·이랜서 공고 형식을 본뜸` |
| is_assumption | bool | N | 항상 true |
| is_demo | bool | N | |
| created_at | datetime | N | |

### Application

`id` PK, `talent_id` int N, `project_id` int N (`Project.id`만 가리킴), `status` str N (`applied`/`accepted`/`rejected`), `created_at` datetime N, `decided_at` datetime Y. `(talent_id, project_id)` 고유 제약.

### AiCache

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| id | int PK | | |
| kind | str | N | `card` / `match` / `sim` |
| talent_id | int | N | |
| project_id | int | Y | card는 NULL |
| key_hash | str(64) | N | **고유**. 아래 규칙 |
| text | str | N | AI 원문 응답 (검증 통과분만 저장) |
| mode | str | N | `mock` / `bedrock` |
| model_id | str | N | |
| created_at | datetime | N | |

`key_hash = sha256(kind | mode | model_id | 프롬프트에 들어가는 전체 입력 문자열)`. 입력이 한 글자라도 바뀌면 새 키가 되어 새로 호출한다. 이전 행은 삭제하지 않는다. 실패한 호출은 저장하지 않는다.

### 4.1 직무군 (`catalog.py`)

| 직무군 | 분류 |
|---|---|
| AI 모델링 | 개발 |
| 데이터 엔지니어링 | 개발 |
| 백엔드·API | 개발 |
| 프론트엔드 | 개발 |
| 서비스 기획 | 기획 |
| 웹 퍼블리싱 | 퍼블리싱 |
| UI·UX 디자인 | 디자인 |
| 기타 | 기타 |

서울 비교 공고는 광주·전남 프로젝트와 같은 직무군 체계를 쓴다. 이것이 두 데이터를 비교 가능하게 하는 공통 키다.

### 스키마 변경 방지 체크 (첫 배포 전 필수)

- 위 컬럼으로 R1~R13이 모두 구현되는지 화면·API 담당이 함께 점검한 뒤 `models.py`를 확정한다.
- 배포 후 컬럼이 더 필요하면 기존 테이블을 고치지 말고 **새 테이블**을 추가한다. 그 외에는 멘토 검토를 요청한다.
- 로컬에서 모델을 바꿔 시작이 중단되면 `KIROTHON_DB_PATH`에 새 파일 경로를 지정한다. 기존 DB 파일을 삭제해서 우회하지 않는다.

## 5. 적합도 점수 산식 (`scoring.py`)

적합도는 **인재와 `Project` 사이에서만** 계산한다. 서울 비교 공고는 입력으로 받지 않는다.

### 5.1 입력 정규화
- 기술명은 `strip()` 후 대소문자 무시로 비교한다. 기술은 카탈로그 태그만 허용하므로 동의어 처리는 하지 않는다.
- 인재가 갖지 않은 기술의 숙련도 `l`은 0이다.

### 5.2 필터 (점수 계산 전)
다음에 하나라도 해당하면 후보에서 제외하고 사유별로 건수를 센다 (`closed` / `category` / `region`).

1. `project.status != open`
2. `project.category != talent.desired_category`
3. `project.work_mode != 재택` 이면서 `project.region ∉ talent.desired_regions`

### 5.3 점수 (정수 0~100)

```
skill   = int(required_part + preferred_part + 0.5)          # 0~70
mode    = 근무 형태 점수                                       # 0~15
sched   = int(period_part + days_part + 0.5)                  # 0~15
total   = skill + mode + sched                                # 각 항목을 먼저 정수로 만든 뒤 합산
```

**기술 (70)**
- `required_part` (60): 필수 기술이 없으면 60. 있으면 `60 × 평균( min(l_i, m_i) / m_i )`.
- `preferred_part` (10): 우대 기술이 없으면 10. 있으면 `10 × (l_i ≥ m_i 인 우대 기술 수) / (우대 기술 수)`.

**근무 형태 (15)**

| 인재 선호 \ 프로젝트 | 상주 | 재택 | 혼합 |
|---|---|---|---|
| 상주 | 15 | 0 | 8 |
| 재택 | 0 | 15 | 8 |
| 무관 | 15 | 15 | 15 |

**일정 (15)**
- `period_part` (10): `10 × 겹치는 일수 / 프로젝트 전체 일수`. 일수는 양 끝날을 포함한다. 겹침이 없으면 0.
- `days_part` (5): 프로젝트가 상주 또는 혼합이면 `인재.days_per_week ≥ 프로젝트.onsite_days_per_week`일 때 5, 아니면 0. 재택이면 5.

### 5.4 정렬과 부족 역량
- 정렬 키: `(-total, -required_part, project.id)`.
- 부족 역량: 필수 기술 중 `l < m`인 항목을 `{skill, current: l, required: m, kind: "required"}`로 반환한다. 미보유면 `current = 0`. 우대 기술 중 `l < m`은 `kind: "preferred"`.
- 일치 기술: `l ≥ m`인 필수·우대 기술 목록.

### 5.5 경계값 (단위 테스트 대상)

| 상황 | 기대 결과 |
|---|---|
| 필수 기술 3개 모두 미보유 | `required_part = 0` |
| 필수 기술 전부 `l ≥ m` | `required_part = 60` |
| 필수 기술이 없는 프로젝트 | `required_part = 60`, 0으로 나누지 않음 |
| 우대 기술이 없는 프로젝트 | `preferred_part = 10` |
| 숙련도 1 vs 최소 5 | 해당 기술 비율 0.2 |
| 일정이 전혀 겹치지 않음 | `period_part = 0` |
| 시작일 = 종료일인 프로젝트 | 일수 1, 0으로 나누지 않음 |
| 같은 총점 | `required_part`가 큰 쪽이 앞, 그다음 id 작은 쪽 |

## 6. 팀 공백 분석 (`team_gap.py`, P1)

1. **팀 역량 합산**: 팀원 전체의 기술별 **최대** 숙련도.
2. **팀 기술 적합도**: §5.3의 `skill` 항목을 합산 역량으로 계산하고 `skill / 70 × 100`을 정수로 표시한다. 근무 형태와 일정은 개인별 값이라 팀 수치에 넣지 않는다.
3. **역할 적합도** `role_fit(member, role)`: 역할의 기술 `s`마다 `min(l, m) / m`의 평균. 최소 숙련도 `m`은 같은 프로젝트의 `ProjectSkill.min_level`.
4. **충족 판정**: `role_fit ≥ 0.6`인 팀원을 역할 슬롯(`headcount`개)에 배정한다. 슬롯은 `(자격 있는 팀원 수 오름차순, role id)` 순으로 처리하고, 각 슬롯에는 아직 배정되지 않은 팀원 중 `role_fit`이 가장 높은 사람(동점이면 id 작은 쪽)을 넣는다.
5. **공백**: 배정되지 못한 슬롯의 역할명을 공백으로 표시한다.
6. **보충 제안**: 공백 역할마다 팀에 속하지 않은 인재를 `role_fit` 내림차순으로 정렬해 상위 3명을 제안한다.
7. 프로젝트에 `ProjectRole`이 없으면 "역할 정보 없음"을 반환한다.

## 7. 정주 시뮬레이션 (`simulation.py`, `benchmark.py`)

### 7.1 계산식

```
take_home = int(pay × (1 − DEDUCTION_RATE) + 0.5)            # 월 실수령액
base      = take_home − rent − transport − fixed             # 지원금 제외 월 저축
saving    = base + support                                   # 지원 기간 중 월 저축
asset[m]  = asset[m−1] + base + (support if m ≤ support_months else 0)   # m = 1..60, asset[0] = 0
```

- `pay`: 월 단가(만 원). 환산 연봉은 `pay × 12`.
- `rent`: 거주 지역의 월세. 주거 형태는 `housing_pref`, 없으면 원룸. 해당 형태 값이 없으면 원룸 값을 쓰고 `housing_fallback: true`.
- `transport`: **지역 간** 이동 교통비만. 같은 지역이면 0. 지역 내 교통비는 계산하지 않는다 (Q1).
- `fixed`: `talent.fixed_expense`, 없으면 0.
- `support`, `support_months`: §7.3.
- 모든 값은 정수 만 원. 반올림은 항목별로 `int(x + 0.5)`.
- 자산은 이자·임금 상승·물가 없이 단순 합산이다. 프로젝트 기간이 짧아도 "같은 조건이 계속된다"는 가정 시나리오다 (A8).
- `asset_24 = asset[24]`, `asset_60 = asset[60]`.

**월 이동 횟수** `trips`
- 상주·혼합: `onsite_days_per_week × 4` (A4)
- 재택: `meeting_per_month`, 없으면 0

**교통비** `transport = 2 × fare(출발, 도착) × trips`
- 요금표는 `TRANSIT_FARE`(편도, §7.2). 자차를 골라도 같은 요금을 쓰고 `car_fallback: true`로 표시한다 (Q5).
- 직접 구간이 표에 없으면(예: 나주↔광양) 광주 경유 합산 `fare(a, 광주) + fare(광주, b)`로 추정하고 `route_estimated: true`로 표시한다.

### 7.2 지역 기준표 (`region_data.py`)

모든 항목은 다음 형태를 갖는다. 확인 전 값은 `is_assumption: True`.

```python
{"value": 45, "source": "한국부동산원 R-ONE (확인 전)", "is_assumption": True}
```

| 표 | 키 | 출처 / 범위 |
|---|---|---|
| `RENT` | `(지역, 주거 형태)`. 지역 6곳: 광주, 나주, 광양, 강남구, 영등포구, 중구 | 한국부동산원 R-ONE 월세 통계. **원룸 값은 필수** |
| `TRANSIT_FARE` | `(출발 지역, 도착 지역)` 편도. 3구간: 광주↔나주 광역버스, 광주↔광양 시외버스, 광주↔서울 KTX(광주송정↔용산). 양방향 같은 값 | 각 운수사 요금표 |
| `TRAVEL_TIME` | 위와 같은 3구간. 편도 분 (선택) | 참고용. 금액에 쓰지 않음 |
| `POLICIES` | 지원 제도 목록 | 아래 |
| `PAY_GRADES` | `{등급 키: {label, monthly}}` 2~3개 | KOSA SW기술자 평균임금(초급 기준) |
| `DEDUCTION_RATE` | 단일 값. 초기 0.033 (가정값, Q2) | 데이터 담당이 확인 |

**POLICIES 항목 형태**

```python
{"name": "국가 청년월세 지원", "scope": "전국", "monthly_amount": 20, "months": 12,
 "source": "…", "is_assumption": True}
```

`scope`는 `전국` / `서울` / `나주` / `광양` / `광주`. 초기 4개 제도: 국가 청년월세(전국, 월 최대 20만 원, 12개월), 서울시 청년 주거 지원(서울), 광양시 청년 주거 지원(광양), 나주시 청년 주거 지원(나주). 광주 제도는 표에 없으므로 광주는 국가 제도만 적용된다. 서울시·광양시·나주시의 금액과 개월 수는 보고서와 이미지에 값이 없으므로 데이터 담당이 확인해 채우고, 채우기 전에는 해당 항목을 `monthly_amount: None`으로 두어 계산에서 제외한다(추정 금지, R10.5).

초기 가정값(보고서 화면 예시, 원룸 기준): 광주 45 / 나주 42 / 광양 35. 서울 3개 구와 교통 요금은 값이 없으므로 채워지기 전까지 `value: None`이다. `None` 값이 계산에 필요하면 시뮬레이션은 해당 시나리오를 `unavailable: true`와 사유("월세 데이터 없음" 등)로 반환하고 숫자를 지어내지 않는다.

필수 조합 점검: `RENT`는 6개 지역 × 원룸, `TRANSIT_FARE`는 3구간이 모두 채워져야 한다. 점검 함수 `check_region_data()`가 누락 키를 목록으로 반환한다.

### 7.3 청년 지원금

```
적용 조건: talent.support_eligible AND rent > 0
후보    : scope ∈ {"전국", 거주 지역의 scope} 이고 monthly_amount 가 None 이 아닌 제도
금액    : amount_i = min(monthly_amount_i, rent)
선택    : amount_i × months_i 가 가장 큰 1개 (동점이면 monthly 큰 쪽, 그다음 이름순)   # Q4, D13
결과    : support = amount, support_months = months
```

적용되지 않으면 `support = 0`이고 `support_reason`에 `not_eligible` / `no_rent` / `no_policy`를 넣는다. 거주 지역의 scope는 광주→`광주`, 나주→`나주`, 광양→`광양`, 서울 3개 구→`서울`이다.

### 7.4 시나리오

**광주·전남 프로젝트 `P` (상주·혼합) → `mode = "relocate_vs_commute"`**

| 시나리오 | 거주지 | rent | transport |
|---|---|---|---|
| `relocate` (프로젝트 지역으로 이사) | `P.region` | `housing_support`면 0, 아니면 `RENT[P.region]` | 0 |
| `commute` (현재 거주지에서 통근) | 광주 | `본가`면 0, 아니면 `RENT[광주]`(기숙사도 광주 월세로 계산) | `commute_support`면 0, 아니면 `P.region`이 광주가 아닐 때 §7.1 |

`P.region`이 광주이면 두 시나리오의 거주지가 같다. `relocate`는 "광주에서 새로 자취"(본가 혜택 없음), `commute`는 현재 상태로 계산한다. `talent.move_willingness`에 해당하는 시나리오에 `highlight: true`.

**광주·전남 프로젝트 `P` (재택) → `mode = "residence_compare"`**

광주·나주·광양 각각을 거주지로 한 시나리오 3개.
- rent: 광주이고 `본가`면 0, 그 외 `RENT[거주지]`. (재택에는 숙소 제공이 없으므로 `housing_support`는 무시.)
- transport: `commute_support`면 0, 아니면 `meeting_per_month` 회의 왕복 비용. 거주지가 `P.region`과 같으면 0.
- 저축이 가장 큰 시나리오(`asset_60` 기준, 동점이면 `asset_24`, 그다음 광주·나주·광양 순)에 `highlight: true`.

**서울 비교 시나리오 (모든 `P`에 공통, 4개)**

| 키 | 거주지 | pay | rent | transport |
|---|---|---|---|---|
| `seoul_강남구` | 강남구 | §7.5 규칙의 구별 보수 | `RENT[강남구]` | 0 |
| `seoul_영등포구` | 영등포구 | 〃 | `RENT[영등포구]` | 0 |
| `seoul_중구` | 중구 | 〃 | `RENT[중구]` | 0 |
| `seoul_ktx` (참고) | 광주 | §7.5 후보 공고 평균 | `commute`와 같은 규칙(광주 현재 거주) | `2 × KTX 편도 × trips` (`trips`는 `P`의 근무 방식, `commute_support` 무시) |

서울 3개 구는 서울로 이사해 현지에서 일하는 경우라 교통비를 0으로 둔다. 숙소 제공·교통비 지원은 서울 시나리오에 적용하지 않는다. 서울 구 시나리오에도 `fixed`를 뺀다. 지원금은 §7.3을 같은 방식으로 적용한다.

### 7.5 서울 비교 공고 선택 (`benchmark.py`, R13.5)

입력: 선택한 프로젝트 `P`, 서울 비교 공고 목록. 출력: 구별 `(pay, pay_basis)`와 비교 근거.

```
후보 = 서울 공고 중 job_family == P.job_family
if 후보가 여러 개:
    같은 work_mode 가 있으면 그것만 남김
    그중 같은 pay_grade 가 있으면 그것만 남김
구 d 의 보수:
    1) 후보 중 district == d 가 있으면 → 그 공고의 pay_monthly            pay_basis = "district_posting"
    2) 없고 후보가 있으면 → 후보 pay_monthly 의 평균(int(x + 0.5))      pay_basis = "family_mean"
    3) 후보가 없으면 → P.pay_monthly                                    pay_basis = "same_pay_assumed"
    (같은 구 공고가 여러 개면 id 작은 순으로 첫 번째)
```

후보 목록은 항상 같은 순서(id 오름차순)로 평가해 결과가 결정적이다.

**비교 근거** `peers`: 사용한 공고마다 `{id, district, title, pay_monthly, pay_grade, work_mode, job_family_match: true, grade_match, work_mode_match, shared_skills}`. `shared_skills`는 `P`의 요구 기술과 공고의 요구 기술 이름의 교집합이다. `peers`가 비어 있으면(규칙 3) 빈 배열이다.

**보수 비교** `pay_compare`: 구별 `{district, seoul_pay, diff = seoul_pay − P.pay, ratio_pct = int(diff / P.pay × 100 + 0.5), take_home_diff}`. 부호를 그대로 반환하고 문구에서 우열을 단정하지 않는다 (R13.6).

**요약** `summary`: 강조 시나리오 vs 서울 구 3개 중 `asset_60`이 가장 큰 구를 비교해 `saving_diff`, `asset_24_diff`, `asset_60_diff`를 계산한다 (R7.14). 동점이면 강남구, 영등포구, 중구 순.

### 7.6 응답 구조

```jsonc
{
  "mode": "relocate_vs_commute",
  "project": {"id": 3, "title": "...", "region": "나주", "work_mode": "상주",
              "pay_monthly": 300, "pay_grade": "G2", "job_family": "백엔드·API",
              "annual_gross": 3600},
  "scenarios": [
    {"key": "relocate", "label": "나주로 이사", "residence": "나주", "highlight": true,
     "pay": 300, "take_home": 290, "rent": 42, "transport": 0, "fixed": 0,
     "support": 20, "support_months": 12, "support_name": "국가 청년월세 지원", "support_reason": null,
     "saving_with_support": 268, "saving_after_support": 248,
     "asset_24": 5996, "asset_60": 14876,
     "asset_curve": [0, 268, 536, "... 61개 정수"],
     "flags": {"housing_fallback": false, "route_estimated": false, "car_fallback": false},
     "sources": [{"item": "월세", "source": "...", "is_assumption": true}]},
    {"key": "seoul_강남구", "label": "서울 강남구", "residence": "강남구", "pay": 330, "pay_basis": "district_posting",
     "...": "..."}
  ],
  "unavailable": [{"key": "seoul_중구", "reason": "월세 데이터 없음"}],
  "pay_compare": [{"district": "강남구", "seoul_pay": 330, "diff": 30, "ratio_pct": 10, "take_home_diff": 29}],
  "peers": [],
  "summary": {"best_seoul": "seoul_강남구", "saving_diff": 0, "asset_24_diff": 0, "asset_60_diff": 0},
  "notices": ["기본 생활비(식비 등)는 반영하지 않았습니다.", "보증금·이사 비용은 반영하지 않았습니다.",
              "같은 조건이 계속된다고 가정한 시나리오입니다.", "서울 공고는 가상 공고입니다."]
}
```

위 숫자는 형식을 보여주는 예시이며 실제 값이 아니다. `asset_curve`가 61개 정수(0~60개월)다. 시나리오가 최대 9개라도 응답은 수 KB다.

## 8. AI 사용 설계 (`ai_helpers.py`)

공통 제약: 입력 `text` ≤ 4,000자, `instruction` ≤ 300자, 출력 ≤ 256토큰(한국어로 대략 150~250자), 분당 20회·하루 600회. 모든 호출은 `generate_text(text, instruction, model_id)`를 거친다.

### 8.1 호출 종류

| 종류 | 호출 시점 | 입력 `text` | 출력 | 최대 호출 |
|---|---|---|---|---|
| `card` | 사용자가 "역량 카드 생성" 클릭 | 서술형 경험 + `기술명(숙련도)` 목록(숙련도 상위 5개) | 줄당 `기술명\|근거 문장(30자 이내)` | 인재 1명당 1회 |
| `match` | 추천 상위 3개 각각 | 프로젝트 제목·분야, 총점과 구성 점수, 일치 기술, 부족 기술(현재→필요) | 추천 이유 1~2문장 + 준비 가이드 1문장, 200자 이내 | 프로젝트 3회 |
| `sim` | 사용자가 "AI 설명" 클릭 | 강조 시나리오와 서울 최상위 구의 월 단가·실수령·월세·교통·지원금·월 저축·24/60개월 자산, 차이값 | 설명 2~3문장, 200자 이내 | 1회 |

표준 시연 한 번은 인재 1명 기준 AI 호출 5회다 (R9.4).

### 8.2 지시문 초안 (각 300자 이내)

- `card`: `아래 경험에서 각 기술을 사용한 근거를 줄당 하나씩 '기술명|근거 문장' 형식으로 써. 근거는 30자 이내. 목록에 있는 기술만 쓰고 다른 설명은 쓰지 마.`
- `match`: `아래 점수와 기술 비교만 근거로 이 프로젝트가 맞는 이유 1~2문장과 부족 기술 준비 방법 1문장을 한국어로 써. 200자 이내. 입력에 없는 숫자나 기술을 만들지 마.`
- `sim`: `아래 계산 결과만 근거로 지역 프로젝트와 서울 같은 직무의 보수, 월 저축, 2년·5년 자산 차이를 2~3문장으로 설명해. 200자 이내. 입력에 없는 숫자를 만들지 말고, 어느 쪽이 낫다고 단정하지 마.`

### 8.3 응답 검증과 대체

1. **숫자 검증**: AI 응답에서 숫자(`\d+(\.\d+)?`)를 모두 뽑아, 프롬프트 입력에 나온 숫자 집합에 없는 값이 있으면 응답을 버리고 대체 문장을 쓴다. 입력에는 `2년`, `5년`, `24개월`, `60개월` 표기를 함께 넣어 정당한 표현이 막히지 않게 한다.
2. **`card` 파싱**: 줄을 `|`로 나눠 기술명이 인재의 기술 목록에 있는 줄만 채택한다. 채택 줄이 0이면 형식 오류로 보고 근거 없이 표시한다.
3. **mock**: mock 응답은 파싱·검증하지 않고 `mode: "mock"`으로 반환한다. 역량 카드는 근거 문장 없이 "모의 응답: 근거 문장은 팀 서버에서 생성됩니다"를 표시한다. 추천·시뮬레이션 설명은 대체 문장 위에 "모의 응답" 배지와 함께 mock 원문을 접어서 보여준다.
4. **대체 문장(fallback)**: 코드가 템플릿으로 만든다. 예: `"필수 기술 3개 중 2개가 맞고 PyTorch가 부족합니다 (현재 2 → 필요 4)."`, `"나주에서 월 300만 원을 받으면 서울 강남구 동일 직무(월 330만 원)보다 월 저축이 N만 원 많고/적고, 60개월 뒤 자산 차이는 M만 원입니다."` 템플릿은 부호에 따라 "많고/적고"를 고른다. AI 호출 없이 항상 생성된다.
5. **오류 처리**: `generate_text`가 던지는 `HTTPException`(429, 502, 413, 422)을 잡아 응답의 `error`에 코드와 메시지를 넣고, 본문은 대체 문장으로 반환한다. HTTP 상태는 200이다. 자동 재시도는 하지 않는다.

### 8.4 AI 응답 공통 형태

```jsonc
{
  "text": "…",                 // 화면에 표시할 문장 (AI 또는 대체)
  "source": "ai" | "fallback",
  "mode": "mock" | "bedrock" | null,
  "model_id": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "cached": true,
  "error": null | {"code": 429, "message": "AI 호출 한도 초과: 분당 20회 또는 하루 600회"}
}
```

## 9. API 계약

모든 경로는 `/api/team` 아래에 있다. 오류 본문은 FastAPI 기본(`{"detail": ...}`). 입력 검증 실패는 422.

| 메서드·경로 | 우선순위 | 요구사항 | 설명 |
|---|---|---|---|
| `GET /meta` | P0 | R1, R3 | 기술 카탈로그, 분류, 직무군, 지역, 구, 근무 형태, 단가 등급 선택지 |
| `POST /seed` | P0 | R11, R13 | 멱등 시드(인재·프로젝트·서울 비교 공고). 응답: 만든 건수와 건너뛴 건수 |
| `POST /talents` | P0 | R1 | 프로필 + 기술 목록 생성 |
| `GET /talents` | P0 | R1 | 목록(역할 선택용 요약) |
| `GET /talents/{id}` | P0 | R1, R2 | 프로필, 기술, 역량 카드 |
| `PUT /talents/{id}` | P0 | R1 | 프로필·기술 수정 (기술 목록 전체 교체. 기술이 같으면 기존 `evidence` 유지) |
| `POST /talents/{id}/card` | P0 | R2 | AI 근거 문장 생성·저장. 응답은 §8.4 형태 + `skills` |
| `PUT /talents/{id}/card` | P0 | R2 | 사용자가 수정한 근거 문장 저장 (`evidence_source = user`) |
| `POST /projects` | P0 | R3 | 프로젝트 + 기술 + 역할 등록. 지역이 광주·나주·광양이 아니면 422 |
| `GET /projects` | P0 | R3 | 쿼리: `region`, `category`, `work_mode`. `Project`만 반환 |
| `GET /projects/{id}` | P0 | R3 | 상세 |
| `GET /talents/{id}/recommendations` | P0 | R4 | 점수순 목록 (AI 호출 없음). 캐시된 설명이 있으면 포함 |
| `POST /talents/{id}/recommendations/{project_id}/explain` | P0 | R5 | 상위 3위가 아니면 422. §8.4 형태 |
| `GET /talents/{id}/simulation?project_id=` | P0 | R7, R13 | §7.6 형태 (AI 호출 없음) |
| `POST /talents/{id}/simulation/explain` | P0 | R7 | 본문 `{project_id}`. §8.4 형태 |
| `GET /benchmarks?job_family=` | P1 | R13 | 서울 비교 공고 목록(읽기 전용, 비교 근거 확인용). 쓰기 API는 만들지 않는다 |
| `POST /teams`, `GET /teams/{id}`, `POST /teams/{id}/members` | P1 | R6 | 팀 생성·조회·팀원 연결 |
| `GET /teams/{id}/gap?project_id=` | P1 | R6 | 팀 적합도, 역할별 충족/공백, 보충 제안 |
| `POST /applications` | P1 | R8 | 중복 지원 409. 존재하지 않는 `Project`면 404 (서울 공고 id는 이 API에서 존재하지 않는다) |
| `GET /applications?talent_id=` / `?project_id=` | P1 | R8 | 지원 현황, 지원자 목록 |
| `PATCH /applications/{id}` | P1 | R8 | `applied`에서 `accepted`/`rejected`로만. 그 외 409 |
| `GET /companies` | P0 | R15 | 관심 기업 선택지: 등록된 `Project`의 기업 이름(중복 제거), 지역, 기업 유형, 산업. 서울 기업은 없다 |
| `GET /talents/{id}/preferences` | P0 | R15 | 저장된 선호. 없으면 `{"exists": false}` |
| `PUT /talents/{id}/preferences` | P0 | R15 | 선호 저장(전체 교체). 관심 기업이 `GET /companies`에 없으면 422. 최초 저장 시 `last_seen_at` = 현재 |
| `GET /talents/{id}/preference-matches?scope=new\|all` | P0 | R15 | 선호 일치도 순 목록 (AI 호출 없음). 선호가 없으면 `{"preference_set": false}` |
| `POST /talents/{id}/preference-matches/seen` | P0 | R15 | `last_seen_at`을 현재로 갱신 |
| `POST /talents/{id}/preference-matches/{project_id}/explain` | P0 | R15 | 본문 `{scope}`. 현재 정렬 상위 3위가 아니면 422. §8.4 형태 |
| `GET /stack-demand?talent_id=` | P0 | R14 | 지역 기술 수요 집계. `talent_id`가 있으면 내 숙련도와 격차 포함 (AI 호출 없음) |

### 추천 응답 예

```jsonc
{
  "talent_id": 1,
  "candidates": 4,
  "excluded": {"closed": 0, "category": 2, "region": 1},
  "items": [{
    "rank": 1,
    "project": {"id": 3, "title": "...", "company_name": "...", "region": "나주",
                "work_mode": "상주", "pay_monthly": 300, "category": "개발", "job_family": "백엔드·API"},
    "score": {"total": 86, "skill": 62, "work_mode": 15, "schedule": 9},
    "matched": ["Python", "FastAPI"],
    "gaps": [{"skill": "PyTorch", "current": 2, "required": 4, "kind": "required"}],
    "explanation": null
  }]
}
```

## 10. 프론트엔드 설계

기존 `App.tsx`는 Record 대시보드다. 이 화면을 팀 서비스 화면으로 교체한다 (`App.tsx`는 수정 가능 파일이다). 기존 `api()` 헬퍼 패턴(상대 경로 `/api/`, 오류 본문 처리)을 새 `src/lib/api.ts`로 옮겨 쓴다. `/api/health`로 mock 모드 배너를 표시하는 동작은 유지한다.

### 10.1 화면 구성

상단에 역할 전환(인재 / 기업)과 인재 선택(시드 인재 목록)을 둔다. 화면 이동은 상태 기반 탭(Button)이다.

| 탭 | 역할 | 내용 | 요구사항 |
|---|---|---|---|
| 프로젝트 | 공통 | 광주·전남 프로젝트 목록, 지역·분류·근무 형태 필터, 상세 Dialog | R3 |
| 내 프로필 | 인재 | 프로필 폼, 기술 태그·숙련도, 개인정보 금지 안내, 청년 지원 대상 체크, 역량 카드 생성·수정 | R1, R2 |
| 추천 | 인재 | 점수 막대(기술/근무/일정), 부족 역량, 상위 3개 AI 설명, 팀 공백 패널(P1) | R4, R5, R6 |
| 정주 시뮬레이션 | 인재 | 아래 §10.4 | R7, R13 |
| 지원 | 인재 | 내 지원 현황 (P1) | R8 |
| 기업 | 기업 | 프로젝트 등록 폼, 지원자 수락·거절 (P1) | R3, R8 |

### 10.2 재사용 컴포넌트와 새로 만들 것

- 재사용: `Card`, `Button`, `Badge`, `Dialog`, `Input`, `Label`, `Table`, `Textarea`.
- 새로 만들기: 네이티브 `<select>`(Tailwind 스타일), 숙련도 1~5 입력, 기술 태그 선택, 가로 누적 막대(`div` 너비 %), 자산 선 그래프(인라인 SVG), AI 결과 배지(`mock`/`ai`/`fallback`), 가정값·가상 공고 라벨.

### 10.3 화면 상태

| 상태 | 처리 |
|---|---|
| 로딩 | 버튼 비활성 + "처리 중" 문구. AI 호출은 최대 약 45초 걸릴 수 있음 |
| 입력 오류 (422) | 항목별 메시지 |
| AI 한도 초과 (`error.code = 429`) | 한도 안내 + 대체 문장 + "다시 시도" 버튼. 자동 재시도 없음 |
| AI 실패 (`502`) | 대체 문장 + 오류 원인 + "다시 시도" |
| mock | 모든 AI 영역에 "모의 응답 — 실제 AI 결과가 아닙니다" 배지 |
| 후보 0건 | 제외 사유별 건수 안내 (R4.7) |
| 음수 저축 | "적자" 표시 |
| 가정값 | 수치 옆 "가정값" 라벨, 툴팁에 출처 |
| 시나리오 `unavailable` | 막대 대신 사유 표시 ("월세 데이터 없음") |

### 10.4 정주 시뮬레이션 탭

위에서 아래로 다섯 구역.

1. **보수 비교 카드** (R13.6): 선택 프로젝트의 월 단가와 서울 강남구·영등포구·중구의 월 단가를 나란히 표시. 구별로 차이(금액, %), 쓴 기준 배지(`district_posting` → "같은 구 공고", `family_mean` → "서울 동일 직무 평균", `same_pay_assumed` → "동일 단가 가정"), "가상 공고" 라벨. 비교 근거(직무군 일치, 단가 등급 일치, 공통 기술)는 접이식으로 보여준다.
2. **월 저축 분해 막대**: 시나리오마다 한 줄. 막대 전체 폭 = 월 실수령액. 구간 = 월세 | 교통비 | 월 고정 지출 | 월 저축. 지원금은 막대 옆 "+20 (12개월)" 배지. 서울 시나리오는 별도 색과 "서울 비교" 라벨. 단위 "만 원/월".
3. **누적 자산 그래프** (R7.9~10): 인라인 SVG 선 그래프. x축 0~60개월(12개월 눈금), y축 자산(만 원, 음수 포함). 24개월·60개월에 세로 보조선과 라벨(2년, 5년). 강조 시나리오는 굵은 선, 서울 3개 구와 KTX는 서로 다른 색의 가는 선. 범례와 같은 값을 보여주는 표(시나리오 × 24개월 / 60개월) 병행. 그래프 위에 "같은 조건이 계속된다고 가정한 시나리오" 문구.
4. **요약과 AI 설명**: 강조 시나리오 vs 서울 최상위 구의 월 저축·24·60개월 자산 차이, "AI 설명" 버튼과 결과.
5. **고지 문구**: `notices` 배열을 항상 표시 (생활비·보증금·이사비 미반영, 가정 시나리오, 가상 공고).

## 11. 시드 데이터 계획 (`seed.py`, R11, R13)

가상 데이터만 쓴다. 표시명은 `인재-01`~`인재-10`, 기업명은 `가상기업 A`~`J`처럼 짓고 실제 기업·인물 이름을 쓰지 않는다. 금액·등급 값은 데이터 담당이 `region_data.PAY_GRADES`에서 가져와 넣는다.

### 광주·전남 프로젝트 10건 (`Project`)

| # | 지역 | 근무 형태 | 분류 | 직무군 | 비고 |
|---|---|---|---|---|---|
| P1 | 나주 | 상주 | 개발 | AI 모델링 | 필요 역할 3(모델링, 데이터, 백엔드), 숙소 제공 |
| P2 | 나주 | 혼합 | 개발 | 데이터 엔지니어링 | |
| P3 | 나주 | 상주 | 개발 | 백엔드·API | |
| P4 | 광양 | 상주 | 개발 | AI 모델링 | 필요 역할 2, 교통비 지원 |
| P5 | 광양 | 혼합 | 퍼블리싱 | 웹 퍼블리싱 | |
| P6 | 광주 | 상주 | 개발 | 백엔드·API | 필요 역할 3 |
| P7 | 광주 | 혼합 | 개발 | 프론트엔드 | |
| P8 | 광주 | 상주 | 기획 | 서비스 기획 | |
| P9 | 광주 | 상주 | 개발 | 데이터 엔지니어링 | |
| P10 | 광주 | 재택 | 개발 | AI 모델링 | 월 미팅 2회 |

지역 합계는 나주 3, 광양 2, 광주 5(재택 1 포함)이고 서울은 없다 (R11.2).

### 서울 비교 공고 7건 (`SeoulBenchmark`)

각 공고는 같은 직무군의 광주·전남 프로젝트와 **요구 기술, 최소 숙련도, 근무 방식, 기간, 단가 등급을 맞추고** 근무지와 보수만 다르게 둔다.

| # | 구 | 근무 형태 | 직무군 | 주로 비교되는 프로젝트 |
|---|---|---|---|---|
| S1 | 강남구 | 상주 | AI 모델링 | P1, P4 |
| S2 | 영등포구 | 재택(월 미팅 2회) | AI 모델링 | P10 |
| S3 | 중구 | 혼합 | 데이터 엔지니어링 | P2, P9 |
| S4 | 강남구 | 상주 | 백엔드·API | P3, P6 |
| S5 | 영등포구 | 혼합 | 프론트엔드 | P7 |
| S6 | 중구 | 상주 | 서비스 기획 | P8 |
| S7 | 영등포구 | 혼합 | 웹 퍼블리싱 | P5 |

점검 조건: 프로젝트 10건의 직무군(AI 모델링, 데이터 엔지니어링, 백엔드·API, 프론트엔드, 서비스 기획, 웹 퍼블리싱)마다 서울 공고가 1건 이상, 세 구가 모두 1건 이상 (R13.2, R13.4). 같은 직무군이 하나뿐이면 다른 두 구의 보수는 §7.5 규칙 2(`family_mean`)로 정해진다. 서울 보수는 가상값이며 `source_note`에 "가상 공고"를 적는다.

### 인재 10명 (`TalentProfile`)

개발 8, 기획 1, 퍼블리싱 1. 근무 형태 선호와 희망 지역을 섞는다. 거주 형태는 자취/본가/기숙사가 모두 나오게 하고 광주 5개 구 중 3곳 이상을 쓴다. 청년 지원 대상은 2명 이상(R11.4). 개발 인재 중 3명은 한 팀(`팀-가상`)으로 묶고, 팀 안에서 한 역할이 비도록 설계해 공백 분석 데모가 되게 한다.

**멱등 규칙**: `is_demo=true`이고 같은 `nickname` / `(company_name, title)` / `(district, title)`이 이미 있으면 건너뛴다. 사용자가 만든 데이터는 건드리지 않는다. 응답에 만든 건수와 건너뛴 건수를 돌려준다.

## 12. 구현 중 주의할 점

| 위험 | 대응 |
|---|---|
| 배포 후 컬럼 변경으로 앱 시작 중단 | §4 체크리스트. 추가 필요 시 새 테이블 |
| 서울 데이터가 추천·지원에 섞임 | 별도 테이블(D10). `Application`은 `Project`만 참조. 추천 쿼리는 `Project`만 읽는다 |
| 서울 월세·KTX 요금·지원 금액 값이 비어 있음 | 값을 지어내지 않고 `None` → 시나리오 `unavailable`(§7.2). 시연 전에 데이터 담당이 채운다 |
| 서울 보수를 실제 시장 데이터로 오해 | "가상 공고"·"가정값" 라벨, 발표에서 가상 데이터임을 명시 |
| 비교 결과를 한쪽으로 몰아 표시 | 부호를 그대로 반환하고, 대체 문장 템플릿과 AI 지시문에서 우열 단정을 금지 (R13.6) |
| 256토큰 출력 잘림 | 줄 수·글자 수 제한 지시, 기술 5개 제한, 잘린 줄은 파싱에서 제외 |
| 분당 20회 한도 | 캐시, 상위 3개만, 자동 재시도 금지 |
| 로컬 mock으로는 AI 품질을 알 수 없음 | 대체 문장과 숫자 검증은 로컬에서 확인하고, 실제 문장 품질은 팀 서버 Deploy 후 확인 |
| 생활비를 뺀 저축액이 과대하게 보임 | 고지 문구 상시 표시 (R7.16). 팀이 Q1을 바꾸면 `LIVING` 표 추가 |
| 지원금 중복 수혜 | 1개만 적용(D13). 확인되면 합산 규칙으로 교체 |
| Basic Auth만 통과하면 누구나 수정 가능 (A1) | 시연용으로 수용. 발표 때 한계로 언급 |
| 서버 삭제(10/31 20:00) | Git에 push, 서버 데이터는 보존 대상이 아님 |

## 13. 별도로 추가하면 좋은 팀 규칙 (이 spec에서는 만들지 않음)

보고서 5장의 steering·hook 제안이다. 기존 steering은 그대로 두고 팀 파일만 추가한다. 만들지 여부는 팀이 정한다.

- steering 후보: 매칭 대상은 광주 인재와 광주·나주·광양 프로젝트로 한정하고 서울은 비교 전용 / 점수는 코드 산식만 / 실명·연락처를 데이터와 테스트에 넣지 않음 / AI 응답은 256토큰 안에 들어가게 지시 / 수치에 출처 또는 "가정값" 표시 / 서울 비교 공고는 `SeoulBenchmark`에만 둠.
- hook 후보: `scoring.py`·`simulation.py`·`benchmark.py` 저장 시 단위 테스트 실행, 프롬프트 파일 변경 시 시드 샘플로 mock 회귀 확인.

## 14. 지역 기술 수요와 선호 기반 신규 공고 매칭 (R14, R15)

범위: 우선순위 1(지역 특성 반영)과 2(선호·신규 공고 매칭). 경력 로드맵은 제외했다. 모든 숫자는 코드가 계산하고, AI는 선택적으로 설명 문장만 쓴다. 기존 원칙 1~4(§1)를 그대로 따른다.

### 14.0 결정

| # | 결정 | 이유 | 대안과 기각 사유 |
|---|---|---|---|
| D14 | 기업 유형·산업·특성 태그의 **값 목록은 코드 카탈로그**에 두고, `Project`에는 문자열 컬럼만 둔다 | 값 목록을 고쳐도 컬럼이 바뀌지 않아 배포 후 스키마 검사에 걸리지 않는다 (D3와 같은 이유) | DB 코드 테이블: 테이블이 늘고 변경 시 위험 |
| D15 | 관심 기업은 별도 `Company` 테이블 없이 `Project.company_name`에서 고른다 | 기업 정보가 프로젝트 속성뿐이다(YAGNI). 선택지가 등록된 광주·나주·광양 기업으로 자동 한정된다(서울 기업 불가) | `Company` 테이블: 이번 범위에 필요한 필드가 없다 |
| D16 | 선호 일치도는 임베딩이 아니라 **속성 일치 산식**으로 계산한다 | 같은 입력이면 같은 결과, 설명 가능, 벡터DB·임베딩 모델을 쓰지 않는다 (tech·aws 규칙) | 임베딩 유사도: 운영진 허용 필요, 결과 설명이 어렵다 |
| D17 | 지역 기술 수요는 DB가 아니라 `region_data.STACK_DEMAND` 상수로 두고, 수집한 **집계 값만** 넣는다 | 수집 중 값이 계속 바뀌므로 DB 컬럼으로 두면 안 된다. 개별 공고 원문을 저장하지 않아 저작권·약관 부담이 없다 (Q8) | 공고를 DB에 저장: 스키마 위험, R11(실제 공고 복사 금지)과 충돌 |
| D18 | 신규 공고는 외부에서 가져오지 않고, 이 서비스에 등록된 공고 중 `created_at > last_seen_at`인 것이다 | 외부 호출 제외 원칙, 시연 가능성 (Q9) | 크롤링·API 연동: 범위 밖 |

### 14.1 카탈로그 (`catalog.py`에 추가)

초기안이다. 값은 코드 상수이므로 데이터 수집 결과에 맞춰 첫 배포 전후 모두 바꿀 수 있다(컬럼 변경이 아니다). 단, 이미 저장된 행의 값과 어긋나지 않게 한다.

| 카탈로그 | 값 |
|---|---|
| `ORG_TYPES` | 공공기관, 대기업·제조, 스타트업·IT, 지역 SI |
| `INDUSTRIES` | 에너지·전력, 철강·화학, 농업·식품, 자동차·가전, AI·데이터, 공공행정·SI, 기타 |
| `STYLE_TAGS` | 안정 지향, 빠른 성장, 체계적 프로세스, 수평적 문화, 신기술 적극 도입, 워라밸 중시 |

- 기술 태그(`SKILLS`)에 지역 공고에서 자주 나오는 기술을 추가한다. 후보: Java, Spring, 전자정부프레임워크, MyBatis, JSP, Oracle. **최종 목록은 수집한 공고의 언급 빈도로 정한다** (tasks 0.5).
- `GET /meta`는 위 세 카탈로그를 함께 내려 준다.
- 특성 태그는 주관적이므로 화면에서 "가정값" 라벨을 붙인다 (A12).

### 14.2 스키마 변경 요약 (첫 배포 전 확정, tasks 1.4 게이트에 포함)

- `Project`에 컬럼 3개 추가: `org_type`, `industry`, `style_tags` (§4).
- 새 테이블 `TalentPreference` (§4).
- `AiCache.kind`에 `pref`를 추가한다. `kind`는 문자열이라 컬럼 변경이 아니다.
- 기존 테이블의 기존 컬럼은 바꾸지 않는다.

### 14.3 입력 검증 (`schemas.py`)

- `org_type`, `industry`가 카탈로그에 없으면 422. `style_tags`는 카탈로그 값만, 중복 없이 최대 3개.
- 선호 프로필: `org_types`, `industries`, `style_tags`(최대 3), `preferred_skills`는 카탈로그 값만. `favorite_companies`는 최대 3개, 중복 없음, 모두 `GET /companies`에 있는 이름이어야 한다. 하나라도 없으면 422와 항목별 메시지.

### 14.4 선호 일치도 산식 (`preference.py`, 순수 함수)

입력: 인재의 선호(`prefs`), 프로젝트(`project`, 요구 기술 목록 포함). 선호의 빈 목록은 "상관없음"이다.

```
org      = 25                                   if prefs.org_types 가 비어 있음
         = 25 if project.org_type  ∈ prefs.org_types else 0
industry = 25                                   if prefs.industries 가 비어 있음
         = 25 if project.industry  ∈ prefs.industries else 0
style    = 20                                   if prefs.style_tags 가 비어 있음
         = int(20 × |prefs.style_tags ∩ project.style_tags| / |prefs.style_tags| + 0.5)
stack    = 30                                   if prefs.preferred_skills 가 비어 있음
         = int(30 × |prefs.preferred_skills ∩ project.skills| / |prefs.preferred_skills| + 0.5)

pref_total = org + industry + style + stack      # 0~100, 각 항목을 먼저 정수로 만든 뒤 합산
```

- `project.skills`는 필수·우대를 합친 요구 기술 이름이다. 기술명은 §5.1처럼 대소문자 무시로 비교한다.
- 선호가 전부 비어 있으면 `pref_total = 100` (R15.8).

**관심 기업**
- `favorite_rank`: 프로젝트의 `company_name`이 `favorite_companies`에 있으면 1부터 시작하는 순서, 없으면 `None`.
- **유사도** `similarity_to_favorite`(0~100): 관심 기업 `F`마다 `F`의 프로젝트 중 id가 가장 작은 것을 기준 프로젝트 `R`로 삼는다. 프로젝트 자신의 기업은 건너뛴다.

```
sim = int(40 × (project.org_type == R.org_type) + 40 × (project.industry == R.industry)
          + 20 × |기술 교집합| / |기술 합집합| + 0.5)
유사 판정: sim ≥ 50     # 유형 또는 산업이 같고 기술이 절반 이상 겹치거나, 둘 다 같음
```

  여러 관심 기업이 있으면 `sim`이 가장 큰 기업(동점이면 우선순위가 높은 쪽)을 `similar_to`로 반환한다: `{company, similarity, same_org_type, same_industry, shared_skills}`. 임계값 50은 초기값이며 시드로 확인해 조정한다.

**정렬 키**: `(favorite_rank or 99, -pref_total, -similarity(없으면 0), -fit.total, project.id)`. `fit`은 §5의 적합도 점수다.

**대상 범위**: §5.2 필터(마감, 분류, 지역)를 먼저 적용하고 제외 건수를 사유별로 센다. `scope=new`이면 `created_at > last_seen_at`인 것만 남긴다. 서울 비교 공고는 입력으로 받지 않는다.

**경계값** (단위 테스트 대상)

| 상황 | 기대 결과 |
|---|---|
| 선호 전부 비어 있음 | `pref_total = 100`, 정렬은 적합도 순 |
| 선호 기업 유형만 지정, 일치 | `org = 25`, 나머지 비어 있어 75 → 합계 100 |
| 선호 기업 유형만 지정, 불일치 | 합계 75 |
| 특성 태그 3개 중 1개 일치 | `style = 7` (`int(20/3 + 0.5)`) |
| 관심 기업 본인 공고 | `favorite_rank`가 있고 `similar_to`에는 자기 기업이 없음 |
| 유형·산업 같고 기술 겹침 0 | `sim = 80`, 유사 판정 true |
| 유형만 같고 기술 겹침 절반 | `sim = 50`, 유사 판정 true (경계) |
| 유형만 같고 기술 겹침 40% | `sim = 48`, 유사 판정 false |
| 같은 `pref_total` | 유사도, 적합도, id 순으로 결정 |

### 14.5 신규 공고 응답 형태

```jsonc
{
  "preference_set": true,
  "scope": "new",
  "candidates": 3,
  "excluded": {"closed": 0, "category": 1, "region": 0},
  "items": [{
    "rank": 1,
    "project": {"id": 11, "title": "...", "company_name": "...", "region": "나주",
                "work_mode": "상주", "pay_monthly": 320, "category": "개발", "job_family": "백엔드·API",
                "org_type": "공공기관", "industry": "에너지·전력", "style_tags": ["안정 지향"], "is_new": true},
    "pref": {"total": 88, "org_type": 25, "industry": 25, "style": 8, "stack": 30,
             "matched": {"org_types": ["공공기관"], "industries": ["에너지·전력"], "style_tags": ["안정 지향"], "skills": ["Java", "Spring"]}},
    "favorite_rank": null,
    "similar_to": {"company": "가상기업 A", "similarity": 80, "same_org_type": true, "same_industry": true, "shared_skills": ["Java"]},
    "fit": {"total": 82, "skill": 60, "work_mode": 15, "schedule": 7},
    "gaps": [{"skill": "Spring", "current": 2, "required": 3, "kind": "required"}],
    "explanation": null
  }]
}
```

위 숫자는 형식을 보여주는 예시다.

### 14.6 지역 기술 수요 (`region_data.STACK_DEMAND`, `insights.py`)

```python
STACK_DEMAND = {
    "collected_at": None,        # 수집 기준일 "YYYY-MM-DD". 수집 전에는 None
    "source": "…",               # 예: "구인 사이트·공공기관 채용 공고 표본을 직접 집계"
    "is_assumption": True,       # 표본이 작거나 확인 전이면 True
    "groups": {                  # 키는 ORG_TYPES + "전체"
        "공공기관": {"sample_n": None, "skills": {"Java": None, "Spring": None}},
        # 값: 그 기술을 요구한 공고의 비율(%) 정수. 모르면 None
    },
    "metro": {"label": "수도권 비교 표본", "sample_n": None, "skills": {"React": None, "Java": None}},  # 선택
}
```

- 값이 `None`이면 계산하지 않고 "집계 데이터 입력 전"으로 반환한다 (R10.5, A13).
- `check_stack_demand()`가 점검한다: 기술명이 카탈로그에 없음, 비율이 0~100 밖, 그룹 키가 카탈로그에 없음.
- 개별 공고는 어디에도 저장하지 않는다. 수집 원본은 팀이 따로 관리한다(Git에 넣지 않는다).

**격차 계산** (`insights.py`, 순수 함수)

```
그룹 g의 기술을 비율 내림차순으로 정렬(None은 뒤, 동점이면 기술명 순). 상위 10개.
my_level = 인재의 숙련도, 미보유 0
status   = "none"  (my_level == 0)  |  "low" (1~2)  |  "ok" (≥ 3)      # 기준 3은 초기값
```

응답은 그룹별 `{sample_n, small_sample(sample_n < 10), items: [{skill, share_pct, metro_share_pct, my_level, status}]}`와 `collected_at`, `source`, `is_assumption`이다.

### 14.7 AI 설명 (`pref`)

- 호출: 사용자가 신규 공고 상위 3개 중 하나의 "AI 설명"을 누를 때. 입력은 공고 제목·기업 유형·산업, `pref_total`과 구성 점수, 일치한 속성, `similar_to`, 적합도와 부족 기술. 입력은 4,000자 이내.
- 지시문(300자 이내): `아래 점수와 일치 속성만 근거로 이 공고가 선호와 맞는 이유를 2문장 이내로 한국어로 써. 150자 이내. 입력에 없는 숫자나 회사 정보를 만들지 마.`
- 검증·캐시·오류 처리는 §8.3과 같다 (숫자 검증, `AiCache` 저장, 대체 문장, 자동 재시도 없음). `kind = "pref"`.
- 대체 문장: `"선호한 기업 유형(공공기관)과 산업(에너지·전력)이 맞고 선호 기술 2개를 쓰는 공고입니다. 관심 기업 가상기업 A와 비슷합니다 (유사도 80)."`처럼 코드 템플릿으로 만든다.
- 선택 기능이며 표준 시연 흐름의 5회에 포함하지 않는다 (R9.4).

### 14.8 프론트엔드

탭 두 개를 추가한다 (인재 역할). 기존 컴포넌트와 패키지만 쓴다 (D9). 막대는 Tailwind `div`로 만든다.

| 탭 | 내용 | 요구사항 |
|---|---|---|
| 선호·새 공고 | 위쪽: 선호 폼(기업 유형·산업·특성 태그·기술 체크, 관심 기업 선택 3칸과 우선순위). 아래쪽: "신규만 / 전체" 전환, 선호 일치도 순 카드 목록, 구성 점수 막대, 관심 기업·유사 기업 배지, 적합도·부족 역량, "확인했음" 버튼, 상위 3개 "AI 설명" | R15 |
| 지역 기술 수요 | 기업 유형 선택, 기술별 요구 비율 막대(수도권 비교가 있으면 겹쳐 표시), 내 숙련도와 격차 배지, 표본 수·수집일·출처, 표본 적음·가정값 라벨 | R14 |

- 프로젝트 등록 폼(기업 역할)에 기업 유형·산업·특성 태그 입력을 넣는다. 이 폼은 신규 공고 시연에 필요해 P0로 올린다 (tasks 6.5).
- 선호가 비어 있으면 "선호를 설정하면 정렬이 바뀝니다"를 안내한다. 신규 공고가 0건이면 제외 사유를 보여준다 (R15.10).

### 14.9 시드 (`seed.py`)

- 프로젝트 10건에 `org_type`, `industry`, `style_tags`를 붙인다. 유형 분포 예: 공공기관 3, 대기업·제조 2, 스타트업·IT 3, 지역 SI 2. 산업은 4종 이상.
- 공공기관 유형 3건 이상이 Java 계열 요구 기술을 갖게 한다. 해당 직무군의 서울 비교 공고도 같은 요구 기술로 맞춘다 (R13.3).
- 인재 2명에게 선호 프로필을 시드한다(관심 기업 포함, `is_demo = true`).
- 값은 가상이다 (A12). 수집 결과가 나오면 `STACK_DEMAND`와 카탈로그를 먼저 갱신하고, 시드의 기술 분포를 그에 맞춘다. 수집한 실제 공고를 시드로 옮기지 않는다 (Q8).

### 14.10 위험

| 위험 | 대응 |
|---|---|
| 수집 표본이 작아 일반화로 오해 | 표본 수·수집일 상시 표시, 표본 10건 미만 "표본 적음", 발표에서 "표본 n건 기준"으로 말한다 |
| 공고 수집 시 사이트 약관·저작권 | 원문 저장·표시 금지, 집계 값만 코드에 둔다. 수집 방식은 팀이 약관을 확인한다 |
| 특성 태그가 주관적 | "가정값" 라벨. 일치도는 설명 가능한 산식이라 근거를 보여 준다 |
| 첫 배포 후 `Project` 컬럼 부족 | tasks 1.4 게이트에서 컬럼을 확정. 이후 필요하면 새 테이블 |
| 관심 기업 이름 변경·삭제 | 이름 문자열 비교. 목록에 없으면 해당 항목을 무시하고 화면에 "현재 등록된 공고가 없는 기업" 표시 |
| AI 호출 증가 | 선택 기능, 상위 3개, 저장된 결과 재사용, 자동 재시도 없음 (R9.4) |
| 선호가 비어 있을 때 의미 없는 100점 | 안내 문구와 적합도 정렬로 대체 (R15.8) |

## 15. 조사 데이터 반영 (2026-10-30, 앞 절과 다르면 이 절이 우선한다)

팀이 조사한 월세, 지원 제도, 교통 요금, 서울 공고 보수를 `region_data.py`에 반영한다. 평균은 사람이 계산해 적지 않고 조사 표본을 코드에 두고 코드가 계산한다. 개인의 소득 분위에 따른 정책 지원은 고려하지 않는다.

### 15.1 월세 (`RENT`, 원룸, 만 원)

국토교통부 실거래가 공개시스템, 계약일 2026-05-01 ~ 2026-10-30, 연립다세대+단독다가구 월세 거래, 면적 33㎡ 이하의 **중앙값**이다.

| 지역 | 값 | 거래 건수 | 비고 |
|---|---|---|---|
| 광주 | 38 | 2,116 | 5개 구 중앙값(39·40·37·34·40)의 단순평균도 38.0으로 같다 |
| 나주 | 35 | 74 | 건수 적음, 참고용 |
| 광양 | 38 | 80 | 건수 적음, 참고용 |
| 서울 강남구 | 69 | 1,955 | |
| 서울 영등포구 | 42 | 2,131 | |
| 서울 중구 | 52 | 502 | |

- 지역 값에는 지역 전체 중앙값을 쓴다. 구별 중앙값을 다시 평균하면 거래 건수가 반영되지 않아 전체 중앙값보다 부정확하기 때문이다. 광주 구별 값은 위 검산에만 쓴다.
- 서울 3개 구 합산 중앙값(53, 4,588건)은 참고값이며 계산에 쓰지 않는다. 구별 시나리오는 구별 값을 쓴다.
- 보증금은 반영하지 않는다 (R7.16).

### 15.2 지원 제도 (`POLICIES`)

| 제도 | scope | 월 지원 | 개월 | 출처 |
|---|---|---|---|---|
| 국가 청년월세 지원 | 전국 | min(월세, 20) | **24** | 광양시 공고, 토스뱅크 |
| 나주시 청년 취업자 주거비 지원 | 나주 | 20 | 12 | 위키트리 2026-08-11 |
| 서울시 청년월세지원 | 서울 | 20 | 12 | gobang.kr |
| 광양시 청년 주거 지원 | 광양 | None | None | 조사 자료 없음 (추정하지 않음) |

- 세 제도 모두 국가 청년월세와 중복되지 않는다고 조사되었다. §7.3의 "후보 중 총액이 가장 큰 1개만 적용"을 그대로 쓴다. 이 값으로는 모든 지역에서 국가 제도(20만 원 × 24개월)가 선택된다.
- 소득 기준(기준중위소득), 연령, 주민등록·무주택 요건은 계산하지 않는다. 인재가 본인 판단으로 체크한 `support_eligible`만 쓴다. 인재의 나이를 받지 않기 때문이다 (R1.4).
- 화면의 지원금 설명에 "소득·연령·거주 요건은 반영하지 않았습니다"를 함께 표시한다.

### 15.3 교통비 (`LOCAL_FARE`, `TRANSIT_FARE`, 편도 원)

**지역 내(시내버스·지하철, 교통카드)**: 광주 1,250 / 나주 1,450 / 광양 1,500 / 서울 1,550 (지하철 기본요금, 환승·거리 추가요금 미반영).

**지역 간**
- 광주↔나주: 광역버스 2,750. 광주에서 탑승하면 시내 기본요금이 적용되어 실제는 이보다 낮을 수 있으므로 조사 자료의 보수적 값(편도 2,750)을 쓴다.
- 광주↔광양: 시외버스. 우등 11,900(일반 9,100, 프리미엄 14,300의 평균은 약 11,767)을 쓴다.
- 광주↔서울: KTX 일반실 38,600(용산→광주송정 확인, 반대 방향은 같다고 추정 → 가정값).
- 나주↔광양은 직접 구간이 없어 광주 경유 합산으로 추정한다 (§7.1).

**산식 변경 (§7.1, §7.4의 "지역 내 교통비 0"을 대체)**
- `transport = 2 × fare(출발, 도착) × trips`. 출발과 도착이 같은 지역이면 `fare`는 그 지역의 `LOCAL_FARE`다 (이전에는 0).
- `trips`는 그대로다(상주·혼합 `onsite_days_per_week × 4`, 재택 `meeting_per_month`). 주 5일 상주이면 `2 × 1,250 × 20 = 50,000원`으로 조사 자료의 광주 월 통근비와 일치한다.
- `relocate`: 프로젝트 지역의 시내 요금. `commute`: 광주에서 프로젝트 지역으로 가는 요금(프로젝트가 광주이면 광주 시내 요금).
- 서울 3개 구: 서울 지하철 요금 × 2 × `trips`. `seoul_ktx`: KTX 요금 × 2 × `trips`만 계산한다(서울 시내 이동은 더하지 않는다).
- `commute_support`이면 해당 시나리오의 교통비는 0이다 (R7.5, 서울 시나리오에는 적용하지 않음).
- K-패스 청년 할인은 연령 정보가 필요해 적용하지 않는다.
- 이 변경은 이전 결정("지역 내 교통비는 계산하지 않는다")을 바꾼다. 월 저축이 소폭 줄어든다.

### 15.4 서울 보수 (`SEOUL_PAY_SAMPLES`, `district_sample_mean`)

서울 구별 보수는 팀이 수집한 공고 표본의 평균 월 단가다 (R13.11).

- 표본(개별 공고)은 구, 분류 라벨, 연봉 하한·상한(만 원)만 저장한다. 기업명과 공고 원문은 저장하지 않는다 (Q8).
- 공고 보수의 환산: 범위는 중앙값, 단일 값은 그 값, "월 N만 원 이상"은 `N × 12`를 하한으로 쓰고 `lower_bound: True`로 표시, "비공개"는 제외한다.
- `구별 월 단가 = int(평균 연봉 ÷ 12 + 0.5)`. 전체 평균은 표본 전체의 평균이며 `seoul_ktx` 시나리오에 쓴다.

| 구 | 유효 표본 | 평균 연봉(만 원) | 월 단가(만 원) |
|---|---|---|---|
| 강남구 | 4 | 4,237.5 | 353 |
| 영등포구 | 4 | 4,075.0 | 340 |
| 중구 | 3 (1건 비공개 제외) | 4,289.3 | 357 |
| 전체 | 11 | 4,192.5 | 349 |

- **한계 (화면에 표시)**: 표본이 구별 3~4건이고 직무가 섞여 있다(백엔드, 프론트엔드, 테스트, 시스템 운영 등). 선택한 프로젝트와 같은 직무의 보수가 아니다. 중구 값은 "월 500만 원 이상" 한 건(하한값 연 6,000)이 평균을 크게 올린다. 이 건을 빼면 중구 평균은 연 3,434, 월 286이다.
- `pay_basis`에 `district_sample_mean`을 추가하고 화면 라벨은 "서울 구별 공고 표본 평균(직무 혼합)"이다. 표본 수를 함께 반환한다.
- `pay_compare` 행에 `sample_n`을 추가하고, 응답 최상위에 `seoul_pay_source: {source, collected_at, note}`를 둔다. `peers`는 반환하지 않는다 (가상 공고를 보수에 쓰지 않음, Q10).
- 같은 직무 비교는 하지 않는다. 직무군별 표본이 충분히 모이면 §7.5의 규칙을 되살릴 수 있다.

### 15.5 신규 공고 경로

신규 공고는 기업 담당자가 이 서비스에서 등록한 공고만 해당한다 (A). 외부 구인 사이트 자동 수집(B)은 구현하지 않고 발표에서 향후 계획으로만 언급한다.
