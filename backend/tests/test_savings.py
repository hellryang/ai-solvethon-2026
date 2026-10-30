"""Hand-computed expected values (docs/calc-criteria.md section 4).

If a number here changes, the criteria document and the pitch numbers change too.
"""

import pytest

from app.team import savings_data as d
from app.team.project_fit import fit_score, recommend, seoul_counterpart
from app.team.savings import (
    Profile, best_subsidy, breakdown, car_fixed_monthly, car_fuel_monthly, compare,
    k_pass, monthly_net_pay, parse_salary_floor,
)

PROJECTS = {p["id"]: p for p in d.JEONNAM_PROJECTS + d.SEOUL_PROJECTS}

DEMO = Profile(home_city="광주", housing="본가", has_car=False, work_mode="상주",
               skills=("Java", "웹 프론트엔드"),
               extended=("Spring", "전자정부 표준프레임워크", "백엔드 API"))


# ------------------------------------------------------------ data rules

def test_salary_floor_parsing_matches_stored_values():
    for p in d.JEONNAM_PROJECTS + d.SEOUL_PROJECTS:
        assert parse_salary_floor(p["salary_text"]) == p["salary_floor_manwon"], p["id"]


def test_salary_text_variants():
    assert parse_salary_floor("3000~6000만원") == 3000
    assert parse_salary_floor("2800만원 이상") == 2800
    assert parse_salary_floor("월 500만원 이상") == 6000
    assert parse_salary_floor("3368만원(통합채용 공고)") == 3368
    assert parse_salary_floor("비공개") is None


def test_every_salary_is_inside_the_net_pay_table():
    for p in d.JEONNAM_PROJECTS + d.SEOUL_PROJECTS:
        if p["salary_floor_manwon"] is not None:
            monthly_net_pay(p["salary_floor_manwon"])


def test_project_skills_come_from_the_dictionary():
    for p in d.JEONNAM_PROJECTS + d.SEOUL_PROJECTS:
        assert set(p["skills"]) <= set(d.SKILLS), p["id"]
        assert set(p["skills_from_posting"]) <= set(p["skills"]), p["id"]


def test_yeongdeungpo_is_not_a_baseline():
    assert "영등포구" not in d.RENT_WON
    assert all(p["place"] in d.SEOUL_DISTRICTS for p in d.SEOUL_PROJECTS)


def test_net_pay_interpolates_between_rows():
    assert monthly_net_pay(5000) == 3_490_000
    assert monthly_net_pay(3300) == 2_420_690  # 2,357,000 + 107,000 × 100/168
    with pytest.raises(ValueError):
        monthly_net_pay(2000)


def test_transport_and_car_constants():
    assert [k_pass(w) for w in (50_000, 58_000, 60_000, 62_000, 80_000)] == \
        [35_000, 40_600, 42_000, 43_400, 56_000]
    assert car_fixed_monthly() == 110_369  # 86,133 + 24,236
    assert car_fuel_monthly(48) == 137_103  # 48km × 20일 ÷ 13km/L × 1,856.6원


# --------------------------------------------------------------- subsidy

def test_national_rent_support_never_applies_to_these_salaries():
    # 본인 소득 기준중위 60% = 월 153.9만원 = 연 1,846만원. 최저 공고 2,600만원.
    for p in d.JEONNAM_PROJECTS + d.SEOUL_PROJECTS:
        s = p["salary_floor_manwon"]
        if s is not None:
            got = best_subsidy(p["place"], s, 300_000, 25)
            assert got is None or got["name"] != "국가 청년월세 지원"


def test_gangnam_rent_is_above_the_seoul_program_cap():
    assert best_subsidy("강남구", 3000, d.RENT_WON["강남구"], 25) is None


def test_junggu_gets_seoul_support_under_150_percent():
    got = best_subsidy("중구", 3000, d.RENT_WON["중구"], 25)
    assert (got["name"], got["monthly"], got["months"]) == ("서울시 청년월세지원", 200_000, 12)


def test_naju_support_needs_rent_and_income_limit():
    got = best_subsidy("나주", 3000, d.RENT_WON["나주"], 25)
    assert (got["name"], got["monthly"], got["months"]) == ("나주시 청년 취업자 주거비 지원", 200_000, 12)
    assert best_subsidy("나주", 5000, d.RENT_WON["나주"], 25) is None  # 월 416.7만 > 384.6만
    assert best_subsidy("나주", 3000, 0, 25) is None  # 본가: 월세 없음


def test_gwangyang_has_no_program():
    assert best_subsidy("광양", 3200, d.RENT_WON["광양"], 25) is None


# ------------------------------------------------------- matching rules

def test_demo_recommendation_order():
    picks = recommend(DEMO)
    assert [(p["project"]["id"], p["fit"]["score"]) for p in picks] == \
        [("NJ-D", 60), ("GJ-D", 60), ("NJ-C", 46)]


