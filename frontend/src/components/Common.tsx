import { useEffect, useState, type ReactNode } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  EXPLORER,
  NETWORK_LABEL,
  explorerAddress,
  shortAddr,
  type Decision,
  type Liveness,
} from "../lib/chain";
import { Seal } from "../art/Art";

/* -------------------------------------------------------------------------
   Verdict pill
   ------------------------------------------------------------------------- */

const VERDICT_CLASS: Record<string, string> = {
  approve: "v-approve",
  reject: "v-reject",
  revise: "v-revise",
  inconclusive: "v-inconclusive",
};

export function Verdict({ decision }: { decision: Decision | string }) {
  if (!decision) return <span className="verdict v-pending">undecided</span>;
  return (
    <span className={`verdict ${VERDICT_CLASS[decision] ?? "v-pending"}`}>
      {decision}
    </span>
  );
}

export function StateChip({ state }: { state: string }) {
  const label = (state || "").replace(/_/g, " ").toLowerCase();
  return <span className="chip">{label || "—"}</span>;
}

/* -------------------------------------------------------------------------
   Network chip
   ------------------------------------------------------------------------- */

export function NetworkChip({ liveness }: { liveness: Liveness }) {
  const dot =
    liveness.kind === "live"
      ? "dot dot-live"
      : liveness.kind === "rpc-down"
      ? "dot dot-down"
      : liveness.kind === "checking"
      ? "dot"
      : "dot dot-warn";
  return (
    <span className="chip">
      <i className={dot} />
      {NETWORK_LABEL} · {CHAIN_ID}
    </span>
  );
}

/* -------------------------------------------------------------------------
   Liveness banner.

   These four states are the ONLY thing standing between a visitor and a
   confident-looking screen full of nothing. Each one says plainly which
   of them is true and what it means.
   ------------------------------------------------------------------------- */

export function LivenessBanner({ liveness }: { liveness: Liveness }) {
  if (liveness.kind === "live") return null;

  // While the probe is in flight nothing is known yet, so nothing is claimed.
  if (liveness.kind === "checking") return null;

  if (liveness.kind === "undeployed") {
    return (
      <div className="banner banner-warn">
        <div>
          <strong>Not deployed.</strong> No contract address is configured, so
          there is nothing to read. Every panel below is empty because the
          protocol has no state yet — not because the state is zero.
        </div>
      </div>
    );
  }

  if (liveness.kind === "no-code") {
    return (
      <div className="banner banner-warn">
        <div>
          <strong>Nothing deployed at this address.</strong>{" "}
          <span className="mono">{shortAddr(liveness.address)}</span> returns no
          contract schema. {NETWORK_LABEL} state can be reset by the operators;
          when that happens the protocol must be redeployed and this address
          updated.
        </div>
      </div>
    );
  }

  return (
    <div className="banner banner-down">
      <div>
        <strong>Cannot reach the network.</strong> The {NETWORK_LABEL} RPC did
        not answer ({liveness.detail}). Nothing is shown rather than something
        stale.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Empty / loading / error states
   ------------------------------------------------------------------------- */

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading({ label = "Reading chain" }: { label?: string }) {
  return (
    <div className="empty row center gap-12">
      <span className="spinner" /> {label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return (
    <div className="banner banner-down">
      <div>
        <strong>Read failed.</strong> {error}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Footer (shared by marketing and app)
   ------------------------------------------------------------------------- */

export function Footer() {
  return (
    <footer className="band footer">
      <div className="shell">
        <div className="row between wrap gap-48" style={{ alignItems: "flex-start" }}>
          <div style={{ maxWidth: 360 }}>
            <div className="row gap-8" style={{ marginBottom: 14 }}>
              <Seal size={20} />
              <span className="wordmark">Non</span>
            </div>
            <p className="lede" style={{ fontSize: 16, margin: 0 }}>
              Adjudication at the speed of evidence.
            </p>
          </div>

          <div className="row gap-48 wrap" style={{ alignItems: "flex-start" }}>
            <div className="footcol">
              <span className="eyebrow eyebrow-light">Product</span>
              <a href="/app">Board</a>
              <a href="/app/open">Open a case</a>
              <a href="/app/constitution">Constitution</a>
              <a href="/app/claims">Claims</a>
            </div>
            <div className="footcol">
              <span className="eyebrow eyebrow-light">Network</span>
              <span className="muted">{NETWORK_LABEL}</span>
              <span className="muted mono">chain {CHAIN_ID}</span>
              <a href={EXPLORER} target="_blank" rel="noreferrer">
                Explorer
              </a>
            </div>
            <div className="footcol">
              <span className="eyebrow eyebrow-light">Contract</span>
              {CONTRACT_ADDRESS ? (
                <a
                  className="mono"
                  href={explorerAddress(CONTRACT_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(CONTRACT_ADDRESS)}
                </a>
              ) : (
                <span className="muted">not deployed</span>
              )}
              <span className="muted">State may reset.</span>
            </div>
          </div>
        </div>

        <hr className="rule" style={{ margin: "48px 0 22px" }} />
        <div className="row between wrap gap-16 small">
          <span className="muted">
            Non settles one question: does a proposal meet its pinned
            constitution under independently fetched evidence?
          </span>
          <span className="muted mono">MIT</span>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------
   Accordion
   ------------------------------------------------------------------------- */

export function Accordion({
  items,
}: {
  items: { q: string; a: ReactNode }[];
}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      {items.map((item, i) => (
        <div className="acc" key={i}>
          <button
            className="acc-head"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {item.q}
            <span className="acc-sign">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div className="acc-body">{item.a}</div>}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Copy-to-clipboard mono value
   ------------------------------------------------------------------------- */

export function Copyable({ value, short }: { value: string; short?: boolean }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(t);
  }, [done]);
  if (!value) return <span className="muted">—</span>;
  return (
    <button
      className="mono"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => setDone(true),
          () => undefined
        );
      }}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
      }}
    >
      {done ? "copied" : short ? shortAddr(value) : value}
    </button>
  );
}
