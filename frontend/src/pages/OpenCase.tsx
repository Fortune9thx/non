import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { ErrorNote, Verdict } from "../components/Common";
import {
  explorerTx,
  fmtGen,
  getConfig,
  getScope,
  shortAddr,
  toWei,
  writeContract,
  type Config,
  type ScopeRecord,
} from "../lib/chain";

/**
 * Open a case.
 *
 * The preview card on the right shows exactly what will be written on
 * chain — it is built from the form's own values, and it never claims a
 * verdict, a score or an outcome that does not exist yet.
 */
export default function OpenCase() {
  const navigate = useNavigate();
  const { isLive, account } = useOutletContext<AppContext>();

  const [scopeId, setScopeId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [claims, setClaims] = useState("");
  const [urls, setUrls] = useState("");
  const [bond, setBond] = useState("2");

  const [config, setConfig] = useState<Config | null>(null);
  const [scope, setScope] = useState<ScopeRecord | null>(null);
  const [scopeError, setScopeError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    if (!isLive) return;
    getConfig().then(setConfig).catch(() => undefined);
  }, [isLive]);

  // Resolve the scope as it is typed so the pinned constitution version is
  // visible BEFORE any bond is posted.
  useEffect(() => {
    const id = scopeId.trim().toLowerCase();
    if (!isLive || !id) {
      setScope(null);
      setScopeError("");
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      getScope(id)
        .then((rec) => {
          if (cancelled) return;
          setScope(rec);
          setScopeError(
            rec.constitution ? "" : "This scope has no constitution pinned yet."
          );
        })
        .catch(() => {
          if (cancelled) return;
          setScope(null);
          setScopeError("No such scope on chain.");
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [scopeId, isLive]);

  const claimList = useMemo(
    () => claims.split("\n").map((c) => c.trim()).filter(Boolean),
    [claims]
  );
  const urlList = useMemo(
    () => urls.split("\n").map((u) => u.trim()).filter(Boolean),
    [urls]
  );

  const maxUrls = config?.max_evidence_urls ?? 8;
  const minBond = config ? BigInt(config.min_review_bond) : 2n * 10n ** 18n;

  const problems: string[] = [];
  if (!scopeId.trim()) problems.push("A scope id is required.");
  if (scope && !scope.constitution) problems.push("That scope has no constitution.");
  if (!title.trim()) problems.push("A title is required.");
  if (claimList.length === 0) problems.push("At least one material claim is required.");
  if (urlList.length === 0) problems.push("At least one evidence url is required.");
  if (urlList.length > maxUrls) problems.push(`At most ${maxUrls} evidence urls.`);
  if (urlList.some((u) => !u.startsWith("https://")))
    problems.push("Evidence urls must be https.");
  let bondWei = 0n;
  try {
    bondWei = toWei(bond);
    if (bondWei < minBond)
      problems.push(`The review bond must be at least ${fmtGen(minBond)} GEN.`);
  } catch {
    problems.push("The bond must be a number.");
  }

  const canSubmit = isLive && !!account && problems.length === 0 && !busy;

  const submit = async () => {
    if (!account) return;
    setBusy(true);
    setError("");
    setTxHash("");
    try {
      const subject = JSON.stringify({
        title: title.trim(),
        summary: summary.trim(),
        claims: claimList,
      });
      const hash = await writeContract({
        method: "open_case",
        args: [scopeId.trim().toLowerCase(), subject, JSON.stringify(urlList)],
        value: bondWei,
        account,
      });
      setTxHash(hash);
      setTimeout(() => navigate("/app"), 2500);
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
          Open a case
        </div>
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>
          Put a claim on the record
        </h1>
        <p className="lede" style={{ maxWidth: 620 }}>
          The scope's current constitution version is frozen onto the case when it
          opens. Your bond is forfeit if the tribunal finally rejects it.
        </p>
      </div>

      {error && <ErrorNote error={error} />}
      {txHash && (
        <div className="banner banner-live">
          <div>
            <strong>Case submitted.</strong>{" "}
            <a className="mono" href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              {shortAddr(txHash)}
            </a>{" "}
            — returning to the board.
          </div>
        </div>
      )}

      <div className="grid-2 gap-24" style={{ alignItems: "start" }}>
        <section className="card stack gap-16">
          <label className="field">
            <span className="field-label">Scope id</span>
            <input
              type="text"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder="core-grants"
            />
            {scopeError ? (
              <span className="hint" style={{ color: "var(--warn)" }}>
                {scopeError}
              </span>
            ) : scope?.constitution ? (
              <span className="hint">
                Will be judged under{" "}
                <span className="mono">{scope.constitution.version}</span>, pinned
                by {shortAddr(scope.admin)}.
              </span>
            ) : (
              <span className="hint">The body of rules this case is judged under.</span>
            )}
          </label>

          <label className="field">
            <span className="field-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fund the open telemetry adapter"
            />
          </label>

          <label className="field">
            <span className="field-label">Summary</span>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What is being proposed, in a sentence or two."
            />
          </label>

          <label className="field">
            <span className="field-label">
              Material claims — one per line ({claimList.length})
            </span>
            <textarea
              rows={4}
              value={claims}
              onChange={(e) => setClaims(e.target.value)}
              placeholder={"The repository is public.\nThe requested budget is 400 GEN."}
            />
            <span className="hint">
              Each claim must be supported by the evidence, or the case will not
              be approved.
            </span>
          </label>

          <label className="field">
            <span className="field-label">
              Evidence urls — one per line ({urlList.length}/{maxUrls})
            </span>
            <textarea
              rows={4}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"https://github.com/example/repo\nhttps://example.org/budget"}
            />
            <span className="hint">
              HTTPS only. Private, loopback and link-local hosts are refused.
            </span>
          </label>

          <label className="field">
            <span className="field-label">Review bond (GEN)</span>
            <input type="text" value={bond} onChange={(e) => setBond(e.target.value)} />
            <span className="hint">
              Minimum {fmtGen(minBond)} GEN. Returned on approve, revise or
              inconclusive; forfeit on a final reject.
            </span>
          </label>

          {problems.length > 0 && (
            <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            {busy
              ? "Submitting…"
              : !account
              ? "Connect a wallet to open a case"
              : !isLive
              ? "Protocol not live"
              : `Bond ${bond} GEN and open`}
          </button>
        </section>

        <section className="card">
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Preview
          </div>
          <div className="row gap-12 wrap" style={{ marginBottom: 18 }}>
            <span className="chip">not yet opened</span>
            <Verdict decision="" />
          </div>

          <h2 style={{ fontSize: 22, marginBottom: 10 }}>
            {title.trim() || <span className="muted">Untitled proposal</span>}
          </h2>
          {summary.trim() && (
            <p style={{ fontSize: 14, marginTop: 0 }}>{summary.trim()}</p>
          )}

          <div className="eyebrow" style={{ margin: "22px 0 10px" }}>
            Material claims
          </div>
          {claimList.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              None yet.
            </p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
              {claimList.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ol>
          )}

          <div className="eyebrow" style={{ margin: "22px 0 10px" }}>
            Evidence
          </div>
          {urlList.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              None yet.
            </p>
          ) : (
            urlList.map((u) => (
              <div className="url" key={u} style={{ marginBottom: 6 }}>
                {u}
              </div>
            ))
          )}

          <hr className="rule" style={{ margin: "22px 0 18px" }} />
          <dl className="kv">
            <dt>Scope</dt>
            <dd className="mono">{scopeId.trim().toLowerCase() || "—"}</dd>
            <dt>Rules version</dt>
            <dd className="mono">{scope?.constitution?.version ?? "—"}</dd>
            <dt>Review bond</dt>
            <dd className="mono">{bond || "0"} GEN</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
