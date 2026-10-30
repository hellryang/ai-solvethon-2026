"""Static catalogs shared by the team API and the frontend (served by GET /meta).

Pure constants: importing this module has no side effects. The values are plain
strings stored in ordinary text columns, so editing a list here never changes
the database schema (design.md D14).
"""

# Skill tags. The last six are candidates for skills that regional (public
# sector) postings often ask for; the final list is decided from the postings
# the team collects (tasks 0.5).
SKILLS: tuple[str, ...] = (
    "Python", "PyTorch", "TensorFlow", "FastAPI", "SQL", "Docker", "AWS", "Spark",
    "React", "TypeScript", "HTML/CSS", "Figma", "서비스 기획", "데이터 분석",
    "Java", "Spring", "전자정부프레임워크", "MyBatis", "JSP", "Oracle",
)

CATEGORIES: tuple[str, ...] = ("개발", "기획", "퍼블리싱", "디자인", "기타")

# (job family, category). The family is the shared key for same-job comparison.
JOB_FAMILIES: tuple[tuple[str, str], ...] = (
    ("AI 모델링", "개발"),
    ("데이터 엔지니어링", "개발"),
    ("백엔드·API", "개발"),
    ("프론트엔드", "개발"),
    ("서비스 기획", "기획"),
    ("웹 퍼블리싱", "퍼블리싱"),
    ("UI·UX 디자인", "디자인"),
    ("기타", "기타"),
)

# Projects (matching targets) exist only in these three regions.
REGIONS: tuple[str, ...] = ("광주", "나주", "광양")
GWANGJU_DISTRICTS: tuple[str, ...] = ("광산구", "북구", "서구", "남구", "동구")
SEOUL_DISTRICTS: tuple[str, ...] = ("강남구", "영등포구", "중구")  # comparison only
WORK_MODES: tuple[str, ...] = ("상주", "재택", "혼합")

# Company attributes used by the preference match (R14, R15). Initial lists.
ORG_TYPES: tuple[str, ...] = ("공공기관", "대기업·제조", "스타트업·IT", "지역 SI")
INDUSTRIES: tuple[str, ...] = (
    "에너지·전력", "철강·화학", "농업·식품", "자동차·가전", "AI·데이터", "공공행정·SI", "기타",
)
# Subjective tags: shown as assumptions in the UI (A12).
STYLE_TAGS: tuple[str, ...] = (
    "안정 지향", "빠른 성장", "체계적 프로세스", "수평적 문화", "신기술 적극 도입", "워라밸 중시",
)

MAX_STYLE_TAGS = 3
MAX_FAVORITE_COMPANIES = 3


def job_family_category(name: str) -> str | None:
    """Return the category a job family belongs to, or None if unknown."""
    for family, category in JOB_FAMILIES:
        if family == name:
            return category
    return None
