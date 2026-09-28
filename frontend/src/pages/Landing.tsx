import { Link } from "react-router-dom";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  EXPLORER,
  NETWORK_LABEL,
  explorerAddress,
  shortAddr,
} from "../lib/chain";

import landscape from "../assets/non-landscape.jpg";
import muse from "../assets/non-muse-left.png";
import philosopher from "../assets/non-philosopher-right.png";
import processImage from "../assets/non-process.jpg";

/**
 * The marketing page.
 *
 * Every number on this page is a protocol constant that the contract
 * actually enforces (bond floors, the four outcomes, the appeal window) —
 * there are no invented adoption metrics, no client logos and no case
 * counts. Live counts live in /app, where they come from the chain.
 *
 * Every call to action resolves to a route that exists in main.tsx. The
 * page has its own footer rather than the shared one from Common, whose
 * banded layout belongs to the app shell.
 */

function Arrow() {
  return (
    <svg
      className="non-arrow"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export default function Landing() {
  return (
    <main className="non-page">
      <Hero />
      <Impact />
      <Process />
      <Faq />
      <FinalCall />
      <LandingFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="non-hero" aria-labelledby="hero-title">
      <div className="non-container non-hero-top">
        <span className="non-kicker">Adjudication at the speed of evidence</span>
        <Link className="non-mark" to="/" aria-label="Non home">
          <span className="non-mark-symbol" aria-hidden="true">
            n
          </span>
          Non
        </Link>
      </div>

      <div className="non-hero-art">
        <img
          className="non-landscape"
          src={landscape}
          alt="Classical landscape with cypress trees and a distant temple"
          width={1536}
          height={1024}
        />
        <img
          className="non-statue non-statue-left"
          src={muse}
          alt=""
          aria-hidden="true"
          width={1024}
          height={1280}
        />
        <img
          className="non-statue non-statue-right"
          src={philosopher}
          alt=""
          aria-hidden="true"
          width={1024}
          height={1280}
        />
        <h1 id="hero-title" className="non-display non-wordmark">
          Non
        </h1>
      </div>

      <div className="non-container non-hero-bottom">
        <p>
          Evidence is gathered independently.
          <br />
          Judgment follows the constitution.
        </p>
        <div className="non-hero-actions">
          <Link className="non-btn non-btn-paper" to="/app">
            Open the board <Arrow />
          </Link>
          <Link className="non-btn non-btn-night" to="/app/constitution">
            Read the constitution <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

const FACTS = [
  {
    number: "2",
    label: "GEN minimum review bond",
    copy: "A review starts with a bond, not an anonymous opinion.",
  },
  {
    number: "4",
    label: "Constitutional outcomes",
    copy: "Approve, reject, revise, or inconclusive. Each decision has a defined place.",
  },
  {
    number: "6h",
    label: "Appeal window",
    copy: "A bounded period to challenge the result before it is settled.",
  },
];

function Impact() {
  return (
    <section className="non-impact" aria-labelledby="impact-title">
      <div className="non-container">
        <p className="non-kicker non-section-label">The protocol, in brief</p>
        <h2 id="impact-title" className="non-display non-section-title">
          A decision with structure.
        </h2>
        <p className="non-impact-intro">
          Every case is measured against a pinned constitution and evidence
          fetched by independent validators.
        </p>
        <div className="non-facts">
          {FACTS.map((fact) => (
            <article className="non-fact" key={fact.label}>
              <p className="non-fact-number">{fact.number}</p>
              <h3 className="non-fact-label">{fact.label}</h3>
              <p className="non-fact-copy">{fact.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS: [string, string][] = [
  ["Register scope", "Define what can be adjudicated."],
  ["Pin constitution", "Set the rules before a case begins."],
  ["Open case with bond", "Commit GEN to bring a proposal forward."],
  ["Evaluate", "Validators fetch HTTPS evidence independently."],
  ["Appeal", "Challenge a decision within the appeal window."],
  ["Claim", "Resolve the outcome and its bond."],
];

function Process() {
  return (
    <section id="process" className="non-process" aria-labelledby="process-title">
      <div className="non-container">
        <div className="non-process-heading">
          <div>
            <p className="non-kicker">The process</p>
            <h2 id="process-title" className="non-display non-section-title">
              From proposition
              <br />
              to resolution.
            </h2>
          </div>
          <span className="non-process-index">
            SIX STAGES / ONE PINNED CONSTITUTION
          </span>
        </div>

        <div className="non-process-grid">
          <div className="non-steps">
            {STEPS.map(([title, copy], index) => (
              <div className="non-step" key={title}>
                <span className="non-step-num">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="non-step-title">{title}</h3>
                  <p className="non-step-copy">{copy}</p>
                </div>
              </div>
            ))}
          </div>

          <figure className="non-process-image-wrap">
            <img
              className="non-process-image"
              src={processImage}
              alt="A marble figure holds a scroll above a sunlit classical landscape"
              loading="lazy"
              width={1536}
              height={1024}
            />
            <figcaption>
              Evidence first. The constitution remains fixed.
            </figcaption>
          </figure>
        </div>

        <div className="non-note">
          <span>GenLayer · {NETWORK_LABEL}</span>
          <span>Network {CHAIN_ID} · State may reset</span>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS: [string, string][] = [
  [
    "What does Non decide?",
    "Non decides whether a proposal satisfies a pinned constitution, using HTTPS evidence independently fetched by validators.",
  ],
  [
    "What happens if evidence is missing?",
    "A decision should not pretend missing evidence exists. The case can be revised or returned inconclusive when the evidence does not support a definite outcome.",
  ],
  [
    "What is INCONCLUSIVE?",
    "It is a defined outcome when the available evidence does not establish approval or rejection. It is not an approval by default, and it refunds every bond exactly.",
  ],
  [
    "Who actually loses money when a verdict is wrong?",
    "The side that was wrong. A final reject forfeits the proposer's bond; if a challenge fails, the challenger forfeits instead. A 2% protocol fee is taken from a slashed bond only, never from a refund.",
  ],
  [
    "What network is this on?",
    `Non is on GenLayer ${NETWORK_LABEL}, network ${CHAIN_ID}. This environment may reset, and if it does, deployed contracts and the cases in them are gone.`,
  ],
];

function Faq() {
  return (
    <section className="non-faq" aria-labelledby="faq-title">
      <div className="non-container">
        <p className="non-kicker non-section-label">Questions &amp; answers</p>
        <h2 id="faq-title" className="non-display non-section-title">
          The essentials.
        </h2>
        <div className="non-faq-list">
          {QUESTIONS.map(([question, answer]) => (
            <details className="non-faq-item" key={question}>
              <summary>
                {question}
                <span className="non-faq-icon" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="non-faq-answer">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="non-final" aria-labelledby="final-title">
      <div className="non-container">
        <p className="non-kicker non-section-label">
          A record worth standing behind
        </p>
        <h2 id="final-title" className="non-display non-section-title">
          Make the case.
          <br />
          Let evidence speak.
        </h2>
        <p className="non-final-copy">
          Open the board to follow proposals, or begin with the rules that
          govern every decision.
        </p>
        <div className="non-final-actions">
          <Link className="non-btn non-btn-ink" to="/app/open">
            Open a case <Arrow />
          </Link>
          <Link className="non-btn non-btn-inkOutline" to="/app">
            Go to the board <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="non-footer">
      <div className="non-container">
        <div className="non-footer-main">
          <span className="non-footer-brand">Non</span>
          <div className="non-footer-meta">
            <div className="non-footer-col">
              <Link to="/app">Board</Link>
              <Link to="/app/open">Open a case</Link>
              <Link to="/app/constitution">Constitution</Link>
              <Link to="/app/claims">Claims</Link>
            </div>
            <div className="non-footer-col">
              <span>{NETWORK_LABEL}</span>
              <span>Chain {CHAIN_ID}</span>
              <a href={EXPLORER} target="_blank" rel="noreferrer">
                Explorer
              </a>
            </div>
            <div className="non-footer-col">
              {CONTRACT_ADDRESS ? (
                <a
                  href={explorerAddress(CONTRACT_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(CONTRACT_ADDRESS)}
                </a>
              ) : (
                <span>Not deployed</span>
              )}
              <span>State may reset</span>
            </div>
          </div>
        </div>
        <div className="non-footer-bottom">
          <span>© Non · MIT</span>
          <span>Evidence before judgment.</span>
        </div>
      </div>
    </footer>
  );
}
