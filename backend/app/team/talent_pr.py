"""Self-PR profiles that companies browse (기업이 보는 인재 PR).

Kept in memory on purpose (10/30 decision: no new DB table). Profiles made on the
site disappear when the server restarts; the sample profiles are fake people
(가상 인물, allowed by the organizers) and always exist. Images arrive as data URLs
in JSON (no multipart) and are checked by type, size and magic bytes.
Skills are free text written by the person, not picked from the savings dictionary.
"""

from __future__ import annotations

import base64
import binascii
import hmac
import re
import secrets
import threading
from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import date
from typing import Any

MEMBER_TYPES = ("개인", "팀")
WORK_MODES = ("상주", "재택")
LEVELS = ("초급", "중급", "고급")
REGIONS = ("광주", "나주", "광양", "전남 기타")
MAX_SKILLS = 12
MAX_IMAGES = 3
MAX_IMAGE_BYTES = 300_000
MAX_USER_PROFILES = 30  # memory guard: at most about 30 x 3 x 300 KB of images

_DATA_URL = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$")
_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n", "image/webp": b"RIFF"}


@dataclass(frozen=True)
class Image:
    mime: str
    data: bytes


@dataclass(frozen=True)
class TalentPR:
    id: int
    name: str
    headline: str
    intro: str
    skills: tuple[str, ...]
    career_years: int
    project_count: int
    member_type: str
    work_modes: tuple[str, ...]
    level: str
    regions: tuple[str, ...]
    available_from: date | None
    images: tuple[Image, ...] = ()
    is_sample: bool = False
    version: int = 1
    edit_token: str = ""  # empty for samples, so they can never be edited


class NotFound(Exception):
    pass


class Forbidden(Exception):
    pass


class StoreFull(Exception):
    pass


def masked_name(name: str) -> str:
    """'이혜량' -> '이**'. 회사 화면에는 성만 보인다."""
    name = name.strip()
    return f"{name[:1]}**" if name else "**"


def decode_image(data_url: str) -> Image:
    """data:image/...;base64,... -> Image. Raises ValueError with a user-facing message."""
    match = _DATA_URL.match(data_url)
    if not match:
        raise ValueError("JPEG·PNG·WEBP 이미지만 올릴 수 있습니다.")
    mime, payload = match.groups()
    try:
        data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("이미지 데이터가 올바르지 않습니다.") from exc
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError(f"이미지 한 장은 {MAX_IMAGE_BYTES // 1000}KB 이하여야 합니다.")
    if not data.startswith(_MAGIC[mime]) or (mime == "image/webp" and data[8:12] != b"WEBP"):
        raise ValueError("이미지 내용이 파일 형식과 다릅니다.")
    return Image(mime, data)


