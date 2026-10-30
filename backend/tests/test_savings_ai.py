"""AI prompt limits, line parsing, keyword fallback, and the router in mock mode."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.team import profile_parse as pp
from app.team.savings_routes import router

app = FastAPI()
app.include_router(router, prefix="/api/team")
client = TestClient(app)

DEMO_INTRO = "광주 본가, 차 없음, 학부 때 Java로 학사관리 웹을 만들어 봤고 상주 근무 괜찮음"
DEMO_PROFILE = {"home_city": "광주", "housing": "본가", "has_car": False, "work_mode": "상주",
                "skills": ["Java", "웹 프론트엔드"],
                "extended": ["Spring", "전자정부 표준프레임워크", "백엔드 API"]}


def test_instructions_fit_the_300_char_limit():
    for text in (pp.INSTRUCTION_PARSE, pp.INSTRUCTION_ANALYSIS, pp.INSTRUCTION_ROADMAP):
        assert len(text) <= 300
    assert len(pp.build_parse_text("가" * 1000)) <= 4000


def test_parse_markdown_reply_and_drop_unknown_skills():
    reply = ("**기술:** Java, 웹 프론트엔드, React\n\n"
             "- 확장: Spring, 전자정부 표준프레임워크, 백엔드 API, Java\n"
             "조건: 거주=광주 본가, 차량=없음, 근무=상주\n"
             "근거: 학사관리 웹을 Java로 만든 경험")
    got = pp.parse_profile(reply)
    p = got["profile"]
    assert p.skills == ("Java", "웹 프론트엔드")
    assert p.extended == ("Spring", "전자정부 표준프레임워크", "백엔드 API")
    assert (p.home_city, p.housing, p.has_car, p.work_mode) == ("광주", "본가", False, "상주")
    assert got["rationale"].startswith("학사관리")


def test_mock_reply_is_not_parsed():
    mock = "[로컬 모의 응답 — 실제 AI 결과가 아닙니다]\n입력 전달과 화면 연동만 확인합니다.\n" \
           + pp.build_parse_text(DEMO_INTRO)[:120]
    assert pp.parse_profile(mock) is None


def test_keyword_fallback_on_demo_sentence():
    p = pp.keyword_profile(DEMO_INTRO)["profile"]
    assert p.skills == ("Java", "웹 프론트엔드")
    assert (p.home_city, p.housing, p.has_car, p.work_mode) == ("광주", "본가", False, "상주")


def test_parse_lines_requires_every_key():
    text = "맞는 점: 공공 금융 경력\n아쉬운 점: 통근 26분\n판단: 추천"
    assert pp.parse_lines(text, ("맞는 점", "아쉬운 점", "판단"))["판단"] == "추천"
    assert pp.parse_lines("맞는 점: x", ("맞는 점", "판단")) is None


def test_route_parse_falls_back_to_keywords_in_mock_mode():
    r = client.post("/api/team/savings/parse", json={"intro": DEMO_INTRO})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "keyword"
    assert body["profile"]["skills"] == ["Java", "웹 프론트엔드"]


def test_route_recommend_and_compare():
    r = client.post("/api/team/savings/recommend", json=DEMO_PROFILE)
    items = r.json()["items"]
    assert [i["project"]["id"] for i in items] == ["NJ-D", "GJ-D", "NJ-C"]
    assert items[0]["advantage_monthly"] == 677_400
    assert "company" not in items[0]["project"]  # 회사 실명은 응답에 넣지 않는다

    r = client.post("/api/team/savings/compare", json={"profile": DEMO_PROFILE, "project_id": "NJ-D"})
    body = r.json()
    assert body["seoul_project"]["id"] == "GN-D"
    assert body["cumulative"]["60"]["jeonnam"] == 134_040_000

    assert client.post("/api/team/savings/compare",
                       json={"profile": DEMO_PROFILE, "project_id": "nope"}).status_code == 404


def test_route_analysis_and_roadmap_in_mock_mode():
    r = client.post("/api/team/savings/analysis", json={"profile": DEMO_PROFILE, "project_id": "NJ-D"})
    assert r.status_code == 200 and r.json()["mode"] == "mock"
    r = client.post("/api/team/savings/roadmap",
                    json={"profile": DEMO_PROFILE, "project_ids": ["NJ-D", "GJ-D"]})
    body = r.json()
    assert r.status_code == 200 and len(body["totals"]) == 2


def test_route_data_hides_company_names():
    body = client.get("/api/team/savings/data").json()
    assert len(body["projects"]) == 12
    assert all("company" not in p for p in body["projects"])


# --------------------------------------------- review fixes (10/30 20:50)

def test_driving_licence_is_not_a_car():
    p = pp.keyword_profile("운전면허 2종 보유, 광주 본가, Java")["profile"]
    assert p.has_car is False
    assert pp.keyword_profile("자차로 출퇴근 가능")["profile"].has_car is True


def test_ascii_keywords_need_word_boundaries():
    p = pp.keyword_profile("5pm meeting, interest in building quizzes")["profile"]
    assert p.skills == ()
    assert pp.keyword_profile("REST API를 만들었다")["profile"].skills == ("백엔드 API",)


def test_empty_skill_line_falls_back():
    assert pp.parse_profile("기술: 없음\n조건: 거주=광주 본가") is None


def test_manwon_rounding_and_sign():
    assert pp._manwon(12_500) == "1.3만원"
    assert pp._manwon(-400) == "0.0만원"
    assert pp._manwon(-677_400) == "-67.7만원"


def test_full_city_name_is_normalized():
    profile = {**DEMO_PROFILE, "home_city": "광주광역시"}
    r = client.post("/api/team/savings/compare", json={"profile": profile, "project_id": "NJ-D"})
    assert r.json()["jeonnam"]["housing"] == "본가"
