"""AI prompts and line parsing for the three AI features.

AI output is line text ("기술: ..."), not JSON: 256 tokens can cut JSON short.
The ① instruction and parsing rules were verified 10/10 on the team server
(`.kiro/specs/net-savings-match/verification.md`). Numbers in ② and ③ are
always passed in by the code; the AI is told not to invent any.
"""

from __future__ import annotations

import re
from typing import Any

from . import savings_data as d
from .savings import Profile, round_half_up

MODEL_ID = "global.anthropic.claude-sonnet-4-6"  # Claude 5 models 502 on the shared temperature

INSTRUCTION_PARSE = (
    "자기소개를 읽고 아래 4줄만 쓰세요. 마크다운 금지. 기술: 함께 준 목록에서만 최대 5개, 쉼표로 구분. "
    "확장: 이 경험으로 할 수 있는 목록 속 기술 최대 3개. 조건: 거주=시군명과 본가·자취·모름 중 하나, "
    "차량=있음/없음, 근무=상주/재택/무관 (예: 조건: 거주=광주 본가, 차량=없음, 근무=상주). "
    "근거: 한 문장. 입력에 없는 사실은 쓰지 마세요."
)
INSTRUCTION_ANALYSIS = (
    "사용자 조건, 회사 정보, 계산된 금액을 보고 정확히 3줄로 쓰세요. 마크다운 금지. "
    "맞는 점: 금액 말고 기술 성장·경력·생활 측면에서 한 문장. 아쉬운 점: 한 문장. 판단: 한 문장. "
    "금액은 주어진 숫자만 그대로 쓰고 새 숫자를 만들지 마세요."
)
INSTRUCTION_ROADMAP = (
    "선택한 회사들의 필요 기술과 사용자 기술을 비교해 정확히 4줄로 쓰세요. 마크다운 금지. "
    "1개월: 할 일. 3개월: 할 일. 6개월: 할 일. 경력: 이 회사에서 1년 일하면 얻는 것 한 문장. "
    "주어진 정보에 없는 회사 사실과 숫자는 쓰지 마세요."
)

MAX_SKILLS = 5
MAX_EXTENDED = 3
_STRIP = re.compile(r"^[\s\-*#`>]*(?:\d+[.)]\s*)?")
_CONDITION = re.compile(r"(거주|차량|근무)\s*=\s*([^,，]+)")

# Fallback when the AI call fails or the reply cannot be parsed.
KEYWORDS: dict[str, tuple[str, ...]] = {
    "Java": ("java", "자바"),
    "Spring": ("spring", "스프링"),
    "전자정부 표준프레임워크": ("전자정부", "egov"),
    "Python": ("python", "파이썬", "판다스", "pandas"),
    "웹 프론트엔드": ("react", "리액트", "vue", "프론트", "html", "웹"),
    "백엔드 API": ("rest", "api", "백엔드", "fastapi", "django"),
    "데이터베이스": ("sql", "mysql", "db", "데이터베이스", "oracle"),
    "데이터 분석": ("분석", "통계", "엑셀"),
    "데이터 시각화": ("시각화", "대시보드", "tableau"),
    "머신러닝": ("머신러닝", "machine learning", "lstm", "xgboost", "딥러닝"),
    "컴퓨터 비전": ("yolo", "비전", "이미지", "opencv"),
    "자연어 처리": ("자연어", "nlp", "rag", "챗봇"),
    "생성형 AI 활용": ("llm", "gpt", "생성형", "프롬프트", "claude"),
    "시계열 예측": ("시계열", "예측", "lstm"),
    "IoT 센서": ("iot", "센서", "아두이노", "라즈베리"),
    "임베디드": ("임베디드", "아두이노", "라즈베리", "펌웨어", "plc"),
    "모바일 앱": ("android", "ios", "앱", "flutter", "kotlin"),
    "클라우드 배포": ("aws", "docker", "배포", "클라우드"),
    "UI/UX 디자인": ("figma", "피그마", "ui", "ux"),
    "서비스 기획": ("기획", "pm"),
    "고객 인터뷰": ("인터뷰", "사용자 조사"),
    "문서화": ("문서", "보고서"),
    "데이터 라벨링": ("라벨링", "어노테이션"),
}
CITY_WORDS = ("광주", "나주", "광양", "순천", "여수", "목포", "담양", "화순", "서울")
CAR_YES = ("차 있", "차량 있", "자차", "차를 보유", "차 보유")  # "운전" alone would match 운전면허
CAR_NO = ("차 없", "차량 없", "뚜벅")


def _has_word(low: str, word: str) -> bool:
    """ASCII keywords need word boundaries ("pm" must not match "5pm")."""
    if word.isascii():
        return re.search(rf"(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])", low) is not None
    return word in low


def normalize_city(value: str | None) -> str | None:
    """'광주광역시' -> '광주'. Unknown names stay None so the code treats them as 모름."""
    if not value:
        return None
    return next((c for c in CITY_WORDS if c in value), None)


