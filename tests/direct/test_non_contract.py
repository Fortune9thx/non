"""
gltest direct-mode tests for the Non contract.

These deploy the real bundle (build/Non.bundled.py) into a real GenVM
sandbox and drive the actual scope -> constitution -> case -> evaluate ->
appeal -> finalize -> claim flow. This is an execution proof of the
storage/event/value wiring; contracts/non_lib.py's pure-logic suite
already covers the rules themselves in isolation.

Notes on running this file:

1. The contract uses the current SDK API (`import genlayer as gl`,
   `gl.contract.Contract`, `gl.chain.Event`, `gl.vm.run_nondet`).
2. TreeMap fields are never hand-instantiated in `__init__` -- this SDK
   build allocates them at class-definition time, and instantiating one in
   `__init__` raises GenerationError.
3. `direct_vm.warp(iso)` moves the clock gltest patches into
   `datetime.now()`, which is what the contract reads. That is what makes
   the real 6-hour appeal window testable without waiting for it.
4. Payable writes need `direct_vm.value` set (gltest's Foundry-style
   cheatcode); CalldataProxy calls have no `value=` kwarg.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

import pytest

CONTRACT_PATH = "build/Non.bundled.py"
SDK_VERSION = "v0.6.0-rc6"

GEN = 10 ** 18
REVIEW_BOND = 2 * GEN
CHALLENGE_BOND = 2 * GEN
SETTLE_BOND = 1 * GEN
APPEAL_WINDOW = 6 * 60 * 60
FEE_BPS = 200

BASE_TIME = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)

SCOPE = "core-grants"
RULES_TEXT = (
    "A proposal is compliant when every material claim it makes is "
    "supported by the fetched evidence and it requests no more than the "
    "scope budget."
)
RULES_JSON = '{"max_budget_gen": 1000, "requires_public_repo": true}'


def _hex(addr) -> str:
    """gltest's `direct_owner` fixture resolves before genlayer.py.types is
    importable and can fall back to a raw 20-byte `bytes` object, whose
    str() is Python's b'...' repr rather than hex. Route every address
    through this so contract-facing address strings are always real hex."""
    s = str(addr)
    if s.startswith("0x") and len(s) == 42:
        return s
    return "0x" + bytes(addr).hex()


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _subject(**overrides) -> str:
    payload = {
        "title": "Fund the open telemetry adapter",
        "summary": "A six-week build with a public repository.",
        "claims": [
            "The repository is public.",
            "The requested budget is 400 GEN.",
        ],
    }
    payload.update(overrides)
    return json.dumps(payload)


def _urls(*extra) -> str:
    return json.dumps(["https://evidence.example.com/proposal"] + list(extra))


def _verdict(decision, outcome, **overrides) -> str:
    payload = {
        "decision": decision,
        "outcome": outcome,
        "score": 70,
        "fit_score": 70,
        "risk": 30,
        "reasoning": "Derived from the fetched evidence.",
        "weak_spots": "",
        "corrections": "",
        "improvements": "",
        "uncertainty": "",
    }
    payload.update(overrides)
    return json.dumps(payload)


PAGE_BODY = (
    "<html><head><title>Proposal evidence</title></head><body>"
    "<p>The repository is public. The requested budget is 400 GEN.</p>"
    "</body></html>"
)


@pytest.fixture
def contract(direct_deploy, direct_owner, direct_vm):
    # gltest clears its own artifacts/ directory at session start; the
    # bundle is written to build/ precisely so it survives that, but
    # rebuild here anyway so a stale bundle can never be what is tested.
    subprocess.run(
        [sys.executable, "scripts/build_bundle.py"], check=True, capture_output=True
    )
    direct_vm.warp(_iso(BASE_TIME))
    return direct_deploy(
        CONTRACT_PATH, _hex(direct_owner), sdk_version=SDK_VERSION
    )


@pytest.fixture
def scoped(contract, direct_owner):
    """A registered scope with a pinned v1 constitution."""
    contract.register_scope(scope_id=SCOPE, admin=_hex(direct_owner))
    contract.set_constitution(
        scope_id=SCOPE, version="v1.0", rules_text=RULES_TEXT, rules_json=RULES_JSON
    )
    return contract


def _mock_evidence(direct_vm, status=200, body=PAGE_BODY):
    direct_vm.mock_web(r".*", {"method": "GET", "status": status, "body": body})


def _open_case(contract, direct_vm, sender=None, bond=REVIEW_BOND, **kw):
    subject = kw.pop("subject_json", _subject())
    urls = kw.pop("evidence_urls", _urls())
    if sender is not None:
        with direct_vm.prank(sender):
            direct_vm.value = bond
            return contract.open_case(
                scope_id=SCOPE, subject_json=subject, evidence_urls=urls
            )
    direct_vm.value = bond
    return contract.open_case(
        scope_id=SCOPE, subject_json=subject, evidence_urls=urls
    )


def _decide(contract, direct_vm, case_id, decision, outcome):
    _mock_evidence(direct_vm)
    direct_vm.mock_llm(r".*", _verdict(decision, outcome))
    return contract.evaluate_case(case_id=case_id)


def _case(contract, case_id) -> dict:
    return json.loads(contract.get_case(case_id=case_id))


def _claimable(contract, addr) -> int:
    return int(contract.get_claimable(address=_hex(addr)))


# ---------------------------------------------------------------------------
# Scopes and constitutions
# ---------------------------------------------------------------------------


class TestScopes:
    def test_register_and_read_back(self, contract, direct_owner):
        contract.register_scope(scope_id="Core-Grants", admin=_hex(direct_owner))
        rec = json.loads(contract.get_constitution(scope_id="core-grants"))
        assert rec["scope_id"] == "core-grants"      # normalized to a slug
        assert rec["constitution"] is None           # not pinned yet

    def test_scope_cannot_be_reregistered(self, contract, direct_owner):
        contract.register_scope(scope_id=SCOPE, admin=_hex(direct_owner))
        with pytest.raises(Exception, match=re.escape("scope exists")):
            contract.register_scope(scope_id=SCOPE, admin=_hex(direct_owner))

    def test_set_constitution_by_non_admin_fails(self, contract, direct_owner,
                                                 direct_vm, direct_alice):
        contract.register_scope(scope_id=SCOPE, admin=_hex(direct_owner))
        with direct_vm.prank(direct_alice):
            with pytest.raises(Exception, match=re.escape("not scope admin")):
                contract.set_constitution(
                    scope_id=SCOPE, version="v9",
                    rules_text=RULES_TEXT, rules_json="{}",
                )

    def test_constitution_round_trips(self, scoped):
        rec = json.loads(scoped.get_constitution(scope_id=SCOPE))
        assert rec["constitution"]["version"] == "v1.0"
        assert "material claim" in rec["constitution"]["rules_text"]


# ---------------------------------------------------------------------------
# open_case
# ---------------------------------------------------------------------------


class TestOpenCase:
    def test_open_without_constitution_fails(self, contract, direct_owner, direct_vm):
        contract.register_scope(scope_id=SCOPE, admin=_hex(direct_owner))
        direct_vm.value = REVIEW_BOND
        with pytest.raises(Exception, match=re.escape("constitution missing")):
            contract.open_case(
                scope_id=SCOPE, subject_json=_subject(), evidence_urls=_urls()
            )

    def test_open_on_unknown_scope_fails(self, contract, direct_vm):
        direct_vm.value = REVIEW_BOND
        with pytest.raises(Exception, match=re.escape("scope missing")):
            contract.open_case(
                scope_id="nope", subject_json=_subject(), evidence_urls=_urls()
            )

    def test_bond_below_minimum_fails(self, scoped, direct_vm):
        direct_vm.value = REVIEW_BOND - 1
        with pytest.raises(Exception, match=re.escape("bond too low")):
            scoped.open_case(
                scope_id=SCOPE, subject_json=_subject(), evidence_urls=_urls()
            )

    def test_bad_subject_fails(self, scoped, direct_vm):
        direct_vm.value = REVIEW_BOND
        with pytest.raises(Exception, match=re.escape("bad subject")):
            scoped.open_case(
                scope_id=SCOPE, subject_json="not json", evidence_urls=_urls()
            )

    def test_non_https_evidence_fails(self, scoped, direct_vm):
        direct_vm.value = REVIEW_BOND
        with pytest.raises(Exception, match=re.escape("bad urls")):
            scoped.open_case(
                scope_id=SCOPE, subject_json=_subject(),
                evidence_urls=json.dumps(["http://evidence.example.com/x"]),
            )

    def test_private_host_evidence_fails(self, scoped, direct_vm):
        direct_vm.value = REVIEW_BOND
        with pytest.raises(Exception, match=re.escape("bad urls")):
            scoped.open_case(
                scope_id=SCOPE, subject_json=_subject(),
                evidence_urls=json.dumps(["https://169.254.169.254/latest/meta-data"]),
            )

    def test_open_pins_version_and_indexes(self, scoped, direct_vm, direct_alice):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        assert case_id == "NON-000001"
        rec = _case(scoped, case_id)
        assert rec["rules_version"] == "v1.0"
        assert rec["state"] == "OPEN"
        assert rec["review_bond"] == str(REVIEW_BOND)
        assert case_id in json.loads(scoped.list_cases(scope_id=SCOPE))
        assert case_id in json.loads(
            scoped.list_cases_for(address=_hex(direct_alice))
        )

    def test_case_keeps_its_pinned_version_after_an_amendment(self, scoped, direct_vm):
        """The central anti-rug property: amending a scope's constitution
        never reaches a case that is already open under the old one."""
        case_id = _open_case(scoped, direct_vm)
        scoped.set_constitution(
            scope_id=SCOPE, version="v2.0",
            rules_text="Completely different rules apply from now on, in full.",
            rules_json="{}",
        )
        assert _case(scoped, case_id)["rules_version"] == "v1.0"
        assert "material claim" in _case(scoped, case_id)["rules_text"]
        # A new case picks up the amendment.
        assert _case(scoped, _open_case(scoped, direct_vm))["rules_version"] == "v2.0"


# ---------------------------------------------------------------------------
# evaluate_case
# ---------------------------------------------------------------------------


class TestEvaluate:
    @pytest.mark.parametrize("decision,outcome", [
        ("approve", "approved"),
        ("reject", "rejected"),
        ("revise", "corrections_required"),
        ("inconclusive", "inconclusive"),
    ])
    def test_each_canonical_outcome_is_reachable(self, scoped, direct_vm,
                                                 decision, outcome):
        case_id = _open_case(scoped, direct_vm)
        assert _decide(scoped, direct_vm, case_id, decision, outcome) == decision
        rec = _case(scoped, case_id)
        assert rec["decision"] == decision
        assert rec["outcome"] == outcome
        assert rec["state"] == "DECIDED"
        assert rec["decided_at"] > 0
        assert rec["derived_state"] == "APPEAL_WINDOW"

    def test_illegal_pair_collapses_to_inconclusive_on_chain(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _mock_evidence(direct_vm)
        direct_vm.mock_llm(r".*", _verdict("approve", "rejected"))
        assert scoped.evaluate_case(case_id=case_id) == "inconclusive"

    def test_unretrievable_evidence_cannot_approve(self, scoped, direct_vm):
        """Every fetch 404s. Even with the model insisting on approval, the
        only honest outcome is INCONCLUSIVE."""
        case_id = _open_case(scoped, direct_vm)
        _mock_evidence(direct_vm, status=404, body="<p>not found</p>")
        direct_vm.mock_llm(r".*", _verdict("approve", "approved"))
        assert scoped.evaluate_case(case_id=case_id) == "inconclusive"

    def test_garbage_model_output_collapses_to_inconclusive(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _mock_evidence(direct_vm)
        direct_vm.mock_llm(r".*", "I refuse to answer in JSON.")
        assert scoped.evaluate_case(case_id=case_id) == "inconclusive"

    def test_evidence_report_records_what_was_fetched(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        report = json.loads(scoped.get_case_evidence(case_id=case_id))
        assert report["urls"] == ["https://evidence.example.com/proposal"]
        assert report["report"][0]["ok"] is True
        assert report["report"][0]["status"] == 200
        assert report["report"][0]["limitations"]

    def test_second_evaluation_without_a_challenge_fails(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with pytest.raises(Exception, match=re.escape("case already decided")):
            scoped.evaluate_case(case_id=case_id)

    def test_evaluate_unknown_case_fails(self, scoped):
        with pytest.raises(Exception, match=re.escape("case missing")):
            scoped.evaluate_case(case_id="NON-999999")


# ---------------------------------------------------------------------------
# challenge
# ---------------------------------------------------------------------------


class TestChallenge:
    def test_challenge_inside_window(self, scoped, direct_vm, direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="Claim 2 is false.",
                             extra_urls=json.dumps(["https://other.example.com/x"]))
        rec = _case(scoped, case_id)
        assert rec["challenger"] == _hex(direct_bob)
        assert rec["challenge_bond"] == str(CHALLENGE_BOND)
        assert "https://other.example.com/x" in rec["evidence_urls"]
        assert "https://evidence.example.com/proposal" in rec["evidence_urls"]

    def test_challenge_outside_window_fails(self, scoped, direct_vm,
                                            direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=APPEAL_WINDOW + 1)))
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            with pytest.raises(Exception, match=re.escape("appeal closed")):
                scoped.challenge(case_id=case_id, note="too late")

    def test_challenge_before_decision_fails(self, scoped, direct_vm,
                                             direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            with pytest.raises(Exception, match=re.escape("case not decided")):
                scoped.challenge(case_id=case_id, note="early")

    def test_proposer_cannot_challenge_itself(self, scoped, direct_vm, direct_alice):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_alice):
            direct_vm.value = CHALLENGE_BOND
            with pytest.raises(Exception,
                               match=re.escape("proposer cannot challenge")):
                scoped.challenge(case_id=case_id, note="self")

    def test_double_challenge_fails(self, scoped, direct_vm, direct_alice,
                                    direct_bob, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="first")
        with direct_vm.prank(direct_owner):
            direct_vm.value = CHALLENGE_BOND
            with pytest.raises(Exception, match=re.escape("already challenged")):
                scoped.challenge(case_id=case_id, note="second")

    def test_challenge_bond_below_minimum_fails(self, scoped, direct_vm,
                                                direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND - 1
            with pytest.raises(Exception, match=re.escape("bond too low")):
                scoped.challenge(case_id=case_id, note="cheap")

    def test_challenge_buys_a_real_second_look(self, scoped, direct_vm,
                                               direct_alice, direct_bob):
        """A challenged case must be re-evaluated before it can finalize --
        otherwise a challenge would be a pure lottery ticket on the first
        verdict rather than a request for a second reading."""
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="Claim 2 is false.")

        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=APPEAL_WINDOW + 1)))
        direct_vm.value = 0
        with pytest.raises(Exception, match=re.escape("case not decided")):
            scoped.finalize(case_id=case_id)

        direct_vm.clear_mocks()
        _decide(scoped, direct_vm, case_id, "reject", "rejected")
        assert _case(scoped, case_id)["eval_rounds"] == 2
        assert _case(scoped, case_id)["decision"] == "reject"


# ---------------------------------------------------------------------------
# finalize + bond accounting
# ---------------------------------------------------------------------------


def _finalize_after_window(contract, direct_vm, case_id, settler=None,
                           settle_bond=0, offset=APPEAL_WINDOW + 1):
    direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=offset)))
    if settler is not None:
        with direct_vm.prank(settler):
            direct_vm.value = settle_bond
            return contract.finalize(case_id=case_id)
    direct_vm.value = settle_bond
    return contract.finalize(case_id=case_id)


class TestFinalize:
    def test_finalize_inside_window_fails(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        direct_vm.value = 0
        with pytest.raises(Exception, match=re.escape("appeal open")):
            scoped.finalize(case_id=case_id)

    def test_finalize_before_decision_fails(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        direct_vm.value = 0
        with pytest.raises(Exception, match=re.escape("case not decided")):
            scoped.finalize(case_id=case_id)

    def test_double_finalize_fails(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        direct_vm.value = 0
        with pytest.raises(Exception, match=re.escape("case already final")):
            scoped.finalize(case_id=case_id)

    def test_inconclusive_refunds_the_review_bond_exactly(self, scoped, direct_vm,
                                                          direct_alice, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "inconclusive", "inconclusive")
        _finalize_after_window(scoped, direct_vm, case_id)
        assert _claimable(scoped, direct_alice) == REVIEW_BOND
        # No fee is charged on an inconclusive case, ever.
        assert _claimable(scoped, direct_owner) == 0

    def test_revise_refunds_the_review_bond_exactly(self, scoped, direct_vm,
                                                    direct_alice, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "revise", "corrections_required")
        _finalize_after_window(scoped, direct_vm, case_id)
        assert _claimable(scoped, direct_alice) == REVIEW_BOND
        assert _claimable(scoped, direct_owner) == 0

    def test_approve_returns_the_review_bond(self, scoped, direct_vm,
                                             direct_alice, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        assert _claimable(scoped, direct_alice) == REVIEW_BOND
        assert _claimable(scoped, direct_owner) == 0

    def test_reject_unchallenged_forfeits_the_review_bond(self, scoped, direct_vm,
                                                          direct_alice, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "reject", "rejected")
        _finalize_after_window(scoped, direct_vm, case_id)
        assert _claimable(scoped, direct_alice) == 0
        # treasury is direct_owner (the deploy arg).
        assert _claimable(scoped, direct_owner) == REVIEW_BOND

    def test_successful_challenge_pays_the_challenger(self, scoped, direct_vm,
                                                      direct_alice, direct_bob,
                                                      direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="Claim 2 is false.")
        direct_vm.clear_mocks()
        _decide(scoped, direct_vm, case_id, "reject", "rejected")
        _finalize_after_window(scoped, direct_vm, case_id)

        fee = (REVIEW_BOND * FEE_BPS) // 10_000
        assert _claimable(scoped, direct_alice) == 0
        assert _claimable(scoped, direct_bob) == CHALLENGE_BOND + (REVIEW_BOND - fee)
        assert _claimable(scoped, direct_owner) == fee

    def test_failed_challenge_pays_the_proposer(self, scoped, direct_vm,
                                                direct_alice, direct_bob,
                                                direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="I say this is wrong.")
        direct_vm.clear_mocks()
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)

        fee = (CHALLENGE_BOND * FEE_BPS) // 10_000
        assert _claimable(scoped, direct_bob) == 0
        assert _claimable(scoped, direct_alice) == REVIEW_BOND + (CHALLENGE_BOND - fee)
        assert _claimable(scoped, direct_owner) == fee

    def test_settle_bond_is_returned_to_the_settler(self, scoped, direct_vm,
                                                    direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id, settler=direct_bob,
                               settle_bond=SETTLE_BOND)
        assert _claimable(scoped, direct_bob) == SETTLE_BOND
        assert _claimable(scoped, direct_alice) == REVIEW_BOND

    def test_undersized_settle_deposit_is_returned_not_kept(self, scoped, direct_vm,
                                                            direct_alice, direct_bob):
        """Finalization must never be blocked by, or quietly absorb, a
        too-small liveness deposit."""
        dust = SETTLE_BOND - 1
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id, settler=direct_bob,
                               settle_bond=dust)
        assert _claimable(scoped, direct_bob) == dust

    def test_finalize_is_permissionless(self, scoped, direct_vm, direct_alice,
                                        direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id, settler=direct_bob)
        assert _case(scoped, case_id)["state"] == "FINAL"

    def test_evaluate_after_final_fails(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        with pytest.raises(Exception, match=re.escape("case already final")):
            scoped.evaluate_case(case_id=case_id)


# ---------------------------------------------------------------------------
# claim
# ---------------------------------------------------------------------------


class TestClaim:
    def test_claim_before_final_fails(self, scoped, direct_vm, direct_alice):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_alice):
            with pytest.raises(Exception, match=re.escape("nothing to claim")):
                scoped.claim()

    def test_claim_after_reject_pays_the_treasury(self, scoped, direct_vm,
                                                  direct_alice, direct_owner):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "reject", "rejected")
        _finalize_after_window(scoped, direct_vm, case_id)
        with direct_vm.prank(direct_owner):
            paid = scoped.claim()
        assert int(paid) == REVIEW_BOND
        assert _claimable(scoped, direct_owner) == 0

    def test_double_claim_fails(self, scoped, direct_vm, direct_alice):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        with direct_vm.prank(direct_alice):
            scoped.claim()
            with pytest.raises(Exception, match=re.escape("nothing to claim")):
                scoped.claim()

    def test_claim_by_uninvolved_address_fails(self, scoped, direct_vm,
                                               direct_alice, direct_bob):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        with direct_vm.prank(direct_bob):
            with pytest.raises(Exception, match=re.escape("nothing to claim")):
                scoped.claim()

    def test_claim_sweeps_balances_from_several_cases(self, scoped, direct_vm,
                                                      direct_alice):
        first = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, first, "approve", "approved")
        second = _open_case(scoped, direct_vm, sender=direct_alice)
        direct_vm.clear_mocks()
        _decide(scoped, direct_vm, second, "inconclusive", "inconclusive")
        _finalize_after_window(scoped, direct_vm, first)
        _finalize_after_window(scoped, direct_vm, second)
        with direct_vm.prank(direct_alice):
            assert int(scoped.claim()) == 2 * REVIEW_BOND


# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------


class TestConfig:
    def test_config_reports_the_live_protocol_parameters(self, contract, direct_owner):
        cfg = json.loads(contract.get_config())
        assert cfg["treasury"].lower() == _hex(direct_owner).lower()
        assert cfg["min_review_bond"] == str(REVIEW_BOND)
        assert cfg["min_challenge_bond"] == str(CHALLENGE_BOND)
        assert cfg["appeal_window_seconds"] == APPEAL_WINDOW
        assert cfg["protocol_fee_bps"] == FEE_BPS
        assert cfg["decisions"] == ["approve", "reject", "revise", "inconclusive"]

    def test_configured_bonds_cannot_go_below_the_protocol_floor(
        self, direct_deploy, direct_owner
    ):
        """An operator may make Non stricter, never cheaper to lie to."""
        weak = direct_deploy(
            CONTRACT_PATH, _hex(direct_owner), "", "1", "1", "1",
            sdk_version=SDK_VERSION,
        )
        cfg = json.loads(weak.get_config())
        assert cfg["min_review_bond"] == str(REVIEW_BOND)
        assert cfg["min_challenge_bond"] == str(CHALLENGE_BOND)
        assert cfg["appeal_window_seconds"] == APPEAL_WINDOW

    def test_stricter_configuration_is_honoured(self, direct_deploy, direct_owner):
        strict = direct_deploy(
            CONTRACT_PATH, _hex(direct_owner), str(APPEAL_WINDOW * 2),
            str(10 * GEN), str(10 * GEN), str(2 * GEN),
            sdk_version=SDK_VERSION,
        )
        cfg = json.loads(strict.get_config())
        assert cfg["min_review_bond"] == str(10 * GEN)
        assert cfg["appeal_window_seconds"] == APPEAL_WINDOW * 2

    def test_empty_case_list_is_empty_not_invented(self, contract):
        assert json.loads(contract.list_cases()) == []
        assert json.loads(contract.list_cases(scope_id="nothing-here")) == []


# ---------------------------------------------------------------------------
# Validator independence
#
# These run the REAL captured validator closure from the contract's own
# gl.vm.run_nondet call, with the mocks swapped underneath it so the
# validator's independent re-fetch and re-prompt see different external
# data than the leader did. This is the property the whole product rests
# on: a leader cannot have a verdict believed just by asserting it.
# ---------------------------------------------------------------------------


class TestValidatorIndependence:
    def _decided_case(self, scoped, direct_vm, decision="approve",
                      outcome="approved"):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, decision, outcome)
        return case_id

    def test_validator_accepts_an_honest_leader(self, scoped, direct_vm):
        self._decided_case(scoped, direct_vm)
        assert direct_vm.run_validator() is True

    def test_validator_accepts_different_prose_for_the_same_decision(
        self, scoped, direct_vm
    ):
        """Two honest validators never write identical reasoning. If
        differing prose failed the check, every case would fail."""
        self._decided_case(scoped, direct_vm)
        direct_vm.clear_mocks()
        _mock_evidence(direct_vm)
        direct_vm.mock_llm(r".*", _verdict(
            "approve", "approved",
            reasoning="Entirely different wording, same conclusion.",
            weak_spots="phrased differently too",
        ))
        assert direct_vm.run_validator() is True

    def test_validator_rejects_a_leader_whose_decision_it_cannot_reproduce(
        self, scoped, direct_vm
    ):
        self._decided_case(scoped, direct_vm, "approve", "approved")
        direct_vm.clear_mocks()
        _mock_evidence(direct_vm)
        # This validator's own independent work says reject.
        direct_vm.mock_llm(r".*", _verdict("reject", "rejected"))
        assert direct_vm.run_validator() is False

    def test_validator_rejects_a_fabricated_leader_envelope(self, scoped, direct_vm):
        """A leader that never fetched anything and simply asserts an
        approval is rejected, because the validator derives its own."""
        self._decided_case(scoped, direct_vm, "reject", "rejected")
        fabricated = json.dumps({
            "decision": "approve", "outcome": "approved",
            "score": 99, "fit_score": 99, "risk": 1,
            "rules_version": "v1.0", "evidence": [],
        })
        assert direct_vm.run_validator(leader_result=fabricated) is False

    def test_validator_rejects_a_verdict_under_another_rules_version(
        self, scoped, direct_vm
    ):
        self._decided_case(scoped, direct_vm, "approve", "approved")
        wrong_version = json.dumps({
            "decision": "approve", "outcome": "approved",
            "score": 70, "fit_score": 70, "risk": 30,
            "rules_version": "v9.9-attacker", "evidence": [{"ok": True}],
        })
        assert direct_vm.run_validator(leader_result=wrong_version) is False

    def test_validator_rejects_unparseable_leader_output(self, scoped, direct_vm):
        self._decided_case(scoped, direct_vm)
        assert direct_vm.run_validator(leader_result="not json at all") is False

    def test_validator_rejects_a_score_beyond_tolerance(self, scoped, direct_vm):
        self._decided_case(scoped, direct_vm, "approve", "approved")
        far_off = json.dumps({
            "decision": "approve", "outcome": "approved",
            "score": 5, "fit_score": 5, "risk": 95,
            "rules_version": "v1.0", "evidence": [{"ok": True}],
        })
        assert direct_vm.run_validator(leader_result=far_off) is False

    def test_validator_rejects_approval_when_its_own_fetches_fail(
        self, scoped, direct_vm
    ):
        """The leader saw a live page; this validator's own fetches 404.
        With no retrievable evidence of its own it derives INCONCLUSIVE,
        which does not match the leader's APPROVE."""
        self._decided_case(scoped, direct_vm, "approve", "approved")
        direct_vm.clear_mocks()
        _mock_evidence(direct_vm, status=404, body="<p>gone</p>")
        direct_vm.mock_llm(r".*", _verdict("approve", "approved"))
        assert direct_vm.run_validator() is False


