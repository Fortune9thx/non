# Non — status

_Last updated: 2026-09-27 — deployed and verified live._

## Contract

| | |
| --- | --- |
| **Deployed** | **Yes — live on Studio Next.** |
| Address | [`0xfc34Ce61034952807899B8abE172BF76cC6036a0`](https://explorer-studio-dev.genlayer.com/address/0xfc34Ce61034952807899B8abE172BF76cC6036a0) |
| Live app | https://non-omega.vercel.app |
| Deploy tx | [`0xe16cc1269e082ddd…`](https://explorer-studio-dev.genlayer.com/tx/0xe16cc1269e082ddd23fd4a4d53fcbcf7719385023ef136051af86294dfe74167) — `ACCEPTED` |
| Treasury / owner | `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537` |
| Target network | GenLayer Studio Dev / Studio Next, chain id 61997 |
| RPC | `https://studio-dev.genlayer.com/api` |
| Explorer | `https://explorer-studio-dev.genlayer.com` |
| Deployable bundle | `build/Non.bundled.py` |
| Bundle size | ~33.8 KB (ceiling observed across prior deploys: 52,224 bytes) |
| Pinned runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| `genvm-lint check` | Passes (3 checks) + validation passes, 14 methods (7 view, 7 write) |

`VITE_CONTRACT_ADDRESS` is set to the live address above. If the address stops
resolving — Studio Next state can be reset by its operators — the frontend
detects that and renders its real empty state rather than stale data.

## Tests

| Layer | Count | What it proves |
| --- | --- | --- |
| `tests/unit` | 101 | Pure logic in isolation: URL allowlist + SSRF guard, enum canonicalization, evidence normalization, envelope binding, the equivalence comparator, the expiry predicate, and the full bond ledger with value conservation. No genlayer import. |
| `tests/direct` | 69 | The real bundle deployed into a GenVM sandbox: scopes, constitution pinning, all four outcomes, the appeal window and the 72h expiry window (via `warp`), bond accounting, claims, config floors. |
| — of which validator | 8 | The **real captured validator closure**, run with web/LLM mocks swapped underneath it. |
| — of which event guards | 16 | Parse the contract source and enforce the indexed-field limit and ordering rules that gltest cannot reach. |
| **Total** | **170** | All passing. |

## Verification actually performed

Local:

- `python -m pytest tests -q` → 170 passed.
- `genvm-lint check build/Non.bundled.py` → lint + validation pass.
- `npm run build` in `frontend/` → clean; `tsc -b --noEmit` clean.

On chain (Studio Next, 2026-09-27):

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

## Live cases

Two real cases were opened with genuine 2 GEN bonds and adjudicated on chain
against the deployed contract. Both nondeterministic paths ran for real:
`gl.nondet.web.get` fetched the evidence and `gl.nondet.exec_prompt` produced
the verdict, and both transactions finished `SUCCESS` — meaning validators
independently re-fetched, re-ran the prompt, and agreed.

Both cases used the same proposal ("Fund continued work on Non" against
`core-grants` v1.0), claiming the repository is public and MIT licensed, with
the GitHub repo page and the raw `LICENSE` file as evidence.

| | NON-000002 | NON-000001 |
| --- | --- | --- |
| Verdict | **APPROVE** / `approved` | **INCONCLUSIVE** |
| Scores | 95 / fit 100 / risk 5 | 0 / 0 / 0 |
| Evidence | both urls retrieved, 200 | both urls retrieved, 200 |
| Reasoning | cites both evidence records and the budget limit | none produced |

The two together are more useful than either alone. NON-000002 is the
substantive path working end to end. **NON-000001 is the fail-closed path
firing for real**: on that run `exec_prompt` returned something the contract
could not parse into a legal verdict, so canonicalization collapsed it to
INCONCLUSIVE rather than guessing — and INCONCLUSIVE returns every bond
exactly, with no fee and no winner. Live LLM output is genuinely
non-deterministic; this is the designed response to it, observed rather than
argued.

Viewable at https://non-omega.vercel.app/app.

## Not yet done

- **`finalize` and `claim` have not run on chain.** The appeal window is six
  hours and its floor is deliberately not loosenable (an operator can only
  make Non stricter), so both cases must age out first. Every branch of the
  bond ledger is proven in gltest with value conservation asserted, but no
  bond has actually been paid out on chain yet.
- **`expire_case` has not run on chain.** It requires a case to be stuck for
  72 hours, which by construction cannot be demonstrated sooner. It is fully
  covered in gltest, including that it refunds exactly, is permissionless,
  and refuses to run on a decided-unchallenged or already-final case.
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
reliably reproduces it. The fix is a **complete** distribution object, best
obtained by pulling a real successful deploy's
`fee_accounting.top_ups[].feesDistribution` off `/api/transactions?limit=N`
and copying it wholesale, rather than trusting `genlayer estimate-fees` —
whose own `feeValue` has been observed ~1000× larger than what successful
deploys actually paid.

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
