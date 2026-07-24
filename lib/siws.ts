import "server-only";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

// Verifying a Solana signature needs two things: base58 decoding and an
// ed25519 check. Both are done here with Node built-ins so the app takes
// on no new dependency — one less thing to keep patched.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(str: string): Uint8Array {
  const map = new Map<string, number>();
  for (let i = 0; i < B58.length; i++) map.set(B58[i], i);

  // Starts empty, not [0]: a seed zero would be counted a second time by
  // the leading-'1' pass below, and any address with a leading zero byte
  // would come out one byte too long and be rejected.
  const bytes: number[] = [];
  for (const ch of str) {
    const val = map.get(ch);
    if (val === undefined) throw new Error("bad base58 character");
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i] * 58 + carry;
      bytes[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Leading '1's in base58 are leading zero bytes.
  for (const ch of str) {
    if (ch !== "1") break;
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

// Node can verify ed25519, but only from a KeyObject. A raw 32-byte
// Solana public key becomes one by prefixing the standard SPKI header for
// ed25519 — cheaper than pulling in a crypto library for twelve bytes.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifySignature(
  message: string,
  signatureB58: string,
  addressB58: string
): boolean {
  try {
    const pub = base58Decode(addressB58);
    if (pub.length !== 32) return false;

    const sig = base58Decode(signatureB58);
    if (sig.length !== 64) return false;

    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub)]),
      format: "der",
      type: "spki",
    });

    return cryptoVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(sig));
  } catch {
    return false;
  }
}

// The exact text the wallet displays. Deliberately plain: the user should
// be able to read it and see that nothing is being transferred. The nonce
// makes each request single-use, so a captured signature can't be replayed.
export function buildMessage(address: string, nonce: string) {
  return [
    "Solmates wants you to verify this wallet.",
    "",
    "This proves you own the address. It is not a transaction and moves no funds.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}
