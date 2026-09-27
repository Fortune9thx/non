import { Link } from "react-router-dom";
import { Accordion, Footer } from "../components/Common";
import { FigureSeated, FigureStanding, Hands, Landscape, Seal, Stairs } from "../art/Art";
import { CHAIN_ID, NETWORK_LABEL } from "../lib/chain";

/**
 * The marketing page.
 *
 * Every number on this page is a protocol constant that the contract
 * actually enforces (bond floors, the four outcomes, the appeal window) —
 * there are no invented adoption metrics, no client logos and no case
 * counts. Live counts live in /app, where they come from the chain.
 */

const STEPS = [
  {
    n: "01",
    title: "Register a scope",
    body: "A scope is a named body of rules with an admin. Scope ids are first-come and cannot be taken over.",
  },
  {
    n: "02",
    title: "Pin a constitution",
    body: "The admin publishes a version, the rules in plain language, and the structured constraints. Amendments are forward-only.",
  },
  {
    n: "03",
    title: "Open a case with a bond",
    body: "A proposer submits the proposal, its material claims and up to eight HTTPS evidence URLs, and bonds GEN. The current constitution version is frozen onto the case.",
  },
  {
    n: "04",
    title: "Evaluate",
    body: "Every validator independently fetches the evidence, runs the prompt and derives its own verdict. The leader's result stands only if they agree on decision, outcome and pinned version.",
  },
  {
    n: "05",
    title: "Appeal",
    body: "For six hours anyone but the proposer can bond against the verdict and add evidence. A challenge always buys a real second reading.",
  },
  {
    n: "06",
    title: "Claim",
    body: "After the window the case finalizes and the ledger is written. The losing side of a final adverse outcome forfeits its bond. Inconclusive refunds everyone exactly.",
  },
];

const FAQ = [
  {
    q: "Who actually loses money when a verdict is wrong?",
    a: (
      <>
        The side that was wrong. A proposer bonds at least 2 GEN to open a case.
        A final <strong>reject</strong> forfeits that bond. A challenger bonds at
        least 2 GEN during the appeal window; if the verdict holds, the
        challenger forfeits instead. A 2% protocol fee is taken from a slashed
        bond only — never from a refund.
      </>
    ),
  },
  {
    q: "What happens when the tribunal cannot tell?",
    a: (
      <>
        It says so. <strong>Inconclusive</strong> returns every bond exactly, with
        no fee and no winner. It is deliberately not a quiet approval: when the
        evidence is missing, unreachable or contradictory, nothing moves. A
        proposal can also come back as <strong>revise</strong>, which names
        defects to correct and is not an approval either.
      </>
    ),
  },
  {
    q: "What counts as evidence?",
    a: (
      <>
        Up to eight HTTPS URLs, fetched independently by each validator. Private,
        loopback and link-local hosts are refused. A page is normalized into a
        record — title, description, a capped text excerpt, and its own stated
        limitations — before anything reads it. That record is treated as data,
        never as instructions, and a page proves only what its own excerpt shows.
        If nothing can be retrieved, the case cannot be approved.
      </>
    ),
  },
  {
    q: "Can the rules be changed under a live case?",
    a: (
      <>
        No. Opening a case freezes the constitution version onto it. A scope
        admin can publish a new version at any time, but it applies only to cases
        opened after it. A verdict reached under a different version is rejected
        outright.
      </>
    ),
  },
  {
    q: `What is ${NETWORK_LABEL}, and can the state disappear?`,
    a: (
      <>
        Non runs on GenLayer {NETWORK_LABEL}, chain {CHAIN_ID}. It is a
        development network and its operators can reset it. If that happens,
        deployed contracts and every case in them are gone and the protocol has
        to be redeployed. The app detects this and says so rather than showing
        stale data.
      </>
    ),
  },
  {
    q: "Does an approval move funds somewhere else?",
    a: (
      <>
        Not on its own. Non produces a judgment and settles the bonds behind it.
        Another system may read a final approval and act on it, but nothing
        external is required for Non to be correct, and Non never takes custody
        of anything beyond the bonds posted to it.
      </>
    ),
  },
];

