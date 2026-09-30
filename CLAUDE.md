# Non — working notes for Claude Code

A bonded constitutional tribunal on GenLayer. Read this before changing anything.

## Current state (2026-09-30)

- **Live contract:** `0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c`, GenLayer
  Studio Next, chain **61997**.
- **App:** https://non-omega.vercel.app — built against that address.
- **`main` is green**, CI passing, working tree clean.
- **Submission-ready.** `docs/SUBMISSION.md` is the Portal packet and its
  evidence links are verified live.

`deploy/deployments.json` is the **single source of truth** for the address.
Never hardcode an address anywhere else; read it from there. Every superseded
address is recorded with the reason it was replaced.

## Verify before believing anything

```bash
node scripts/e2e_check.mjs     # 22 checks: build + live contract + deployed app
```

Studio Next is a development network its operators can reset. If the contract
vanishes, this is how you find out. Run it before any release or submission,
and at the start of any session that touches deployment. It exits non-zero on
failure and reads the address from `deployments.json`, so it cannot drift.

## Commit rules — not negotiable

- Author is **`Fortunex9 <fortuneemx@gmail.com>`**, sole-authored.
- **No co-author trailer, no AI attribution, no session links** — not in
  commit messages, not in PR bodies, not in docs, not in code comments.
- Work on `main` unless told otherwise.

## Traps that have already cost real time

Each of these was hit for real. Do not rediscover them.

1. **Never use `eth_getCode` as a liveness probe.** A healthy GenLayer
   intelligent contract returns `0x`. The authoritative probe is
   `gen_getContractSchema`, which returns a method schema when live and
   error `-32001` when nothing is there.

2. **The `genlayer` CLI has no preset for chain 61997.** Its `studionet`
   preset is **61999** — one digit away, and it has silently pointed at the
   wrong network before. `genlayer network info` can never report 61997.
   Use `genlayer-js`'s `studioDevnet` preset (which *is* 61997), or pass
   `--rpc https://studio-dev.genlayer.com/api` explicitly.

3. **Fees: use `estimateTransactionFees()`, not `estimateFeesDistribution()`.**
   The latter returns a distribution with no `feeValue`, and the write fails
   with `FeeValueMustBeNonZero(1)` — which reads like an on-chain revert but
   is client-side. Pass the whole result of the former as `fees`.

4. **Constructor address goes in bare and unquoted:** `--args 0xADDR`.
   `'"0xADDR"'` embeds literal quote characters that `Address()` rejects;
   `'["0xADDR"]'` is parsed as one array-valued argument.

5. **`build/Non.bundled.py` is generated. Never hand-edit it.** Run
   `python scripts/build_bundle.py`. CI fails if the committed bundle is not
   reproducible from source.

6. **Unit tests need `-p no:gltest`** when `genlayer-test` is installed: its
   pytest plugin validates every network in `gltest.config.yaml` and blocks
   collection because `studio_devnet` has no `accounts` key.

7. **`tests/direct` cannot run anywhere**, CI included. Its pinned GenVM
   runner asset (`genvm v0.6.0-rc6`) returns HTTP 404 upstream; `v0.6.0`,
   `rc5` and `rc7` were checked and 404 too. CI marks that job
   `continue-on-error`. This is upstream, not a defect in this repo. Do not
   "fix" it by skipping or rewriting tests.

8. **`VITE_*` values are inlined at build time.** Changing
   `VITE_CONTRACT_ADDRESS` on Vercel does nothing until a redeploy **with
   the build cache disabled**. A stale value produces an app silently serving
   a previous contract's cases — invisible in the repo, in CI and on chain.
   `scripts/e2e_check.mjs` is what catches it.

9. **Python's default `urllib` user agent gets 403 through some proxies.**
   Set an explicit `User-Agent` on outbound requests.

## Commands

```bash
python scripts/build_bundle.py              # regenerate the deployable bundle
python -m pytest tests -q                    # 177 tests (needs the runner cached)
python -m pytest tests/unit -q               # 107 pure-logic tests, no SDK
python scripts/check_line_endings.py         # LF-only gate, enforced in CI
npm --prefix frontend ci                     # frontend deps (incl. genlayer-js)
npm --prefix frontend run build              # typecheck + build
node scripts/e2e_check.mjs                   # full live end-to-end check
```

## Known limitations — state these, never paper over them

- **`tests/direct` needs the GenVM runner already cached** (trap 7). All 177
  tests (107 unit + 70 direct) execute and pass on a machine whose
  `~/.cache/gltest-direct` already holds the pinned runner — verified
  2026-09-30. From a **cold** checkout the direct suite cannot run at all,
  because that runner asset returns HTTP 404 upstream and has to be
  downloaded on first use; that is why CI marks the job
  `continue-on-error`. Check which situation you are in before describing it:
  run the suite rather than assuming either outcome. "177 pass where the
  runner is cached; the direct suite cannot run from a fresh clone" is the
  accurate claim — do not downgrade it to "only 107 ran", and do not claim
  177 pass from an environment where you have not run them.
- **`owner` has no live holder.** The live contract was deployed from an
  ephemeral key that was not retained. Contained by design: `treasury` and the
  `core-grants` scope `admin` are both
  `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537`, and `owner`'s only power is
  `set_constitution` on a scope the caller does not already administer.
  A redeploy from the project key restores it.
- **Not yet exercised on chain:** `finalize`, `claim`, `challenge`, and a
  *successful* `expire_case` (needs a case stuck 72h). `expire_case`'s
  refusal path *has* run live.
- Live LLM output is non-deterministic. Report what a run actually produced;
  never retry to reproduce a previous result.

## Where things are

```
contracts/   non_lib.py (pure logic, no genlayer import) + Non.py — sources of truth
build/       Non.bundled.py — generated, deployed, never hand-edited
scripts/     build_bundle.py · check_line_endings.py · e2e_check.mjs
tests/       unit/ (107, runs) + direct/ (70, cannot run — trap 7)
deploy/      deployments.json — the live address and every superseded one
docs/        STATUS · SUBMISSION · SECURITY(../) · architecture · audit · STEWARD
frontend/    Vite + React + TypeScript, fails closed when the contract is unreachable
```

`docs/STATUS.md` records what was actually verified and when. Keep it honest:
if something was not run, say so there rather than implying coverage.
