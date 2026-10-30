"""기업이 보는 인재 PR: /api/team/pr/... (목록·상세·사진 + 본인이 만들기·고치기·지우기).

No login: whoever creates a profile gets an edit token once and must send it back in
the X-Edit-Token header to change or delete it. Storage is in memory (talent_pr.py).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field, StringConstraints

from . import talent_pr as tp

router = APIRouter(prefix="/pr", tags=["talent-pr"])

MemberType = Literal["개인", "팀"]
WorkMode = Literal["상주", "재택"]
Level = Literal["초급", "중급", "고급"]
Region = Literal["광주", "나주", "광양", "전남 기타"]
Sort = Literal["career", "projects", "recent"]
SkillText = Annotated[str, StringConstraints(max_length=30)]
# A 300 KB image is about 400 KB as base64.
ImageDataUrl = Annotated[str, StringConstraints(max_length=420_000)]


class PRIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
    headline: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    intro: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    skills: list[SkillText] = Field(default_factory=list, max_length=tp.MAX_SKILLS * 2)
    career_years: int = Field(default=0, ge=0, le=40)
    project_count: int = Field(default=0, ge=0, le=200)
    member_type: MemberType = "개인"
    work_modes: list[WorkMode] = Field(default_factory=lambda: ["상주"], min_length=1, max_length=2)
    level: Level = "초급"
    regions: list[Region] = Field(default_factory=list, max_length=4)
    available_from: date | None = None
    images: list[ImageDataUrl] = Field(default_factory=list, max_length=tp.MAX_IMAGES)

    def to_fields(self) -> dict[str, Any]:
        try:
            images = tuple(tp.decode_image(url) for url in self.images)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {
            "name": self.name, "headline": self.headline, "intro": self.intro,
            "skills": tp.clean_skills(self.skills), "career_years": self.career_years,
            "project_count": self.project_count, "member_type": self.member_type,
            "work_modes": tuple(dict.fromkeys(self.work_modes)), "level": self.level,
            "regions": tuple(dict.fromkeys(self.regions)), "available_from": self.available_from,
            "images": images,
        }


def _public(p: tp.TalentPR) -> dict[str, Any]:
    """회사 화면용. 이름은 성만, 편집 토큰은 절대 내보내지 않는다."""
    return {
        "id": p.id, "display_name": tp.masked_name(p.name), "headline": p.headline, "intro": p.intro,
        "skills": list(p.skills), "career_years": p.career_years, "project_count": p.project_count,
        "member_type": p.member_type, "work_modes": list(p.work_modes), "level": p.level,
        "regions": list(p.regions),
        "available_from": p.available_from.isoformat() if p.available_from else None,
        "image_urls": [f"/api/team/pr/{p.id}/images/{i}?v={p.version}" for i in range(len(p.images))],
        "is_sample": p.is_sample,
    }


def _get(pr_id: int) -> tp.TalentPR:
    try:
        return tp.STORE.get(pr_id)
    except tp.NotFound:
        raise HTTPException(404, "PR을 찾을 수 없습니다.") from None


@router.get("")
def list_profiles(
    q: Annotated[str | None, Query(max_length=50)] = None,
    member_type: MemberType | None = None,
    work_mode: WorkMode | None = None,
    level: Level | None = None,
    region: Region | None = None,
    sort: Sort = "career",
) -> dict[str, Any]:
    items = tp.STORE.search(q=q, member_type=member_type, work_mode=work_mode, level=level,
                            region=region, sort=sort)
    return {
        "items": [_public(p) for p in items],
        "options": {"member_types": list(tp.MEMBER_TYPES), "work_modes": list(tp.WORK_MODES),
                    "levels": list(tp.LEVELS), "regions": list(tp.REGIONS)},
    }


@router.get("/{pr_id}")
def get_profile(pr_id: int) -> dict[str, Any]:
    return _public(_get(pr_id))


@router.get("/{pr_id}/images/{index}")
def get_image(pr_id: int, index: int) -> Response:
    images = _get(pr_id).images
    if not 0 <= index < len(images):
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    image = images[index]
    # The URL carries ?v=<version>, so a changed profile gets a new URL.
    return Response(content=image.data, media_type=image.mime,
                    headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})


@router.post("", status_code=201)
def create_profile(body: PRIn) -> dict[str, Any]:
    try:
        profile = tp.STORE.create(body.to_fields())
    except tp.StoreFull:
        raise HTTPException(409, "시연용 저장 공간이 찼습니다. 서버를 다시 켜면 비워집니다.") from None
    # The token is shown only once; the browser keeps it to edit this profile later.
    return {**_public(profile), "edit_token": profile.edit_token}


@router.put("/{pr_id}")
def update_profile(pr_id: int, body: PRIn,
                   x_edit_token: Annotated[str, Header(max_length=64)] = "") -> dict[str, Any]:
    fields = body.to_fields()
    try:
        return _public(tp.STORE.update(pr_id, x_edit_token, fields))
    except tp.NotFound:
        raise HTTPException(404, "PR을 찾을 수 없습니다.") from None
    except tp.Forbidden:
        raise HTTPException(403, "이 PR을 만든 브라우저에서만 고칠 수 있습니다.") from None


@router.delete("/{pr_id}", status_code=204)
def delete_profile(pr_id: int, x_edit_token: Annotated[str, Header(max_length=64)] = "") -> Response:
    try:
        tp.STORE.delete(pr_id, x_edit_token)
    except tp.NotFound:
        raise HTTPException(404, "PR을 찾을 수 없습니다.") from None
    except tp.Forbidden:
        raise HTTPException(403, "이 PR을 만든 브라우저에서만 지울 수 있습니다.") from None
    return Response(status_code=204)
