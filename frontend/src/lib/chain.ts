/**
 * Chain access for Non.
 *
 * Every read in this app goes through here, and every read can fail
 * closed. There is no fixture data, no seeded case list, and no "demo
 * mode" anywhere in this file or downstream of it: if the contract
 * address is unset, or nothing is deployed at it, or the RPC is
 * unreachable, the UI renders an empty product and says which of those
 * three is true.
 */

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? "").trim();
export const RPC_URL = (
  import.meta.env.VITE_GENLAYER_RPC_URL ?? "https://studio-dev.genlayer.com/api"
).trim();
export const CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID ?? 61997);
export const EXPLORER = (
  import.meta.env.VITE_EXPLORER ?? "https://explorer-studio-dev.genlayer.com"
).trim();

export const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);
export const NETWORK_LABEL = "Studio Next";

/** How the app is currently connected to the protocol. */
export type Liveness =
  | { kind: "undeployed" }              // no address configured
  | { kind: "no-code"; address: string } // address set, nothing deployed there
  | { kind: "rpc-down"; detail: string } // could not reach the RPC at all
  | { kind: "live"; address: string };

let rpcId = 1;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const body = await res.json();
  if (body.error) {
    const err = new Error(body.error.message ?? "rpc error");
    (err as { code?: number }).code = body.error.code;
    throw err;
  }
  return body.result as T;
}

/**
 * Liveness probe.
 *
 * NOTE: this deliberately does NOT use eth_getCode. A GenLayer
 * intelligent contract is not an EVM contract -- eth_getCode returns "0x"
 * for a perfectly healthy, responding, deployed IC, so a frontend gating
 * on it reports "nothing deployed, the network was reset" about a live
 * contract and fails every read and write closed for no reason. The
 * authoritative probe is gen_getContractSchema, which returns a method
 * schema for a live contract and JSON-RPC error -32001 ("Contract ... not
 * found") for an address with nothing at it -- cleanly separating
 * live / nothing-there / RPC-unreachable, which is exactly the three-way
 * distinction this app's banners need.
 */
export async function probeLiveness(): Promise<Liveness> {
  if (!CONTRACT_ADDRESS) return { kind: "undeployed" };
  try {
    await rpc<unknown>("gen_getContractSchema", [CONTRACT_ADDRESS]);
    return { kind: "live", address: CONTRACT_ADDRESS };
  } catch (err) {
    const code = (err as { code?: number }).code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === -32001 || /not found/i.test(message)) {
      return { kind: "no-code", address: CONTRACT_ADDRESS };
    }
    return { kind: "rpc-down", detail: message };
  }
}

/**
 * Shared read-only genlayer-js client. Imported dynamically so a visitor
 * who never reaches a data view does not pay for the client bundle, and
 * so a client-library failure surfaces as a failed read rather than a
 * blank page.
 */
let readClientPromise: Promise<unknown> | null = null;

async function readClient(): Promise<unknown> {
  if (!readClientPromise) {
    readClientPromise = (async () => {
      const [{ createClient }, { studionet }] = await Promise.all([
        import("genlayer-js"),
        import("genlayer-js/chains"),
      ]);
      const chain = {
        ...studionet,
        id: CHAIN_ID,
        rpcUrls: { default: { http: [RPC_URL] } },
      };
      return createClient({ chain: chain as never });
    })();
  }
  return readClientPromise;
}

/**
 * Calls a read-only contract method and returns its raw string result.
 * Throws when the protocol is not configured or the read fails -- callers
 * surface that as an explicit failure state, never as empty-looking data
 * that could be mistaken for "no cases yet".
 */
export async function callView(method: string, args: unknown[] = []): Promise<string> {
  if (!CONTRACT_ADDRESS) throw new Error("no contract address configured");
  const client = (await readClient()) as {
    readContract: (a: unknown) => Promise<unknown>;
  };
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return String(raw);
}

// ---------------------------------------------------------------------------
// Typed shapes returned by the contract's own views.
// ---------------------------------------------------------------------------

export type Decision = "approve" | "reject" | "revise" | "inconclusive" | "";

export type Config = {
  treasury: string;
  owner: string;
  min_review_bond: string;
  min_challenge_bond: string;
  min_settle_bond: string;
  appeal_window_seconds: number;
  protocol_fee_bps: number;
  max_evidence_urls: number;
  score_tolerance: number;
  decisions: string[];
  case_count: number;
};

export type EvidenceRow = {
  url: string;
  status: number;
  ok: boolean;
  title: string;
  limitations: string;
};

export type CaseRecord = {
  case_id: string;
  scope_id: string;
  proposer: string;
  subject: { title: string; summary: string; claims: string[] };
  evidence_urls: string[];
  rules_version: string;
  rules_text: string;
  rules_json: string;
  state: string;
  derived_state: string;
  opened_at: number;
  decided_at: number;
  finalized_at: number;
  appeal_deadline: number;
  review_bond: string;
  challenger: string;
  challenge_bond: string;
  challenge_note: string;
  settler: string;
  settle_bond: string;
  decision: Decision;
  outcome: string;
  scores: { score?: number; fit_score?: number; risk?: number };
  reasoning: string;
  weak_spots: string;
  corrections: string;
  improvements: string;
  uncertainty: string;
  evidence_report: EvidenceRow[];
  eval_rounds: number;
  settled: boolean;
};

