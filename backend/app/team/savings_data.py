"""Snapshot data for the net-savings comparison (남는 돈 비교).

Plain constants only: no database, no AI, no network, no work at import time.
All amounts are integer 원 (`_won`) unless a name says `_manwon`. Every number
comes from a team-collected CSV (10/30) and carries its source in `SOURCES`.
The rules that use these numbers are written down in `docs/calc-criteria.md`.

Do not move this into a JSON file or a folder named `data`: the deploy ships
only `.py` files under backend/app and drops `data` folders (ops/deploy.py).
"""

from __future__ import annotations

from typing import Any

# ------------------------------------------------------------------ sources

SOURCES: dict[str, str] = {
    "rent": "국토교통부 실거래가 공개시스템, 계약일 2026-05-01~10-30, 연립다세대+단독다가구 "
            "월세 33㎡ 이하 중앙값",
    "net_pay": "연봉별 월 실수령액표 (1인, 비과세 식대 월 20만원 포함, 2026 4대보험 요율, "
               "지방소득세 포함) moneynestlab.com/kr-salary/2026-salary-table",
    "living": "국가데이터처 「2025 통계로 보는 1인 가구」 2024년 1인 가구 월평균 소비지출 168.9만원에서 "
              "주거·수도·광열 18.4%, 교통·운송 10.6%를 뺀 값",
    "transit": "광주 시내버스(아시아경제 2026-07-08), 나주 BIS 요금표, 광양시청 시내버스 안내, "
               "서울 지하철 기본요금(2025-06-28 인상). 월 40회(통근 20일 왕복), K패스 청년 30% 환급 적용",
    "commute_gj_naju": "나주 BIS 요금표: 997·998·999번. 광주 탑승 1,250원 + 나주 탑승 2,750원 = 하루 4,000원 × 20일",
    "distance": "네이버지도 자동차 길찾기, 광주청사 → 한국전력공사 본사 편도 24km, 2026-10-30 20시 조회",
    "car_insurance": "보험개발원 「2025년 자동차보험 가입현황 분석」 개인용 평균 68만원 × 운전경력 1년 미만 "
                     "최초 가입 할증 1.52 (금감원 2016 보도)",
    "car_tax": "지방세법 비영업용 승용차 1,600cc 이하 cc당 140원 + 지방교육세 30% (1,598cc 기준)",
    "fuel": "오피넷 2026년 10월 둘째 주 전국 휘발유 평균 1,856.6원/L, 준중형 연비 13km/L 가정",
    "median_income": "보건복지부 2026년 기준 중위소득 (복지로), 1인 가구",
    "subsidy": "국가 청년월세 지원(광양시 공고), 나주시 청년 취업자 주거비 지원(2026-08-11 보도), "
               "서울시 청년월세지원(gobang.kr)",
    "salary": "고용24 채용 공고 연봉. 범위는 하한값을 쓴다",
}

# ------------------------------------------------------------------- skills

# AI may only pick from this list (verified 10/10 on the team server).
SKILLS: tuple[str, ...] = (
    "데이터 분석", "데이터 라벨링", "머신러닝", "컴퓨터 비전", "자연어 처리", "생성형 AI 활용",
    "시계열 예측", "Python", "Java", "Spring", "전자정부 표준프레임워크", "백엔드 API",
    "웹 프론트엔드", "모바일 앱", "데이터베이스", "클라우드 배포", "IoT 센서", "임베디드",
    "서비스 기획", "UI/UX 디자인", "데이터 시각화", "문서화", "고객 인터뷰",
)

# --------------------------------------------------------------- pay & cost

# 연봉 하한(만원) -> 월 실수령액(원). 3368 and 3500 are linear interpolations made
# by the data team from the neighbouring rows of the same source table.
NET_PAY_WON: dict[int, int] = {
    2600: 1_943_000,
    2800: 2_085_000,
    3000: 2_225_000,
    3200: 2_357_000,
    3368: 2_464_000,
    3400: 2_484_000,
    3500: 2_547_000,
    4000: 2_862_000,
    5000: 3_490_000,
    6000: 4_112_000,
}

LIVING_COST_WON = 1_200_000  # 주거·교통 제외. Same value on both sides.

RENT_WON: dict[str, int] = {
    "광주": 380_000,
    "나주": 350_000,
    "광양": 380_000,
    "강남구": 690_000,
    "중구": 520_000,
}

