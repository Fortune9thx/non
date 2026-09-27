# Non — steward packet

## One paragraph

Non is a bonded constitutional tribunal on GenLayer. Validators independently
re-fetch HTTPS evidence and decide whether a proposal satisfies a pinned
constitution. Outcomes are APPROVE, REJECT, REVISE, or INCONCLUSIVE. Proposer
and challenger bonds make false verdicts costly. INCONCLUSIVE refunds bonds
exactly. Live at `0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76` on chain 61997 Studio Next; state may reset.

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
[`0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76`](https://explorer-studio-dev.genlayer.com/address/0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76), verified by `gen_getContractSchema` and a
real on-chain `get_config` read.

What is **not** yet proven on chain: no case has been opened, because
`open_case`, `challenge` and `finalize` are payable and `genlayer write`
cannot attach native GEN. The full case lifecycle — all four outcomes, the
appeal window, and every branch of the bond ledger — is proven in gltest
direct-mode against a real GenVM sandbox. See [`STATUS.md`](STATUS.md) for the
exact five-step on-chain smoke test that was run, and for what it does not
cover.

## Evidence for review

| | |
| --- | --- |
| Source | `contracts/non_lib.py`, `contracts/Non.py` |
| Deployable bundle | `build/Non.bundled.py` — `Depends` on line 1, no prose above it |
| Tests | 128 passing — `python -m pytest tests -q` |
| Lint | `genvm-lint check build/Non.bundled.py` — clean |
| Architecture | [`architecture.md`](architecture.md) |
| Self-audit | [`audit.md`](audit.md) — including two real bugs caught pre-deploy |
| Live contract | [`0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76`](https://explorer-studio-dev.genlayer.com/address/0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76) |
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
