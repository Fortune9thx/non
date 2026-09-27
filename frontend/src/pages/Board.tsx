import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Empty, ErrorNote, Loading, StateChip, Verdict } from "../components/Common";
import {
  countdown,
  fmtGen,
  fmtTime,
  getConfig,
  loadAllCases,
  shortAddr,
  type CaseRecord,
  type Config,
} from "../lib/chain";

/**
 * The board.
 *
 * Every number here is derived from cases actually read off the chain. If
 * the protocol is not live, the loader never runs and the page renders
 * its real empty state — there is no placeholder row, no sample case and
 * no seeded TVL anywhere in this file.
 */
export default function Board() {
  const { isLive } = useOutletContext<AppContext>();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLive) {
      setCases([]);
      return;
    }
    let cancelled = false;
    setCases(null);
    Promise.all([loadAllCases(), getConfig()])
      .then(([rows, cfg]) => {
        if (cancelled) return;
        setCases(rows);
        setConfig(cfg);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setCases([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const now = Date.now() / 1000;
  const rows = cases ?? [];
  const unknown = !isLive || cases === null || !!error;
  const open = rows.filter((c) => c.derived_state !== "FINAL").length;
  const decided24h = rows.filter(
    (c) => c.decided_at > 0 && now - c.decided_at < 86400
  ).length;
  const inconclusive = rows.filter((c) => c.decision === "inconclusive").length;
  const bonded = rows
    .filter((c) => c.derived_state !== "FINAL")
    .reduce(
      (sum, c) => sum + BigInt(c.review_bond || "0") + BigInt(c.challenge_bond || "0"),
      0n
    );

  return (
    <>
      <div className="row between wrap gap-16">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Board
          </div>
          <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>
            Cases on chain
          </h1>
        </div>
        <Link className="btn btn-primary" to="/app/open">
          Open a case
        </Link>
      </div>

      {error && <ErrorNote error={error} />}

      {/* An unreadable chain shows "—", never "0". A zero would claim a
          fact about on-chain state that we did not actually read. */}
      <div className="grid-4">
        <Stat label="Open cases" value={unknown ? "—" : String(open)} />
        <Stat label="Decided, 24h" value={unknown ? "—" : String(decided24h)} />
        <Stat label="Inconclusive" value={unknown ? "—" : String(inconclusive)} />
        <Stat
          label="GEN bonded, live cases"
          value={unknown ? "—" : fmtGen(bonded)}
        />
      </div>

      {config && (
        <div className="row gap-8 wrap small muted">
          <span className="chip">
            min review bond {fmtGen(config.min_review_bond)} GEN
          </span>
          <span className="chip">
            min challenge bond {fmtGen(config.min_challenge_bond)} GEN
          </span>
          <span className="chip">
            appeal {Math.round(config.appeal_window_seconds / 3600)}h
          </span>
          <span className="chip">fee {config.protocol_fee_bps / 100}% on slashes</span>
        </div>
      )}

      <div className="card card-flush">
        {cases === null ? (
          <Loading label="Reading cases" />
        ) : rows.length === 0 ? (
          <Empty>
            No cases on chain yet.
            {!isLive && " The protocol is not live on this network."}
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Proposal</th>
                <th>Scope</th>
                <th>State</th>
                <th>Verdict</th>
                <th>Bonded</th>
                <th>Appeal</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((c) => (
                  <tr key={c.case_id}>
                    <td>
                      <Link className="mono" to={`/app/cases/${c.case_id}`}>
                        {c.case_id}
                      </Link>
                    </td>
                    <td>
                      <div style={{ maxWidth: 280 }}>
                        <div>{c.subject?.title || "—"}</div>
                        <div className="small muted">
                          {shortAddr(c.proposer)} · {fmtTime(c.opened_at)}
                        </div>
                      </div>
                    </td>
                    <td className="mono small">
                      {c.scope_id}
                      <div className="muted">{c.rules_version}</div>
                    </td>
                    <td>
                      <StateChip state={c.derived_state} />
                    </td>
                    <td>
                      <Verdict decision={c.decision} />
                    </td>
                    <td className="mono">
                      {fmtGen(
                        BigInt(c.review_bond || "0") + BigInt(c.challenge_bond || "0")
                      )}
                    </td>
                    <td className="mono small muted">
                      {c.derived_state === "APPEAL_WINDOW"
                        ? countdown(c.appeal_deadline, now)
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div
        className="mono"
        style={{ fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div className="metric-label" style={{ marginTop: 10 }}>
        {label}
      </div>
    </div>
  );
}
