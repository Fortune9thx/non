import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Copyable, Empty, ErrorNote, Loading, StateChip, Verdict } from "../components/Common";
import {
  countdown,
  explorerTx,
  fmtGen,
  fmtTime,
  getCase,
  getConfig,
  shortAddr,
  submitWrite,
  toWei,
  type CaseRecord,
  type Config,
} from "../lib/chain";

type Busy = "" | "evaluate" | "challenge" | "finalize" | "expire";

export default function CaseTicket() {
  const { caseId = "" } = useParams();
  const { isLive, account, refreshWallet, checking } = useOutletContext<AppContext>();

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [txHash, setTxHash] = useState("");
  const [actionError, setActionError] = useState("");

  const [note, setNote] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [challengeBond, setChallengeBond] = useState("2");

  const load = useCallback(() => {
    if (!isLive || !caseId) {
      setRecord(null);
      return;
    }
    setError("");
    Promise.all([getCase(caseId), getConfig()])
      .then(([rec, cfg]) => {
        setRecord(rec);
        setConfig(cfg);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [caseId, isLive]);

  useEffect(load, [load]);

  // A transaction hash is a receipt of submission, not of success. Every
  // action waits for a terminal state and checks it before this page shows
  // anything as done -- an UNDETERMINED consensus outcome records nothing
  // at all, and must never be rendered as a completed action.
  const run = async (kind: Busy, method: string, args: unknown[], value?: bigint) => {
    if (!account) return;
    setBusy(kind);
    setActionError("");
    setTxHash("");
    try {
      const outcome = await submitWrite({ method, args, value, account });
      setTxHash(outcome.hash);
      if (!outcome.ok) {
        setActionError(outcome.reason);
      }
      load();
      refreshWallet();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  if (checking) return <Loading label="Checking the network" />;

  if (!isLive) {
    return (
      <div className="card">
        <Empty>
          This case cannot be read. The protocol is not live on this network.
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-ghost btn-sm" to="/app">
              Back to the board
            </Link>
          </div>
        </Empty>
      </div>
    );
  }

  if (error) return <ErrorNote error={error} />;
  if (!record) return <Loading label={`Reading ${caseId}`} />;

  const now = Date.now() / 1000;
  const state = record.derived_state;
  const appealOpen = state === "APPEAL_WINDOW";
  const isProposer =
    !!account && account.toLowerCase() === record.proposer.toLowerCase();

  const canEvaluate =
    !!account &&
    (state === "OPEN" ||
      (state !== "FINAL" && !!record.challenger && record.eval_rounds < 2));
  const canChallenge = !!account && appealOpen && !record.challenger && !isProposer;
  const canFinalize =
    !!account &&
    state === "DECIDED" &&
    !appealOpen &&
    (!record.challenger || record.eval_rounds >= 2);

  // The bounded escape hatch: only offered once a case has actually been
  // stuck past its expiry window with no reachable verdict, and only to a
  // party whose bond is locked in it. Expiring ends a case permanently, so
  // the contract refuses a caller with nothing at stake; mirroring that here
  // means a stranger sees no button rather than an opaque revert.
  const isChallenger =
    !!account &&
    !!record.challenger &&
    account.toLowerCase() === record.challenger.toLowerCase();
  const expiryDeadline = record.expiry_deadline ?? 0;
  const canExpire =
    (isProposer || isChallenger) &&
    state !== "FINAL" &&
    expiryDeadline > 0 &&
    now >= expiryDeadline;

  return (
    <>
      <div className="row between wrap gap-16">
        <div>
          <div className="row gap-12 wrap" style={{ marginBottom: 10 }}>
            <span className="eyebrow mono">{record.case_id}</span>
            <StateChip state={state} />
            <Verdict decision={record.decision} />
          </div>
          <h1 style={{ fontSize: "clamp(26px, 3.4vw, 38px)", maxWidth: 720 }}>
            {record.subject?.title || "—"}
          </h1>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/app">
          Board
        </Link>
      </div>

      {txHash && !actionError && (
        <div className="banner banner-live">
          <div>
            <strong>Confirmed on chain.</strong>{" "}
            <a className="mono" href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              {shortAddr(txHash)}
            </a>{" "}
            — the case record above reflects it.
          </div>
        </div>
      )}
      {actionError && <ErrorNote error={actionError} />}

      <div className="grid-2 gap-24" style={{ alignItems: "start" }}>
        {/* ------------------------------------------------- left column */}
        <div className="stack gap-24">
          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              The proposal
            </div>
            {record.subject?.summary && (
              <p style={{ marginTop: 0 }}>{record.subject.summary}</p>
            )}
            <div className="eyebrow" style={{ margin: "22px 0 12px" }}>
              Material claims
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
              {(record.subject?.claims ?? []).map((claim, i) => (
                <li key={i}>{claim}</li>
              ))}
            </ol>
            <p className="hint" style={{ marginBottom: 0, marginTop: 18 }}>
              Submitted text is untrusted input. Instructions embedded in it are
              ignored by the adjudicator.
            </p>
          </section>

          <section className="card">
            <div className="row between" style={{ marginBottom: 16 }}>
              <span className="eyebrow">Evidence</span>
              <span className="chip">{record.evidence_urls.length} urls</span>
            </div>
            {record.evidence_urls.length === 0 ? (
              <Empty>No evidence on this case.</Empty>
            ) : (
              <div>
                {record.evidence_urls.map((url) => {
                  const report = record.evidence_report?.find((r) => r.url === url);
                  return (
                    <div className="evidence-item" key={url}>
                      <span
                        className={`dot ${
                          !report ? "" : report.ok ? "dot-live" : "dot-down"
                        }`}
                        style={{ marginTop: 7, flex: "none" }}
                      />
                      <div className="grow">
                        <a
                          className="url"
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {url}
                        </a>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          {!report
                            ? "not yet retrieved"
                            : `${report.ok ? "retrieved" : "not retrieved"} · status ${
                                report.status
                              }${report.title ? ` · ${report.title}` : ""}`}
                        </div>
                        {report?.limitations && (
                          <div className="small muted" style={{ marginTop: 2 }}>
                            {report.limitations}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Verdict
            </div>
            {!record.decision ? (
              <Empty>Not evaluated yet.</Empty>
            ) : (
              <>
                <div className="row gap-12 wrap" style={{ marginBottom: 18 }}>
                  <Verdict decision={record.decision} />
                  <span className="chip">{record.outcome}</span>
                  <span className="chip">
                    round {record.eval_rounds} · {record.rules_version}
                  </span>
                </div>

                <Score label="Score" value={record.scores?.score} />
                <Score label="Fit" value={record.scores?.fit_score} />
                <Score label="Risk" value={record.scores?.risk} />

                {record.reasoning && (
                  <Block title="Reasoning" body={record.reasoning} />
                )}
                {record.weak_spots && (
                  <Block title="Weak spots" body={record.weak_spots} />
                )}
                {record.corrections && (
                  <Block title="Corrections required" body={record.corrections} />
                )}
                {record.improvements && (
                  <Block title="Improvements" body={record.improvements} />
                )}
                {record.uncertainty && (
                  <Block title="Uncertainty" body={record.uncertainty} />
                )}

                <p className="hint" style={{ marginBottom: 0, marginTop: 18 }}>
                  Retrieval status is the adjudicator's own fetch record. It is
                  bound to this case's locked urls, but it is not itself
                  re-agreed field by field — what consensus protects is the
                  verdict it produced.
                </p>
                <p className="hint" style={{ marginBottom: 0, marginTop: 18 }}>
                  Scores are informational. Only decision, outcome and the pinned
                  constitution version are enforced by the equivalence rule
                  {config ? ` (scores must agree within ${config.score_tolerance})` : ""}.
                </p>
              </>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ right column */}
        <div className="stack gap-24">
          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Record
            </div>
            <dl className="kv">
              <dt>Scope</dt>
              <dd className="mono">{record.scope_id}</dd>
              <dt>Rules version</dt>
              <dd className="mono">{record.rules_version}</dd>
              <dt>Proposer</dt>
              <dd>
                <Copyable value={record.proposer} short />
              </dd>
              <dt>Opened</dt>
              <dd className="mono small">{fmtTime(record.opened_at)}</dd>
              <dt>Decided</dt>
              <dd className="mono small">{fmtTime(record.decided_at)}</dd>
              {record.decided_at > 0 && (
                <>
                  <dt>Appeal ends</dt>
                  <dd className="mono small">
                    {fmtTime(record.appeal_deadline)}
                    {appealOpen && (
                      <span className="muted">
                        {" "}
                        · {countdown(record.appeal_deadline, now)} left
                      </span>
                    )}
                  </dd>
                </>
              )}
              {record.finalized_at > 0 && (
                <>
                  <dt>Finalized</dt>
                  <dd className="mono small">{fmtTime(record.finalized_at)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Bonds
            </div>
            <dl className="kv">
              <dt>Review bond</dt>
              <dd className="mono">{fmtGen(record.review_bond)} GEN</dd>
              <dt>Challenger</dt>
              <dd>
                {record.challenger ? (
                  <Copyable value={record.challenger} short />
                ) : (
                  <span className="muted">none</span>
                )}
              </dd>
              {record.challenger && (
                <>
                  <dt>Challenge bond</dt>
                  <dd className="mono">{fmtGen(record.challenge_bond)} GEN</dd>
                </>
              )}
            </dl>

            {record.challenge_note && (
              <Block title="Challenger's note" body={record.challenge_note} />
            )}

            <hr className="rule" style={{ margin: "18px 0" }} />
            <p className="hint" style={{ margin: 0 }}>
              {record.decision === "inconclusive" || record.decision === "revise"
                ? "This outcome returns every bond exactly. No fee is charged."
                : record.decision === "reject"
                ? record.challenger
                  ? "The challenge succeeded: the proposer's bond pays the challenger, less the protocol fee."
                  : "The proposer's bond is forfeit to the treasury, less the protocol fee."
                : record.decision === "approve"
                ? record.challenger
                  ? "The challenge failed: the challenger's bond pays the proposer, less the protocol fee."
                  : "The review bond is returned in full."
                : "Bond accounting is written when the case finalizes."}
            </p>
          </section>

          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Actions
            </div>

            {!account && (
              <p className="hint" style={{ marginTop: 0 }}>
                Connect a wallet to act on this case.
              </p>
            )}

            <div className="stack gap-12">
              <button
                className="btn btn-primary"
                disabled={!canEvaluate || busy !== ""}
                onClick={() => run("evaluate", "evaluate_case", [record.case_id])}
              >
                {busy === "evaluate" ? "Evaluating…" : "Evaluate"}
              </button>
              <p className="hint" style={{ margin: 0 }}>
                {state === "OPEN"
                  ? "Runs the adjudication. Permissionless — anyone may pay the gas."
                  : record.challenger && record.eval_rounds < 2
                  ? "This case was challenged and needs its second, independent reading."
                  : "Already evaluated."}
              </p>

              {canChallenge && (
                <>
                  <hr className="rule" />
                  <label className="field">
                    <span className="field-label">Challenge bond (GEN)</span>
                    <input
                      type="text"
                      value={challengeBond}
                      onChange={(e) => setChallengeBond(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Why is this wrong?</span>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Claim 2 is contradicted by the filing at…"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Extra evidence (one url per line)</span>
                    <textarea
                      rows={2}
                      value={extraUrls}
                      onChange={(e) => setExtraUrls(e.target.value)}
                      placeholder="https://…"
                    />
                  </label>
                  <button
                    className="btn btn-ghost"
                    disabled={busy !== "" || !note.trim()}
                    onClick={() => {
                      let value: bigint;
                      try {
                        value = toWei(challengeBond);
                      } catch (err) {
                        setActionError(
                          err instanceof Error ? err.message : String(err)
                        );
                        return;
                      }
                      const urls = extraUrls
                        .split("\n")
                        .map((u) => u.trim())
                        .filter(Boolean);
                      run(
                        "challenge",
                        "challenge",
                        [record.case_id, note.trim(), urls.length ? JSON.stringify(urls) : ""],
                        value
                      );
                    }}
                  >
                    {busy === "challenge" ? "Bonding…" : "Challenge this verdict"}
                  </button>
                  <p className="hint" style={{ margin: 0 }}>
                    Your bond is forfeit if the verdict holds. A challenger may add
                    evidence, never remove it.
                  </p>
                </>
              )}

              {appealOpen && isProposer && (
                <p className="hint" style={{ margin: 0 }}>
                  You opened this case, so you cannot challenge it.
                </p>
              )}

              <hr className="rule" />
              <button
                className="btn btn-ghost"
                disabled={!canFinalize || busy !== ""}
                onClick={() => run("finalize", "finalize", [record.case_id])}
              >
                {busy === "finalize" ? "Finalizing…" : "Finalize"}
              </button>
              <p className="hint" style={{ margin: 0 }}>
                {state === "FINAL"
                  ? "This case is final. Balances are on the Claims page."
                  : appealOpen
                  ? "Available once the appeal window closes."
                  : "Writes the bond ledger. Permissionless."}
              </p>

              {canExpire && (
                <>
                  <hr className="rule" />
                  <button
                    className="btn btn-ghost"
                    disabled={busy !== ""}
                    onClick={() => run("expire", "expire_case", [record.case_id])}
                  >
                    {busy === "expire" ? "Expiring…" : "Expire and refund"}
                  </button>
                  <p className="hint" style={{ margin: 0 }}>
                    This case has gone {Math.round(
                      (config?.expiry_seconds ?? 259200) / 3600
                    )}h without a reachable verdict. Expiring it returns every
                    bond exactly, with no fee and no winner.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Score({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="row between small" style={{ marginBottom: 6 }}>
        <span className="muted">{label}</span>
        <span className="mono">{value}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 7 }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>{body}</p>
    </div>
  );
}
