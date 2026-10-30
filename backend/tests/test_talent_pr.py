"""기업이 보는 인재 PR (메모리 저장): 목록·필터·사진·편집 토큰."""
import base64

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.team import talent_pr as tp

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
PNG_URL = "data:image/png;base64," + base64.b64encode(PNG_1X1).decode()

NEW_PR = {
    "name": "임혜량", "headline": "광주에서 일하고 싶은 백엔드 개발자", "intro": "FastAPI로 챗봇 백엔드를 만들었습니다.",
    "skills": ["FastAPI", " fastapi ", "Python", ""], "career_years": 0, "project_count": 2,
    "member_type": "개인", "work_modes": ["상주", "재택"], "level": "초급", "regions": ["광주"],
    "available_from": "2026-11-16", "images": [PNG_URL],
}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_samples_are_listed_with_masked_names(client):
    body = client.get("/api/team/pr").json()
    assert len(body["items"]) >= len(tp.SAMPLES)
    assert all(item["display_name"].endswith("**") for item in body["items"])
    assert "edit_token" not in body["items"][0]


def test_filters_and_sort(client):
    remote = client.get("/api/team/pr", params={"work_mode": "재택"}).json()["items"]
    assert remote and all("재택" in item["work_modes"] for item in remote)
    by_skill = client.get("/api/team/pr", params={"q": "임베디드"}).json()["items"]
    assert [item["id"] for item in by_skill] == [3]
    careers = [i["career_years"] for i in client.get("/api/team/pr", params={"sort": "career"}).json()["items"]]
    assert careers == sorted(careers, reverse=True)
    assert client.get("/api/team/pr", params={"region": "서울"}).status_code == 422


def test_create_read_image_update_delete(client):
    created = client.post("/api/team/pr", json=NEW_PR)
    assert created.status_code == 201, created.text
    body = created.json()
    token, pr_id = body["edit_token"], body["id"]
    assert body["display_name"] == "임**"
    assert body["skills"] == ["FastAPI", "Python"]  # trimmed, empty dropped, duplicate ignoring case

    image = client.get(body["image_urls"][0])
    assert image.status_code == 200 and image.content == PNG_1X1
    assert image.headers["content-type"] == "image/png"

    changed = {**NEW_PR, "headline": "고친 소개", "images": []}
    assert client.put(f"/api/team/pr/{pr_id}", json=changed).status_code == 403
    updated = client.put(f"/api/team/pr/{pr_id}", json=changed, headers={"X-Edit-Token": token})
    assert updated.status_code == 200 and updated.json()["headline"] == "고친 소개"
    assert updated.json()["image_urls"] == []

    assert client.delete(f"/api/team/pr/{pr_id}").status_code == 403
    assert client.delete(f"/api/team/pr/{pr_id}", headers={"X-Edit-Token": token}).status_code == 204
    assert client.get(f"/api/team/pr/{pr_id}").status_code == 404


def test_samples_cannot_be_edited(client):
    assert client.delete("/api/team/pr/1", headers={"X-Edit-Token": ""}).status_code == 403


def test_bad_images_are_rejected(client):
    for url in ("data:image/gif;base64,R0lGODlh", "data:image/png;base64,bm90LWEtcG5n",
                "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"0" * 300_001).decode()):
        response = client.post("/api/team/pr", json={**NEW_PR, "images": [url]})
        assert response.status_code == 422, url[:30]


def test_store_is_capped():
    store = tp.TalentStore([])
    fields = {k: v for k, v in tp.SAMPLES[0].__dict__.items()
              if k not in ("id", "is_sample", "version", "edit_token")}
    for _ in range(tp.MAX_USER_PROFILES):
        store.create(fields)
    with pytest.raises(tp.StoreFull):
        store.create(fields)
