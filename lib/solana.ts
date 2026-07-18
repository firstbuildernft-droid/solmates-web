// Read-only Solana access. Everything in this file asks questions.
// Nothing in here can sign a transaction or move a lamport — there is no
// keypair anywhere in this codebase, by design.

const RPC = process.env.SOLANA_RPC_URL!;
const LAMPORTS = 1_000_000_000;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "RPC error");
  return json.result;
}

// Solana addresses are base58 and 32 bytes. They carry no checksum, so
// this catches typos in shape but not a valid-looking wrong address.
// Nothing can catch that — which is why we make them prove ownership
// by paying from it rather than trusting what they typed.
export function looksLikeAddress(a: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim());
}

export async function getBalanceSol(address: string): Promise<number> {
  const r = await rpc<{ value: number }>("getBalance", [address]);
  return r.value / LAMPORTS;
}

type ParsedTx = {
  transaction: {
    message: {
      instructions: {
        program?: string;
        parsed?: {
          type?: string;
          info?: { source?: string; destination?: string; lamports?: number };
        };
      }[];
    };
  };
  meta: { err: unknown } | null;
};

/**
 * Did `from` send at least `minSol` to `to`, recently?
 *
 * We scan the CLAIMED wallet's own history rather than the deposit
 * address's. Two reasons: the deposit address will eventually have
 * thousands of transactions and theirs will have a handful, and it means
 * verification cost doesn't grow as you get more users.
 *
 * Returns the transaction signature, or null.
 */
export async function findDeposit(
  from: string,
  to: string,
  minSol: number,
  scanLimit = 25
): Promise<{ signature: string | null; scanned: number }> {
  const sigs = await rpc<{ signature: string; err: unknown }[]>(
    "getSignaturesForAddress",
    [from, { limit: scanLimit }]
  );

  const minLamports = Math.round(minSol * LAMPORTS);

  for (const s of sigs) {
    if (s.err) continue; // failed transaction, didn't move anything

    const tx = await rpc<ParsedTx | null>("getTransaction", [
      s.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx || tx.meta?.err) continue;

    for (const ix of tx.transaction.message.instructions) {
      const p = ix.parsed;
      if (ix.program !== "system" || p?.type !== "transfer") continue;

      const info = p.info ?? {};
      if (
        info.source === from &&
        info.destination === to &&
        (info.lamports ?? 0) >= minLamports
      ) {
        return { signature: s.signature, scanned: sigs.length };
      }
    }
  }

  return { signature: null, scanned: sigs.length };
}

// Which network are we actually talking to? The single most useful thing
// to know when a payment "doesn't exist" -- a mainnet transaction is
// invisible from a devnet endpoint, and it fails silently rather than
// erroring, which is exactly as confusing as it sounds.
export function rpcHost() {
  try {
    return new URL(RPC).hostname;
  } catch {
    return "MISSING - check .env.local";
  }
}
