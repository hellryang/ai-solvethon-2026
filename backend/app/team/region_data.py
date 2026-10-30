"""Regional reference data (rent, transit, support policies, Seoul pay, stack demand).

Everything here is a plain constant or a pure function: no database, no AI, and
no work at import time. Every entry carries a `source` and `is_assumption` so the
UI can label assumed values (R10). A value that is not known stays `None`; it is
never guessed (R10.5). Amounts are integer 만 원 unless a name says `_won`.

Sources: the team's own survey (design.md section 15). Personal income-bracket
rules are not modelled; eligibility is the talent's own `support_eligible`.
"""

from __future__ import annotations

from typing import Any

from .catalog import ORG_TYPES, REGIONS, SEOUL_DISTRICTS, SKILLS

Entry = dict[str, Any]


def _entry(value: Any, source: str, is_assumption: bool = False) -> Entry:
    return {"value": value, "source": source, "is_assumption": is_assumption}


# ---------------------------------------------------------------- rent (15.1)

_RENT_SRC = (
    "국토교통부 실거래가 공개시스템, 계약일 2026-05-01~2026-10-30, 연립다세대+단독다가구 "
    "월세 거래 면적 33㎡ 이하 중앙값 (거래 {n}건{note})"
)

# Key: (region, housing type). Only studio ("원룸") data exists; other housing
# types fall back to the studio value and the simulation flags `housing_fallback`.
RENT: dict[tuple[str, str], Entry] = {
    ("광주", "원룸"): _entry(38, _RENT_SRC.format(n=2116, note="")),
    ("나주", "원룸"): _entry(35, _RENT_SRC.format(n=74, note=", 건수 적음 참고용")),
    ("광양", "원룸"): _entry(38, _RENT_SRC.format(n=80, note=", 건수 적음 참고용")),
    ("강남구", "원룸"): _entry(69, _RENT_SRC.format(n=1955, note="")),
    ("영등포구", "원룸"): _entry(42, _RENT_SRC.format(n=2131, note="")),
    ("중구", "원룸"): _entry(52, _RENT_SRC.format(n=502, note="")),
}

# Gwangju district medians (median 만 원, trades). Used only to cross-check the
# Gwangju-wide value above; the simulation does not use district rents.
GWANGJU_GU_RENT_CHECK: dict[str, tuple[int, int]] = {
    "광산구": (39, 703), "남구": (40, 237), "동구": (37, 152), "북구": (34, 416), "서구": (40, 608),
}


def gwangju_gu_mean() -> float:
    """Simple mean of the five district medians (about 38.0)."""
    values = [median for median, _ in GWANGJU_GU_RENT_CHECK.values()]
    return sum(values) / len(values)


# ---------------------------------------------------------- transit (15.3)

# One-way fare in won inside a region (transit card).
LOCAL_FARE: dict[str, Entry] = {
    "광주": _entry(1250, "아시아경제 2026-07-08, 시내버스 카드 일반"),
    "나주": _entry(1450, "나주시 BIS 요금 안내, 시내버스 교통카드 (현금 1,500)"),
    "광양": _entry(1500, "광양시청 시내버스 안내, 일반 교통카드"),
    "서울": _entry(1550, "이투데이, 지하철 기본요금 카드 (환승·거리 추가요금 미반영)"),
}

# One-way fare in won between regions. Both directions use the same value.
# Frozenset keys: {"광주", "나주"}. "서울" stands for any of the three districts.
TRANSIT_FARE: dict[frozenset[str], Entry] = {
    frozenset({"광주", "나주"}): _entry(
        2750, "나주시 BIS, 광주↔나주 광역버스 997·998·999번 (광주 탑승 시 실제는 더 낮을 수 있어 보수적 값)"),
    frozenset({"광주", "광양"}): _entry(
        11900, "시외버스 우등 (일반 9,100 / 프리미엄 14,300)"),
    frozenset({"광주", "서울"}): _entry(
        38600, "KTX 일반실 용산→광주송정 (반대 방향은 같다고 추정)", True),
}

# Not used for money; shown as a note where a route is only estimated.
ROUTE_ESTIMATED_NOTE = "직접 구간이 없어 광주 경유 요금을 합산한 추정값"

# ------------------------------------------------------- support policy (15.2)