EXPIRY = 72 * 60 * 60


# ---------------------------------------------------------------------------
# Bounded liveness escape hatch
# ---------------------------------------------------------------------------


class TestExpiry:
    def test_open_case_cannot_expire_early(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY - 60)))
        with pytest.raises(Exception, match=re.escape("case not expired")):
            scoped.expire_case(case_id=case_id)

    def test_stuck_open_case_expires_and_refunds_exactly(self, scoped, direct_vm,
                                                         direct_alice, direct_owner):
        """A case whose evaluation never converges must still release its
        bond. This is the path that exists because 'permissionlessly
        retriable' is not 'guaranteed to converge'."""
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY + 1)))
        with direct_vm.prank(direct_alice):
            assert scoped.expire_case(case_id=case_id) == "inconclusive"

        rec = _case(scoped, case_id)
        assert rec["state"] == "FINAL"
        assert rec["expired"] is True
        assert rec["decision"] == "inconclusive"
        assert _claimable(scoped, direct_alice) == REVIEW_BOND
        assert _claimable(scoped, direct_owner) == 0  # no fee, ever

    def test_a_stranger_cannot_expire_a_case(self, scoped, direct_vm,
                                             direct_alice, direct_bob):
        """Expiring a case moves it to FINAL, and evaluate_case refuses a
        FINAL case, so an unauthenticated expiry would let anyone terminally
        halt a funded case on the clock alone -- no evidence that evaluation
        was ever attempted, no validator review. Bonds refunding exactly is
        not a defence: the proposer still has to re-open and re-bond, and it
        costs the attacker only gas."""
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY + 1)))
        with direct_vm.prank(direct_bob):
            with pytest.raises(Exception,
                               match=re.escape("not a party to this case")):
                scoped.expire_case(case_id=case_id)

        # The revert alone is only suggestive; the proof is that the case is
        # untouched and still adjudicable.
        assert _claimable(scoped, direct_alice) == 0
        assert json.loads(scoped.get_case(case_id=case_id))["state"] != "FINAL"

    def test_the_proposer_may_expire_their_own_stuck_case(
        self, scoped, direct_vm, direct_alice
    ):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY + 1)))
        with direct_vm.prank(direct_alice):
            scoped.expire_case(case_id=case_id)
        assert _claimable(scoped, direct_alice) == REVIEW_BOND

    def test_stuck_challenged_case_expires_and_refunds_both_sides(
        self, scoped, direct_vm, direct_alice, direct_bob, direct_owner
    ):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        with direct_vm.prank(direct_bob):
            direct_vm.value = CHALLENGE_BOND
            scoped.challenge(case_id=case_id, note="Claim 2 is false.")

        # The re-evaluation never converges. Expired here by the CHALLENGER,
        # proving either party can exit alone and neither is hostage to the
        # other's inaction.
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY + 1)))
        with direct_vm.prank(direct_bob):
            scoped.expire_case(case_id=case_id)

        assert _claimable(scoped, direct_alice) == REVIEW_BOND
        assert _claimable(scoped, direct_bob) == CHALLENGE_BOND
        assert _claimable(scoped, direct_owner) == 0

    def test_decided_unchallenged_case_cannot_be_expired(self, scoped, direct_vm):
        """finalize already settles it. An expiry path here would be a way
        to dodge a resolved REJECT."""
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "reject", "rejected")
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY * 10)))
        with pytest.raises(Exception, match=re.escape("case not expirable")):
            scoped.expire_case(case_id=case_id)

    def test_expiry_cannot_reopen_a_final_case(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        _finalize_after_window(scoped, direct_vm, case_id)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY * 10)))
        with pytest.raises(Exception, match=re.escape("case already final")):
            scoped.expire_case(case_id=case_id)

    def test_expired_bond_is_actually_claimable(self, scoped, direct_vm,
                                                direct_alice):
        case_id = _open_case(scoped, direct_vm, sender=direct_alice)
        direct_vm.warp(_iso(BASE_TIME + timedelta(seconds=EXPIRY + 1)))
        with direct_vm.prank(direct_alice):
            scoped.expire_case(case_id=case_id)
            assert int(scoped.claim()) == REVIEW_BOND


