# Changelog

All notable changes to Non are recorded here.

## [1.0.0] — 2026-09-27

Initial build. Not deployed.

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
- 128 passing: 69 pure-logic (no genlayer import) and 59 gltest direct-mode
  against a real GenVM sandbox, including 8 that execute the real captured
  validator closure.

### Frontend
- Vite + React + TypeScript. Marketing page and `/app` shell: board, cases,
  case ticket, open, constitution, claims.
- Fails closed everywhere. No fixtures, no demo data, no seeded metrics.
  Unreadable chain state renders an em dash, never a zero.
- Liveness via `gen_getContractSchema`, not `eth_getCode` (which returns `0x`
  for a healthy intelligent contract).
