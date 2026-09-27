# Non — status

_Last updated: 2026-09-27 — deployed and verified live._

## Contract

| | |
| --- | --- |
| **Deployed** | **Yes — live on Studio Next.** |
| Address | [`0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76`](https://explorer-studio-dev.genlayer.com/address/0x235c4fAeDd0F8427732231B2D4CBBCB62035aa76) |
| Deploy tx | [`0x4ca5244a86e67d36…`](https://explorer-studio-dev.genlayer.com/tx/0x4ca5244a86e67d3606dc93e74fafda59c67b9acb50a0527fc5c69276e8ec2311) — `ACCEPTED` |
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

## Not yet done

- **No case has been opened on chain.** `open_case`, `challenge` and
  `finalize` are all payable, and `genlayer write` has no flag for attaching
  native GEN — so a real bonded end-to-end case requires the frontend with an
  injected wallet, or a direct `genlayer-js` script. The full case lifecycle is
  proven in gltest direct-mode against a real GenVM sandbox, not yet on chain.
- **The frontend's write path has not round-tripped a real transaction.** The
  Consensus v0.6 fee shape is wired via `estimateTransactionFeesForWrite`, but
  is unproven from the browser.
- **No live adjudication has run**, so `gl.nondet.web.get` and
  `gl.nondet.exec_prompt` have not been exercised against the real network —
  only against gltest's mocks.

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
