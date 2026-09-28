#!/usr/bin/env node
/**
 * End-to-end check for Non: the build is sound, the contract is live, and the
 * deployed app points at it.
 *
 *   npm --prefix frontend ci      # once, for genlayer-js
 *   node scripts/e2e_check.mjs
 *
 * The address, RPC and chain id are read from deploy/deployments.json -- the
 * single source of truth -- so this script holds no copy of them and cannot
 * drift from what is actually deployed.
 *
 * Exits 0 only if every check passes.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";

const ROOT = new URL("..", import.meta.url);
const req = createRequire(new URL("frontend/node_modules/", ROOT));

const EXPECTED_METHODS = 15;
const GEN = 10n ** 18n;
const EXPECTED_CONFIG = {
  min_review_bond: 2n * GEN,
  min_challenge_bond: 2n * GEN,
  min_settle_bond: 1n * GEN,
  appeal_window_seconds: 21600,
  expiry_seconds: 259200,
  protocol_fee_bps: 200,
};

const failures = [];
const check = (label, ok, detail = "") => {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
  return ok;
};

// The proxy in some CI sandboxes rejects default library user agents.
const UA = { "user-agent": "non-e2e-check/1.0" };

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const get = (u) => fetch(u, { headers: UA }).then((r) => r.text());

async function main() {
  const dep = JSON.parse(readFileSync(new URL("deploy/deployments.json", ROOT)));
  const { address, rpc: rpcUrl, chain_id: chainId, app, superseded = [] } = dep.studio_next;

  console.log(`\nNon end-to-end check\n  address ${address}\n  chain   ${chainId}\n`);

  // 1. Build -----------------------------------------------------------
  console.log("Build");
  const bundle = readFileSync(new URL("build/Non.bundled.py", ROOT));
  const text = bundle.toString("utf8");
  check("bundle exists", bundle.length > 0, `${bundle.length} bytes`);
  check("bundle is LF-only", !text.includes("\r\n"));
  const publicMethods = (text.match(/@gl\.public\.[a-z_]+/g) || []).length;
  check(`bundle declares ${EXPECTED_METHODS} public methods`,
        publicMethods === EXPECTED_METHODS, `found ${publicMethods}`);
  check("bundle starts with the bare Depends header",
        text.startsWith("# { \"Depends\""), text.slice(0, 32).trim());

  // 2. Network ---------------------------------------------------------
  console.log("\nNetwork");
  const { studioDevnet } = req("genlayer-js/chains");
  check(`genlayer-js studioDevnet is chain ${chainId}`, studioDevnet.id === chainId,
        `preset says ${studioDevnet.id}`);
  const live = parseInt(await rpc(rpcUrl, "eth_chainId", []), 16);
  check(`RPC reports chain ${chainId}`, live === chainId, `got ${live}`);

  // 3. Contract --------------------------------------------------------
  // gen_getContractSchema, never eth_getCode: a healthy intelligent contract
  // returns "0x" from eth_getCode, so it is the wrong liveness probe.
  console.log("\nContract");
  const schema = await rpc(rpcUrl, "gen_getContractSchema", [address]);
  const names = Object.keys(schema.methods || {});
  check(`schema returns ${EXPECTED_METHODS} methods`, names.length === EXPECTED_METHODS,
        `got ${names.length}`);
  check("expire_case is present", names.includes("expire_case"));

  const { createClient } = req("genlayer-js");
  const client = createClient({ chain: studioDevnet, endpoint: rpcUrl });
  const read = async (fn, args = []) =>
    String(await client.readContract({ address, functionName: fn, args }));

  const cfg = JSON.parse(await read("get_config"));
  for (const [key, want] of Object.entries(EXPECTED_CONFIG)) {
    check(`config ${key} = ${want}`, String(cfg[key]) === String(want), `got ${cfg[key]}`);
  }
  check("treasury is a clean 42-char address", (cfg.treasury || "").length === 42, cfg.treasury);

  // 4. State -----------------------------------------------------------
  console.log("\nState");
  const con = JSON.parse(await read("get_constitution", ["core-grants"]));
  check("core-grants scope registered", con.scope_id === "core-grants");
  check("constitution pinned at v1.0", con.constitution?.version === "v1.0");

  const ids = JSON.parse(await read("list_cases", ["core-grants"]));
  check("at least one case on chain", ids.length >= 1, ids.join(", ") || "none");
  for (const id of ids) {
    const rec = JSON.parse(await read("get_case", [id]));
    check(`${id} readable`, Boolean(rec.state),
          `${rec.state} / ${rec.decision || "undecided"} / bond ${BigInt(rec.review_bond) / GEN} GEN`);
  }

  // 5. Deployed app ----------------------------------------------------
  // The address is inlined into the JS at build time, so a stale Vercel
  // environment variable is visible here and nowhere else.
  console.log("\nDeployed app");
  const html = await get(`${app}/app`);
  const assets = [...new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.js/g) || [])];
  check("app serves JS assets", assets.length > 0, `${assets.length} found`);
  const js = (await Promise.all(assets.slice(0, 8).map((a) => get(`${app}${a}`)))).join("");
  check("app bundle carries the live address", js.includes(address));
  const stale = superseded.map((s) => s.address).filter((a) => js.includes(a));
  check("app bundle carries no superseded address", stale.length === 0, stale.join(", ") || "none");

  console.log();
  if (failures.length) {
    console.log(`FAILED — ${failures.length} check(s): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("All checks passed. Build is sound and the deployment is live.");
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
