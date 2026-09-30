import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Copyable, Empty, ErrorNote, Loading } from "../components/Common";
import {
  explorerTx,
  fmtTime,
  getScope,
  shortAddr,
  submitWrite,
  type ScopeRecord,
} from "../lib/chain";

/**
 * Constitution reader.
 *
 * A scope's rules are only knowable by asking the chain for a specific
 * scope id — there is no on-chain enumeration of scopes, and this page
 * does not pretend otherwise by listing invented ones.
 */
export default function Constitution() {
  const { isLive, account, checking } = useOutletContext<AppContext>();
  const [params, setParams] = useSearchParams();
  const [scopeId, setScopeId] = useState(params.get("scope") ?? "");
  const [scope, setScope] = useState<ScopeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = (id: string) => {
    const key = id.trim().toLowerCase();
    setParams(key ? { scope: key } : {});
    if (!key || !isLive) {
      setScope(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    getScope(key)
      .then(setScope)
      .catch(() => {
        setScope(null);
        setError(`No scope "${key}" on chain.`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const initial = params.get("scope");
    if (initial && isLive) lookup(initial);   // re-runs when isLive flips true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const constitution = scope?.constitution ?? null;

  return (
    <>
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Constitution
        </div>
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>
          The rules a case is judged under
        </h1>
        <p className="lede" style={{ maxWidth: 640 }}>
          Each scope pins a version. Opening a case freezes that version onto it,
          so a later amendment can never reach a case already in flight.
        </p>
      </div>

      <div className="card">
        <div className="row gap-12 wrap">
          <input
            type="text"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(scopeId)}
            placeholder="core-grants"
            style={{ maxWidth: 320 }}
          />
          <button
            className="btn btn-primary"
            onClick={() => lookup(scopeId)}
            disabled={!isLive || !scopeId.trim()}
          >
            Read
          </button>
        </div>
        {checking ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Checking the network…
          </p>
        ) : !isLive ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            The protocol is not live on this network, so no scope can be read.
          </p>
        ) : null}
      </div>

      {error && <ErrorNote error={error} />}
      {loading && <Loading label="Reading scope" />}

      {scopeId.trim() && !loading && (
        <ScopeAdmin
          scopeId={scopeId}
          scope={scope}
          account={account}
          isLive={isLive}
          onDone={() => lookup(scopeId)}
        />
      )}

      {scope && (
        <div className="grid-2 gap-24" style={{ alignItems: "start" }}>
          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              Rules
            </div>
            {!constitution ? (
              <Empty>This scope exists but has no constitution pinned yet.</Empty>
            ) : (
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {constitution.rules_text}
              </p>
            )}
          </section>

          <div className="stack gap-24">
            <section className="card">
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                Scope
              </div>
              <dl className="kv">
                <dt>Scope id</dt>
                <dd className="mono">{scope.scope_id}</dd>
                <dt>Admin</dt>
                <dd>
                  <Copyable value={scope.admin} short />
                </dd>
                <dt>Version</dt>
                <dd className="mono">{constitution?.version ?? "—"}</dd>
                <dt>Pinned</dt>
                <dd className="mono small">
                  {constitution ? fmtTime(constitution.set_at) : "—"}
                </dd>
              </dl>
            </section>

            {constitution && (
              <section className="card">
                <div className="eyebrow" style={{ marginBottom: 16 }}>
                  Structured constraints
                </div>
                <pre
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    lineHeight: 1.7,
                  }}
                >
                  {prettyJson(constitution.rules_json)}
                </pre>
                <p className="hint" style={{ marginBottom: 0, marginTop: 14 }}>
                  Stored canonically with sorted keys, so the same constraints
                  always serialize to the same bytes.
                </p>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}


/* -------------------------------------------------------------------------
   Scope administration.

   `register_scope` and `set_constitution` are the two writes that create the
   rules a case is judged against. Without them here the app can only read a
   scope somebody else made from the CLI, so a new operator cannot actually
   use the product end to end.
   ------------------------------------------------------------------------- */

function ScopeAdmin({
  scopeId,
  scope,
  account,
  isLive,
  onDone,
}: {
  scopeId: string;
  scope: ScopeRecord | null;
  account: string | null;
  isLive: boolean;
  onDone: () => void;
}) {
  const [admin, setAdmin] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [rulesText, setRulesText] = useState("");
  const [rulesJson, setRulesJson] = useState('{\n  "max_budget_gen": 1000\n}');
  const [busy, setBusy] = useState<"" | "register" | "pin">("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const id = scopeId.trim().toLowerCase();
  const exists = !!scope;
  const isAdmin =
    !!account && !!scope && scope.admin.toLowerCase() === account.toLowerCase();

  const run = async (
    kind: "register" | "pin",
    method: string,
    args: unknown[]
  ) => {
    if (!account) return;
    setBusy(kind);
    setError("");
    setTxHash("");
    try {
      const outcome = await submitWrite({ method, args, account });
      setTxHash(outcome.hash);
      if (!outcome.ok) setError(outcome.reason);
      else onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  };

  // Mirror the contract's own validation so the user gets a real message
  // instead of an opaque revert.
  const idOk = /^[a-z0-9][a-z0-9._-]{1,63}$/.test(id);
  const rulesTextOk = rulesText.trim().length >= 20;
  let rulesJsonOk = true;
  try {
    const parsed = JSON.parse(rulesJson || "{}");
    rulesJsonOk = !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    rulesJsonOk = false;
  }

  return (
    <section className="card">
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        Scope administration
      </div>

      {!account ? (
        <p className="hint" style={{ marginTop: 0 }}>
          Connect a wallet to register a scope or pin a constitution.
        </p>
      ) : !isLive ? (
        <p className="hint" style={{ marginTop: 0 }}>
          The protocol is not live on this network.
        </p>
      ) : !idOk ? (
        <p className="hint" style={{ marginTop: 0 }}>
          Enter a scope id above first — lowercase letters, digits, dot, dash
          or underscore, 2–64 characters.
        </p>
      ) : null}

      {error && (
        <div className="banner banner-down" style={{ marginBottom: 14 }}>
          <div>{error}</div>
        </div>
      )}
      {txHash && !error && (
        <div className="banner banner-live" style={{ marginBottom: 14 }}>
          <div>
            Confirmed on chain —{" "}
            <a
              className="mono"
              href={explorerTx(txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(txHash)}
            </a>
          </div>
        </div>
      )}

      {!exists ? (
        <div className="stack gap-12">
          <label className="field">
            <span className="field-label">Admin address</span>
            <input
              type="text"
              value={admin}
              onChange={(e) => setAdmin(e.target.value)}
              placeholder={account ?? "0x…"}
            />
            <span className="hint">
              Who may pin constitutions for this scope. Defaults to you.
            </span>
          </label>
          <button
            className="btn btn-primary"
            disabled={!account || !isLive || !idOk || busy !== ""}
            onClick={() =>
              run("register", "register_scope", [id, (admin || account) as string])
            }
          >
            {busy === "register"
              ? "Registering…"
              : `Register "${id || "…"}"`}
          </button>
          <p className="hint" style={{ margin: 0 }}>
            Scope ids are first-come. A registered scope can never be taken
            over by anyone else.
          </p>
        </div>
      ) : !isAdmin ? (
        <p className="hint" style={{ marginTop: 0, marginBottom: 0 }}>
          This scope is administered by{" "}
          <span className="mono">{shortAddr(scope.admin)}</span>. Only that
          address can pin a new constitution for it.
        </p>
      ) : (
        <div className="stack gap-12">
          <label className="field">
            <span className="field-label">Version</span>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.0"
            />
          </label>
          <label className="field">
            <span className="field-label">Rules — plain language</span>
            <textarea
              rows={5}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="A proposal is compliant when every material claim it makes is supported by the fetched evidence…"
            />
            {!rulesTextOk && rulesText.length > 0 && (
              <span className="hint" style={{ color: "var(--warn)" }}>
                At least 20 characters.
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Structured constraints (JSON object)</span>
            <textarea
              rows={4}
              value={rulesJson}
              onChange={(e) => setRulesJson(e.target.value)}
            />
            {!rulesJsonOk && (
              <span className="hint" style={{ color: "var(--warn)" }}>
                Must be a JSON object.
              </span>
            )}
          </label>
          <button
            className="btn btn-primary"
            disabled={
              !isLive || busy !== "" || !rulesTextOk || !rulesJsonOk || !version.trim()
            }
            onClick={() =>
              run("pin", "set_constitution", [
                id,
                version.trim(),
                rulesText.trim(),
                rulesJson,
              ])
            }
          >
            {busy === "pin" ? "Pinning…" : "Pin this constitution"}
          </button>
          <p className="hint" style={{ margin: 0 }}>
            Amendments are forward-only: every case already open keeps the
            version it was opened under.
          </p>
        </div>
      )}
    </section>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
