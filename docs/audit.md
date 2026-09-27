# Non — self-audit

Written against the deployable bundle (`build/Non.bundled.py`) and the test
suite at 128 passing tests, `genvm-lint check` clean.

This document records what was actually found and fixed, what is deliberately
out of scope, and what remains unproven. It is not a claim that the contract
is correct.

---

## Findings fixed during the build

### 1. Validator was broken shut — every case would have failed consensus

**Severity: critical. Found by a positive test, fixed.**

`gl.vm.run_nondet` types its validator as
`Callable[[Return[T] | VMError], bool]`. The validator receives a *wrapper*,
not the leader's raw return value; the payload is in `.calldata`. The original
code did:

```python
leader_verdict = json.loads(str(leader_result))   # WRONG
```

`str()` on the dataclass yields `Return(calldata='{...}')`, which never
parses, so the `except` branch fired and the validator returned `False`
unconditionally. In production, **every single case would have failed
consensus**.

Note the asymmetry that makes this easy to miss: `run_nondet`'s own return
value at the call site *is* the bare decoded value, so `str(raw_result)` there
is correct. Only the callback's argument is wrapped.

What makes it genuinely dangerous is that it is invisible to every rejection
test — a validator that always returns `False` passes "rejects a dishonest
leader" perfectly. It was caught only by
`test_validator_accepts_an_honest_leader`. The lesson generalizes: **any
predicate whose failure mode is "always deny" needs an explicit accept test.**

Fixed by unwrapping `.calldata` and treating a missing payload (a `VMError`)
as a rejection.

### 2. Every successful fetch normalized to empty

**Severity: high. Found by reading the SDK source, fixed.**

`gl.nondet.web.Response` is `{status: int, headers: dict[str, bytes], body:
bytes | None}` — **`body` is bytes, never `str`.** The normalizer did
`text = body if isinstance(body, str) else ""`, so every successful fetch
produced an empty excerpt, `ok=False`, and — correctly, given that input —
every case would have been forced to `INCONCLUSIVE`.

The fail-closed design masked the bug rather than exposing it: nothing
crashed, nothing looked wrong, and the protocol would simply never have
reached a verdict. Fixed by decoding bytes inside `normalize_evidence`, with
tests for bytes, undecodable bytes, and `None`.

### 3. `genvm-lint` findings

- `_floor` was a `@staticmethod`; the linter requires `self` as the first
  parameter of a contract method. Moved to a module-level function.
- The nondeterministic calls lived in a helper that `leader_fn` delegated to,
  which the linter could not trace to the equivalence-principle block
  (`gl.nondet.* not reachable from equivalence principle block`). The fetch
  and prompt now live directly in `leader_fn`, and `validator_fn` re-runs
  `leader_fn` from scratch.

Both were real, not lint noise: the second would have shipped a block the
platform's own tooling could not verify.

---

## Deliberate design decisions

### `REVISE` refunds the proposer's bond

`REVISE` names defects to correct. It is not an adverse finding that the
proposal was false, so it forfeits nothing. The alternative — slashing on
`REVISE` — would make the tribunal's most useful outcome its most expensive
one, and would push proposers toward all-or-nothing submissions. This is a
judgement call and it is stated in the UI, not buried.

### The settle bond is never at risk

Finalization must never be blocked by, or quietly absorb, a fee. A deposit
below the floor is credited straight back to the sender rather than reverting
or being kept.

### `claim()` sweeps the whole ledger balance

Paying per-case would leave the last claimant of a multi-party pot exposed to
rounding dust. `claim()` takes no case id and pays everything owed at once.

### Configurable minimums are floored, not free

An operator may make Non stricter (higher bonds, longer appeal window) but
never cheaper to lie to. The fee rate is fixed at deploy time and is not
operator-settable at all. Tested by
`test_configured_bonds_cannot_go_below_the_protocol_floor`.

### No timeout path is needed, because every step is permissionless

