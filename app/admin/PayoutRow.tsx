"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ActivityRow } from "@/lib/activity";
import { markPaid } from "./actions";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

export default function PayoutRow({ row }: { row: ActivityRow }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(row.suggestedUsd));
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await markPaid(row.userId, Number(amount), sig);
    setBusy(false);
    if (res?.error) setError(res.error);
    else setOpen(false);
  }

  return (
    <>
      <tr style={{ borderTop: "1px solid rgba(11,31,18,.07)" }}>
        <Td strong>{row.name}</Td>
        <Td>{row.likesReceived}</Td>
        <Td>{row.swipesOnHer ? `${Math.round(row.likeRate * 100)}%` : "—"}</Td>
        <Td>{row.messagesSent}</Td>
        <Td>{row.messagesReceived}</Td>
        <Td>{row.matches}</Td>
        <Td strong>{row.score}</Td>
        <Td strong>${row.suggestedUsd}</Td>
        <Td>
          {row.alreadyPaid ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: GREEN_DK,
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <Check size={14} strokeWidth={3} /> Paid
            </span>
          ) : (
            <button
              onClick={() => setOpen(!open)}
              style={{
                background: "rgba(34,197,94,.12)",
                color: GREEN_DK,
                border: "none",
                borderRadius: 999,
                padding: "5px 13px",
                fontWeight: 800,
                fontSize: 12,
                fontFamily: font,
                cursor: "pointer",
              }}
            >
              {open ? "Cancel" : "Record"}
            </button>
          )}
        </Td>
      </tr>

      {open && (
        <tr>
          <td colSpan={9} style={{ padding: "0 0 14px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                background: "rgba(34,197,94,.05)",
                border: "1px solid rgba(34,197,94,.2)",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <span style={{ fontSize: 12.5, color: MUTE, fontWeight: 700 }}>
                Sent it? Record it:
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                style={{ ...input, width: 70 }}
                placeholder="USD"
              />
              <input
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                style={{ ...input, flex: 1, minWidth: 200, fontFamily: "monospace" }}
                placeholder="Transaction signature"
              />
              <button
                onClick={submit}
                disabled={busy}
                style={{
                  background: busy ? MUTE : GREEN,
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 18px",
                  fontWeight: 800,
                  fontSize: 12.5,
                  fontFamily: font,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Saving..." : "Save"}
              </button>
              {error && (
                <span style={{ color: "#dc2626", fontSize: 12.5, fontWeight: 600 }}>
                  {error}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const input: React.CSSProperties = {
  border: "1px solid rgba(11,31,18,.15)",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: font,
  outline: "none",
};

function Td({
  children,
  strong,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 10px 10px 0",
        color: strong ? INK : MUTE,
        fontWeight: strong ? 800 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
