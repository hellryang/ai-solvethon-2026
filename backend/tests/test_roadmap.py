"""③ 준비 로드맵: 부족한 기술 -> 필요 자격증 + 기업별 프로젝트 (개월 순서)."""
from fastapi.testclient import TestClient

from app.main import app
from app.team import roadmap as rm
from app.team import savings_data as d
from app.team.savings import Profile

PROJECTS = {p["id"]: p for p in d.JEONNAM_PROJECTS}
JAVA_WEB = Profile(home_city="광주", housing="본가", skills=("Java", "웹 프론트엔드"))


def test_every_certificate_skill_is_in_the_dictionary():
    for cert in rm.CERTIFICATES:
        assert set(cert.skills) <= set(d.SKILLS), cert.name


def test_gaps_follow_the_fit_score_rule():
    gaps = rm.skill_gaps(JAVA_WEB, [PROJECTS["NJ-D"], PROJECTS["GJ-D"]])
    assert gaps[0]["missing"] == ["Spring", "데이터베이스"]
    assert gaps[1]["missing"] == ["데이터베이스", "백엔드 API"]


def test_plan_puts_shared_certificate_first_then_projects_in_pick_order():
    picks = [PROJECTS["NJ-D"], PROJECTS["GJ-D"]]
    plan = rm.build_plan(picks, rm.skill_gaps(JAVA_WEB, picks), {})

    certs = [(c["name"], c["start_month"], c["end_month"], c["covers"]) for c in plan["certificates"]]
    # Both companies lack 데이터베이스 and one skill each that 정보처리기사 covers: tie -> list order.
    assert certs == [("SQLD", 1, 2, ["데이터베이스"]), ("정보처리기사", 3, 5, ["Spring", "백엔드 API"])]
    months = [(p["display_name"], p["start_month"], p["end_month"], p["source"]) for p in plan["projects"]]
    assert months == [("나주 D사", 3, 4, "template"), ("광주 D사", 5, 6, "template")]


def test_no_gap_means_no_certificate_and_projects_start_at_month_one():
    full = Profile(skills=("Java", "Spring", "데이터베이스"))
    plan = rm.build_plan([PROJECTS["NJ-D"]], rm.skill_gaps(full, [PROJECTS["NJ-D"]]), {})
    assert plan["certificates"] == []
    assert plan["projects"][0]["start_month"] == 1


def test_ai_project_lines_replace_the_template():
    text = "1. **나주 D사**: 거래 내역 조회 API - Spring으로 계좌 거래 조회 API를 만든다\n없는 회사: 무시"
    parsed = rm.parse_ai_projects(text, ("나주 D사", "광주 D사"))
    assert parsed == {"나주 D사": ("거래 내역 조회 API", "Spring으로 계좌 거래 조회 API를 만든다")}
    picks = [PROJECTS["NJ-D"], PROJECTS["GJ-D"]]
    plan = rm.build_plan(picks, rm.skill_gaps(JAVA_WEB, picks), parsed)
    assert [p["source"] for p in plan["projects"]] == ["ai", "template"]


def test_route_returns_two_sections_and_never_shows_the_mock_echo():
    profile = {"home_city": "광주", "housing": "본가", "has_car": False, "work_mode": "상주",
               "skills": ["Java", "웹 프론트엔드"], "extended": []}
    with TestClient(app) as client:
        r = client.post("/api/team/savings/roadmap", json={"profile": profile, "project_ids": ["NJ-D", "GJ-D"]})
    body = r.json()
    assert r.status_code == 200, r.text
    assert body["mode"] == "mock" and body["ai_error"] is None
    assert [c["name"] for c in body["certificates"]] == ["SQLD", "정보처리기사"]
    assert all(p["source"] == "template" for p in body["projects"])
    assert len(body["totals"]) == 2


def test_projects_split_by_work_mode():
    assert {p["work_mode"] for p in d.JEONNAM_PROJECTS} == {"상주"}
    assert set(d.WORK_MODES) == {"상주", "재택"}
