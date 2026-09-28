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

## When a case gets stuck

Consensus is not guaranteed to converge. A case whose evaluation never
succeeds would otherwise hold both bonds forever, so there is a bounded
escape hatch: after **72 hours**, `expire_case` settles it as `INCONCLUSIVE`
and returns every bond exactly, with no fee and no winner.

**Only a party to the case may call it** — the proposer while the case is
unchallenged, the proposer or the challenger once it is challenged. Expiry is
terminal, so leaving it open to anyone means any address could end any funded
case 72 hours after it opened, costing the caller only gas and forcing the
proposer to re-open and re-bond. Bonds refund exactly, so nothing is stolen;
it is a griefing vector, not a theft one.

Liveness survives the restriction. Each party can exit alone, so neither is
hostage to the other's inaction, and `evaluate_case`, `finalize` and `claim`
stay permissionless — anyone may push a case forward. Only *ending* one is
restricted.

## Network and status

- **Network:** GenLayer Studio Dev / Studio Next, chain id **61997**
- **RPC:** `https://studio-dev.genlayer.com/api`
- **Explorer:** `https://explorer-studio-dev.genlayer.com`
- **App:** [https://non-omega.vercel.app](https://non-omega.vercel.app) — live, reading the contract above
- **Contract address:** [`0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`](https://explorer-studio-dev.genlayer.com/address/0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c) — **live**, verified by
  `gen_getContractSchema` (15 methods) and a real on-chain read of
  `get_config`. Deploy tx
  [`0xec59d576564b52f5…`](https://explorer-studio-dev.genlayer.com/tx/0xec59d576564b52f5c5919f75f3e8e4cffb7aff2165224c776d8282a6ff3b4930).

Studio Next is a development network. Its operators can reset it; if that
happens, deployed contracts and every case in them are gone and the protocol
must be redeployed. This is stated in the UI, not buried here.

## Running the tests

**177 tests in two layers.** The first needs nothing but pytest; the second
needs the GenVM runner.

```bash
# Layer 1 — 107 pure-logic tests, no SDK, no network
pip install pytest
python -m pytest tests/unit -q
```

```bash
# Layer 2 — 70 direct-mode tests against a real GenVM sandbox
pip install genlayer-test genvm-linter Pillow
python -m pytest tests/direct -q
```

If `genlayer-test` is installed, layer 1 needs `-p no:gltest`: its pytest
plugin validates every network in `gltest.config.yaml` and blocks collection
because `studio_devnet` has no `accounts` key.

- `tests/unit` — 107 plain-pytest tests over `contracts/non_lib.py`, which has
  zero genlayer imports. URL allowlist and SSRF guard, enum canonicalization,
  evidence normalization, the equivalence comparator, and every branch of the
  bond ledger including value conservation.
- `tests/direct` — 70 gltest direct-mode tests that deploy the real bundle
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
              check_line_endings.py — LF-only gate, enforced in CI
tests/        unit/ (107, plain pytest) + direct/ (70, gltest, real GenVM)
docs/         architecture · audit · STEWARD · STATUS · SUBMISSION
deploy/       deployments.json — the live address, and every superseded one
frontend/     Vite + React + TypeScript app, fails closed
build/        generated Non.bundled.py — do not hand-edit
```

`deploy/deployments.json` is the single source of truth for what is live. An
address is recorded there only after `gen_getContractSchema` confirms it, and
every superseded address keeps the reason it was replaced.

Security policy, trust boundaries and the authorisation rules for each method:
[SECURITY.md](SECURITY.md).

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
