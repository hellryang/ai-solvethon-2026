"""저장소 구조 검사 — 루트에 생긴 새 파일, 커밋되면 안 되는 파일, 큰 파일을 찾는다.

실행: python scripts/check_structure.py
CI(.github/workflows/ci.yml)와 Kiro hook(.kiro/hooks/structure-check.json)이 같은 스크립트를 쓴다.
루트 허용 목록을 늘리려면 이 파일을 고치는 PR을 올린다. 팀 전원이 보도록 하기 위해서다.
"""

import subprocess
import sys
from pathlib import Path

ROOT_ALLOWED = {
    "README.md",
    "LICENSE",
    ".gitignore",
    ".gitattributes",
    ".env.example",
    ".github",
    ".kiro",
    "frontend",
    "backend",
    "infra",
    "docs",
    "scripts",
}
FORBIDDEN_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".pem", ".key", ".pfx", ".zip"}
MAX_BYTES = 5 * 1024 * 1024


def candidate_files() -> list[Path]:
    """커밋됐거나 커밋될 수 있는 파일. .gitignore에 걸린 scratch/·node_modules/는 빠진다."""
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return [Path(line) for line in result.stdout.splitlines() if line]


def find_problems(path: Path) -> list[str]:
    problems = []
    if path.parts[0] not in ROOT_ALLOWED:
        problems.append("루트에 허용되지 않은 항목 → .kiro/steering/structure.md 표를 보고 옮기세요 (일회성이면 scratch/)")
    if path.name.startswith(".env") and path.name != ".env.example":
        problems.append("환경변수 파일은 커밋 금지 → .gitignore 확인")
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        problems.append(f"{path.suffix} 파일은 커밋 금지 (DB·키·압축 파일)")
    if path.is_file() and path.stat().st_size > MAX_BYTES:
        problems.append(f"{MAX_BYTES // 1024 // 1024}MB 초과 → S3에 올리고 링크로 대체")
    return problems


def main() -> int:
    # Windows에서 출력이 파이프로 넘어가면(Kiro hook) cp949가 쓰인다. 인코딩 못 하는 글자로 죽지 않게 한다
    sys.stdout.reconfigure(errors="replace")
    try:
        files = candidate_files()
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        print(f"git 저장소 루트에서 실행하세요: {error}", file=sys.stderr)
        return 2

    violations = [(path, problem) for path in files for problem in find_problems(path)]
    if not violations:
        print(f"구조 검사 통과 ({len(files)}개 파일)")
        return 0

    print(f"구조 검사 실패: {len(violations)}건")
    for path, problem in violations:
        print(f"  {path.as_posix()}: {problem}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
