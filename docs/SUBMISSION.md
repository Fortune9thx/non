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
| Contract (explorer) | https://explorer-studio-dev.genlayer.com/address/0xfc34Ce61034952807899B8abE172BF76cC6036a0 |
| Deploy tx | https://explorer-studio-dev.genlayer.com/tx/0xe16cc1269e082ddd23fd4a4d53fcbcf7719385023ef136051af86294dfe74167 |
| Network | GenLayer Studio Next, chain id 61997 |
| Example case (APPROVE) | https://non-omega.vercel.app/app/cases/NON-000002 |
| Example case (INCONCLUSIVE) | https://non-omega.vercel.app/app/cases/NON-000001 |

## Notes field

Plain text, 952 characters. Paste verbatim.

> Non is a bonded constitutional tribunal. It settles one contested question
> on-chain: do a proposal's material claims meet a pinned constitution under
> independently fetched evidence? Outcomes: APPROVE, REJECT, REVISE,
> INCONCLUSIVE.
>
> Every validator re-fetches the HTTPS evidence, re-runs the prompt and
> derives its own verdict through the same pure code. The leader's result
> stands only on exact agreement of decision, outcome and the case's pinned
> rules version. The agreed envelope is bound to the case id and that case's
> locked evidence URLs.
>
> Proposers and challengers each bond 2 GEN, with a 6h appeal window. A final
> REJECT forfeits the proposer's bond; a failed challenge forfeits the
> challenger's. INCONCLUSIVE and REVISE refund exactly, no fee. A stuck case
> expires after 72h and returns every bond.
>
> Live: two real bonded cases adjudicated (NON-000002 APPROVE; NON-000001
> INCONCLUSIVE, the fail-closed path firing live). 170 tests, lint clean.

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

- `finalize`, `claim`, `challenge` and `expire_case` have not run on chain
  yet: the appeal window is 6h and the expiry window 72h, and neither floor is
  loosenable. All are fully covered in gltest against a real GenVM sandbox,
  with value conservation asserted on every branch.
- No adverse verdict (REJECT/REVISE) has been produced live.
- Live LLM output is non-deterministic. NON-000001 is a real instance:
  `exec_prompt` returned something unparseable, and the contract collapsed it
  to INCONCLUSIVE rather than guessing. This is the designed response, not a
  defect — but it means a caller should expect to retry.
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
