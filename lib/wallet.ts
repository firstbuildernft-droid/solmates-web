"use client";

// Talking to whatever Solana wallet the browser has. Deliberately small:
// we only ever ask for the public key and a signed message. There is no
// transaction here and nothing that could move funds.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Byte-array arithmetic rather than BigInt: the build targets below
// ES2020, where BigInt literals aren't available.
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Each leading zero byte is a literal '1'.
  let out = "";
  for (let i = 0; i < zeros; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

type Provider = {
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (msg: Uint8Array, enc?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
  publicKey?: { toString(): string } | null;
  isPhantom?: boolean;
};

export type Detected = { name: string; provider: Provider };

// Most wallets inject themselves, and nearly all of them also answer to
// window.solana. Listing them by name lets the user pick when several are
// installed, instead of silently getting whichever won the race.
export function detectWallets(): Detected[] {
  if (typeof window === "undefined") return [];
  const w = window as any;
  const found: Detected[] = [];
  const seen = new Set<Provider>();

  const add = (name: string, p: unknown) => {
    if (!p || typeof (p as Provider).signMessage !== "function") return;
    if (seen.has(p as Provider)) return;
    seen.add(p as Provider);
    found.push({ name, provider: p as Provider });
  };

  add("Phantom", w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null));
  add("Solflare", w.solflare?.isSolflare ? w.solflare : null);
  add("Backpack", w.backpack);
  add("Coinbase Wallet", w.coinbaseSolana);
  // Anything else that injected window.solana.
  add("Browser wallet", w.solana);

  return found;
}

export function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Connect, then sign. Returns the address and base58 signature for the
// server to check.
export async function connectAndSign(
  provider: Provider,
  buildMessageFor: (address: string) => Promise<string>
): Promise<{ address: string; signature: string }> {
  const res = await provider.connect();
  const address = (res?.publicKey ?? provider.publicKey)?.toString();
  if (!address) throw new Error("Wallet didn't return an address.");

  // The message comes from our server and carries a one-time nonce, so it
  // has to be fetched after we know which address we're proving.
  const message = await buildMessageFor(address);

  const encoded = new TextEncoder().encode(message);
  const signed = await provider.signMessage(encoded, "utf8");
  const sigBytes =
    signed instanceof Uint8Array ? signed : (signed as { signature: Uint8Array }).signature;

  if (!sigBytes) throw new Error("Wallet didn't return a signature.");

  return { address, signature: base58Encode(sigBytes) };
}