COMMUTE_DAYS = 20  # 월 40회 = 20일 왕복. Same basis as the transit CSV.
K_PASS_YOUTH_REFUND = 0.30  # Applied on both sides (national program).

# Monthly public-transit cost before the K-Pass refund.
LOCAL_TRANSIT_BASE_WON: dict[str, int] = {
    "광주": 50_000,
    "나주": 58_000,
    "광양": 60_000,
    "서울": 62_000,
}
GJ_NAJU_COMMUTE_BASE_WON = 80_000

ROUND_TRIP_KM: dict[frozenset[str], int] = {frozenset({"광주", "나주"}): 48}

CAR_INSURANCE_AVG_YEAR_WON = 680_000
NEW_DRIVER_SURCHARGE = 1.52
CAR_CC = 1_598
CAR_TAX_PER_CC_WON = 140
LOCAL_EDU_TAX_RATE = 0.30
FUEL_PRICE_WON_PER_L = 1_856.6
FUEL_KM_PER_L = 13

# ------------------------------------------------------------------ subsidy

MEDIAN_INCOME_1P_WON = 2_564_238
ASSUMED_AGE = 25  # Target is new graduates; inside every program's age range.

# One dict per program. Income limits are fractions of the 1-person median
# income, compared with 연봉 ÷ 12 (세전). Programs cannot be combined; the code
# picks the one with the largest total.
SUBSIDIES: tuple[dict[str, Any], ...] = (
    {
        "name": "국가 청년월세 지원", "regions": ("광주", "나주", "광양", "강남구", "중구"),
        "monthly_cap_won": 200_000, "months": 24, "age": (19, 34),
        "income_max_ratio": 0.60, "income_min_ratio": None, "rent_max_won": None,
        "selection": "요건 충족 시 지원",
    },
    {
        "name": "나주시 청년 취업자 주거비 지원", "regions": ("나주",),
        "monthly_cap_won": 200_000, "months": 12, "age": (18, 45),
        "income_max_ratio": 1.50, "income_min_ratio": None, "rent_max_won": 600_000,
        "selection": "모집 인원 내 선정 (공고일 기준 나주 주민등록 필요)",
    },
    {
        "name": "서울시 청년월세지원", "regions": ("강남구", "중구"),
        "monthly_cap_won": 200_000, "months": 12, "age": (19, 39),
        "income_max_ratio": 1.50, "income_min_ratio": 0.48, "rent_max_won": 600_000,
        "selection": "추첨",
    },
)
# 광양시 청년 주거 지원 제도: 없음 (데이터 담당 확인, 10/30).

# ---------------------------------------------------------------- projects

JEONNAM_CITIES: tuple[str, ...] = ("광주", "나주", "광양")
SEOUL_DISTRICTS: tuple[str, ...] = ("강남구", "중구")  # 영등포구 제외 (10/30 19:35)


def _p(pid: str, place: str, display: str, company: str, work: str,
       skills: tuple[str, ...], posted: tuple[str, ...], salary_text: str,
       salary_floor: int | None) -> dict[str, Any]:
    return {
        "id": pid, "place": place, "display_name": display, "company": company,
        "work": work, "skills": skills, "skills_from_posting": posted,
        "salary_text": salary_text, "salary_floor_manwon": salary_floor,
    }


