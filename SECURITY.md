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

**Authorisation boundaries.** Three actions are restricted, and everything
else is permissionless by design:

- `set_constitution` — the scope's `admin`, or the contract `owner`.
- `expire_case` — only a party whose bond is locked in that case: the
  proposer while it is unchallenged, the proposer or the challenger once it
  is challenged. Expiry is terminal, so an unauthenticated caller could
  otherwise end any funded case and force the proposer to re-open and
  re-bond.
- `challenge` — anyone except the proposer.

`evaluate_case`, `finalize` and `claim` are deliberately permissionless:
anyone may push a case forward or settle it, so no party is hostage to
another's inaction.

**Untrusted:** every proposal, every fetched page, every challenger note,
every model response, and every RPC answer the frontend receives.

## Known limits

- **Live deployment.** `0x98dE8a0F72d62F806B02a18a2e24326f82E1Ba6c` on
  GenLayer Studio Next (chain 61997). See `deploy/deployments.json` for the
  superseded addresses and why each was replaced.
- **The `owner` key is not held.** The live contract was deployed from an
  ephemeral key that was not retained, so `owner` has no live holder. This
  removes a privilege rather than exposing one: `owner`'s only power is
  `set_constitution` on a scope the caller does not already administer.
  `treasury` and the `core-grants` scope `admin` are both
  `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537`, so fee destination and
  constitution control are unaffected. A redeploy from the project key
  restores it.
- **Not yet exercised on chain:** `finalize`, `claim`, `challenge`, and a
  *successful* `expire_case`. The appeal window is 6h and the expiry window
  72h, and neither floor is loosenable. `expire_case`'s refusal path *has*
  run live — a non-party was rejected with `not a party to this case`.
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
