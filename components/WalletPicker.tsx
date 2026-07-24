"use client";

import { useState } from "react";
import { walletOptions, isMobile, type WalletOption } from "@/lib/wallet";
import { GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// The list that opens from "Connect wallet". Installed wallets sit at the
// top and connect; the rest link out to install, so nobody hits a dead end.

export default function WalletPicker({
  onPick,
  onClose,
  busy,
}: {
  onPick: (w: WalletOption) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const options = walletOptions();
  const anyInstalled = options.some((o) => o.provider);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,20,12,.35)",
        zIndex: 78,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        fontFamily: font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "18px 18px calc(22px + env(safe-area-inset-bottom))",
          maxWidth: 430,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          maxHeight: "82dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 900, fontSize: 16.5, color: INK }}>Connect a wallet</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: MUTE, fontSize: 24, lineHeight: 1, cursor: "pointer", padding: 0 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: MUTE, margin: "0 0 14px", lineHeight: 1.45 }}>
          You&apos;ll sign a message to prove the wallet is yours. No transaction,
          no funds move.
        </p>

        {!anyInstalled && isMobile() && (
          <div style={{ background: "rgba(11,31,18,.03)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12.5, color: MUTE, lineHeight: 1.5 }}>
            On a phone, the reliable way is to open <b style={{ color: INK }}>thesolmates.com</b> inside
            your wallet app&apos;s own browser. Then come back here and it will
            connect first try.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => (
            <Row key={o.slug} option={o} busy={busy} onPick={onPick} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  option,
  busy,
  onPick,
}: {
  option: WalletOption;
  busy: boolean;
  onPick: (w: WalletOption) => void;
}) {
  const installed = !!option.provider;

  const inner = (
    <>
      <Logo slug={option.slug} name={option.name} />
      <span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: INK }}>{option.name}</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: installed ? GREEN_DK : MUTE }}>
        {installed ? "Connect" : "Install"}
      </span>
    </>
  );

  const style: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    border: "1px solid rgba(11,31,18,.11)",
    borderRadius: 14,
    padding: "12px 14px",
    cursor: busy ? "default" : "pointer",
    fontFamily: font,
    textAlign: "left",
    textDecoration: "none",
    opacity: busy ? 0.55 : 1,
  };

  if (!installed) {
    if (!option.installUrl) return null;
    return (
      <a href={option.installUrl} target="_blank" rel="noopener noreferrer" style={style}>
        {inner}
      </a>
    );
  }

  return (
    <button onClick={() => onPick(option)} disabled={busy} style={style}>
      {inner}
    </button>
  );
}

// Uses /wallets/<slug>.<ext> when it exists, trying the common image
// formats in turn, and falls back to a lettered circle so the picker
// still looks finished before any logos are added.
const LOGO_EXTS = ["png", "svg", "webp", "jpg", "jpeg"];

function Logo({ slug, name }: { slug: string; name: string }) {
  const [attempt, setAttempt] = useState(0);

  if (slug === "generic" || attempt >= LOGO_EXTS.length) {
    return (
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "rgba(34,197,94,.12)",
          color: GREEN_DK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {name.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={`/wallets/${slug}.${LOGO_EXTS[attempt]}`}
      alt=""
      onError={() => setAttempt((n) => n + 1)}
      style={{ width: 34, height: 34, borderRadius: 10, objectFit: "contain", flexShrink: 0 }}
    />
  );
}
