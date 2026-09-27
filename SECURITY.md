# Security

## Reporting

Open a GitHub issue for anything non-sensitive. For a vulnerability that could
move funds or forge a verdict, please report it privately to the repository
owner before disclosing it publicly.

## Scope and posture

Non holds only the bonds posted to it. It takes no custody of anything else
and wires no funds to any external system.

**Trusted:** the GenLayer consensus layer, the pinned `py-genlayer` runner,
and a scope admin — for their own scope's rules, forward in time only.

**Untrusted:** every proposal, every fetched page, every challenger note,
every model response, and every RPC answer the frontend receives.

## Known limits

- The contract is not deployed; no live-network security claim is made.
- Non constrains what a model's output can *do*, not what it thinks. The
  equivalence rule defends against a lying or compromised leader. It does not
  defend against every validator being wrong in the same way.
- Evidence fetches execute inside validator nodes. URLs are restricted to
  HTTPS and non-private hosts to keep those nodes from probing internal
  networks; see the SSRF guard in `contracts/non_lib.py`.
- Studio Next is a development network whose state can be reset by its
  operators, destroying all cases.

## Never in this repository

No private keys, no keystore files, no mnemonics, and no `.env` containing
secrets. `frontend/.env.example` contains only public endpoints.
