import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { AppContext } from "../components/AppShell";
import { Copyable, Empty, ErrorNote, Loading } from "../components/Common";
import { fmtTime, getScope, type ScopeRecord } from "../lib/chain";

/**
 * Constitution reader.
 *
 * A scope's rules are only knowable by asking the chain for a specific
 * scope id — there is no on-chain enumeration of scopes, and this page
 * does not pretend otherwise by listing invented ones.
 */
export default function Constitution() {
  const { isLive } = useOutletContext<AppContext>();
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
    if (initial && isLive) lookup(initial);
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
        {!isLive && (
          <p className="hint" style={{ marginBottom: 0 }}>
            The protocol is not live on this network, so no scope can be read.
          </p>
        )}
      </div>

      {error && <ErrorNote error={error} />}
      {loading && <Loading label="Reading scope" />}

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

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
