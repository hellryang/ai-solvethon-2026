"""The real app (app.main) serves the net-savings API the screens call, in screen order."""
from fastapi.testclient import TestClient

from app.main import app

DEMO_INTRO = "광주 본가, 차 없음, 학부 때 Java로 학사관리 웹을 만들어 봤고 상주 근무 괜찮음"


def test_savings_routes_are_mounted_under_api_team():
    with TestClient(app) as client:
        response = client.get("/api/team/savings/data")

    assert response.status_code == 200
    body = response.json()
    assert len(body["projects"]) == 12
    assert all("company" not in p for p in body["projects"])


def test_screen_flow_story_recommend_compare_roadmap():
    with TestClient(app) as client:
        # ① 내 이야기: mock AI is not parseable, so the keyword fallback fills the profile
        parsed = client.post("/api/team/savings/parse", json={"intro": DEMO_INTRO})
        assert parsed.status_code == 200, parsed.text
        profile = parsed.json()["profile"]
        assert "Java" in profile["skills"]

        # ② 추천 3곳
        recommended = client.post("/api/team/savings/recommend", json=profile)
        assert recommended.status_code == 200, recommended.text
        items = recommended.json()["items"]
        assert len(items) == 3
        first_id = items[0]["project"]["id"]

        # ③ 남는 돈 비교 + AI 분석 버튼
        compared = client.post("/api/team/savings/compare",
                               json={"profile": profile, "project_id": first_id})
        assert compared.status_code == 200, compared.text
        assert set(compared.json()["cumulative"]) == {"12", "24", "60"}
        analysis = client.post("/api/team/savings/analysis",
                               json={"profile": profile, "project_id": first_id})
        assert analysis.status_code == 200, analysis.text

        # ④ 준비 로드맵
        roadmap = client.post("/api/team/savings/roadmap",
                              json={"profile": profile, "project_ids": [first_id]})
        assert roadmap.status_code == 200, roadmap.text
        assert roadmap.json()["totals"][0]["project_id"] == first_id