# scope: 전국 / 서울 / 나주 / 광양 / 광주. `monthly_amount` None = no data, so the
# policy is excluded from the calculation. Income, age and residency rules are
# not modelled (the talent decides eligibility herself).
POLICIES: list[dict[str, Any]] = [
    {"name": "국가 청년월세 지원", "scope": "전국", "monthly_amount": 20, "months": 24,
     "source": "광양시 공고, 토스뱅크 (월 지원액은 min(월세, 20))", "is_assumption": False},
    {"name": "나주시 청년 취업자 주거비 지원", "scope": "나주", "monthly_amount": 20, "months": 12,
     "source": "위키트리 2026-08-11", "is_assumption": False},
    {"name": "서울시 청년월세지원", "scope": "서울", "monthly_amount": 20, "months": 12,
     "source": "gobang.kr", "is_assumption": False},
    {"name": "광양시 청년 주거 지원", "scope": "광양", "monthly_amount": None, "months": None,
     "source": "조사 자료 없음", "is_assumption": True},
]

# Scope of each residence, used to pick applicable policies.
POLICY_SCOPE: dict[str, str] = {
    "광주": "광주", "나주": "나주", "광양": "광양",
    "강남구": "서울", "영등포구": "서울", "중구": "서울",
}

# --------------------------------------------------------------- pay (10, 15.4)

# KOSA pay grades for the local projects are not collected yet: values stay None.
PAY_GRADES: dict[str, dict[str, Any]] = {
    "G1": {"label": "등급 1 (값 확인 전)", "monthly": None, "source": "KOSA SW기술자 평균임금 (확인 전)", "is_assumption": True},
    "G2": {"label": "등급 2 (값 확인 전)", "monthly": None, "source": "KOSA SW기술자 평균임금 (확인 전)", "is_assumption": True},
    "G3": {"label": "등급 3 (값 확인 전)", "monthly": None, "source": "KOSA SW기술자 평균임금 (확인 전)", "is_assumption": True},
}

DEDUCTION_RATE: Entry = _entry(0.033, "단일 공제율 가정 (Q2, 3.3%)", True)

# Seoul pay samples. Only the district, a category label and the annual pay range
# (만 원) are kept: no company names and no posting text (Q8).
#   annual_min/annual_max None  -> pay not disclosed, excluded from the mean.
#   lower_bound True            -> the posting said "N or more", so the value is a floor.
SEOUL_PAY_SAMPLES: list[dict[str, Any]] = [
    {"district": "강남구", "label": "SW·백엔드", "annual_min": 3000, "annual_max": 5000},
    {"district": "강남구", "label": "SW 테스트·AI 자동화", "annual_min": 2600, "annual_max": 2800},
    {"district": "강남구", "label": "로봇·SW", "annual_min": 4000, "annual_max": 6000},
    {"district": "강남구", "label": "금융 백엔드", "annual_min": 5000, "annual_max": 5500},
    {"district": "영등포구", "label": "제조·DB·SW", "annual_min": 5000, "annual_max": 5000},
    {"district": "영등포구", "label": "보안 SW", "annual_min": 3000, "annual_max": 3400},
    {"district": "영등포구", "label": "시스템 운영", "annual_min": 3500, "annual_max": 4500},
    {"district": "영등포구", "label": "AI·백엔드", "annual_min": 3200, "annual_max": 5000},
    {"district": "중구", "label": "전산·시스템 운영", "annual_min": 3368, "annual_max": 3368},
    {"district": "중구", "label": "의료 SW", "annual_min": 3000, "annual_max": 4000},
    # "월 500만원 이상" -> annual floor 6,000. This single posting lifts the 중구 mean a lot.
    {"district": "중구", "label": "프론트엔드", "annual_min": 6000, "annual_max": 6000, "lower_bound": True},
    {"district": "중구", "label": "웹·앱·시스템", "annual_min": None, "annual_max": None},
]

SEOUL_PAY_SOURCE: dict[str, Any] = {
    "source": "고용24 공고 표본 (팀 직접 수집, 기업명·원문 미저장)",
    "collected_at": None,  # collection date not recorded
    "note": "구별 3~4건, 직무 혼합 평균. 선택한 프로젝트와 같은 직무의 보수가 아닙니다.",
    "is_assumption": False,
}


def _round_half_up(x: float) -> int:
    return int(x + 0.5)