export type ScopeRecord = {
  scope_id: string;
  admin: string;
  constitution: null | {
    version: string;
    rules_text: string;
    rules_json: string;
    set_at: number;
  };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getConfig(): Promise<Config> {
  return JSON.parse(await callView("get_config"));
}

export async function listCases(scopeId = ""): Promise<string[]> {
  return JSON.parse(await callView("list_cases", [scopeId]));
}

export async function listCasesFor(address: string): Promise<string[]> {
  return JSON.parse(await callView("list_cases_for", [address]));
}

export async function getCase(caseId: string): Promise<CaseRecord> {
  return JSON.parse(await callView("get_case", [caseId]));
}

export async function getScope(scopeId: string): Promise<ScopeRecord> {
  return JSON.parse(await callView("get_constitution", [scopeId]));
}

export async function getClaimable(address: string): Promise<bigint> {
  return BigInt(await callView("get_claimable", [address]));
}

/**
 * Loads every case the contract knows about. Returns [] when the
 * protocol is not live -- the caller renders an empty board, never a
 * fabricated one.
 */
export async function loadAllCases(scopeId = ""): Promise<CaseRecord[]> {
  const ids = await listCases(scopeId);
  const settled = await Promise.allSettled(ids.map((id) => getCase(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<CaseRecord> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ---------------------------------------------------------------------------
// Wallet (injected provider)
// ---------------------------------------------------------------------------

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...a: unknown[]) => void) => void;
};

export function injectedProvider(): Eip1193 | null {
  const w = window as unknown as { ethereum?: Eip1193 };
  return w.ethereum ?? null;
}

export async function connectWallet(): Promise<string> {
  const provider = injectedProvider();
  if (!provider) throw new Error("No injected wallet found in this browser.");
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("Wallet returned no account.");
  await ensureChain();
  return accounts[0];
}

/** Switches to chain 61997, adding it first if the wallet does not know it. */
export async function ensureChain(): Promise<void> {
  const provider = injectedProvider();
  if (!provider) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: `GenLayer ${NETWORK_LABEL}`,
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export async function currentAccount(): Promise<string | null> {
  const provider = injectedProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getBalance(address: string): Promise<bigint> {
  const provider = injectedProvider();
  if (!provider) return 0n;
  try {
    const hex = (await provider.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    })) as string;
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

// ---------------------------------------------------------------------------
// Writes
//
// Writes are submitted through genlayer-js, which owns calldata encoding
// and the v0.6 transaction fee shape. The import is dynamic so that a
// read-only visitor with no wallet never pays for the client bundle, and
// so a client-library failure degrades to a clear error on the one action
// that needed it rather than a blank page.
// ---------------------------------------------------------------------------

export type WriteArgs = {
  method: string;
  args: unknown[];
  /** Native GEN to attach, in wei. Bonds are posted this way. */
  value?: bigint;
  account: string;
};

export async function writeContract({ method, args, value, account }: WriteArgs) {
  if (!CONTRACT_ADDRESS) throw new Error("no contract address configured");
  const provider = injectedProvider();
  if (!provider) throw new Error("No injected wallet found in this browser.");
  await ensureChain();

  const [{ createClient }, { studionet }] = await Promise.all([
    import("genlayer-js"),
    import("genlayer-js/chains"),
  ]);

  const chain = { ...studionet, id: CHAIN_ID, rpcUrls: { default: { http: [RPC_URL] } } };
  const client = createClient({
    chain: chain as never,
    account: account as never,
  });

  // Consensus v0.6 requires an explicit non-zero fee on every write. Let
  // the client simulate this exact call to derive one rather than
  // guessing a number; a partial fee distribution is rejected locally
  // before broadcast and produces a confusing "reverted" message.
  let fees: unknown = undefined;
  try {
    fees = await (client as never as {
      estimateTransactionFeesForWrite: (a: unknown) => Promise<unknown>;
    }).estimateTransactionFeesForWrite({
      address: CONTRACT_ADDRESS,
      functionName: method,
      args,
      value: value ?? 0n,
    });
  } catch {
    fees = undefined;
  }

  const hash = await (client as never as {
    writeContract: (a: unknown) => Promise<string>;
  }).writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
    value: value ?? 0n,
    ...(fees ? { fees } : {}),
  });

  return hash;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtGen(wei: string | bigint, decimals = 2): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const whole = v / 10n ** 18n;
  const frac = ((v % 10n ** 18n) * 10n ** BigInt(decimals)) / 10n ** 18n;
  if (decimals === 0) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

export function toWei(amount: string): bigint {
  const trimmed = (amount || "0").trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("amount must be a number");
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded || "0");
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export function countdown(deadline: number, now = Date.now() / 1000): string {
  const left = Math.floor(deadline - now);
  if (left <= 0) return "closed";
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function explorerAddress(addr: string): string {
  return `${EXPLORER}/address/${addr}`;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}
