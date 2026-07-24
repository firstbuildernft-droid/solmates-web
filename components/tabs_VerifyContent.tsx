"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, Copy, Check, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { connectAndSign, type WalletOption } from "@/lib/wallet";
import WalletPicker from "@/components/WalletPicker";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

const DEPOSIT = process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS!;
const AMOUNT = process.env.NEXT_PUBLIC_VERIFY_MIN_SOL ?? "0.1";

type State = "unverified" | "pending" | "verified";

export default function VerifyContent() {
  const [state, setState] = useState<State>("unverified");
  const [picking, setPicking] = useState(false);
  const [signing, setSigning] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("wallets")
        .select("address, state")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAddress(data.address);
        setState(data.state as State);
      }
      setLoading(false);
    })();
  }, []);

  // Connect a wallet and prove ownership by signing a message. No payment,
  // no transaction, and the private key never leaves the wallet.
  async function signVerify(w: WalletOption) {
    setSigning(true);
    setNote(null);
    try {
      const { address: addr, signature } = await connectAndSign(w.provider!, async (a) => {
        const res = await fetch("/api/wallet/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: a }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't start verification.");
        return json.message as string;
      });

      const res = await fetch("/api/wallet/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Verification failed.");

      setAddress(addr);
      setState("verified");
      setPicking(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      // Wallets throw this when the user closes the prompt; not an error
      // worth shouting about.
      setNote(/reject|denied|cancel/i.test(msg) ? null : msg);
    } finally {
      setSigning(false);
    }
  }

  async function claim() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/wallet/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address.trim() }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setNote(json.error);
    setState("pending");
  }

  async function check() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/wallet/check", { method: "POST" });
    const json = await res.json();
    setBusy(false);

    if (!res.ok) return setNote(json.error);
    if (json.state === "verified") return setState("verified");
    setNote(
      "No payment from that wallet yet. If you just sent it, wait a few seconds and check again."
    );
  }

  if (loading) return null;

  // Solana Pay URI — Phantom and friends read this off the QR and fill in
  // the address and amount, so there's nothing to mistype.
  const payUri = `solana:${DEPOSIT}?amount=${AMOUNT}&label=Solmates&message=Wallet%20verification`;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "4px 20px 60px",
        fontFamily: font,
        background: "transparent",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1
          style={{
            fontWeight: 900,
            fontSize: 26,
            color: INK,
            letterSpacing: -0.5,
            margin: "0 0 6px",
          }}
        >
          Verify your wallet
        </h1>

        {state === "verified" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <ShieldCheck size={46} color={GREEN} />
            <div style={{ fontWeight: 900, fontSize: 19, color: INK, marginTop: 8 }}>
              Wallet verified
            </div>
            <div
              style={{
                fontSize: 13,
                color: MUTE,
                marginTop: 6,
                fontFamily: "monospace",
              }}
            >
              {address.slice(0, 4)}...{address.slice(-4)}
            </div>

            <button
              onClick={() => {
                if (window.confirm("Change your wallet? You'll enter a new address and send 0.1 SOL again to verify it. Your current wallet stays until the new one is confirmed.")) {
                  setAddress("");
                  setState("unverified");
                }
              }}
              style={{
                marginTop: 26,
                background: "none",
                border: `1px solid rgba(11,31,18,.18)`,
                borderRadius: 999,
                padding: "10px 20px",
                fontWeight: 800,
                fontSize: 13.5,
                fontFamily: font,
                color: INK,
                cursor: "pointer",
              }}
            >
              Change wallet
            </button>
          </div>
        ) : state === "unverified" ? (
          <>
            <p style={{ color: MUTE, fontSize: 14.5, lineHeight: 1.5, marginBottom: 16 }}>
              Show your holdings on your profile. Connect a wallet and sign a
              message to prove it's yours. Nothing is sent and no funds move.
            </p>

            <button
              onClick={() => setPicking(true)}
              disabled={signing}
              style={{
                width: "100%",
                background: GREEN,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: 14,
                fontWeight: 800,
                fontSize: 15,
                fontFamily: font,
                cursor: signing ? "default" : "pointer",
                opacity: signing ? 0.6 : 1,
                marginBottom: 20,
              }}
            >
              {signing ? "Waiting for your wallet…" : "Connect wallet"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px" }}>
              <span style={{ flex: 1, height: 1, background: "rgba(11,31,18,.1)" }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: MUTE }}>OR</span>
              <span style={{ flex: 1, height: 1, background: "rgba(11,31,18,.1)" }} />
            </div>

            <p style={{ color: MUTE, fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
              Works with any wallet, including hardware. Paste the address, then
              send <b style={{ color: INK }}>{AMOUNT} SOL</b> from it to prove
              it's yours.
            </p>

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your Solana address"
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid rgba(11,31,18,.14)",
                borderRadius: 12,
                padding: "13px 15px",
                fontSize: 14,
                fontFamily: "monospace",
                outline: "none",
              }}
            />

            {note && <Note>{note}</Note>}

            <Button onClick={claim} busy={busy}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <img
                src="/bird.png"
                alt=""
                style={{ width: 74, height: 74, objectFit: "contain", flexShrink: 0 }}
              />
              <p style={{ color: MUTE, fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>
                Send exactly <b style={{ color: GREEN_DK }}>{AMOUNT} SOL</b> from{" "}
                <b style={{ color: INK, fontFamily: "monospace" }}>
                  {address.slice(0, 4)}...{address.slice(-4)}
                </b>
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div
                style={{
                  padding: 12,
                  background: "#fff",
                  border: `2px solid ${GREEN}`,
                  borderRadius: 16,
                }}
              >
                <QRCodeSVG value={payUri} size={168} />
              </div>
            </div>

            <div
              onClick={() => {
                navigator.clipboard?.writeText(DEPOSIT);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f0f4f1",
                borderRadius: 10,
                padding: "11px 13px",
                fontSize: 12,
                fontFamily: "monospace",
                color: INK,
                cursor: "pointer",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {DEPOSIT}
              </span>
              {copied ? <Check size={15} color={GREEN} /> : <Copy size={15} color={MUTE} />}
            </div>

            {/* The single most common way this goes wrong. */}
            <div
              style={{
                display: "flex",
                gap: 9,
                background: "rgba(234,179,8,.1)",
                border: "1px solid rgba(234,179,8,.35)",
                borderRadius: 12,
                padding: "11px 13px",
                marginBottom: 6,
              }}
            >
              <TriangleAlert size={17} color="#a16207" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "#713f12", lineHeight: 1.45 }}>
                Send from your own wallet, not from Binance or another
                exchange. Exchanges send from their address, not yours, so we
                won't be able to match it to you, and the SOL is gone.
              </div>
            </div>

            {note && <Note>{note}</Note>}

            <Button onClick={check} busy={busy}>
              {busy ? "Checking..." : "I've sent it"}
            </Button>

            <button
              onClick={() => {
                setState("unverified");
                setNote(null);
              }}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                color: MUTE,
                fontWeight: 700,
                fontSize: 13,
                fontFamily: font,
                padding: "12px 0",
                cursor: "pointer",
              }}
            >
              Use a different wallet
            </button>
          </>
        )}
      </div>

      {picking && (
        <WalletPicker
          busy={signing}
          onPick={(w) => signVerify(w)}
          onClose={() => setPicking(false)}
        />
      )}
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        color: INK,
        background: "rgba(11,31,18,.04)",
        borderRadius: 10,
        padding: "10px 12px",
        margin: "12px 0 0",
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        width: "100%",
        marginTop: 14,
        background: busy ? MUTE : GREEN,
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: 14,
        fontWeight: 800,
        fontSize: 15.5,
        fontFamily: font,
        cursor: busy ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
