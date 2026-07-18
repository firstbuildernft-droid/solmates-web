"use client";

import { GREEN, INK } from "@/lib/theme";

// The mark lives in /public/logo.png, so the path is just "/logo.png".
// Plain <img> rather than next/image on purpose: it's one small
// transparent PNG, and next/image would want config for no benefit here.

export default function Logo({
  size = 30,
  wordmark = true,
  fontSize,
  color,
}: {
  size?: number;
  wordmark?: boolean;
  fontSize?: number;
  color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <img
        src="/logo.png"
        alt="Solmates"
        width={size}
        height={size}
        style={{ display: "block" }}
      />
      {wordmark && (
        <span
          style={{
            fontWeight: 900,
            fontSize: fontSize ?? size * 0.78,
            color: color ?? INK,
            letterSpacing: -0.6,
          }}
        >
          Sol<span style={{ color: GREEN }}>mates</span>
        </span>
      )}
    </span>
  );
}
