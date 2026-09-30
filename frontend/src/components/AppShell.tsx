import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  connectWallet,
  currentAccount,
  fmtGen,
  getBalance,
  injectedProvider,
  onWalletDiscovered,
  probeLiveness,
  shortAddr,
  type Liveness,
} from "../lib/chain";
import { Footer, LivenessBanner, NetworkChip } from "./Common";
import { Seal } from "../art/Art";

export type AppContext = {
  liveness: Liveness;
  isLive: boolean;
  /** The probe has not answered yet — assert nothing about the chain. */
  checking: boolean;
  account: string | null;
  balance: bigint;
  refreshWallet: () => void;
};

const NAV = [
  { to: "/app", label: "Board", end: true },
  { to: "/app/cases", label: "Cases" },
  { to: "/app/open", label: "Open" },
  { to: "/app/constitution", label: "Constitution" },
  { to: "/app/claims", label: "Claims" },
];

export default function AppShell() {
  const [liveness, setLiveness] = useState<Liveness | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    let cancelled = false;
    probeLiveness().then((result) => {
      if (!cancelled) setLiveness(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshWallet = useCallback(() => {
    currentAccount().then(async (addr) => {
      setAccount(addr);
      if (addr) setBalance(await getBalance(addr));
    });
  }, []);

  // Bumped when a wallet announces itself after mount, so the effect below
  // re-runs and binds to a provider that did not exist on the first pass.
  const [walletEpoch, setWalletEpoch] = useState(0);

  useEffect(
    () => onWalletDiscovered(() => setWalletEpoch((n) => n + 1)),
    []
  );

  useEffect(() => {
    refreshWallet();
    const provider = injectedProvider();
    if (!provider?.on) return;
    const handler = () => refreshWallet();
    provider.on("accountsChanged", handler);
    provider.on("chainChanged", handler);
    return () => {
      provider.removeListener?.("accountsChanged", handler);
      provider.removeListener?.("chainChanged", handler);
    };
  }, [refreshWallet, walletEpoch]);

  const onConnect = async () => {
    setConnecting(true);
    setWalletError("");
    try {
      const addr = await connectWallet();
      setAccount(addr);
      setBalance(await getBalance(addr));
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  const context: AppContext = useMemo(
    () => ({
      // Until the probe answers, the state is genuinely unknown. Coercing
      // that to "undeployed" made the app assert the protocol was not
      // deployed on every page load, about a contract that is live.
      liveness: liveness ?? { kind: "checking" },
      isLive: liveness?.kind === "live",
      checking: liveness === null,
      account,
      balance,
      refreshWallet,
    }),
    [liveness, account, balance, refreshWallet]
  );

  return (
    <>
      <header className="appnav">
        <div className="shell row between gap-24" style={{ height: 64 }}>
          <Link to="/" className="row gap-8 wordmark" style={{ flex: "none" }}>
            <Seal size={19} />
            Non
          </Link>

          <nav className="row gap-24 nav-links grow" style={{ justifyContent: "center" }}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `navlink${isActive ? " active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="row gap-12" style={{ flex: "none" }}>
            {liveness && <NetworkChip liveness={liveness} />}
            {account ? (
              <span className="chip" title={account}>
                {shortAddr(account)} · {fmtGen(balance)} GEN
              </span>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={onConnect}
                disabled={connecting}
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="shell" style={{ padding: "32px 24px 88px", minHeight: "62vh" }}>
        <div className="stack gap-24">
          {liveness && <LivenessBanner liveness={liveness} />}
          {walletError && (
            <div className="banner banner-down">
              <div>
                <strong>Wallet.</strong> {walletError}
              </div>
            </div>
          )}
          <Outlet context={context} />
        </div>
      </main>

      <Footer />
    </>
  );
}
