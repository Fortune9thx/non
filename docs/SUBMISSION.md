# Non — Portal submission packet

Everything a reviewer needs, in one place. Links verified reachable
(HTTP 200) at the time of writing — check the **exact** URL as submitted, not
the one you believe is correct, since a single truncated character produces a
404 that reads as "repo is private".

## Evidence fields

| Field | Value |
| --- | --- |
| GitHub | https://github.com/Fortune9thx/non |
| Live app | https://non-omega.vercel.app |
| Contract (explorer) | https://explorer-studio-dev.genlayer.com/address/0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c |
| Deploy tx | https://explorer-studio-dev.genlayer.com/tx/0xec59d576564b52f5c5919f75f3e8e4cffb7aff2165224c776d8282a6ff3b4930 |
| Network | GenLayer Studio Next, chain id 61997 |
| Example case (APPROVE, 100/100/0) | https://non-omega.vercel.app/app/cases/NON-000002 |
| Example case (APPROVE, 95/92/5) | https://non-omega.vercel.app/app/cases/NON-000001 |
| Bond ledger settled (NON-000001) | https://explorer-studio-dev.genlayer.com/tx/0x768e54f9d9b7f48fd32a3a84d25a8db298f6649922da9d1c5f9e117457f94c02 |
| Bond ledger settled (NON-000002) | https://explorer-studio-dev.genlayer.com/tx/0xcb30c21502604f113cf22dff3e99b375355462ca6608602ab7f016427ae66e28 |
| Example case (REJECT, false claims) | https://non-omega.vercel.app/app/cases/NON-000003 |
| REJECT adjudication tx | https://explorer-studio-dev.genlayer.com/tx/0x6d62a6bea80a3db2fb9b36af91a5b3cc4fddee139fbc7f7b575c35e778767de5 |
| `expire_case` auth refused live | https://explorer-studio-dev.genlayer.com/tx/0xd96eb029130f0eb9d22fb4571c3d393b1babe8ee89f7ca6b1f046d0de9a9a66d |

## Notes field

Plain text, 981 characters. Paste verbatim.

> Non is a bonded constitutional tribunal. It settles one contested question
> on-chain: do a proposal's material claims meet a pinned constitution under
> independently fetched evidence? Outcomes: APPROVE, REJECT, REVISE,
> INCONCLUSIVE.
>
> Every validator re-fetches the evidence, re-runs the prompt and derives its
> own verdict through the same pure code. The leader's result stands only on
> exact agreement of decision, outcome and the pinned rules version. The
> agreed envelope is bound to the case id and that case's locked evidence
> URLs.
>
> Proposers and challengers each bond 2 GEN, with a 6h appeal window. A final
> REJECT forfeits the proposer's bond; a failed challenge forfeits the
> challenger's. INCONCLUSIVE and REVISE refund exactly. A stuck case expires
> after 72h and returns every bond.
>
> Live: three real bonded cases adjudicated. Two honest ones returned
> APPROVE; a third, whose claims contradicted its own evidence, returned
> REJECT naming each defect. 177 tests pass; lint clean.

## What GenLayer decides

Constitutional compliance of a natural-language proposal against a
natural-language rule set, and whether its material claims survive evidence
each validator fetches for itself. Neither is computable from on-chain data.

## Who loses money on a false verdict

| Final outcome | No challenger | Challenger bonded |
| --- | --- | --- |
| REJECT | Proposer's bond forfeit to treasury, less 2% | Proposer's bond pays the challenger, less 2% |
| APPROVE | Review bond returned in full | Challenger's bond pays the proposer, less 2% |
| REVISE / INCONCLUSIVE | Every bond returned exactly, no fee | Every bond returned exactly, no fee |

## Known limitations, stated up front

- **`finalize` has run on chain** for the two APPROVE cases, and the ledger
  it wrote matches `settle_accounting` exactly: 4 GEN to the proposer, 0 to
  the treasury — live confirmation that the protocol fee applies to slashed
  bonds only. **`claim()` has not**, and cannot be shown for those cases: the
  credited address is the retired deploy key. The payout call is exercised
  directly in gltest against `emit_transfer`.
- **A REJECT verdict has been produced live** (NON-000003, on deliberately
  false claims). **The slash it implies has not settled yet** — the 6h appeal
  window is still open, so the bond is held and the treasury reads 0. On that
  case the proposer and treasury are the same address, so the settlement will
  demonstrate the contract's routing decision rather than a transfer between
  distinct parties; the faucet was tried first and credits nothing on this
  network.
- `challenge` and re-evaluation have not run on chain — a challenge must land
  inside a 6h window whose floor is deliberately not loosenable. Covered in
  gltest with value conservation asserted on every branch.
- `expire_case` has run on chain only in its **refusal** path: a non-party was
  rejected live with `not a party to this case`. A *successful* expiry still
  needs a case stuck for 72h, so the refund arithmetic and the `REVIEWING`
  branch remain unproven live.
- All 177 tests execute and pass where the pinned GenVM runner is cached
  (107 pure-logic + 70 GenVM-sandbox). `tests/direct` cannot run from a
  **fresh** checkout, because that runner asset now returns HTTP 404 upstream
  and has to be downloaded on first use — so CI marks that job
  `continue-on-error`. The pure-logic suite imports no GenLayer code and runs
  anywhere.
- No adverse verdict (REJECT/REVISE) has been produced live.
- Live LLM output is non-deterministic, and this project has observed it
  directly: the superseded deploy produced an INCONCLUSIVE on this exact
  proposal because `exec_prompt` returned something unparseable and the
  contract collapsed it rather than guessing, while the current deploy
  produced APPROVE on both runs, with `fit_score` differing (92 and 100) on
  identical input. The fail-closed collapse is the designed response, not a
  defect — but it means a caller should expect to retry, and it is covered in
  `tests/unit` rather than being re-summoned on demand here.
- Studio Next state can be reset by its operators, destroying all cases.
- The CI `genvm` job is allowed to fail: on a cold runner the published GenVM
  archive's index does not contain the `py-genlayer` runner tarball for the
  pinned SDK, so the fetch fails before any contract code is examined. The
  SDK-free lint stage and the full pure-logic suite run in the must-pass job.

## Where to look first

1. `settle_accounting()` in `contracts/non_lib.py` — the whole money story,
   pure, with conservation asserted by the caller.
2. `bind_envelope()` — the verdict must be about *this* case, citing *this*
   case's locked evidence.
3. `canonicalize_verdict()` — the one-way safety direction toward
   INCONCLUSIVE.
4. `validator_fn` inside `Non.evaluate_case`, and `docs/audit.md` finding 1 —
   why the *positive* validator tests are the load-bearing ones.
5. `expire_case()` — the bounded liveness escape hatch.
