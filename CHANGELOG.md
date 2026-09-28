# Changelog

All notable changes to Non are recorded here.

## [1.1.0] — 2026-09-28

Redeployed to GenLayer Studio Next (chain 61997) at
`0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`, superseding
`0xfc34Ce61034952807899B8abE172BF76cC6036a0`.

### Fixed
- **`expire_case` was unauthenticated.** Its only guards were the case state
  and the clock, so any address — no bond, no evidence, no validator review —
  could permanently end any funded case 72 hours after it opened. It is now
  bound to the parties whose bonds are locked in the case: the proposer alone
  while unchallenged, proposer or challenger once challenged. Unauthorised
  callers get `not a party to this case`.
- **`REVIEWING` had no expiry path.** It is now covered in both expiry
  branches, with re-evaluation dated from the challenge rather than the
  original open.

### Verified on chain
- `gen_getContractSchema` returns 15 methods including `expire_case`.
- `get_config` returns the expected constants with a clean 42-character
  treasury address.
- A non-party calling `expire_case` on funded, OPEN case `NON-000001` was
  refused with `not a party to this case`, leaving the case untouched.
- `core-grants` v1.0 re-pinned, with `rules_text` and `rules_json` byte
  identical to the superseded contract's.
- Two real bonded cases opened and adjudicated: `NON-000001` APPROVE
  (95 / fit 92 / risk 5) and `NON-000002` APPROVE (100 / fit 100 / risk 0).

### Added
- `scripts/e2e_check.mjs` — a single command that verifies the build, the live
  contract and its state, and that the **deployed app's JavaScript carries the
  live address and no superseded one**. It reads the address from
  `deploy/deployments.json` so it cannot drift, and exits non-zero on failure.
  Both failure modes were confirmed to fail: a stale app address and an
  unreachable contract. Not wired into the must-pass CI, because it depends on
  a development network whose operators can reset it.

### Documentation and repository hygiene
- Corrected the test counts, which were wrong and internally inconsistent:
  the suite is **177** (107 unit + 70 direct), not 170, and the README's own
  breakdown (101 + 69) did not sum to the total it stated.
- `SECURITY.md` claimed the contract was not deployed and made no
  live-network security claim. It now records the live address, the
  authorisation boundary for every restricted method, the unheld `owner`
  key, and what remains unexercised on chain.
- Documented the expiry escape hatch in `README.md`, including who may call
  `expire_case` and why it is restricted — it was absent entirely.
- `README.md` test instructions now separate the two layers by what they
  require, and note the `-p no:gltest` workaround.
- Repository layout now lists `deploy/` and links `SECURITY.md`.
- Untracked `frontend/tsconfig.tsbuildinfo`, a TypeScript incremental build
  cache that should never have been committed, and extended
  `frontend/.gitignore` to cover it.

### Notes
- Deployed from an ephemeral key funded via `sim_fundAccount`, so `owner` has
  no live holder. `treasury` and the `core-grants` scope `admin` were both set
  to `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537`, so fee destination and
  constitution control are unaffected.
- `tests/direct` could not be executed: its pinned GenVM runner asset returns
  HTTP 404 upstream. 107 pure-logic tests pass.

## [1.0.0] — 2026-09-27

Initial build. **Deployed and verified live on GenLayer Studio Next**
(chain 61997) at `0xfc34Ce61034952807899B8abE172BF76cC6036a0`.

### Deployed
- Five-step on-chain smoke test: deploy accepted; `gen_getContractSchema`
  returns 14 methods; `get_config` returns the expected constants with an
  uncorrupted treasury address; `register_scope` + `set_constitution` write
  real state; and a negative call returns the contract's own `case missing`
  `UserError` from chain.
- The frontend was pointed at the live address and confirmed reading real
  state, including the constitution written in the smoke test.
- **Live case NON-000001**: opened with a real 2 GEN bond, both evidence URLs
  fetched on chain, a real prompt run, and validator consensus reached on an
  APPROVE (score 95). Both nondeterministic paths exercised in production.
- Frontend deployed to https://non-omega.vercel.app, reading the live contract.
- Not yet on chain: `finalize` and `claim`, since the six-hour appeal window's
  floor is deliberately not loosenable.

### Fixed after the first deploy
- **Event topic overflow and silent field scrambling.** `CaseOpened` declared
  four indexed fields, but `ABI.EVENT_MAX_TOPICS` is 4 *including* the
  signature topic, so `open_case` aborted on chain with `SystemError: 2:
  inval`. Separately, the SDK binds indexed fields by zipping alphabetically
  sorted names against positional values, so three events recorded their data
  under the wrong names. gltest direct-mode reproduces neither; all tests
  passed against the broken code. Both rules are now enforced by
  `tests/unit/test_events.py`, and the contract was redeployed.

### Contract
- Bonded constitutional tribunal with four canonical outcomes: APPROVE,
  REJECT, REVISE, INCONCLUSIVE.
- Scope registration and forward-only constitution versioning; `open_case`
  freezes the rules version onto the case.
- Single `gl.vm.run_nondet` equivalence block: independent HTTPS evidence
  fetches and an independent prompt per validator; agreement required on
  decision, outcome and pinned rules version, with a score tolerance of 10.
- Bond ledger with asserted value conservation; the protocol fee is charged on
  slashed bonds only. INCONCLUSIVE and REVISE refund exactly.
- 6-hour appeal window; a challenge forces a second independent reading before
  finalization.
- SSRF-guarded evidence URLs: HTTPS only, no private, loopback or link-local
  hosts.
- Configurable minimums floored at the protocol defaults — an operator can
  make Non stricter, never cheaper to lie to.

### Fixed before release
- **Critical:** the `run_nondet` validator unwrapped its argument incorrectly
  (`str(leader_result)` on a `gl.vm.Return` wrapper), so it returned `False`
  unconditionally and every case would have failed consensus. See
  `docs/audit.md` finding 1.
- **High:** `gl.nondet.web.Response.body` is `bytes`; the normalizer treated a
  non-`str` body as empty, so every successful fetch produced an empty record
  and every case would have been forced to INCONCLUSIVE.
- Two `genvm-lint` findings: a `@staticmethod` contract method, and
  nondeterministic calls the linter could not trace to the equivalence block.

### Tests
- 170 passing: 101 pure-logic (no genlayer import) and 69 gltest direct-mode
  against a real GenVM sandbox, including 8 that execute the real captured
  validator closure.

### Frontend
- Vite + React + TypeScript. Marketing page and `/app` shell: board, cases,
  case ticket, open, constitution, claims.
- Fails closed everywhere. No fixtures, no demo data, no seeded metrics.
  Unreadable chain state renders an em dash, never a zero.
- Liveness via `gen_getContractSchema`, not `eth_getCode` (which returns `0x`
  for a healthy intelligent contract).
