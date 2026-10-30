"""Regional stack demand versus the talent's own skills (design.md section 14.6).

Pure functions over the STACK_DEMAND shape of region_data. A share that is still
None is passed through as None: nothing is estimated (R10.5).
"""

from __future__ import annotations

from typing import Any, Mapping

TOP_N = 10
OK_LEVEL = 3  # initial threshold: level 3 or more counts as "ok"


def skill_status(level: int) -> str:
    """none (not held), low (1-2), ok (3 or more)."""
    if level <= 0:
        return "none"
    return "low" if level < OK_LEVEL else "ok"


def stack_gap(
    demand: Mapping[str, Any],
    my_levels: Mapping[str, int],
    group: str,
    top_n: int = TOP_N,
    small_sample_n: int = 10,
) -> dict[str, Any]:
    """Demand ranking of one company-type group with the talent's level per skill.

    Items are sorted by share descending (None last), then by skill name, and cut to
    `top_n`. `my_levels` maps a skill name to the talent's level (missing means 0);
    names are compared ignoring case. `data_ready` is False when no share is known.
    """
    block = demand["groups"].get(group, {"sample_n": None, "skills": {}})
    metro = demand.get("metro", {"sample_n": None, "skills": {}})
    levels = {name.strip().casefold(): level for name, level in my_levels.items()}
    metro_shares = {name.strip().casefold(): share for name, share in metro["skills"].items()}

    skills: Mapping[str, int | None] = block["skills"]
    ordered = sorted(
        skills.items(),
        key=lambda kv: (kv[1] is None, -(kv[1] or 0), kv[0]),
    )[:top_n]

    sample_n = block["sample_n"]
    items = []
    for skill, share in ordered:
        level = levels.get(skill.strip().casefold(), 0)
        items.append({
            "skill": skill,
            "share_pct": share,
            "metro_share_pct": metro_shares.get(skill.strip().casefold()),
            "my_level": level,
            "status": skill_status(level),
        })
    return {
        "group": group,
        "sample_n": sample_n,
        "small_sample": sample_n is not None and sample_n < small_sample_n,
        "data_ready": any(share is not None for share in skills.values()),
        "metro_sample_n": metro.get("sample_n"),
        "metro_label": metro.get("label"),
        "collected_at": demand.get("collected_at"),
        "source": demand.get("source"),
        "is_assumption": demand.get("is_assumption", True),
        "items": items,
    }