def clean_skills(skills: Iterable[str]) -> tuple[str, ...]:
    """공백 정리, 빈 값 제거, 대소문자를 무시한 중복 제거, 최대 12개."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in skills:
        skill = " ".join(raw.split())
        if skill and skill.casefold() not in seen:
            seen.add(skill.casefold())
            result.append(skill)
    return tuple(result[:MAX_SKILLS])


_SORT_KEYS = {
    "career": lambda p: (-p.career_years, -p.project_count, p.id),
    "projects": lambda p: (-p.project_count, -p.career_years, p.id),
    "recent": lambda p: (-p.id,),
}
SORTS = tuple(_SORT_KEYS)


class TalentStore:
    def __init__(self, samples: Iterable[TalentPR]) -> None:
        self._lock = threading.Lock()
        self._items: dict[int, TalentPR] = {p.id: p for p in samples}
        self._next_id = max(self._items, default=0) + 1

    def get(self, pr_id: int) -> TalentPR:
        try:
            return self._items[pr_id]
        except KeyError:
            raise NotFound from None

    def search(self, *, q: str | None = None, member_type: str | None = None, work_mode: str | None = None,
               level: str | None = None, region: str | None = None, sort: str = "career") -> list[TalentPR]:
        items = list(self._items.values())
        if q and q.strip():
            needle = q.strip().casefold()
            items = [p for p in items if needle in " ".join((p.headline, p.intro, *p.skills)).casefold()]
        if member_type:
            items = [p for p in items if p.member_type == member_type]
        if work_mode:
            items = [p for p in items if work_mode in p.work_modes]
        if level:
            items = [p for p in items if p.level == level]
        if region:
            items = [p for p in items if region in p.regions]
        return sorted(items, key=_SORT_KEYS[sort])

    def create(self, fields: dict[str, Any]) -> TalentPR:
        with self._lock:
            if sum(1 for p in self._items.values() if not p.is_sample) >= MAX_USER_PROFILES:
                raise StoreFull
            profile = TalentPR(id=self._next_id, edit_token=secrets.token_urlsafe(16), **fields)
            self._items = {**self._items, profile.id: profile}
            self._next_id += 1
            return profile

    def update(self, pr_id: int, token: str, fields: dict[str, Any]) -> TalentPR:
        with self._lock:
            current = self._owned(pr_id, token)
            updated = replace(current, **fields, version=current.version + 1)
            self._items = {**self._items, pr_id: updated}
            return updated

    def delete(self, pr_id: int, token: str) -> None:
        with self._lock:
            self._owned(pr_id, token)
            self._items = {k: v for k, v in self._items.items() if k != pr_id}

    def _owned(self, pr_id: int, token: str) -> TalentPR:
        current = self.get(pr_id)
        if not current.edit_token or not hmac.compare_digest(current.edit_token, token):
            raise Forbidden
        return current


def _sample(pr_id: int, name: str, headline: str, intro: str, skills: tuple[str, ...], career: int,
            projects: int, member_type: str, work_modes: tuple[str, ...], level: str,
            regions: tuple[str, ...], available: str) -> TalentPR:
    return TalentPR(
        id=pr_id, name=name, headline=headline, intro=intro, skills=skills, career_years=career,
        project_count=projects, member_type=member_type, work_modes=work_modes, level=level,
        regions=regions, available_from=date.fromisoformat(available), is_sample=True,
    )


# Fake people for the demo. Every number here is invented and the screen labels them "예시".
SAMPLES: tuple[TalentPR, ...] = (
    _sample(1, "이**", "Java·Spring으로 학사관리 웹을 만든 신입 백엔드 개발자",
            "학부 팀 프로젝트에서 Spring Boot와 MySQL로 수강 신청·성적 조회 기능을 맡았습니다. "
            "광주 본가에서 다닐 수 있는 상주 근무를 찾고 있습니다.",
            ("Java", "Spring", "MySQL", "JSP", "Git"), 0, 3, "개인", ("상주",), "초급",
            ("광주", "나주"), "2026-11-16"),
    _sample(2, "박**", "공공기관 홈페이지를 2년 유지보수한 전자정부프레임워크 개발자",
            "지역 SI에서 전자정부 표준프레임워크와 Oracle로 공공기관 홈페이지 기능 개선을 해 왔습니다.",
            ("전자정부 표준프레임워크", "Java", "Oracle", "jQuery", "JSP"), 2, 6, "개인", ("상주", "재택"),
            "중급", ("광주",), "2026-12-01"),
    _sample(3, "김**", "설비 센서 데이터를 모아 본 임베디드·IoT 개발자",
            "아두이노와 PLC로 공장 설비 온도·진동 데이터를 수집하는 졸업작품을 만들었습니다. 광양 현장 근무 가능합니다.",
            ("C", "임베디드", "IoT 센서", "PLC", "Python"), 1, 4, "개인", ("상주",), "초급",
            ("광양", "전남 기타"), "2026-11-23"),
    _sample(4, "정**", "LLM 상담 챗봇을 만든 4인 팀",
            "RAG로 민원 상담 챗봇을 만들어 교내 경진대회에서 시연했습니다. 기획부터 배포까지 팀으로 함께합니다.",
            ("Python", "FastAPI", "RAG", "생성형 AI", "React"), 0, 2, "팀", ("재택",), "초급",
            ("광주",), "2026-11-16"),
    _sample(5, "최**", "전력 사용량 데이터를 3년째 분석·시각화하는 데이터 분석가",
            "Python과 SQL로 수요 예측 모델과 대시보드를 만들어 왔습니다.",
            ("Python", "SQL", "데이터 분석", "시계열 예측", "Tableau"), 3, 9, "개인", ("상주",), "고급",
            ("나주",), "2026-12-07"),
    _sample(6, "한**", "피그마 화면 설계부터 React 구현까지 하는 프론트엔드 개발자",
            "공공 서비스 화면을 피그마로 설계하고 React·TypeScript로 구현한 경험이 있습니다.",
            ("React", "TypeScript", "Figma", "UI/UX 디자인", "HTML/CSS"), 1, 5, "개인", ("상주", "재택"),
            "중급", ("광주",), "2026-11-30"),
)

STORE = TalentStore(SAMPLES)