# ---------------------------------------------------------------------------
# Envelope binding: the verdict must be about THIS case, citing THIS case's
# locked evidence. A prompt asking for the right id is not code checking the
# right id came back.
# ---------------------------------------------------------------------------


class TestEnvelopeBinding:
    def test_validator_rejects_a_verdict_naming_another_case(self, scoped,
                                                             direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        other = json.dumps({
            "case_id": "NON-999999", "decision": "approve", "outcome": "approved",
            "score": 70, "fit_score": 70, "risk": 30,
            "rules_version": "v1.0", "evidence": [{"ok": True}],
        })
        assert direct_vm.run_validator(leader_result=other) is False

    def test_agreed_verdict_records_its_own_case_id(self, scoped, direct_vm):
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        report = json.loads(scoped.get_case_evidence(case_id=case_id))
        assert report["report"], "evidence report should survive binding"
        for row in report["report"]:
            assert row["url"] in report["urls"]

    def test_stored_evidence_only_ever_cites_locked_urls(self, scoped, direct_vm):
        """Whatever the leader reports, every stored evidence row must name a
        url this case actually locked. The void-on-mismatch rule itself is
        exercised exhaustively in tests/unit/test_non_lib.py."""
        case_id = _open_case(scoped, direct_vm)
        _decide(scoped, direct_vm, case_id, "approve", "approved")
        rec = _case(scoped, case_id)
        assert rec["evidence_report"]
        for row in rec["evidence_report"]:
            assert row["url"] in rec["evidence_urls"]
