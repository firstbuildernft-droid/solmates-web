"use client";

import { useState } from "react";

// Click the address to copy it to the clipboard — for sending payouts.
export default function CopyAddr({ address }: { address: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!address) return <span style={{ color: "#9aa5a0" }}>—</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      onClick={copy}
      title="Click to copy"
      style={{
        background: copied ? "rgba(34,197,94,.15)" : "rgba(11,31,18,.04)",
        border: "1px solid rgba(11,31,18,.1)",
        borderRadius: 6,
        padding: "3px 7px",
        fontFamily: "monospace",
        fontSize: 11.5,
        cursor: "pointer",
        color: copied ? "#15803d" : "#0b1f12",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : address}
    </button>
  );
}
