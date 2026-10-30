"""Endpoints for the net-savings flow: ① parse → recommend → ② compare/analysis → ③ roadmap.

Thin layer: money comes from `savings`, ranking from `project_fit`, AI text
from the shared `generate_text`. AI is called only by these POST buttons.
Mount it from team/routes.py with `router.include_router(savings_router)`.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..ai_service import generate_text
from . import profile_parse as pp
from . import roadmap as rm
from . import savings_data as d
from .project_fit import fit_score, recommend, seoul_counterpart
from .savings import Profile, car_fixed_monthly, compare

router = APIRouter(prefix="/savings", tags=["savings"])

_JEONNAM = {p["id"]: p for p in d.JEONNAM_PROJECTS}


class ProfileIn(BaseModel):
    home_city: str | None = Field(default=None, max_length=20)
    housing: Literal["본가", "자취", "모름"] = "모름"
    has_car: bool = False
    work_mode: Literal["상주", "재택", "무관"] = "무관"
    skills: list[str] = Field(default_factory=list, max_length=5)
    extended: list[str] = Field(default_factory=list, max_length=3)

    def to_profile(self) -> Profile:
        known = set(d.SKILLS)
        return Profile(home_city=pp.normalize_city(self.home_city), housing=self.housing,
                       has_car=self.has_car, work_mode=self.work_mode,
                       skills=tuple(s for s in self.skills if s in known),
                       extended=tuple(s for s in self.extended if s in known))


class ParseIn(BaseModel):
    intro: str = Field(min_length=1, max_length=1000)


class CompareIn(BaseModel):
    profile: ProfileIn
    project_id: str


class RoadmapIn(BaseModel):
    profile: ProfileIn
    project_ids: list[str] = Field(min_length=1, max_length=3)


def _profile_out(p: Profile) -> dict[str, Any]:
    return {"home_city": p.home_city, "housing": p.housing, "has_car": p.has_car,
            "work_mode": p.work_mode, "skills": list(p.skills), "extended": list(p.extended)}


def _project(project_id: str) -> dict[str, Any]:
    if project_id not in _JEONNAM:
        raise HTTPException(404, "Project not found")
    return _JEONNAM[project_id]


def _public(p: dict[str, Any]) -> dict[str, Any]:
    """Screen shows the masked name; the real company stays out of the response."""
    return {k: (list(v) if isinstance(v, tuple) else v)
            for k, v in p.items() if k not in ("company",)}


@router.get("/data")
def data() -> dict[str, Any]:
    return {
        "skills": list(d.SKILLS),
        "projects": [_public(p) for p in d.JEONNAM_PROJECTS],
        "sources": d.SOURCES,
        "assumptions": {
            "living_cost": d.LIVING_COST_WON, "commute_days": d.COMMUTE_DAYS,
            "car_fixed": car_fixed_monthly(), "age": d.ASSUMED_AGE,
            "notes": ["정비비 제외", "지원금은 추첨·선정제라 보장되지 않음", "회사명은 가림 (출처: 고용24 공고)"],
        },
    }


@router.post("/parse")
def parse(body: ParseIn) -> dict[str, Any]:
    """① AI가 자기소개에서 기술·확장·조건을 뽑는다. 실패하면 키워드로 대체."""
    parsed, source = None, "ai"
    try:
        result = generate_text(pp.build_parse_text(body.intro), pp.INSTRUCTION_PARSE, pp.MODEL_ID)
        parsed = pp.parse_profile(result["text"])
    except HTTPException as exc:
        if exc.status_code < 429:
            raise
    if parsed is None:
        parsed, source = pp.keyword_profile(body.intro), "keyword"
    return {"profile": _profile_out(parsed["profile"]), "rationale": parsed["rationale"],
            "source": source}


@router.post("/recommend")
def recommend_projects(body: ProfileIn) -> dict[str, Any]:
    profile = body.to_profile()
    items = []
    for pick in recommend(profile):
        project = pick["project"]
        seoul = seoul_counterpart(project)
        result = compare(project, seoul, profile)
        items.append({
            "project": _public(project), "fit": pick["fit"],
            "seoul": {"display_name": seoul["display_name"], "place": seoul["place"]},
            "advantage_monthly": result["advantage_monthly"],
            "savings_monthly": result["jeonnam"]["savings"],
            "message": result["message"],
        })
    return {"items": items}


@router.post("/compare")
def compare_project(body: CompareIn) -> dict[str, Any]:
    profile = body.profile.to_profile()
    project = _project(body.project_id)
    seoul = seoul_counterpart(project)
    result = compare(project, seoul, profile)
    return {**result, "project": _public(project), "fit": fit_score(profile, project),
            "seoul_project": _public(seoul)}


@router.post("/analysis")
def analysis(body: CompareIn) -> dict[str, Any]:
    """② 맞는 점 / 아쉬운 점 / 판단. 금액은 코드가 넘긴 숫자만."""
    profile = body.profile.to_profile()
    project = _project(body.project_id)
    result = compare(project, seoul_counterpart(project), profile)
    text = pp.build_analysis_text(profile, result, project["work"])
    reply = generate_text(text, pp.INSTRUCTION_ANALYSIS, pp.MODEL_ID)
    lines = pp.parse_lines(reply["text"], ("맞는 점", "아쉬운 점", "판단"))
    return {"lines": lines, "raw": reply["text"], "mode": reply["mode"]}


@router.post("/roadmap")
def roadmap(body: RoadmapIn) -> dict[str, Any]:
    """③ 1~3순위 -> 부족한 기술, 필요 자격증, 기업별 프로젝트(이름만 AI 1회, 실패하면 템플릿)."""
    profile = body.profile.to_profile()
    picks = [_project(pid) for pid in dict.fromkeys(body.project_ids)]
    gaps = rm.skill_gaps(profile, picks)
    ai_projects: dict[str, tuple[str, str]] = {}
    mode, ai_error = None, None
    try:
        missing = {g["project_id"]: g["missing"] for g in gaps}
        reply = generate_text(pp.build_roadmap_text(profile, picks, missing), pp.INSTRUCTION_ROADMAP, pp.MODEL_ID)
        mode = reply["mode"]
        # The local mock echoes the input back; never show that as an AI answer.
        if mode != "mock":
            ai_projects = rm.parse_ai_projects(reply["text"], tuple(p["display_name"] for p in picks))
    except HTTPException as exc:
        if exc.status_code < 429:
            raise
        ai_error = str(exc.detail)
    plan = rm.build_plan(picks, gaps, ai_projects)
    totals = []
    for p in picks:
        r = compare(p, seoul_counterpart(p), profile)
        totals.append({"project_id": p["id"], "display_name": p["display_name"],
                       "cumulative": r["cumulative"]})
    return {**plan, "mode": mode, "ai_error": ai_error, "totals": totals}