def build_parse_text(intro: str) -> str:
    return f"기술 목록: {', '.join(d.SKILLS)}\n자기소개: {intro.strip()}"


def _clean_lines(text: str) -> dict[str, str]:
    """빈 줄 건너뜀 → 마크다운·번호 제거 → 첫 ':'로 나눔."""
    fields: dict[str, str] = {}
    for raw in text.splitlines():
        line = _STRIP.sub("", raw).replace("*", "").replace("`", "").strip()
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        fields.setdefault(key.strip(), value.strip())
    return fields


def _skills(value: str, limit: int) -> tuple[str, ...]:
    picked = [s.strip() for s in re.split(r"[,，/]", value)]
    known = [s for s in picked if s in d.SKILLS]  # drop anything outside the dictionary
    return tuple(dict.fromkeys(known))[:limit]


def _residence(value: str) -> tuple[str | None, str]:
    city = normalize_city(value)
    housing = "본가" if "본가" in value else "자취" if "자취" in value else "모름"
    return city, housing


def parse_profile(ai_text: str) -> dict[str, Any] | None:
    """AI ① 응답 -> Profile 값. 기술 줄이 없으면 None (키워드 대체로 넘어간다)."""
    fields = _clean_lines(ai_text)
    if "기술" not in fields:
        return None
    conditions = dict(_CONDITION.findall(fields.get("조건", "")))
    city, housing = _residence(conditions.get("거주", ""))
    skills = _skills(fields["기술"], MAX_SKILLS)
    if not skills:
        return None  # empty or "없음": let the keyword fallback try
    extended = tuple(s for s in _skills(fields.get("확장", ""), MAX_EXTENDED) if s not in skills)
    work = conditions.get("근무", "").strip()
    return {
        "profile": Profile(
            home_city=city, housing=housing,
            has_car=conditions.get("차량", "").strip().startswith("있"),
            work_mode=work if work in ("상주", "재택", "무관") else "무관",
            skills=skills, extended=extended,
        ),
        "rationale": fields.get("근거", ""),
    }


def keyword_profile(intro: str) -> dict[str, Any]:
    """AI 없이 키워드로 뽑는다. 확장 기술은 비운다."""
    low = intro.lower()
    skills = tuple(s for s, words in KEYWORDS.items()
                   if any(_has_word(low, w) for w in words))[:MAX_SKILLS]
    city, housing = _residence(intro)
    has_car = any(w in intro for w in CAR_YES) and not any(w in intro for w in CAR_NO)
    work = "재택" if "재택" in intro else "상주" if "상주" in intro or "출근" in intro else "무관"
    return {"profile": Profile(home_city=city, housing=housing, has_car=has_car,
                               work_mode=work, skills=skills),
            "rationale": "AI 응답을 받지 못해 키워드로 추출했습니다"}


def parse_lines(ai_text: str, keys: tuple[str, ...]) -> dict[str, str] | None:
    """②③ 응답에서 정해진 줄만 꺼낸다. 하나라도 없으면 None."""
    fields = _clean_lines(ai_text)
    if not all(k in fields for k in keys):
        return None
    return {k: fields[k] for k in keys}


def _manwon(won: int) -> str:
    """Same half-up rounding as the money code; never prints -0.0."""
    tenths = round_half_up(abs(won) / 1_000)
    sign = "-" if won < 0 and tenths else ""
    return f"{sign}{tenths / 10:.1f}만원"


def build_analysis_text(profile: Profile, comparison: dict[str, Any], work: str) -> str:
    j, s = comparison["jeonnam"], comparison["seoul"]
    return "\n".join([
        f"사용자: 거주 {profile.home_city or '모름'} {profile.housing}, 차량 {'있음' if profile.has_car else '없음'}, "
        f"기술 {', '.join(profile.skills) or '없음'}, 확장 {', '.join(profile.extended) or '없음'}",
        f"회사: {j['display_name']} ({j['place']}), 업무: {work}",
        f"전남 월 남는 돈: {_manwon(j['savings'])} (거주 {j['housing']}, 월세 {_manwon(j['rent'])})",
        f"같은 일 서울 공고({s['place']}) 월 남는 돈: {_manwon(s['savings'])} (월세 {_manwon(s['rent'])})",
        f"차이: 월 {_manwon(comparison['advantage_monthly'])}, 5년 누적 전남 "
        f"{_manwon(comparison['cumulative']['60']['jeonnam'])} / 서울 {_manwon(comparison['cumulative']['60']['seoul'])}",
    ])


def build_roadmap_text(profile: Profile, picks: list[dict[str, Any]]) -> str:
    lines = [f"사용자 기술: {', '.join(profile.skills) or '없음'}"]
    for rank, p in enumerate(picks, 1):
        lines.append(f"{rank}순위 {p['display_name']} ({p['place']}): 업무 {p['work']}, "
                     f"필요 기술 {', '.join(p['skills'])}")
    return "\n".join(lines)
