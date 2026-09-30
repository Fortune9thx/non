# Non — steward packet

## One paragraph

Non is a bonded constitutional tribunal on GenLayer. Validators independently
re-fetch HTTPS evidence and decide whether a proposal satisfies a pinned
constitution. Outcomes are APPROVE, REJECT, REVISE, or INCONCLUSIVE. Proposer
and challenger bonds make false verdicts costly. INCONCLUSIVE refunds bonds
exactly. Live at `0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c` on chain 61997 Studio Next; state may reset.

## The contested claim

> Does this proposal's material claims meet a pinned constitution under
> independently fetched evidence?

This is not computable from on-chain data. It requires fetching pages that
live outside the chain and judging natural-language compliance against a
natural-language rule set — which is what GenLayer's equivalence principle
exists for.

## Who loses money on a false verdict

- Proposer bonds ≥ 2 GEN to open a case. A final REJECT forfeits it.
- Challenger bonds ≥ 2 GEN during the 6-hour appeal window. If the verdict
  holds, the challenger forfeits instead.
- 2% protocol fee on slashed bonds only. Never on a refund.
- INCONCLUSIVE and REVISE return every bond exactly, with no fee and no
  winner.

## Equivalence rule

Each validator re-fetches the evidence, re-runs the prompt, and derives its
own verdict through the same pure code. It accepts the leader only on exact
agreement of `decision`, `outcome` and the case's pinned `rules_version`, with
informational scores within a tolerance of 10. Reasoning prose and raw HTML
are not compared — two honest validators never write identical text.

## Failure policy

One-way, toward the outcome that moves no money.

| Condition | Result |
| --- | --- |
| No evidence URL retrievable | INCONCLUSIVE, bonds refunded exactly |
| Model output unparseable or illegally paired | INCONCLUSIVE |
| Verdict carries a different rules version | INCONCLUSIVE |
| Validators disagree | Consensus fails; no verdict is written |
| Contract address unset, or reset | UI shows an empty product and says why |
| RPC unreachable | UI shows nothing rather than something stale |

## Status

**Live on Studio Next (chain 61997)** at
[`0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`](https://explorer-studio-dev.genlayer.com/address/0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c), verified by `gen_getContractSchema` and a
real on-chain `get_config` read.

Two real cases, **NON-000001** and **NON-000002**, have each been opened with a
2 GEN bond and adjudicated live: both evidence URLs fetched over HTTPS, a real
prompt run, and validator consensus reached on an **APPROVE** in both. The
`expire_case` authentication fix was also proven live — a non-party calling it
was refused with `not a party to this case`, leaving the case untouched.

Both cases have since been **finalized on chain** after their appeal windows
expired, and the resulting bond ledger was read back and matched
`settle_accounting`'s prediction exactly: 4 GEN returned to the proposer, 0 to
the treasury — live confirmation that the protocol fee applies to slashed
bonds only.

Four things remain **gltest-only**, and are stated here rather than left to be
discovered:

- **`claim()`** — the payout call. The bonds are credited to the retired
  deploy key, so nobody can call it for these two cases.
- **An adverse verdict.** Every live case so far returned APPROVE, so no bond
  has actually been slashed on chain and the treasury has never been paid.
- **`challenge` and re-evaluation** — a challenge must land inside a 6h window.
- **A successful `expire_case`** — needs a case stuck for 72h. Only its
  refusal path has run live.

Every one of these is covered in gltest against a real GenVM sandbox, with
value conservation asserted on each branch. See [`STATUS.md`](STATUS.md) for
exactly what was run and what it does not cover.

## Evidence for review

| | |
| --- | --- |
| Source | `contracts/non_lib.py`, `contracts/Non.py` |
| Deployable bundle | `build/Non.bundled.py` — `Depends` on line 1, no prose above it |
| Tests | 177 passing — `python -m pytest tests -q` (needs the GenVM runner cached; see STATUS.md) |
| Lint | `genvm-lint check build/Non.bundled.py` — clean |
| Architecture | [`architecture.md`](architecture.md) |
| Self-audit | [`audit.md`](audit.md) — 12 findings across two adversarial rounds, including three that would have broken the product silently |
| Live contract | [`0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`](https://explorer-studio-dev.genlayer.com/address/0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c) |
| Explorer | https://explorer-studio-dev.genlayer.com |

## What a reviewer should look at first

1. `settle_accounting()` in `contracts/non_lib.py` — the entire money story,
   pure, with conservation asserted by the caller.
2. `canonicalize_verdict()` — the one-way safety direction.
3. `validator_fn` inside `Non.evaluate_case`, together with `audit.md`
   finding 1, which explains why the *positive* validator tests are the
   load-bearing ones.
4. `tests/direct/test_non_contract.py::TestValidatorIndependence` — validator
   independence executed against a real GenVM sandbox, not merely asserted.
