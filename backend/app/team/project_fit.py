"""Fit score, top-3 recommendation, and the "같은 일 서울 공고" pick.

Integer arithmetic only so ties are exact. Rules: `docs/calc-criteria.md` R11, R12.
"""

from __future__ import annotations

from typing import Any, Iterable

from . import savings_data as d
from .savings import Profile

SKILL_POINTS = 80
CONDITION_POINTS = 20
TOP_N = 3
# Every posting is a regular on-site job (고용24), so 상주·무관 match it.
ONSITE_OK = frozenset({"상주", "무관"})


def fit_score(profile: Profile, project: dict[str, Any]) -> dict[str, Any]:
    """기술 = (보유 일치 + 확장 일치 × 0.5) ÷ 필요 수 × 80, 조건 +20, 소수점 버림 (R11)."""
    required = project["skills"]
    owned = set(profile.skills)
    owned_hits = [s for s in required if s in owned]
    extended_hits = [s for s in required if s in set(profile.extended) and s not in owned]
    skill = (2 * len(owned_hits) + len(extended_hits)) * (SKILL_POINTS // 2) // len(required)
    condition = CONDITION_POINTS if profile.work_mode in ONSITE_OK else 0
    return {"score": skill + condition, "skill_points": skill, "condition_points": condition,
            "owned_hits": owned_hits, "extended_hits": extended_hits,
            "missing": [s for s in required if s not in owned_hits and s not in extended_hits]}


def recommend(profile: Profile, n: int = TOP_N) -> list[dict[str, Any]]:
    """전남·광주 공고만 추천한다. 동점: 보유 일치 많은 순 → 연봉 하한 높은 순 → id (R11)."""
    scored = [(fit_score(profile, p), p) for p in d.JEONNAM_PROJECTS]
    scored.sort(key=lambda sp: (-sp[0]["score"], -len(sp[0]["owned_hits"]),
                                -sp[1]["salary_floor_manwon"], sp[1]["id"]))
    return [{"project": p, "fit": f} for f, p in scored[:n]]


def _jaccard(a: Iterable[str], b: Iterable[str]) -> tuple[int, int]:
    """Exact Jaccard as (intersection, union) for cross-multiplied comparison."""
    sa, sb = set(a), set(b)
    return len(sa & sb), len(sa | sb)


def seoul_counterpart(jeonnam_project: dict[str, Any]) -> dict[str, Any]:
    """같은 일 서울 공고 1곳 (R12).

    기술 일치 수 많은 순 → 기술 구성이 더 비슷한 순(Jaccard) → 서울 연봉 하한 높은 순
    (전남에 불리한 쪽을 골라 '유리한 것만 골랐다'는 지적을 막는다) → 목록 순서.
    연봉 비공개 공고는 후보에서 뺀다.
    """
    need = jeonnam_project["skills"]
    candidates = [s for s in d.SEOUL_PROJECTS
                  if s["salary_floor_manwon"] is not None and s["place"] in d.SEOUL_DISTRICTS]
    if not candidates:
        raise ValueError("no Seoul baseline postings")

    def key(item: tuple[int, dict[str, Any]]):
        order, s = item
        inter, union = _jaccard(need, s["skills"])
        return (-inter, _Ratio(inter, union), -s["salary_floor_manwon"], order)

    return min(enumerate(candidates), key=key)[1]


class _Ratio:
    """Sorts larger fractions first without floating point."""

    __slots__ = ("num", "den")

    def __init__(self, num: int, den: int) -> None:
        self.num, self.den = num, den

    def __lt__(self, other: "_Ratio") -> bool:
        return self.num * other.den > other.num * self.den

    def __eq__(self, other: object) -> bool:
        return isinstance(other, _Ratio) and self.num * other.den == other.num * self.den
