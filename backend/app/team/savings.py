"""Net-savings calculation (남는 돈): pure functions, same input -> same output.

Money is computed here, never by AI. Amounts are integer 원; fractions are
rounded half up at the point they appear. Rule numbers (R1..R10) refer to
`docs/calc-criteria.md`, which is also the Q&A sheet for the judges.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from . import savings_data as d

MESSAGE_MARGIN = 0.05  # 5%p band for the headline message (R9)


@dataclass(frozen=True)
class Profile:
    """What the user told us (AI ① extraction or the toggles)."""

    home_city: str | None = None  # 거주 시군, e.g. "광주"; None = 모름
    housing: str = "모름"  # 본가 / 자취 / 모름
    has_car: bool = False
    work_mode: str = "무관"  # 상주 / 재택 / 무관
    skills: tuple[str, ...] = field(default_factory=tuple)
    extended: tuple[str, ...] = field(default_factory=tuple)
    age: int = d.ASSUMED_AGE


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


# ------------------------------------------------------------ income (R1, R2)

def parse_salary_floor(text: str) -> int | None:
    """연봉 공고 표기 -> 하한 (만원/년). 비공개 -> None (R1)."""
    if "비공개" in text:
        return None
    numbers = [int(n) for n in re.findall(r"\d+", text.replace(",", ""))]
    if not numbers:
        return None
    if text.strip().startswith("월"):
        return numbers[0] * 12
    return numbers[0]


def monthly_net_pay(salary_manwon: int) -> int:
    """월 실수령액. Table lookup, linear between rows (R2)."""
    table = d.NET_PAY_WON
    if salary_manwon in table:
        return table[salary_manwon]
    keys = sorted(table)
    if not keys[0] <= salary_manwon <= keys[-1]:
        raise ValueError(f"salary {salary_manwon} outside net-pay table {keys[0]}~{keys[-1]}")
    hi = next(k for k in keys if k > salary_manwon)
    lo = max(k for k in keys if k < salary_manwon)
    ratio = (salary_manwon - lo) / (hi - lo)
    return round_half_up(table[lo] + (table[hi] - table[lo]) * ratio)


def monthly_gross(salary_manwon: int) -> float:
    return salary_manwon * 10_000 / 12


# --------------------------------------------------------- transport (R4, R5)

def k_pass(base_won: int) -> int:
    return round_half_up(base_won * (1 - d.K_PASS_YOUTH_REFUND))


def car_fixed_monthly() -> int:
    """보험 + 자동차세, 월 (R5). 정비비는 넣지 않는다."""
    insurance = round_half_up(d.CAR_INSURANCE_AVG_YEAR_WON * d.NEW_DRIVER_SURCHARGE / 12)
    tax = round_half_up(d.CAR_CC * d.CAR_TAX_PER_CC_WON * (1 + d.LOCAL_EDU_TAX_RATE) / 12)
    return insurance + tax


def car_fuel_monthly(round_trip_km: int) -> int:
    litres = round_trip_km * d.COMMUTE_DAYS / d.FUEL_KM_PER_L
    return round_half_up(litres * d.FUEL_PRICE_WON_PER_L)


# ------------------------------------------------------ where you live (R3)

def jeonnam_living(profile: Profile, work_city: str) -> dict[str, Any]:
    """본가에서 다니면 월세 0, 아니면 근무지에서 자취 (R3)."""
    home = profile.home_city
    at_home = profile.housing == "본가" and home is not None
    if at_home and home == work_city:
        return {"housing": "본가", "rent": 0, "transit": k_pass(d.LOCAL_TRANSIT_BASE_WON[work_city]),
                "transit_label": f"{work_city} 시내버스", "car_alt": None}
    pair = frozenset({home, work_city})
    if at_home and pair in d.ROUND_TRIP_KM:
        bus = k_pass(d.GJ_NAJU_COMMUTE_BASE_WON)
        fuel = car_fuel_monthly(d.ROUND_TRIP_KM[pair])
        car_alt = {"fuel": fuel, "round_trip_km": d.ROUND_TRIP_KM[pair]} if profile.has_car else None
        # With a car, take the cheaper way to commute (R5).
        if profile.has_car and fuel < bus:
            return {"housing": "본가", "rent": 0, "transit": fuel,
                    "transit_label": "자차 통근(유류비)", "car_alt": car_alt}
        return {"housing": "본가", "rent": 0, "transit": bus,
                "transit_label": "광주↔나주 광역버스", "car_alt": car_alt}
    return {"housing": "자취", "rent": d.RENT_WON[work_city],
            "transit": k_pass(d.LOCAL_TRANSIT_BASE_WON[work_city]),
            "transit_label": f"{work_city} 시내버스", "car_alt": None}


def seoul_living(district: str) -> dict[str, Any]:
    """서울은 그 구에서 자취 + 지하철 (R3)."""
    return {"housing": "자취", "rent": d.RENT_WON[district],
            "transit": k_pass(d.LOCAL_TRANSIT_BASE_WON["서울"]),
            "transit_label": "서울 지하철", "car_alt": None}


# ----------------------------------------------------------- subsidy (R6)

def best_subsidy(place: str, salary_manwon: int, rent: int, age: int) -> dict[str, Any] | None:
    """요건을 충족하는 지원 중 총액이 가장 큰 1개. 중복 불가 (R6)."""
    if rent <= 0:
        return None  # 월세를 내지 않으면 월세 지원 대상이 아니다
    income = monthly_gross(salary_manwon)
    median = d.MEDIAN_INCOME_1P_WON
    best = None
    for program in d.SUBSIDIES:
        if place not in program["regions"]:
            continue
        low_age, high_age = program["age"]
        if not low_age <= age <= high_age:
            continue
        if income > median * program["income_max_ratio"]:
            continue
        if program["income_min_ratio"] is not None and income < median * program["income_min_ratio"]:
            continue
        if program["rent_max_won"] is not None and rent > program["rent_max_won"]:
            continue
        monthly = min(rent, program["monthly_cap_won"])
        candidate = {"name": program["name"], "monthly": monthly, "months": program["months"],
                     "selection": program["selection"]}
        if best is None or monthly * program["months"] > best["monthly"] * best["months"]:
            best = candidate
    return best


# ----------------------------------------------------------- savings (R7)

def breakdown(project: dict[str, Any], profile: Profile) -> dict[str, Any]:
    """1년차 월 기준 남는 돈 내역."""
    salary = project["salary_floor_manwon"]
    if salary is None:
        raise ValueError(f"{project['id']}: salary not disclosed, excluded from calculation")
    place = project["place"]
    living = seoul_living(place) if place in d.SEOUL_DISTRICTS else jeonnam_living(profile, place)
    car_fixed = car_fixed_monthly() if profile.has_car else 0  # both sides alike (R5)
    subsidy = best_subsidy(place, salary, living["rent"], profile.age)
    subsidy_monthly = subsidy["monthly"] if subsidy else 0
    net_pay = monthly_net_pay(salary)
    costs = living["rent"] + living["transit"] + d.LIVING_COST_WON + car_fixed
    return {
        "project_id": project["id"], "display_name": project["display_name"], "place": place,
        "salary_floor_manwon": salary, "net_pay": net_pay,
        "housing": living["housing"], "rent": living["rent"],
        "transit": living["transit"], "transit_label": living["transit_label"],
        "living_cost": d.LIVING_COST_WON, "car_fixed": car_fixed, "car_alt": living["car_alt"],
        "subsidy": subsidy, "costs": costs - subsidy_monthly,
        "savings": net_pay - costs + subsidy_monthly,
        "savings_after_subsidy": net_pay - costs,
    }


def cumulative(b: dict[str, Any], months: int) -> int:
    """N개월 누적. 지원금은 지원 기간만큼만 더한다."""
    subsidy = b["subsidy"]
    extra = subsidy["monthly"] * min(months, subsidy["months"]) if subsidy else 0
    return b["savings_after_subsidy"] * months + extra


# ------------------------------------------------- comparison (R8, R9, R10)

def compare(jeonnam: dict[str, Any], seoul: dict[str, Any], profile: Profile) -> dict[str, Any]:
    j = breakdown(jeonnam, profile)
    s = breakdown(seoul, profile)
    advantage = j["savings"] - s["savings"]
    # X: 서울 실수령이 전남보다 몇 % 많아야 남는 돈이 같아지나. g: 실제로 몇 % 많은가.
    break_even = (s["costs"] - j["costs"]) / j["net_pay"]
    actual_gap = (s["net_pay"] - j["net_pay"]) / j["net_pay"]
    return {
        "jeonnam": j, "seoul": s,
        "advantage_monthly": advantage,
        "reversal_subsidy": max(0, -advantage),
        "break_even_ratio": break_even,
        "actual_gap_ratio": actual_gap,
        "message": headline(break_even, actual_gap),
        "cumulative": {
            str(m): {"jeonnam": cumulative(j, m), "seoul": cumulative(s, m)} for m in (12, 24, 60)
        },
    }


def headline(break_even: float, actual_gap: float) -> str:
    diff = break_even - actual_gap
    if diff > MESSAGE_MARGIN:
        return "jeonnam_wins"  # "남으면, 남는다."
    if diff >= -MESSAGE_MARGIN:
        return "even"  # 연봉은 서울이 높아도 남는 돈은 비슷하다
    return "seoul_wins"  # 역전 지원금 S를 보여 준다
