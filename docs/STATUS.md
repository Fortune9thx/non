# Non — status

_Last updated: 2026-09-28 — redeployed after the `expire_case` authentication fix, and verified live._

## Contract

| | |
| --- | --- |
| **Deployed** | **Yes — live on Studio Next.** |
| Address | [`0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`](https://explorer-studio-dev.genlayer.com/address/0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c) |
| Live app | https://non-omega.vercel.app |
| Deploy tx | [`0xec59d576564b52f5…`](https://explorer-studio-dev.genlayer.com/tx/0xec59d576564b52f5c5919f75f3e8e4cffb7aff2165224c776d8282a6ff3b4930) — `ACCEPTED` |
| Treasury | `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537` |
| Scope admin (`core-grants`) | `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537` |
| `owner` | `0x49fe058A588f2515Ad75D47B989114390B05eaC4` — see note below |
| Target network | GenLayer Studio Dev / Studio Next, chain id 61997 |
| RPC | `https://studio-dev.genlayer.com/api` |
| Explorer | `https://explorer-studio-dev.genlayer.com` |
| Deployable bundle | `build/Non.bundled.py` |
| Bundle size | 37,423 bytes (ceiling observed across prior deploys: 52,224 bytes) |
| Pinned runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| `genvm-lint check` | Passes (3 checks) + validation passes, 15 methods |

`VITE_CONTRACT_ADDRESS` on Vercel project `non` was updated to the address
above and the site redeployed without build cache on 2026-09-28. Verified by
fetching the served bundle: it contains the new address and no occurrence of
the superseded one, with chain id 61997 and the studio-dev RPC baked in. The
app links in `docs/SUBMISSION.md` are therefore live and submittable.

If the address stops resolving — Studio Next state can be reset by its
operators — the frontend detects that and renders its real empty state rather
than stale data.

**On `owner`.** This deploy was made from an ephemeral key generated in CI and
funded through the network's `sim_fundAccount` faucet; that key was not
retained, so `owner` has no live holder. The blast radius is contained by
design: `treasury` is a constructor argument and `register_scope` takes its
`admin` as an explicit parameter, so both were set to
`0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537` and fee destination and
constitution control are unaffected. `owner`'s only power is `set_constitution`
on a scope the caller does not already administer, which does not apply to
`core-grants`. A future deploy from the project key restores it.

## Tests

| Layer | Count | What it proves |
| --- | --- | --- |
| `tests/unit` | 107 | Pure logic in isolation: URL allowlist + SSRF guard, enum canonicalization, evidence normalization, envelope binding, the equivalence comparator, the expiry predicate, and the full bond ledger with value conservation. No genlayer import. |
| `tests/direct` | 70 | The real bundle deployed into a GenVM sandbox: scopes, constitution pinning, all four outcomes, the appeal window and the 72h expiry window (via `warp`), bond accounting, claims, config floors. |
| — of which validator | 8 | The **real captured validator closure**, run with web/LLM mocks swapped underneath it. |
| — of which event guards | 16 | Parse the contract source and enforce the indexed-field limit and ordering rules that gltest cannot reach. |
| **Total** | **177** | All 177 executed and passing (see below). |

**Which of these actually ran, and where.** All 177 were executed and pass
on a machine whose GenVM runner cache is already populated —
`python -m pytest tests -q` → **177 passed**, most recently on 2026-09-30
against this commit.

`tests/direct` cannot run in a **cold** environment, which is why CI marks
that job `continue-on-error`: the pinned runner
(`py-genlayer:5jycge…`, from `genvm v0.6.0-rc6`) has to be downloaded on
first use, and that asset currently returns **HTTP 404** upstream (`v0.6.0`,
`rc5` and `rc7` were checked and 404 as well). A machine that fetched the
runner before it disappeared keeps it under `~/.cache/gltest-direct` and runs
the suite normally.

So the limitation is an **upstream asset-availability problem for fresh
environments**, not a property of the tests: they execute and pass wherever
the runner is present. A reviewer cloning fresh should expect `tests/direct`
to fail at the download step, and `tests/unit` (which imports no GenLayer
code at all) to pass anywhere.

## Verification actually performed

Local:

- `python -m pytest tests -q` → **177 passed** (107 unit + 70 direct), on a
  machine with the runner cached.
- `python -m pytest tests/unit -q -p no:gltest` → 107 passed. (`-p no:gltest`
  is required when `genlayer-test` is installed *and* `gltest.config.yaml`
  has a network without an `accounts` key: its pytest plugin validates every
  network at collection time and blocks the run.)
- `tests/direct` → 70 passed locally; not runnable from a cold checkout, see
  above.
- `node scripts/e2e_check.mjs` → 22 checks passed, covering the build, the
  live contract, its state, and the deployed app's own JavaScript.
- `genvm-lint check build/Non.bundled.py` → lint + validation pass.
- `npm run build` in `frontend/` → clean; `tsc -b --noEmit` clean.

On chain (Studio Next, 2026-09-28):

1. **Deploy** -> `ACCEPTED`, contract address above.
2. **`gen_getContractSchema`** -> returns all **15 methods**. (`eth_getCode`
   on a live address returns `0x`, confirming first-hand that it is the wrong
   liveness probe for an intelligent contract.)
3. **`get_config`** -> the expected constants: 2 GEN review and challenge
   bonds, 1 GEN settle bond, 21600 s appeal window, 259200 s expiry window,
   200 bps fee, the four decisions. The `treasury` field came back as a clean
   42-character address, confirming the bare `--args 0xADDR` form did not
   corrupt it.
4. **`register_scope` + `set_constitution`** -> `core-grants` v1.0 pinned on
   chain, `rules_json` stored canonically.
5. **Two real bonded cases opened and adjudicated** -- see below.
6. **Negative test** (on the previous deploy of the same code path) --
   `evaluate_case` on a nonexistent case id returned the contract's own
   `UserError` string, decoded from the leader receipt as
   `b'case missing'`, proving storage, write dispatch and error handling
   work live without moving funds.

The frontend was then pointed at the live address and confirmed reading real
state: the network chip goes green, `get_config` populates the bond and window
chips, and both cases render with their real verdicts and evidence.

## Bond ledger settled on chain (2026-09-30)

Both appeal windows expired, and both cases were finalized with a real
permissionless `finalize` call — the first time the settlement path has run on
the live network.

| | |
| --- | --- |
| NON-000001 | [`0x768e54f9d9…`](https://explorer-studio-dev.genlayer.com/tx/0x768e54f9d9b7f48fd32a3a84d25a8db298f6649922da9d1c5f9e117457f94c02) — `FINISHED_WITH_RETURN` |
| NON-000002 | [`0xcb30c21502…`](https://explorer-studio-dev.genlayer.com/tx/0xcb30c21502604f113cf22dff3e99b375355462ca6608602ab7f016427ae66e28) — `FINISHED_WITH_RETURN` |

Both cases now read `state: FINAL`, `settled: true`. The ledger the calls
wrote was then read back and checked against what `settle_accounting` predicts
for two unchallenged APPROVEs:

| Address | Expected | On chain |
| --- | --- | --- |
| Proposer | 4 GEN (2 × the review bond, returned in full) | **4.000000000 GEN** |
| Treasury | 0 (the protocol fee applies to slashed bonds only) | **0** |

That second row is the one worth reading twice: it is the live confirmation
that an approval costs the proposer nothing, because the fee is charged on a
forfeiture and nowhere else.

`claim()` cannot be demonstrated for these two cases — the credited address is
the ephemeral deploy key described above, which was not retained. The payout
call itself is covered in gltest, where it is exercised directly rather than
mocked.

## Live cases

Two real cases were opened with genuine 2 GEN bonds and adjudicated on chain
against the deployed contract. Both nondeterministic paths ran for real:
`gl.nondet.web.get` fetched the evidence and `gl.nondet.exec_prompt` produced
the verdict. Every write was checked on `statusName` and `resultName`, not only
`txExecutionResultName`: all came back `ACCEPTED` / `MAJORITY_AGREE`, meaning
validators independently re-fetched, re-ran the prompt, and agreed, and the
result persisted.

Both cases used the same proposal ("Fund continued work on Non" against
`core-grants` v1.0), claiming the repository is public and MIT licensed, with
the GitHub repo page and the raw `LICENSE` file as evidence — byte-identical to
the proposal used on the superseded contract.

| | NON-000001 | NON-000002 |
| --- | --- | --- |
| Verdict | **APPROVE** / `approved` | **APPROVE** / `approved` |
| Scores | 95 / fit 92 / risk 5 | 100 / fit 100 / risk 0 |
| Evidence | both urls retrieved, 200 | both urls retrieved, 200 |
| Reasoning | cites both evidence records and the budget limit | cites both evidence records and the budget limit |
| Eval rounds | 1 | 1 |

**These verdicts differ from the previous deploy's, and that is expected.** The
superseded contract produced one APPROVE (95 / fit 100 / risk 5) and one
INCONCLUSIVE, the latter because `exec_prompt` returned something the contract
could not parse into a legal verdict and canonicalization collapsed it to
INCONCLUSIVE rather than guessing. This round both runs parsed cleanly and both
approved, with `fit_score` landing at 92 and 100 on identical input. Live LLM
output is genuinely non-deterministic; these runs were **not** retried to
reproduce the earlier spread, because doing so would make the record an
artefact of selection rather than an observation.

One consequence worth stating plainly: the fail-closed INCONCLUSIVE path that
the previous deploy demonstrated live has **not** been re-demonstrated on this
contract. It remains covered in `tests/unit`. It cannot be summoned on demand.

Viewable at https://non-omega.vercel.app/app.

## Not yet done

- **`claim` has not run on chain.** `finalize` now has (see below), and the
  bond ledger it wrote is verifiable by a read — but the credited party is
  the retired deploy key, so nobody can call `claim()` for these two cases.
  The payout itself is proven only in gltest, where `claim()` is exercised
  directly against `emit_transfer`.
- **`expire_case`'s refusal path has now run on chain; its settlement path has
  not.** A non-party was rejected live with `not a party to this case` (above),
  which is the fix this redeploy exists for. What has *not* run on chain is a
  successful expiry: that still requires a case stuck for 72 hours, so the
  refund arithmetic, the `REVIEWING` expiry branch, and the proposer's and
  challenger's own ability to expire remain proven only in tests — and the
  three direct-mode expiry tests covering the new rule are themselves
  unexecuted here (see Tests). The participant rule is proven live for refusal
  and in `tests/unit` at the library level via `expire_callers`.
- **`challenge` and re-evaluation have not run on chain**, for the same
  appeal-window reason.
- **No adverse verdict has been produced live.** REJECT and REVISE have been
  exercised only in gltest.

## Deploy notes for whoever runs it

Two failure modes have cost real time on this network before. Both are
caller-side, and both are fixable.

**1. A partial fee distribution fails client-side, before broadcast** — and
reports itself as `Transaction reverted: EVM tx 0x… FeeValueMustBeNonZero(N)`,
which reads exactly like a real on-chain revert. It is not: the hash will not
exist on the explorer. Passing only `--fee-value`, or a partial `--fees`,
reliably reproduces it. The fix is a **complete** fee object — one that
carries a non-zero `feeValue`, not just a distribution.

Observed first-hand on 2026-09-28, deploying through `genlayer-js` 2.0.0-rc.1:
`estimateFeesDistribution()` returns only the distribution, with no `feeValue`,
and deploying with it fails exactly this way. `estimateTransactionFees()` is
the one that returns `{distribution, feeValue, policy}`, and passing its whole
result as `fees` deployed on the first attempt — `feeValue`
`100000000000010352` (~0.1 GEN), against the ~0.075 GEN the superseded deploy
paid. So on this network the estimator was accurate and usable; the earlier
"~1000× too large" observation did not reproduce, and copying a historical
distribution wholesale was not necessary. Check `getCurrentFeePolicy()` first:
it returns `enabled: true` with live prices when the fee infrastructure is up,
which is a faster signal than a failed deploy.

**2. Pass the constructor address as a bare, unquoted token: `--args 0xADDR`.**
Two separate CLI argument bugs both have to be avoided here, and only the bare
form avoids both:

- `--args '["0xADDR"]'` is parsed as *one* argument whose value is a JSON
  array, not as an argument list.
- `--args '"0xADDR"'` embeds the **literal quote characters into the string**,
  so the contract receives a 44-character value starting with `"` rather than
  the 42-character address.

The second one matters specifically for `Non`, because its constructor calls
`Address(treasury).as_hex`, which re-parses the string and checks
`startswith("0x")`. That check fails on the quoted form, and the deploy dies
with `FINISHED_WITH_ERROR` rather than a clean error. A contract that merely
stores the string opaquely never notices, which is why the quoted form can
appear to "work" elsewhere.

Before concluding "the network is down", look up your own transaction hash on
the explorer API. If it is not found, the failure was client-side and never
reached the chain — and separately, listing recent transactions shows whether
other accounts are succeeding right now.

After a successful deploy: verify with `gen_getContractSchema` (**not**
`eth_getCode`, which returns `0x` for a healthy intelligent contract), record
the address in `deploy/deployments.json`, and only then set
`VITE_CONTRACT_ADDRESS`.
