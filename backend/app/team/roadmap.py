"""③ 준비 로드맵: 부족한 기술 -> 필요 자격증 + 기업별 프로젝트, 두 가지만 개월 순서로 놓는다.

Gaps, certificates and months are code: the same picks always give the same plan.
The AI only names one portfolio project per company; when it fails (or the local
mock answers) a template built from the posting is used instead.
Certificates are suggestions that prove a missing skill, not posting requirements.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import profile_parse as pp
from .project_fit import fit_score
from .savings import Profile

PROJECT_MONTHS = 2  # one portfolio project per company, two months each


@dataclass(frozen=True)
class Certificate:
    name: str
    issuer: str
    months: int  # 준비 기간 가정 (일반적인 학습 기간)
    skills: tuple[str, ...]  # skills in savings_data.SKILLS this certificate shows


# Order breaks ties when two certificates are needed by the same number of companies.
CERTIFICATES: tuple[Certificate, ...] = (
    Certificate("SQLD", "한국데이터산업진흥원", 2, ("데이터베이스",)),
    Certificate("정보처리기사", "한국산업인력공단", 3,
                ("Java", "Spring", "백엔드 API", "웹 프론트엔드", "모바일 앱", "전자정부 표준프레임워크")),
    Certificate("ADsP", "한국데이터산업진흥원", 2, ("데이터 분석", "데이터 시각화")),
    Certificate("빅데이터분석기사", "한국데이터산업진흥원", 3,
                ("머신러닝", "시계열 예측", "컴퓨터 비전", "자연어 처리")),
    Certificate("AICE Associate", "KT", 1, ("생성형 AI 활용",)),
    Certificate("임베디드기사", "한국산업인력공단", 3, ("임베디드", "IoT 센서")),
    Certificate("AWS Certified Cloud Practitioner", "Amazon Web Services", 1, ("클라우드 배포",)),
    Certificate("웹디자인기능사", "한국산업인력공단", 2, ("UI/UX 디자인",)),
)


def skill_gaps(profile: Profile, picks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """회사마다 부족한 기술 (적합도 점수와 같은 기준, docs/calc-criteria.md R11)."""
    gaps = []
    for project in picks:
        fit = fit_score(profile, project)
        gaps.append({
            "project_id": project["id"], "display_name": project["display_name"],
            "owned_hits": fit["owned_hits"], "extended_hits": fit["extended_hits"],
            "missing": fit["missing"],
        })
    return gaps


def parse_ai_projects(ai_text: str, names: tuple[str, ...]) -> dict[str, tuple[str, str]]:
    """'나주 D사: 이름 - 설명' 줄 -> {회사: (이름, 설명)}. 설명이 없으면 빈 문자열."""
    parsed = {}
    for name, value in pp.parse_named_lines(ai_text, names).items():
        title, _, description = value.partition(" - ")
        if title.strip():
            parsed[name] = (title.strip(), description.strip())
    return parsed


def _template_project(project: dict[str, Any], missing: list[str]) -> tuple[str, str]:
    skills = missing or list(project["skills"][:2])
    return (f"{project['work']} 축소판",
            f"{', '.join(skills)}(으)로 핵심 기능 하나를 직접 만들어 저장소에 올립니다.")


def build_plan(picks: list[dict[str, Any]], gaps: list[dict[str, Any]],
               ai_projects: dict[str, tuple[str, str]]) -> dict[str, Any]:
    """Certificates first, one after another from month 1; projects start after the first
    certificate (or at month 1) and run one after another in pick order."""
    needed = []
    for cert in CERTIFICATES:
        covers = [s for s in cert.skills if any(s in g["missing"] for g in gaps)]
        if covers:
            companies = [g["display_name"] for g in gaps if any(s in g["missing"] for s in cert.skills)]
            needed.append((cert, covers, companies))
    needed.sort(key=lambda item: -len(item[2]))  # stable: CERTIFICATES order on ties

    certificates, month = [], 1
    for cert, covers, companies in needed:
        certificates.append({
            "name": cert.name, "issuer": cert.issuer, "covers": covers, "for_companies": companies,
            "start_month": month, "end_month": month + cert.months - 1,
        })
        month += cert.months

    start = certificates[0]["end_month"] + 1 if certificates else 1
    projects = []
    for index, (project, gap) in enumerate(zip(picks, gaps)):
        ai = ai_projects.get(project["display_name"])
        title, description = ai or _template_project(project, gap["missing"])
        first = start + index * PROJECT_MONTHS
        projects.append({
            "project_id": project["id"], "display_name": project["display_name"],
            "title": title, "description": description, "covers": gap["missing"],
            "source": "ai" if ai else "template",
            "start_month": first, "end_month": first + PROJECT_MONTHS - 1,
        })

    return {"gaps": gaps, "certificates": certificates, "projects": projects}
