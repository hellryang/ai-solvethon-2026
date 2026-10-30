"""Preference match: how well a posting fits a talent's taste (design.md section 14.4).

Pure functions. No database, no AI, no clock: the same input always gives the same
score and order (R15.4). An empty preference list means "no preference" and earns
the full points of that component, so empty preferences give 100 for every posting.

The score is separate from the skill fit of scoring.py: the caller computes the
fit total and passes it in for tie-breaking only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

W_ORG = 25
W_INDUSTRY = 25
W_STYLE = 20
W_STACK = 30
SIMILAR_THRESHOLD = 50  # initial value, tune with the seed data (design.md 14.4)
NO_FAVORITE_RANK = 99


@dataclass(frozen=True)
class Prefs:
    org_types: tuple[str, ...] = ()
    industries: tuple[str, ...] = ()
    style_tags: tuple[str, ...] = ()
    preferred_skills: tuple[str, ...] = ()
    #: company names, highest priority first
    favorite_companies: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProjectView:
    id: int
    company_name: str
    org_type: str
    industry: str
    style_tags: tuple[str, ...] = ()
    #: required and preferred skill names together
    skills: tuple[str, ...] = ()


def _half_up(x: float) -> int:
    return int(x + 0.5)


def _key(name: str) -> str:
    return name.strip().casefold()


def _overlap(wanted: Iterable[str], have: Iterable[str]) -> list[str]:
    """Items of `wanted` (in its order) that also appear in `have`, ignoring case."""
    have_keys = {_key(x) for x in have}
    return [w for w in wanted if _key(w) in have_keys]


def preference_score(prefs: Prefs, project: ProjectView) -> dict[str, Any]:
    """Return {total, org_type, industry, style, stack, matched} (total is 0..100)."""
    if prefs.org_types:
        matched_orgs = [project.org_type] if project.org_type in prefs.org_types else []
        org = W_ORG if matched_orgs else 0
    else:
        matched_orgs, org = [], W_ORG

    if prefs.industries:
        matched_industries = [project.industry] if project.industry in prefs.industries else []
        industry = W_INDUSTRY if matched_industries else 0
    else:
        matched_industries, industry = [], W_INDUSTRY

    if prefs.style_tags:
        matched_styles = [t for t in prefs.style_tags if t in project.style_tags]
        style = _half_up(W_STYLE * len(matched_styles) / len(prefs.style_tags))
    else:
        matched_styles, style = [], W_STYLE

    if prefs.preferred_skills:
        matched_skills = _overlap(prefs.preferred_skills, project.skills)
        stack = _half_up(W_STACK * len(matched_skills) / len(prefs.preferred_skills))
    else:
        matched_skills, stack = [], W_STACK

    return {
        "total": org + industry + style + stack,
        "org_type": org,
        "industry": industry,
        "style": style,
        "stack": stack,
        "matched": {
            "org_types": matched_orgs,
            "industries": matched_industries,
            "style_tags": matched_styles,
            "skills": matched_skills,
        },
    }


def favorite_rank(prefs: Prefs, project: ProjectView) -> int | None:
    """1-based priority if the posting belongs to a favorite company, else None."""
    for index, company in enumerate(prefs.favorite_companies, start=1):
        if company == project.company_name:
            return index
    return None


def _jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    set_a = {_key(x) for x in a}
    set_b = {_key(x) for x in b}
    union = set_a | set_b
    return len(set_a & set_b) / len(union) if union else 0.0


def similarity_to_favorite(
    prefs: Prefs,
    project: ProjectView,
    all_projects: Sequence[ProjectView],
) -> dict[str, Any] | None:
    """Best match against the favorite companies, or None if nothing is similar enough.

    For each favorite company F (not the posting's own company) the reference is F's
    posting with the smallest id. The most similar favorite wins; a tie goes to the
    higher priority. A posting counts as similar at `SIMILAR_THRESHOLD` or more.
    """
    best: dict[str, Any] | None = None
    for company in prefs.favorite_companies:
        if company == project.company_name:
            continue
        candidates = [p for p in all_projects if p.company_name == company]
        if not candidates:
            continue
        ref = min(candidates, key=lambda p: p.id)
        same_org = project.org_type == ref.org_type
        same_industry = project.industry == ref.industry
        shared = _overlap(project.skills, ref.skills)
        similarity = _half_up(
            40 * same_org + 40 * same_industry + 20 * _jaccard(project.skills, ref.skills))
        if best is None or similarity > best["similarity"]:
            best = {
                "company": company,
                "similarity": similarity,
                "same_org_type": same_org,
                "same_industry": same_industry,
                "shared_skills": shared,
            }
    if best is None or best["similarity"] < SIMILAR_THRESHOLD:
        return None
    return best


def rank_matches(
    prefs: Prefs,
    projects: Sequence[ProjectView],
    fit_totals: Mapping[int, int],
    all_projects: Sequence[ProjectView] | None = None,
) -> list[dict[str, Any]]:
    """Score and order `projects` for one talent.

    `fit_totals` maps project id to the skill-fit total of scoring.py (tie-breaker only;
    a missing id counts as 0). `all_projects` is the pool used to find the reference
    posting of each favorite company; it defaults to `projects`.

    Order: favorite company (by priority), preference total, similarity to a favorite,
    fit total (all descending), then project id.
    """
    pool = projects if all_projects is None else all_projects
    rows: list[dict[str, Any]] = []
    for project in projects:
        similar = similarity_to_favorite(prefs, project, pool)
        rows.append({
            "project": project,
            "pref": preference_score(prefs, project),
            "favorite_rank": favorite_rank(prefs, project),
            "similar_to": similar,
            "fit_total": fit_totals.get(project.id, 0),
        })
    rows.sort(key=lambda r: (
        r["favorite_rank"] if r["favorite_rank"] is not None else NO_FAVORITE_RANK,
        -r["pref"]["total"],
        -(r["similar_to"]["similarity"] if r["similar_to"] else 0),
        -r["fit_total"],
        r["project"].id,
    ))
    for rank, row in enumerate(rows, start=1):
        row["rank"] = rank
    return rows
