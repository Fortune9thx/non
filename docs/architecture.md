# Non — architecture

## The one contested question

> Does this proposal's material claims meet a pinned constitution under
> independently fetched evidence?

Everything below exists to make that question answerable on-chain, expensive
to answer falsely, and honest when it cannot be answered at all.

## Two layers, one boundary

```
contracts/non_lib.py     pure Python, ZERO genlayer imports
                         every rule, every enum, all bond arithmetic
                         plain-pytest testable in isolation

contracts/Non.py         gl.contract.Contract storage/transaction glue
                         the single nondeterministic block
                         raises stable UserError strings

scripts/build_bundle.py  inlines non_lib into Non.py -> build/Non.bundled.py
                         (sibling imports fail contract validation)
```

The boundary is deliberate. Anything that decides a verdict or moves a wei
lives in `non_lib.py`, where it can be exercised without a chain, a network,
or a model. `Non.py` contributes storage, value handling, and the consensus
call — and nothing that a unit test cannot reach.

## State machine

```
OPEN ──evaluate_case──▶ DECIDED ──(6h)──▶ finalize ──▶ FINAL ──▶ claim
                           │
                        challenge (within window, bonded)
                           │
                           └──evaluate_case (round 2)──▶ DECIDED ──▶ finalize
```

- `open_case` freezes the scope's current constitution version onto the case.
- `evaluate_case` is permissionless. Anyone may pay the gas; nobody can
  influence the result by doing so.
- `challenge` is only possible inside the appeal window, only once, only by
  someone other than the proposer, and only with a bond at or above the floor.
- A challenged case **must** be re-evaluated (`eval_rounds >= 2`) before it can
  finalize. A challenge always buys a real second reading rather than a
  lottery ticket on the first verdict.
- `finalize` is permissionless after the window and writes the bond ledger.
- `claim` is the only method that moves GEN out of the contract.

`REVIEWING` is written before the nondeterministic block and overwritten with
`DECIDED` in the same transaction. A failed transaction — including one where
validators disagree — rolls back every write in it, so a case can never be
found parked in `REVIEWING`, and no case becomes stuck and un-retryable.

Because `evaluate_case`, `finalize` and `claim` are all permissionless, a
proposer can always move their own case to completion without anyone else's
cooperation. That is the escape hatch, and it is why no abandonment timeout is
needed to keep a bond reachable.

`case_state()` derives the presentational state from stored facts plus the
clock, so the stored state and the appeal deadline can never disagree.

## The nondeterministic block

A single `gl.vm.run_nondet(leader_fn, validator_fn)` call per evaluation.

**`leader_fn`** — runs identically on the leader and on every validator:

1. `gl.nondet.web.get(url)` for each pinned evidence URL. A failed fetch is
   caught and recorded as a failure, never as an absence.
2. `normalize_evidence(url, status, body)` turns each response into the only
   record anything downstream ever sees: `{url, status, ok, title,
   description, excerpt, limitations}`. Scripts and styles are removed, tags
   are stripped, and the text is capped. `Response.body` is `bytes`, and is
   decoded inside the normalizer.
3. If nothing was retrievable, the block short-circuits to `INCONCLUSIVE`
   without spending a prompt call — there is no conclusion that no evidence
   can support.
4. Otherwise `build_prompt(...)` fences each untrusted region
   (`<<<PROPOSAL`, `<<<EVIDENCE`, `<<<CHALLENGE`) behind an explicit security
   preamble, and `gl.nondet.exec_prompt` is called.
5. `canonicalize_verdict(raw, evidence_ok=...)` maps the response onto the
   four canonical outcomes.

**`validator_fn`** — re-does the *whole* job:

```python
payload = getattr(leader_result, "calldata", None)   # Return | VMError
if payload is None:
    return False
leader_verdict = json.loads(str(payload))
mine = json.loads(leader_fn())        # own fetches, own prompt
return verdicts_equivalent(leader_verdict, mine, rules_version_match=...)
```