A case opened and then ignored by everyone else would strand the proposer's
bond — which is exactly the kind of fund-stranding defect worth a timeout and
a reclaim path. Non does not need one: `evaluate_case`, `finalize` and
`claim` are all permissionless writes with no caller restriction, so **the
proposer always has a complete self-service route out of their own case**
(open → evaluate → wait out the window → finalize → claim). No third party's
cooperation is required at any step, and no branch leaves a bond unreachable.

The one thing a proposer cannot do is challenge their own case, which is
refused deliberately.

### `REVIEWING` is a transient, never externally observable

`evaluate_case` writes `REVIEWING` before entering the nondeterministic block
and overwrites it with `DECIDED` at the end of the same transaction. If the
transaction fails for any reason — including validators disagreeing — every
storage write in it rolls back and the case returns to `OPEN`. So a case can
never be found parked in `REVIEWING`, and there is no state in which a case is
stuck and un-retryable. It is documented in the state machine because it is
the real intermediate state, not because a reader will ever see it.

### A challenger may add evidence, never remove it

`merge_evidence_urls` appends and caps. A challenger cannot drop the record
that the original verdict was reached on.

### Self-challenge is refused

Otherwise one party could manufacture a two-sided case and collect from
itself, converting the fee into the only real cost of a fake dispute.

---

## Value conservation

`settle_accounting()` returns a credit map whose total is asserted equal to
`review_bond + challenge_bond + settle_bond`. On mismatch it discards the
distribution and refunds every participant instead — a conservation failure is
a bug, and no wei moves under an accounting that cannot be proven closed.

Tested exhaustively across every decision × challenger-present combination,
plus a deliberately indivisible bond amount to confirm the fee remainder
follows the principal rather than vanishing.

---

## Prompt-injection posture

- The proposal, the evidence excerpts and the challenger note are each fenced
  in labelled regions and introduced as untrusted data.
- The security preamble states that instructions inside those regions are to
  be ignored, and that a claim counts as supported only if the support appears
  in the normalized evidence.
- `<script>`, `<style>`, `<noscript>` and `<template>` blocks are removed
  before tags are stripped, so page JavaScript never reaches the prompt.
- The model's response cannot escape canonicalization: it is re-mapped through
  `canonicalize_verdict` in deterministic code after consensus, before it
  touches storage. A response that asks for an outcome it did not legally
  state gets `INCONCLUSIVE`.
- `test_prompt_fences_untrusted_regions_and_states_rules` asserts that a claim
  reading "ignore previous instructions" appears inside the fenced region and
  nowhere else.

**What this does not do:** it does not guarantee the model is uninfluenced by
a sufficiently clever payload. It ensures such a payload cannot produce a
verdict the validators did not independently reach, cannot exceed the four
canonical outcomes, and cannot move money without a second node agreeing.

---

## Known limits and unproven claims

1. **Not deployed.** No live address, no on-chain smoke test. Everything here
   is proven in gltest direct-mode against a real GenVM sandbox, which is a
   genuine execution proof but not a network proof. See `docs/STATUS.md`.
2. **Payable methods are untestable from the CLI.** `genlayer write` has no
   flag for attaching native GEN, so a real bonded call requires a wallet or a
   direct `genlayer-js` script. `open_case`, `challenge` and `finalize` are
   all payable.
3. **`datetime.now()` is the clock.** It is deterministic within a GenLayer
   transaction and is what gltest's `warp` cheatcode controls.
   `gl.vm.get_timestamp()` returns `None` in direct-mode, which would make
   every window comparison locally untestable.
4. **No scope enumeration on chain.** Scopes are readable only by id. The UI
   does not pretend otherwise by listing invented ones.
5. **The model itself is not audited.** Non constrains what a model's output
   can *do*, not what it thinks. The equivalence rule is the whole defence,
   and it protects against a lying or compromised leader — not against every
   validator being wrong the same way.
6. **Studio Next state can be reset** by its operators, destroying all cases.
   Stated in the README, in `STATUS.md`, and in the app's own footer.
7. **Frontend write path is unexercised against a live chain.** The v0.6 fee
   shape (`estimateTransactionFeesForWrite`) is wired but has never round-
   tripped a real transaction from this app.
