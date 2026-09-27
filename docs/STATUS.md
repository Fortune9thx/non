# Non — status

_Last updated: 2026-09-27._

## Contract

| | |
| --- | --- |
| **Deployed** | **No.** No address on any network. |
| Target network | GenLayer Studio Dev / Studio Next, chain id 61997 |
| RPC | `https://studio-dev.genlayer.com/api` |
| Explorer | `https://explorer-studio-dev.genlayer.com` |
| Deployable bundle | `build/Non.bundled.py` |
| Bundle size | ~33.8 KB (ceiling observed across prior deploys: 52,224 bytes) |
| Pinned runner | `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| `genvm-lint check` | Passes (3 checks) + validation passes, 14 methods (7 view, 7 write) |

`VITE_CONTRACT_ADDRESS` is deliberately empty. The frontend renders its real
empty state and says the protocol is not deployed. It will only be set after a
deploy is confirmed live by `gen_getContractSchema`.

## Tests

| Layer | Count | What it proves |
| --- | --- | --- |
| `tests/unit` | 69 | Pure logic in isolation: URL allowlist + SSRF guard, enum canonicalization, evidence normalization, the equivalence comparator, full bond ledger with value conservation. No genlayer import. |
| `tests/direct` | 59 | The real bundle deployed into a GenVM sandbox: scopes, constitution pinning, all four outcomes, the appeal window (via `warp`), bond accounting, claims, config floors. |
| — of which validator | 8 | The **real captured validator closure**, run with web/LLM mocks swapped underneath it. |
| **Total** | **128** | All passing. |

## Verification actually performed

- `python -m pytest tests -q` → 128 passed.
- `genvm-lint check build/Non.bundled.py` → lint + validation pass.
- `npm run build` in `frontend/` → clean; `tsc -b --noEmit` clean.
- Frontend rendered and inspected in a browser at 1440×900: landing page,
  `/app` board, `/app/open`. Fail-closed banner and empty states confirmed
  visually; zero console errors.

## Not yet done

- **No on-chain deploy.** Consequently: no live address, no transaction
  hashes, no explorer links, and no end-to-end smoke test.
- **No payable call has ever executed against a live network.** `genlayer
  write` cannot attach native GEN, so `open_case`, `challenge` and `finalize`
  need a wallet or a direct `genlayer-js` script.
- **The frontend's write path has not round-tripped a real transaction.** The
  Consensus v0.6 fee shape is wired via `estimateTransactionFeesForWrite`, but
  is unproven from this app.

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

**2. `--args '["0xADDR"]'` is parsed as one argument whose value is a JSON
array**, not as an argument list. `Non`'s constructor takes `treasury: str`,
so the correct form for a single string argument is `--args '"0xADDR"'`. A
bare `0x…` is auto-detected as an *address* type, which a `str` parameter also
rejects.

Before concluding "the network is down", look up your own transaction hash on
the explorer API. If it is not found, the failure was client-side and never
reached the chain — and separately, listing recent transactions shows whether
other accounts are succeeding right now.

After a successful deploy: verify with `gen_getContractSchema` (**not**
`eth_getCode`, which returns `0x` for a healthy intelligent contract), record
the address in `deploy/deployments.json`, and only then set
`VITE_CONTRACT_ADDRESS`.
