import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Empty, ErrorNote, Loading, StateChip, Verdict } from "../components/Common";
import {
  explorerTx,
  fmtGen,
  getCase,
  getClaimable,
  listCasesFor,
  shortAddr,
  writeContract,
  type CaseRecord,
} from "../lib/chain";

/**
 * Claims.
 *
 * `claim()` pays the caller their whole ledger balance across every case
 * they have touched, so the balance shown here is a single number rather
 * than a per-case list of things to collect one at a time.
 */
export default function Claims() {
  const { isLive, account, refreshWallet } = useOutletContext<AppContext>();
  const [owed, setOwed] = useState<bigint | null>(null);
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");

  const load = useCallback(() => {
    if (!isLive || !account) {
      setOwed(null);
      setCases([]);
      return;
    }
    setError("");
    getClaimable(account)
      .then(setOwed)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));

    listCasesFor(account)
      .then(async (ids) => {
        const settled = await Promise.allSettled(ids.map((id) => getCase(id)));
        setCases(
          settled
            .filter((r): r is PromiseFulfilledResult<CaseRecord> => r.status === "fulfilled")
            .map((r) => r.value)
        );
      })
      .catch(() => setCases([]));
  }, [isLive, account]);

  useEffect(load, [load]);

  const claim = async () => {
    if (!account) return;
    setBusy(true);
    setError("");
    setTxHash("");
    try {
      const hash = await writeContract({ method: "claim", args: [], account });
      setTxHash(hash);
      load();
      refreshWallet();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Claims
        </div>
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>Your balance</h1>
        <p className="lede" style={{ maxWidth: 620 }}>
          Bonds are credited to a ledger when a case finalizes. Claiming pays out
          everything owed to you at once, so the last claimant of a pot is never
          left holding dust.
        </p>
      </div>

      {error && <ErrorNote error={error} />}
      {txHash && (
        <div className="banner banner-live">
          <div>
            <strong>Claim submitted.</strong>{" "}
            <a className="mono" href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              {shortAddr(txHash)}
            </a>
          </div>
        </div>
      )}

      <div className="card">
        {!account ? (
          <Empty>Connect a wallet to see what you are owed.</Empty>
        ) : !isLive ? (
          <Empty>The protocol is not live on this network.</Empty>
        ) : owed === null ? (
          <Loading label="Reading ledger" />
        ) : (
          <div className="row between wrap gap-24">
            <div>
              <div className="metric-value">{fmtGen(owed, 4)}</div>
              <div className="metric-label">GEN claimable · {shortAddr(account)}</div>
            </div>
            <button
              className="btn btn-primary"
              disabled={owed === 0n || busy}
              onClick={claim}
            >
              {busy ? "Claiming…" : owed === 0n ? "Nothing to claim" : "Claim all"}
            </button>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Cases you have touched
        </div>
        <div className="card card-flush">
          {!account ? (
            <Empty>Not connected.</Empty>
          ) : cases === null ? (
            <Loading label="Reading cases" />
          ) : cases.length === 0 ? (
            <Empty>
              You have not opened or challenged any case.
              <div style={{ marginTop: 16 }}>
                <Link className="btn btn-ghost btn-sm" to="/app/open">
                  Open a case
                </Link>
              </div>
            </Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Your role</th>
                  <th>State</th>
                  <th>Verdict</th>
                  <th>Your bond</th>
                </tr>
              </thead>
              <tbody>
                {cases
                  .slice()
                  .reverse()
                  .map((c) => {
                    const me = account.toLowerCase();
                    const isProposer = c.proposer.toLowerCase() === me;
                    return (
                      <tr key={c.case_id}>
                        <td>
                          <Link className="mono" to={`/app/cases/${c.case_id}`}>
                            {c.case_id}
                          </Link>
                          <div className="small muted">{c.subject?.title}</div>
                        </td>
                        <td className="small">
                          {isProposer ? "proposer" : "challenger"}
                        </td>
                        <td>
                          <StateChip state={c.derived_state} />
                        </td>
                        <td>
                          <Verdict decision={c.decision} />
                        </td>
                        <td className="mono">
                          {fmtGen(isProposer ? c.review_bond : c.challenge_bond)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
