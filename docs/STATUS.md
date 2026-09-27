# Non — status

_Last updated: 2026-09-27 — deployed and verified live._

## Contract

| | |
| --- | --- |
| **Deployed** | **Yes — live on Studio Next.** |
| Address | [`0xb263b7E8972D243639F797948A3322cE1Ca657dc`](https://explorer-studio-dev.genlayer.com/address/0xb263b7E8972D243639F797948A3322cE1Ca657dc) |
| Live app | https://non-omega.vercel.app |
| Deploy tx | [`0x4ca5244a86e67d36…`](https://explorer-studio-dev.genlayer.com/tx/0xb551f25c47e3bf0320c948853a3068810f2c8bc31c86a139564d17c9402f5bd9) — `ACCEPTED` |
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
| `tests/unit` | 69 | Pure logic in isolation: URL allowlist + SSRF guard, enum canonicalization, evidence normalization, the equivalence comparator, full bond ledger with value conservation. No genlayer import. |
| `tests/direct` | 59 | The real bundle deployed into a GenVM sandbox: scopes, constitution pinning, all four outcomes, the appeal window (via `warp`), bond accounting, claims, config floors. |
| — of which validator | 8 | The **real captured validator closure**, run with web/LLM mocks swapped underneath it. |
| **Total** | **128** | All passing. |

## Verification actually performed

Local:

- `python -m pytest tests -q` → 128 passed.
- `genvm-lint check build/Non.bundled.py` → lint + validation pass.
- `npm run build` in `frontend/` → clean; `tsc -b --noEmit` clean.

On chain (Studio Next, 2026-09-27) — a real five-step smoke test:

1. **Deploy** → `ACCEPTED`, contract address above.
2. **`gen_getContractSchema`** → returns all **14 methods**. (`eth_getCode` on
   this same live address returns `0x`, confirming first-hand that it is the
   wrong liveness probe for an intelligent contract.)
3. **`get_config`** → returns the expected constants: 2 GEN review and
   challenge bonds, 1 GEN settle bond, 21600 s appeal window, 200 bps fee, the
   four decisions, `case_count: 0`. The `treasury` field came back as a clean
   42-character address, confirming the bare `--args 0xADDR` form did not
   corrupt it.
4. **`register_scope` + `set_constitution`** (real writes) → `core-grants` v1.0
   pinned on chain, with `rules_json` stored canonically as
   `{"max_budget_gen":1000,"requires_public_repo":true}`.
5. **Negative test** — `evaluate_case` on a nonexistent case id. The leader
   receipt's decoded result is `b'case missing'`: the contract's own
   `UserError` string, returned from chain. That proves deploy, storage, write
   dispatch and error handling all work live, without moving any funds.

The frontend was then pointed at the live address and confirmed reading real
state: the network chip goes green, `get_config` populates the bond and window
chips, the board correctly shows zero cases, and the constitution page renders
the `core-grants` rules that were written on chain in step 4.

## Live case NON-000001

A real case was opened, bonded and adjudicated on chain:

| | |
| --- | --- |
| Proposal | "Fund continued work on Non" against `core-grants` v1.0 |
| Claims | the repository is public; the project is MIT licensed |
| Evidence | the GitHub repo page and the raw `LICENSE` file |
| Review bond | **2 GEN**, attached as real native value |
| Verdict | **APPROVE** / `approved`, score 95, fit 96, risk 8 |
| Evidence fetches | both URLs retrieved, status 200 |

Both nondeterministic paths ran for real: `gl.nondet.web.get` fetched the two
pages and `gl.nondet.exec_prompt` produced a verdict that cites each piece of
evidence specifically. The transaction finished `SUCCESS`, which means the
**validators independently re-fetched the evidence, re-ran the prompt, and
agreed** — the equivalence principle holding in production, not in a mock.

The case is viewable at https://non-omega.vercel.app/app/cases/NON-000001.

## Not yet done

- **`finalize` and `claim` have not run on chain.** The appeal window is six
  hours and its floor is deliberately not loosenable (an operator can only
  make Non stricter), so the case must sit in `APPEAL_WINDOW` until it
  expires. Every branch of the bond ledger is proven in gltest with value
  conservation asserted, but no bond has actually been paid out on chain.
- **`challenge` and re-evaluation have not run on chain**, for the same
  reason.
- **No adverse verdict has been produced live.** The one real case was
  correctly approved, so REJECT, REVISE and INCONCLUSIVE have been exercised
  only in gltest.

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