The validator never reads the leader's fetches. A leader that fabricated a
self-consistent envelope would pass a structural check; it cannot pass this
one unless the validator's own independent work agrees.

> **Note on the argument type.** `run_nondet` types its validator as
> `Callable[[Return[T] | VMError], bool]`. The validator receives a *wrapper*,
> not the leader's raw value — the payload is in `.calldata`. The natural-looking
> `json.loads(str(leader_result))` never parses, so the validator returns
> `False` unconditionally and every case fails consensus. This is invisible to
> every rejection test, because a validator that is broken shut passes all of
> them. It is caught only by the positive tests
> (`test_validator_accepts_an_honest_leader`, and the
> same-decision-different-prose case), which is why those exist.

## Safety direction

Canonicalization is one-way toward the outcome that moves no money:

| Input | Result |
| --- | --- |
| Unparseable / non-object response | `INCONCLUSIVE` |
| Unknown decision | `INCONCLUSIVE` |
| Illegal decision/outcome pair | `INCONCLUSIVE` (never repaired toward the stated decision) |
| `APPROVE` with no retrievable evidence | `INCONCLUSIVE` |
| Verdict under a different `rules_version` | `INCONCLUSIVE` |

No input shape produces `APPROVE` by default. An approval must be stated
explicitly, paired legally, and backed by at least one retrieved record.

Scores are clamped to 0–100 and every free-text field is length-capped before
it reaches storage, so a hostile response cannot inflate state.

## Bond ledger

`settle_accounting()` is a single pure function that returns
`{credits: {address: amount}, total}`. The contract asserts

```
total == review_bond + challenge_bond + settle_bond
```

and, if that ever fails, discards the computed distribution and refunds every
participant instead. No branch can mint value, and no branch can strand it.

The protocol fee is integer-floored; the remainder always follows the
principal rather than disappearing. Payouts are credited to a per-address
ledger rather than pushed, and `claim()` pays the caller's **whole** balance
across every case they have touched — so the last claimant of a multi-party
pot is never left holding dust.

## Trust boundaries

| Input | Treated as |
| --- | --- |
| Proposal JSON | Hostile data. Parsed for shape and size only. |
| Evidence pages | Untrusted web content. Normalized to a record with stated limitations. |
| Challenger note | A claim that the reading was wrong. Not an instruction. |
| Model response | A proposal for a verdict, re-canonicalized in deterministic code before it touches storage. |
| Scope admin | Trusted for their own scope's rules, and only forward in time. |

### SSRF guard

Evidence URLs must be HTTPS, under 500 characters, free of credentials in the
authority, and not on `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`
(cloud metadata), `172.16–31.*`, `.local` or `.internal`. Fetches execute
inside validator nodes on networks we do not own; an unguarded URL field is a
request to have those nodes probe them.

### Constitution pinning

`open_case` copies the version, rules text and canonical rules JSON onto the
case. `set_constitution` affects only cases opened afterwards. A verdict
carrying a different `rules_version` is discarded. This is the anti-rug
property: rules cannot be changed under a live case.

## Frontend

Vite + React + TypeScript. One rule governs the whole app: **no data that did
not come from the chain**. There are no fixtures, no seeded cases, and no demo
mode anywhere in the source.

Liveness is a three-way probe using **`gen_getContractSchema`**, not
`eth_getCode`. A GenLayer intelligent contract is not an EVM contract —
`eth_getCode` returns `0x` for a healthy, responding, deployed IC, so gating
on it reports "nothing deployed, the network was reset" about a live contract
and fails every read closed. `gen_getContractSchema` cleanly separates
*live* / *nothing-there* / *RPC-unreachable*, which is exactly the
distinction the banners need.

When the chain cannot be read, stat tiles show `—` rather than `0`: a zero
would claim a fact about on-chain state that was never read.
