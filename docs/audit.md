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

### 3. Events: a topic-budget overflow and silent field scrambling

**Severity: high (one broke `open_case` outright). Found on the live network,
after a clean deploy, fixed and redeployed.**

The first deploy was live and healthy, but `open_case` aborted on chain with
`SystemError: 2: inval` inside `Event.emit_raw`. Two distinct SDK rules were
being violated, and **gltest direct-mode reproduces neither** — all 170 tests
passed against the broken code.

**a. The topic budget counts the signature.** `ABI.EVENT_MAX_TOPICS` is 4, and
the event's own signature occupies one topic, so only **three** indexed fields
fit. `CaseOpened` declared four. Locally the SDK only issues a
`warnings.warn` — nothing fails — so the contract sails through every local
test and then dies on the real network. The fourth field moved into the
keyword blob.

**b. Indexed fields are bound by sorted name, not by position.** The SDK
builds `indexed_args = tuple(sorted(...))` and then binds values with
`zip(indexed_args, args)` — alphabetically sorted *names* against positional
*values*. If a declaration's parameter order is not already alphabetical,
every value is silently recorded under the wrong field name. Nothing raises,
on chain or off. Three events were affected: `ScopeRegistered(scope_id,
admin)` and `Claimed(claimant, amount)` had their two fields transposed, and
`CaseOpened` was scrambled outright. All declarations are now in alphabetical
order.

Events are logs rather than consensus state, so (b) could not have moved money
— but it would have made the emitted record permanently wrong, which is worse
than useless for anyone indexing it. `tests/unit/test_events.py` now enforces
both rules by parsing the contract source, so neither can regress silently.

### 4. `genvm-lint` findings

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

## Strict pre-submission audit round

A second, deliberately adversarial pass was run against a 188-item checklist
compiled from real GenLayer Portal steward rejections. It produced four code
findings, all fixed and redeployed.

### 4. No bounded escape hatch if evaluation never converges

**Severity: high — this exact reasoning has caused a real steward rejection
before.**

Non's own earlier audit argued that no timeout was needed because
`evaluate_case`, `finalize` and `claim` are all permissionless, so a proposer
can always move their own case along. That argument is wrong, and it is wrong
in a way a steward has already rejected on another project: **"permissionlessly
retriable" is not the same claim as "guaranteed to converge."** Nothing bounds
how long a genuinely ambiguous case, or a validator-infrastructure problem,
can make every attempt at agreement fail — and for as long as that lasts, the
bonds sit locked with no way out.

Added `expire_case`: after 72 hours with no reachable verdict, anyone may
expire the case and every bond is returned exactly, with no fee and no winner.
It cannot run on a FINAL case, and it cannot run on a decided, unchallenged
case — that one simply needs its appeal window to close before `finalize`
settles it — so it can never be used to dodge a resolved forfeiture. It covers
both states that can genuinely stall: an `OPEN` case that never gets a
decision, and a challenged case whose second reading never converges.

### 5. The agreed verdict was not bound to the case it was about

**Severity: medium-high.** The envelope carried no case id, and the stored
evidence report was copied verbatim from the leader with no check that its
URLs were the ones this case actually locked. Worse, `evidence_ok` — the gate
that decides whether an APPROVE is permitted at all — was computed from that
unchecked list.

Consensus still protected the *decision* (a validator re-deriving from the
case's own locked inputs would not match a foreign verdict), but a prompt
asking for the right case id is not the same thing as code checking the right
case id came back. `bind_envelope` now verifies the case id, the rules
version, and that every evidence row names a locked URL — voiding the **whole**
envelope on any mismatch rather than filtering it, so a fabricated "ok" row
can never reach the evidence-sufficiency gate.

### 6. The frontend write path could not sign at all

**Severity: high (every write broken).** `writeContract` fetched the injected
provider, null-checked it, and then never passed it to `createClient` — so the
client had no signer. This had never been caught because no browser write had
ever been exercised against a live contract.

### 7. Success was shown from a transaction hash alone

**Severity: medium.** Every action rendered a success banner as soon as
`writeContract` returned a hash, with no polling and no status check. A hash is
a receipt of submission, not of success: an `UNDETERMINED` consensus outcome —
validators independently re-ran the work and disagreed, so nothing was
persisted — would have been shown to the user as a completed action.

Every write now goes through `submitWrite`, which waits for a terminal state
and checks it against a **whitelist** of known-good values, never a blacklist
of known-bad ones. A blacklist silently treats every state it has not heard of
as success.

### Also tightened

- **SSRF:** explicit ports are now rejected. Literal IPv4/IPv6 and
  numeric-encoded hosts were already structurally refused by the hostname
  rule, but a port let a fetch be aimed at a non-standard service on a host
  that otherwise looks public.
- **`.gitattributes` + a CI check** keep contract sources LF-only. (The
  sources were already LF; this prevents drift rather than fixing a defect.)
- **CI now has a real lint gate.** `genvm-lint lint` — the SDK-free AST half
  of `check` — runs in the must-pass job.

### Checked and found already correct

Verified against the checklist rather than assumed: the read client is a
memoized singleton that never creates an ephemeral account; address keys are
normalized identically at write and lookup; every bond collected has a
resolution on every exit path, with conservation asserted; `claim()` — the
only value-moving call — is genuinely exercised by tests; every `str` field
reaching a prompt is length-capped at the write that stores it; both the
challenge-opening and finalize paths independently re-check the appeal window;
self-dealing is rejected; no float ever reaches calldata; and the header is a
bare `Depends` comment on line 1.

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

1. **A full case has not been settled on chain.** The contract is live at
   `0xfc34Ce61034952807899B8abE172BF76cC6036a0` and one real case, `NON-000001`, was opened with a 2 GEN bond and
   adjudicated live — real HTTPS fetches, a real prompt, and validator
   consensus. What has *not* run on chain is `finalize` and `claim`: the
   appeal window is six hours and its floor is deliberately not loosenable, so
   the bond ledger has still only been exercised in gltest. Challenge and
   re-evaluation are likewise unproven live.

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