export default function Landing() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="band hero">
        <div className="shell" style={{ position: "relative" }}>
          <div className="row between" style={{ marginBottom: 40 }}>
            <span className="eyebrow eyebrow-light">
              Adjudication at the speed of evidence
            </span>
            <span className="row gap-8 wordmark">
              <Seal size={18} />
              Non
            </span>
          </div>

          <div className="hero-figures" aria-hidden="true">
            <FigureSeated className="hero-figure" />
            <FigureStanding className="hero-figure right" />
          </div>

          <div className="landscape-frame">
            <Landscape className="plate" seed={1} />
          </div>

          <h1 className="display hero-word tac">Non</h1>
        </div>

        <div className="shell tac" style={{ paddingTop: 56, paddingBottom: 88 }}>
          <p
            className="lede"
            style={{ maxWidth: 620, margin: "0 auto 32px", fontSize: 21 }}
          >
            A bonded constitutional tribunal. Non settles whether a proposal's
            material claims are supported by{" "}
            <span style={{ color: "var(--band-text)" }}>
              independently fetched evidence
            </span>{" "}
            under a pinned constitution — and makes a false verdict cost the side
            that was wrong.
          </p>
          <div className="row center gap-12 wrap">
            <Link className="btn btn-primary" to="/app">
              Open the board
            </Link>
            <Link className="btn btn-ghost" to="/app/constitution">
              Read the constitution
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Protocol constants                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="section">
        <div className="shell">
          <div className="tac" style={{ marginBottom: 56 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              The terms
            </div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 46px)", maxWidth: 620, margin: "0 auto" }}>
              What the contract enforces, not what we hope for
            </h2>
          </div>

          <div className="grid-3">
            <Metric
              value="2 GEN"
              label="Minimum bond, each side"
              body="A proposer bonds to open a case; a challenger bonds to contest one. An operator can raise these floors, never lower them."
            />
            <Metric
              value="4"
              label="Canonical outcomes"
              body="Approve, reject, revise, inconclusive. Anything the model returns that is unparseable, illegal or unsupported collapses to inconclusive — never to approve."
            />
            <Metric
              value="6h"
              label="Appeal window"
              body="After a decision, anyone but the proposer can bond against it and add evidence. A challenge always forces a second, independent reading."
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Process                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="band section">
        <div className="shell">
          <div className="tac" style={{ marginBottom: 56 }}>
            <div className="eyebrow eyebrow-light" style={{ marginBottom: 14 }}>
              The process
            </div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 46px)" }}>
              Six steps, one contested question
            </h2>
          </div>

          <div className="grid-2 gap-48" style={{ alignItems: "start" }}>
            <div>
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step-n">{s.n}</div>
                  <div>
                    <div style={{ fontSize: 17, marginBottom: 6 }}>{s.title}</div>
                    <div className="lede" style={{ fontSize: 15 }}>
                      {s.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="stack gap-24">
              <div className="frame" style={{ borderColor: "var(--band-line)" }}>
                <Hands className="plate" />
              </div>
              <div className="frame" style={{ borderColor: "var(--band-line)" }}>
                <Stairs className="plate" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The honest part                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="section">
        <div className="shell">
          <div className="grid-2 gap-48" style={{ alignItems: "center" }}>
            <div className="frame">
              <Landscape className="plate" seed={2} />
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                What Non is not
              </div>
              <h2 style={{ fontSize: "clamp(26px, 3.4vw, 38px)", marginBottom: 20 }}>
                Judgment and bonds. Nothing else.
              </h2>
              <p className="lede" style={{ fontSize: 16 }}>
                Non is not a treasury, a payroll, or a membership app. It does not
                hold anyone's funds beyond the bonds posted to a case, and it does
                not wire money anywhere because a model said yes.
              </p>
              <p className="lede" style={{ fontSize: 16 }}>
                Fetched pages are untrusted web content, and a submission is
                hostile input: text inside either that tries to address the
                adjudicator, claim authority, or demand an outcome is ignored. A
                page proves only what appears in its normalized record.
              </p>
              <p className="lede" style={{ fontSize: 16, marginBottom: 0 }}>
                External systems may read a final approval. None of them are
                required for Non to be correct.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ                                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="section-tight" style={{ paddingBottom: 96 }}>
        <div className="shell" style={{ maxWidth: 820 }}>
          <div className="tac" style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(28px, 3.6vw, 40px)" }}>FAQ</h2>
          </div>
          <Accordion items={FAQ} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CTA                                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div
            className="card"
            style={{ padding: 0, overflow: "hidden", background: "var(--cream)" }}
          >
            <div className="grid-2" style={{ gap: 0, alignItems: "stretch" }}>
              <div style={{ padding: 48 }}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  Open a case
                </div>
                <h2 style={{ fontSize: "clamp(26px, 3.2vw, 36px)", marginBottom: 16 }}>
                  Put a claim on the record
                </h2>
                <p className="lede" style={{ fontSize: 16 }}>
                  Bond it, cite your evidence, and let independent validators
                  decide. You will be told exactly what the tribunal could and
                  could not verify.
                </p>
                <div className="row gap-12 wrap">
                  <Link className="btn btn-primary" to="/app/open">
                    Open a case
                  </Link>
                  <Link className="btn btn-ghost" to="/app">
                    See the board
                  </Link>
                </div>
              </div>
              <div style={{ minHeight: 300 }}>
                <Landscape className="plate" seed={3} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function Metric({
  value,
  label,
  body,
}: {
  value: string;
  label: string;
  body: string;
}) {
  return (
    <div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <hr className="rule" style={{ margin: "18px 0 14px" }} />
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        {body}
      </p>
    </div>
  );
}
