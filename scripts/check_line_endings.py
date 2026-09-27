#!/usr/bin/env python3
"""
Fails if any committed contract source contains a CR byte.

GenVM reads the runner comment off line 1 of the deployed file, and a deploy
can happen from any checkout — the CLI, a Studio paste, someone else's
machine. Keeping the committed bytes identical on every platform removes a
whole class of "it works here" surprise. `.gitattributes` enforces this on
checkout; this check proves it stayed true.

Usage: python scripts/check_line_endings.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECKED_DIRS = ("contracts", "build")
CR = b"\r"


def main() -> int:
    offenders = []
    for directory in CHECKED_DIRS:
        base = ROOT / directory
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.py")):
            if CR in path.read_bytes():
                offenders.append(str(path.relative_to(ROOT)))

    if offenders:
        print("CRLF line endings found in:", file=sys.stderr)
        for name in offenders:
            print(f"  {name}", file=sys.stderr)
        return 1

    print("LF only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
