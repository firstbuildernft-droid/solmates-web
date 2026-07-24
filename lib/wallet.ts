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
};

export type WalletOption = {
  slug: string;      // also the logo filename: /wallets/<slug>.png
  name: string;
  installUrl: string;
  provider: Provider | null;   // null when it isn't installed
};

// The wallets we offer by name, in the order they're shown. Each knows how
// to find itself and where to send someone who hasn't got it. Adding one
// is a single entry here — the picker and the signing flow need no change.
const REGISTRY: {
  slug: string;
  name: string;
  installUrl: string;
  find: (w: any) => unknown;
}[] = [
  {
    slug: "phantom",
    name: "Phantom",
    installUrl: "https://phantom.app/download",
    find: (w) => w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null),
  },
  {
    slug: "solflare",
    name: "Solflare",
    installUrl: "https://solflare.com/download",
    find: (w) => (w.solflare?.isSolflare ? w.solflare : null) ?? w.solflare,
  },
  {
    slug: "trust",
    name: "Trust Wallet",
    installUrl: "https://trustwallet.com/download",
    find: (w) => w.trustwallet?.solana ?? w.trustWallet?.solana,
  },
  {
    slug: "backpack",
    name: "Backpack",
    installUrl: "https://backpack.app/download",
    find: (w) => w.backpack,
  },
  {
    slug: "coinbase",
    name: "Coinbase Wallet",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    find: (w) => w.coinbaseSolana,
  },
];

function usable(p: unknown): p is Provider {
  return !!p && typeof (p as Provider).signMessage === "function";
}

// Every wallet we know about, each marked with whether it's actually here.
// Not-installed ones still get listed so the user can go and get one,
// rather than staring at an empty list wondering what went wrong.
export function walletOptions(): WalletOption[] {
  const w = (typeof window === "undefined" ? {} : window) as any;
  const seen = new Set<unknown>();

  const known = REGISTRY.map(({ slug, name, installUrl, find }) => {
    const found = find(w);
    const ok = usable(found) && !seen.has(found);
    if (ok) seen.add(found);
    return { slug, name, installUrl, provider: ok ? (found as Provider) : null };
  });

  // Something injected window.solana that we don't recognise by name.
  if (usable(w.solana) && !seen.has(w.solana)) {
    known.push({
      slug: "generic",
      name: "Browser wallet",
      installUrl: "",
      provider: w.solana as Provider,
    });
  }

  // Installed first, so the useful ones are at the top.
  return known.sort((a, b) => Number(!!b.provider) - Number(!!a.provider));
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
