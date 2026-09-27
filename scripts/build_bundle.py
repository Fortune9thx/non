#!/usr/bin/env python3
"""
Bundles contracts/non_lib.py into contracts/Non.py to produce
build/Non.bundled.py -- the ONE file the network actually receives
(sibling imports fail contract validation).

The first line of the output MUST stay a bare `# { "Depends": ... }`
comment with nothing above it, so it is split off before the AST pass and
re-prepended afterwards (ast.unparse never re-emits comments).

Usage:  python scripts/build_bundle.py
Output: build/Non.bundled.py
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB_PATH = ROOT / "contracts" / "non_lib.py"
CONTRACT_PATH = ROOT / "contracts" / "Non.py"
OUT_DIR = ROOT / "build"
OUT_PATH = OUT_DIR / "Non.bundled.py"

BEGIN_MARKER = "# BEGIN NON_LIB INLINE"
END_MARKER = "# END NON_LIB INLINE"

# Documented Studio deploy-size ceiling observed across prior GenLayer
# projects. This is a PLATFORM/RPC payload ceiling, not GenVM's own
# contract size limit -- they are separate numbers.
MAX_BUNDLE_BYTES = 52224


def _strip_lib_source(lib_source: str) -> str:
    """Removes non_lib.py's module docstring and the imports the bundle
    header already provides once at top level."""
    text = lib_source
    docstring_match = re.match(r'\s*""".*?"""\s*', text, flags=re.DOTALL)
    if docstring_match:
        text = text[docstring_match.end():]

    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("from __future__ import"):
            continue
        if stripped in ("import json", "import re"):
            continue
        if stripped == "from typing import NoReturn":
            continue
        kept.append(line)
    return "\n".join(kept).strip("\n") + "\n"


class _DocstringStripper(ast.NodeTransformer):
    """Drops docstrings and other bare string-literal statements so the
    deployed bundle carries no prose. Semantics are untouched."""

    def _strip_body(self, body: list) -> list:
        new_body = []
        for node in body:
            if (
                isinstance(node, ast.Expr)
                and isinstance(node.value, ast.Constant)
                and isinstance(node.value.value, str)
            ):
                continue
            new_body.append(node)
        return new_body or [ast.Pass()]

    def visit_Module(self, node):
        self.generic_visit(node)
        node.body = self._strip_body(node.body)
        return node

    def visit_ClassDef(self, node):
        self.generic_visit(node)
        node.body = self._strip_body(node.body)
        return node

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        node.body = self._strip_body(node.body)
        return node

    def visit_AsyncFunctionDef(self, node):
        self.generic_visit(node)
        node.body = self._strip_body(node.body)
        return node


def _minify(source: str) -> str:
    tree = ast.parse(source)
    tree = _DocstringStripper().visit(tree)
    ast.fix_missing_locations(tree)
    return ast.unparse(tree)


def build() -> Path:
    for path in (LIB_PATH, CONTRACT_PATH):
        if not path.exists():
            raise SystemExit(f"missing {path}")

    contract_source = CONTRACT_PATH.read_text(encoding="utf-8")
    lib_source = LIB_PATH.read_text(encoding="utf-8")

    if BEGIN_MARKER not in contract_source or END_MARKER not in contract_source:
        raise SystemExit(f"Non.py is missing the {BEGIN_MARKER}/{END_MARKER} markers")

    before, rest = contract_source.split(BEGIN_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)

    bundled = (
        before
        + BEGIN_MARKER
        + " -- inlined by scripts/build_bundle.py, do not hand-edit)\n"
        + _strip_lib_source(lib_source).rstrip("\n")
        + "\n"
        + END_MARKER
        + after
    )

    # non_lib.py uses `re` and typing.NoReturn; make sure the bundle header
    # provides both exactly once.
    head = bundled.split(BEGIN_MARKER)[0]
    if "import re" not in head:
        bundled = bundled.replace(
            "import json\n", "import json\nimport re\nfrom typing import NoReturn\n", 1
        )

    first_line, _, remainder = bundled.partition("\n")
    if not first_line.strip().startswith('# { "Depends"'):
        raise SystemExit("first line of Non.py must be the bare Depends comment")

    bundled = first_line + "\n" + _minify(remainder) + "\n"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(bundled, encoding="utf-8", newline="\n")

    size = len(bundled.encode("utf-8"))
    print(f"Wrote {OUT_PATH} ({size} bytes)")
    if size > MAX_BUNDLE_BYTES:
        print(f"WARNING: bundle exceeds the documented {MAX_BUNDLE_BYTES}-byte "
              f"Studio ceiling by {size - MAX_BUNDLE_BYTES} bytes")
    else:
        print(f"OK: {MAX_BUNDLE_BYTES - size} bytes under the "
              f"{MAX_BUNDLE_BYTES}-byte ceiling")
    return OUT_PATH


if __name__ == "__main__":
    build()
