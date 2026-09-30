import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Empty, ErrorNote, Loading, StateChip, Verdict } from "../components/Common";
import {
  fmtGen,
  fmtTime,
  loadAllCases,
  shortAddr,
  type CaseRecord,
} from "../lib/chain";

const FILTERS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "APPEAL_WINDOW", label: "In appeal" },
  { key: "DECIDED", label: "Decided" },
  { key: "FINAL", label: "Final" },
];

const VERDICTS = ["", "approve", "reject", "revise", "inconclusive"];

export default function Cases() {
  const { isLive, account, checking } = useOutletContext<AppContext>();
  const [cases, setCases] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState("");
  const [verdict, setVerdict] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (checking) return;
    if (!isLive) {
      setCases([]);
      return;
    }
    let cancelled = false;
    setCases(null);
    loadAllCases()
      .then((rows) => !cancelled && setCases(rows))
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setCases([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLive, checking]);

  const rows = useMemo(() => {
    const all = cases ?? [];
    const q = query.trim().toLowerCase();
    const me = account?.toLowerCase();
    return all
      .filter((c) => (state ? c.derived_state === state : true))
      .filter((c) => (verdict ? c.decision === verdict : true))
      .filter((c) =>
        mineOnly && me
          ? c.proposer.toLowerCase() === me || c.challenger.toLowerCase() === me
          : true
      )
      .filter((c) =>
        q
          ? c.case_id.toLowerCase().includes(q) ||
            c.scope_id.toLowerCase().includes(q) ||
            (c.subject?.title ?? "").toLowerCase().includes(q)
          : true
      )
      .reverse();
  }, [cases, state, verdict, mineOnly, query, account]);

  return (
    <>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Cases
        </div>
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>Every case on chain</h1>
      </div>

      {error && <ErrorNote error={error} />}

      <div className="card stack gap-16">
        <div className="row gap-16 wrap between">
          <div className="row gap-8 wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`btn btn-sm ${state === f.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setState(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="row gap-12 wrap">
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)}
              style={{ width: "auto", minWidth: 150 }}>
              {VERDICTS.map((v) => (
                <option key={v} value={v}>
                  {v || "Any verdict"}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, scope, title"
              style={{ width: 230 }}
            />
            {account && (
              <label className="row gap-8 small muted" style={{ whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Mine only
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="card card-flush">
        {cases === null ? (
          <Loading label="Reading cases" />
        ) : rows.length === 0 ? (
          <Empty>
            {(cases ?? []).length === 0
              ? `No cases on chain yet.${isLive || checking ? "" : " The protocol is not live on this network."}`
              : "No cases match these filters."}
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
                <th>Review bond</th>
                <th>Challenger</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.case_id}>
                  <td>
                    <Link className="mono" to={`/app/cases/${c.case_id}`}>
                      {c.case_id}
                    </Link>
                  </td>
                  <td>
                    <div style={{ maxWidth: 300 }}>
                      <div>{c.subject?.title || "—"}</div>
                      <div className="small muted">{fmtTime(c.opened_at)}</div>
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
                  <td className="mono">{fmtGen(c.review_bond)}</td>
                  <td className="mono small muted">
                    {c.challenger ? shortAddr(c.challenger) : "—"}
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