def sample_annual(sample: dict[str, Any]) -> float | None:
    """Annual pay (만 원) of one sample: range midpoint, single value as is, None if undisclosed."""
    low, high = sample.get("annual_min"), sample.get("annual_max")
    if low is None or high is None:
        return None
    return (low + high) / 2


def seoul_pay_summary() -> dict[str, dict[str, Any]]:
    """Mean pay per Seoul district and overall, computed from SEOUL_PAY_SAMPLES.

    Returns {district or "전체": {"n", "annual_mean", "monthly", "includes_lower_bound"}}.
    `monthly = int(annual_mean / 12 + 0.5)`. Districts without a usable sample map to None.
    """
    groups: dict[str, list[dict[str, Any]]] = {d: [] for d in SEOUL_DISTRICTS}
    for sample in SEOUL_PAY_SAMPLES:
        if sample_annual(sample) is not None:
            groups.setdefault(sample["district"], []).append(sample)

    def summarize(samples: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not samples:
            return None
        annual_mean = sum(sample_annual(s) or 0 for s in samples) / len(samples)
        return {
            "n": len(samples),
            "annual_mean": annual_mean,
            "monthly": _round_half_up(annual_mean / 12),
            "includes_lower_bound": any(s.get("lower_bound") for s in samples),
        }

    result: dict[str, dict[str, Any]] = {d: summarize(groups[d]) for d in SEOUL_DISTRICTS}  # type: ignore[misc]
    result["전체"] = summarize([s for d in SEOUL_DISTRICTS for s in groups[d]])  # type: ignore[assignment]
    return result


# ------------------------------------------------- regional stack demand (14)

# Aggregated share (%) of postings that ask for a skill, per company type. Values
# stay None until the team finishes collecting (tasks 0.5). Individual postings
# are never stored (Q8). `metro` is an optional comparison sample.
STACK_DEMAND: dict[str, Any] = {
    "collected_at": None,
    "source": "수집 전 (팀이 공고 표본을 집계해 채운다)",
    "is_assumption": True,
    "groups": {org: {"sample_n": None, "skills": {}} for org in (*ORG_TYPES, "전체")},
    "metro": {"label": "수도권 비교 표본", "sample_n": None, "skills": {}},
}

SMALL_SAMPLE_N = 10


# ------------------------------------------------------------------ checks


def check_region_data() -> list[str]:
    """Return the missing or invalid keys (empty list means complete)."""
    problems: list[str] = []
    for place in (*REGIONS, *SEOUL_DISTRICTS):
        entry = RENT.get((place, "원룸"))
        if entry is None or entry["value"] is None:
            problems.append(f"RENT[{place}, 원룸]")
    for region in (*REGIONS, "서울"):
        if LOCAL_FARE.get(region, {}).get("value") is None:
            problems.append(f"LOCAL_FARE[{region}]")
    for pair in ({"광주", "나주"}, {"광주", "광양"}, {"광주", "서울"}):
        if TRANSIT_FARE.get(frozenset(pair), {}).get("value") is None:
            problems.append(f"TRANSIT_FARE[{'-'.join(sorted(pair))}]")
    summary = seoul_pay_summary()
    for district in SEOUL_DISTRICTS:
        if summary[district] is None:
            problems.append(f"SEOUL_PAY_SAMPLES[{district}]")
    return problems


def check_stack_demand() -> list[str]:
    """Return problems in STACK_DEMAND: unknown company types or skills, shares outside 0..100."""
    problems: list[str] = []
    allowed_groups = {*ORG_TYPES, "전체"}
    blocks: list[tuple[str, dict[str, Any]]] = [
        (f"groups[{group}]", data) for group, data in STACK_DEMAND["groups"].items()
    ]
    blocks.append(("metro", STACK_DEMAND["metro"]))
    for group in STACK_DEMAND["groups"]:
        if group not in allowed_groups:
            problems.append(f"groups[{group}]: 알 수 없는 기업 유형")
    for label, block in blocks:
        for skill, share in block["skills"].items():
            if skill not in SKILLS:
                problems.append(f"{label}.{skill}: 카탈로그에 없는 기술")
            if share is not None and not 0 <= share <= 100:
                problems.append(f"{label}.{skill}: 비율 {share}이(가) 0~100 밖")
    return problems