def test_fit_score_formula():
    f = fit_score(DEMO, PROJECTS["NJ-C"])  # 확장 2개 / 필요 3개
    assert (f["skill_points"], f["condition_points"]) == (26, 20)
    remote = Profile(work_mode="재택", skills=("Java",))
    assert fit_score(remote, PROJECTS["NJ-D"])["condition_points"] == 0


def test_seoul_counterparts():
    assert seoul_counterpart(PROJECTS["NJ-D"])["id"] == "GN-D"  # 3개 일치
    assert seoul_counterpart(PROJECTS["GJ-D"])["id"] == "GN-A"  # 2/4 동률 → 연봉 동률 → 목록 순
    assert seoul_counterpart(PROJECTS["NJ-B"])["id"] == "GN-C"  # 1개 일치 중 Jaccard 1/4
    assert all(seoul_counterpart(p)["salary_floor_manwon"] is not None for p in d.JEONNAM_PROJECTS)


# ------------------------------------------------- representative cases

def test_case_a_demo_naju_java_from_gwangju_home():
    r = compare(PROJECTS["NJ-D"], PROJECTS["GN-D"], DEMO)
    j, s = r["jeonnam"], r["seoul"]
    assert (j["housing"], j["rent"], j["transit"], j["savings"]) == ("본가", 0, 56_000, 2_234_000)
    assert (s["rent"], s["transit"], s["subsidy"], s["savings"]) == (690_000, 43_400, None, 1_556_600)
    assert r["advantage_monthly"] == 677_400
    assert r["reversal_subsidy"] == 0
    assert r["break_even_ratio"] == pytest.approx(677_400 / 3_490_000)  # 19.4%
    assert r["actual_gap_ratio"] == 0
    assert r["message"] == "jeonnam_wins"
    assert r["cumulative"]["60"] == {"jeonnam": 134_040_000, "seoul": 93_396_000}


def test_case_b_gwangju_web_job_from_home():
    r = compare(PROJECTS["GJ-D"], PROJECTS["GN-A"], DEMO)
    assert r["jeonnam"]["savings"] == 1_312_000  # 2,547,000 − 35,000 − 1,200,000
    assert r["seoul"]["savings"] == 291_600  # 2,225,000 − 690,000 − 43,400 − 1,200,000
    assert r["advantage_monthly"] == 1_020_400
    assert r["break_even_ratio"] == pytest.approx(698_400 / 2_547_000)
    assert r["actual_gap_ratio"] == pytest.approx(-322_000 / 2_547_000)


def test_case_c_naju_studio_with_subsidy_is_close_to_seoul():
    me = Profile(home_city="순천", housing="자취", work_mode="상주", skills=("IoT 센서",))
    r = compare(PROJECTS["NJ-B"], PROJECTS["GN-C"], me)
    j = r["jeonnam"]
    assert (j["housing"], j["rent"], j["transit"]) == ("자취", 350_000, 40_600)
    assert j["subsidy"]["monthly"] == 200_000
    assert j["savings"] == 834_400
    assert r["seoul"]["savings"] == 928_600
    assert r["reversal_subsidy"] == 94_200
    assert r["message"] == "even"  # X 24.4% vs g 28.6%: 5%p 안
    assert r["cumulative"]["12"] == {"jeonnam": 10_012_800, "seoul": 11_143_200}
    assert r["cumulative"]["60"] == {"jeonnam": 40_464_000, "seoul": 55_716_000}


def test_car_owner_pays_fixed_cost_on_both_sides_and_takes_the_bus():
    driver = Profile(home_city="광주", housing="본가", has_car=True, work_mode="상주", skills=("Java",))
    r = compare(PROJECTS["NJ-D"], PROJECTS["GN-D"], driver)
    j, s = r["jeonnam"], r["seoul"]
    assert j["car_fixed"] == s["car_fixed"] == 110_369
    assert j["transit"] == 56_000 and j["car_alt"]["fuel"] == 137_103
    assert r["advantage_monthly"] == 677_400  # 차가 있어도 차이는 같다


def test_advantage_identity_holds_for_every_project():
    for p in d.JEONNAM_PROJECTS:
        r = compare(p, seoul_counterpart(p), DEMO)
        net = r["jeonnam"]["net_pay"]
        expected = net * (r["break_even_ratio"] - r["actual_gap_ratio"])
        assert r["advantage_monthly"] == pytest.approx(expected, abs=1)


def test_unknown_residence_is_treated_as_studio():
    r = breakdown(PROJECTS["GJ-D"], Profile())
    assert (r["housing"], r["rent"]) == ("자취", 380_000)


def test_undisclosed_salary_is_rejected():
    with pytest.raises(ValueError):
        breakdown(PROJECTS["JG-D"], DEMO)