# Recommended side. `skills_from_posting` are written in the posting; the rest
# are inferred from the job description (docs/meeting-agenda.md section 7).
JEONNAM_PROJECTS: tuple[dict[str, Any], ...] = (
    _p("GJ-A", "광주", "광주 A사", "나눔테크", "의료기기 소프트웨어 개발",
       ("임베디드", "문서화"), ("임베디드",), "3000만원", 3000),
    _p("GJ-B", "광주", "광주 B사", "에이아이랩", "임베디드·IoT 소프트웨어 개발",
       ("임베디드", "IoT 센서"), ("임베디드", "IoT 센서"), "2800만원 이상", 2800),
    _p("GJ-C", "광주", "광주 C사", "레플러스", "생성형 AI 솔루션·Python 자동화",
       ("생성형 AI 활용", "Python", "자연어 처리"), ("생성형 AI 활용", "Python"),
       "3000~6000만원", 3000),
    _p("GJ-D", "광주", "광주 D사", "아이엠알", "웹 솔루션 및 데이터베이스 연동 시스템",
       ("웹 프론트엔드", "데이터베이스", "백엔드 API"), ("웹 프론트엔드", "데이터베이스"),
       "3500~7000만원", 3500),
    _p("NJ-A", "나주", "나주 A사", "티이에프", "연구과제 SW·데이터 처리 및 기능 개발",
       ("데이터 분석", "Python"), ("데이터 분석",), "2800만원", 2800),
    _p("NJ-B", "나주", "나주 B사", "제이지파워넷", "IoT 서비스·제품 개발",
       ("IoT 센서", "임베디드", "백엔드 API"), ("IoT 센서",), "3000만원", 3000),
    _p("NJ-C", "나주", "나주 C사", "앤솔루션", "전력 정보시스템 개발·운영",
       ("데이터베이스", "백엔드 API", "전자정부 표준프레임워크"), (), "3000~9000만원", 3000),
    _p("NJ-D", "나주", "나주 D사", "코리아퍼스텍", "Java 기반 금융시스템 개발",
       ("Java", "Spring", "데이터베이스"), ("Java",), "5000만원 이상", 5000),
    _p("GY-A", "광양", "광양 A사", "피디엠", "공정·물류 자동화 응용 SW 개발",
       ("IoT 센서", "데이터베이스"), (), "3200~3500만원", 3200),
    _p("GY-B", "광양", "광양 B사", "세신전기", "산업설비 PLC 프로그래밍 및 제어 시스템 설계",
       ("임베디드", "IoT 센서"), (), "5000~6000만원", 5000),
    _p("GY-C", "광양", "광양 C사", "디엑스에이블", "공장 자동화 소프트웨어 및 운영",
       ("IoT 센서", "데이터베이스", "데이터 시각화"), (), "3200~3500만원", 3200),
    _p("GY-D", "광양", "광양 D사", "아인봇랩", "Python 기반 소프트웨어 개발",
       ("Python", "백엔드 API"), ("Python",), "3500~4000만원", 3500),
)

# Baseline side only: never recommended, used to pick "같은 일 서울 공고".
SEOUL_PROJECTS: tuple[dict[str, Any], ...] = (
    _p("GN-A", "강남구", "서울 강남 A사", "아크넥사", "국방·공공 응용SW, API 및 데이터 연동 개발",
       ("백엔드 API", "데이터베이스", "전자정부 표준프레임워크"), ("백엔드 API",),
       "3000~5000만원", 3000),
    _p("GN-B", "강남구", "서울 강남 B사", "티벨", "모바일·PC 소프트웨어 테스트 및 AI 자동화 개발",
       ("Python", "생성형 AI 활용"), (), "2600~2800만원", 2600),
    _p("GN-C", "강남구", "서울 강남 C사", "씨네틱모션", "ROS2 기반 로봇팔·카메라 모션 제어 SW 개발",
       ("임베디드", "컴퓨터 비전"), (), "4000~6000만원", 4000),
    _p("GN-D", "강남구", "서울 강남 D사", "체크팀", "Java·Spring·MySQL 금융 백엔드 개발",
       ("Java", "Spring", "데이터베이스", "백엔드 API"), ("Java", "Spring", "데이터베이스"),
       "5000~5500만원", 5000),
    _p("JG-A", "중구", "서울 중구 A사", "한국재정정보원", "재정정보 전산시스템 및 인프라 운영",
       ("데이터베이스", "클라우드 배포", "전자정부 표준프레임워크"), (),
       "3368만원(통합채용 공고)", 3368),
    _p("JG-B", "중구", "서울 중구 B사", "이지케어텍", "병원 정보시스템 개발",
       ("Java", "데이터베이스", "백엔드 API"), (), "3000~4000만원", 3000),
    _p("JG-C", "중구", "서울 중구 C사", "소프트웍스", "React 프론트엔드 개발",
       ("웹 프론트엔드", "UI/UX 디자인"), ("웹 프론트엔드",), "월 500만원 이상", 6000),
    _p("JG-D", "중구", "서울 중구 D사", "신세계아이앤씨", "Java·웹·앱 개발 및 운영",
       ("Java", "웹 프론트엔드", "모바일 앱"), ("Java", "웹 프론트엔드", "모바일 앱"),
       "비공개", None),
)
