# Non

**A bonded constitutional tribunal on GenLayer.**

Non settles one contested question on-chain:

> Does this proposal's material claims meet a pinned constitution under
> independently fetched evidence?

Outcomes: **APPROVE · REJECT · REVISE · INCONCLUSIVE**.

---

## What decision GenLayer owns

Two things that cannot be computed from on-chain data alone:

1. **Constitutional compliance** — whether the proposal satisfies the rules
   version that was frozen onto the case when it opened.
2. **Evidence sufficiency** — whether the proposal's material claims survive
   HTTPS evidence that each validator fetches *for itself*.

The leader does not get to assert a verdict and have it believed. Every
validator re-fetches the evidence, re-runs the prompt, and canonicalizes its
own verdict through the same pure code. The leader's result stands only if the
two independently derived verdicts agree.

## Who loses money if the verdict is wrong

| Final outcome | No challenger | Challenger bonded |
| --- | --- | --- |
| **REJECT** | Proposer's bond is forfeit to the treasury, less a 2% fee | Challenge succeeded: proposer's bond pays the challenger, less the fee |
| **APPROVE** | Review bond returned in full | Challenge failed: challenger's bond pays the proposer, less the fee |
| **REVISE** | Every bond returned exactly, no fee | Every bond returned exactly, no fee |
| **INCONCLUSIVE** | Every bond returned exactly, no fee | Every bond returned exactly, no fee |

Minimum bonds are 2 GEN to open a case and 2 GEN to challenge one. The
protocol fee is charged **only on a slashed bond** — never on a refund. The
optional settle deposit is a liveness bond and is always returned.

`INCONCLUSIVE` is not a soft approval. When the evidence is missing,
unreachable or contradictory, nothing moves and nobody profits.

## The equivalence rule

A validator accepts the leader's result only when its own independent work
agrees on:

- `decision` — exactly
- `outcome` — exactly
- the case's pinned `rules_version` — exactly
- informational scores — within `SCORE_TOLERANCE` (10)

Reasoning prose, excerpt wording, and raw HTML are explicitly **not**
compared. Two honest validators never write identical text, and demanding
that would fail every case.

The safety direction is one-way. Anything unparseable, any illegal
decision/outcome pair, and any verdict reached under a different rules version
collapses to `INCONCLUSIVE`. An `APPROVE` additionally requires that at least
one evidence URL was actually retrieved. No input shape produces an approval
by default.

## Network and status

- **Network:** GenLayer Studio Dev / Studio Next, chain id **61997**
- **RPC:** `https://studio-dev.genlayer.com/api`
- **Explorer:** `https://explorer-studio-dev.genlayer.com`
- **Contract address:** [`0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76`](https://explorer-studio-dev.genlayer.com/address/0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76) — **live**, verified by
  `gen_getContractSchema` (14 methods) and a real on-chain read of
  `get_config`. Deploy tx
  [`0x4ca5244a86e67d36…`](https://explorer-studio-dev.genlayer.com/tx/0x4ca5244a86e67d3606dc93e74fafda59c67b9acb50a0527fc5c69276e8ec2311).

Studio Next is a development network. Its operators can reset it; if that
happens, deployed contracts and every case in them are gone and the protocol
must be redeployed. This is stated in the UI, not buried here.

## Running the tests

```bash
pip install genlayer-test genvm-linter Pillow pytest
python -m pytest tests -q
```

128 tests, in two layers:

- `tests/unit` — 69 plain-pytest tests over `contracts/non_lib.py`, which has
  zero genlayer imports. URL allowlist and SSRF guard, enum canonicalization,
  evidence normalization, the equivalence comparator, and every branch of the
  bond ledger including value conservation.
- `tests/direct` — 59 gltest direct-mode tests that deploy the real bundle
  into a GenVM sandbox and drive the whole flow: scopes, constitutions,
  version pinning, all four outcomes, the appeal window, bond accounting, and
  claims. Eight of them run the **real captured validator closure** with the
  web/LLM mocks swapped underneath it, so validator independence is executed,
  not just asserted.

Lint the deployable bundle:

```bash
python scripts/build_bundle.py
genvm-lint check build/Non.bundled.py
```

**A note on CI.** The `contract` and `frontend` jobs are self-contained and
must pass. The `genvm` job — lint plus the direct-mode tests — is marked
`continue-on-error`, because on a cold runner the published GenVM archive's
index does not currently contain the `py-genlayer` runner tarball for this
contract's pinned SDK version, and the fetch fails before any of the
contract's own code is examined. That is an upstream toolchain gap, not a
result about Non. Both steps are run locally before every release with the
commands above; `docs/STATUS.md` records the results.

## Repository layout

```
contracts/    non_lib.py (pure logic, no genlayer import) + Non.py
scripts/      build_bundle.py — produces the single deployable file
tests/        unit/ (plain pytest) + direct/ (gltest, real GenVM)
docs/         architecture · audit · STEWARD · STATUS
frontend/     Vite + React + TypeScript app, fails closed
build/        generated Non.bundled.py — do not hand-edit
```

`contracts/Non.py` and `contracts/non_lib.py` are the sources of truth.
The network only ever receives `build/Non.bundled.py`, whose first line is the
bare `Depends` comment with nothing above it.

## What Non is not

Not a DAO factory, not a custodial treasury, not a membership app, and not a
grant payroll that wires funds because a model said yes. Non produces a
judgment and settles the bonds behind it. An external system may *read* a
final approval; none is required for Non to be correct.

Fetched pages are untrusted web content and a submission is hostile input.
Text inside either that addresses the adjudicator, claims authority, or
demands an outcome is ignored. A page proves only what appears in its
normalized record.

## Licence

MIT — see [LICENSE](LICENSE).
