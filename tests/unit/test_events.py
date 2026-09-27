"""
Guards on the contract's event declarations.

Both rules here were learned the hard way, from a live on-chain failure that
no existing test caught, because gltest's direct mode does not reproduce
either one:

1. **At most three indexed fields.** `ABI.EVENT_MAX_TOPICS` is 4 and the
   event signature itself occupies one topic, so a fourth positional
   parameter makes `.emit()` fail on chain with `SystemError: 2: inval`.
   Locally the SDK only issues a `warnings.warn`, so the contract passes
   every local test and then dies on the real network.

2. **Positional parameters must already be in alphabetical order.** The SDK
   builds `indexed_args = tuple(sorted(...))` and then binds values with
   `zip(indexed_args, args)` — sorted *names* against positional *values*.
   If the declared order is not alphabetical, every value is recorded under
   the wrong field name. Nothing raises; the event simply carries wrong data
   forever.

These are parsed from the source rather than imported, because
contracts/Non.py imports `genlayer`, which is not available outside GenVM.
"""

import ast
from pathlib import Path

import pytest

CONTRACT = Path(__file__).resolve().parents[2] / "contracts" / "Non.py"

# ABI.EVENT_MAX_TOPICS (4) minus the one topic taken by the event signature.
MAX_INDEXED_FIELDS = 3


def _event_classes():
    """Every `class X(gl.chain.Event)` in the contract, with the positional
    (indexed) parameter names of its __init__."""
    tree = ast.parse(CONTRACT.read_text(encoding="utf-8"))
    events = []
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        is_event = any(
            isinstance(base, ast.Attribute) and base.attr == "Event"
            for base in node.bases
        )
        if not is_event:
            continue
        for item in node.body:
            if isinstance(item, ast.FunctionDef) and item.name == "__init__":
                indexed = [a.arg for a in item.args.posonlyargs if a.arg != "self"]
                has_blob = item.args.kwarg is not None
                events.append((node.name, indexed, has_blob))
    return events


EVENTS = _event_classes()


def test_contract_declares_events():
    assert EVENTS, "no gl.chain.Event subclasses found — did the file move?"


@pytest.mark.parametrize("name,indexed,has_blob", EVENTS,
                         ids=[e[0] for e in EVENTS])
def test_event_is_within_the_topic_budget(name, indexed, has_blob):
    assert len(indexed) <= MAX_INDEXED_FIELDS, (
        f"{name} declares {len(indexed)} indexed fields; at most "
        f"{MAX_INDEXED_FIELDS} fit alongside the signature topic. Move the "
        f"extras into the keyword blob (add `**blob`), or emit fails on "
        f"chain with SystemError: 2: inval."
    )
    assert not has_blob or indexed, f"{name} should index at least one field"


@pytest.mark.parametrize("name,indexed,has_blob", EVENTS,
                         ids=[e[0] for e in EVENTS])
def test_event_fields_are_declared_in_alphabetical_order(name, indexed, has_blob):
    assert indexed == sorted(indexed), (
        f"{name} declares {indexed} but the SDK binds values to "
        f"{sorted(indexed)} — every field would be recorded under the wrong "
        f"name. Declare the parameters in alphabetical order."
    )


def test_every_event_is_actually_emitted():
    """An event class that is never emitted is dead weight in the bundle,
    and one that is emitted under a stale name is a bug."""
    source = CONTRACT.read_text(encoding="utf-8")
    for name, _indexed, _blob in EVENTS:
        assert f"{name}(" in source.split("class Non(")[1], (
            f"{name} is declared but never emitted"
        )
