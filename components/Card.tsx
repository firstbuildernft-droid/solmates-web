"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Wallet,
  Ruler,
  Dumbbell,
  Wine,
  Cigarette,
  TrendingUp,
} from "lucide-react";
import { GREEN, GREEN_DK, GREEN_LT, INK, MUTE } from "@/lib/theme";
import { publicUrl } from "@/lib/photos";
import type { Candidate } from "@/lib/deck";

export default function Card({
  p,
  dragOffset = 0,
  isTop,
  style,
}: {
  p: Candidate;
  dragOffset?: number;
  isTop: boolean;
  style?: React.CSSProperties;
}) {
  const [i, setI] = useState(0);

  const rot = dragOffset / 18;
  const likeOp = Math.min(Math.max(dragOffset / 90, 0), 1);
  const nopeOp = Math.min(Math.max(-dragOffset / 90, 0), 1);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 26,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 12px 40px rgba(11,31,18,.16)",
        border: "1px solid rgba(11,31,18,.06)",
        transform: isTop
          ? `translateX(${dragOffset}px) rotate(${rot}deg)`
          : style?.transform,
        transition: isTop ? "none" : "transform .3s ease",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `center / cover no-repeat url(${publicUrl(p.photos[i])})`,
        }}
      />

      {p.photos.length > 1 && (
        <>
          <div
            onClick={() => setI((n) => Math.max(0, n - 1))}
            style={{ position: "absolute", left: 0, top: 0, bottom: "45%", width: "40%", zIndex: 4 }}
          />
          <div
            onClick={() => setI((n) => Math.min(p.photos.length - 1, n + 1))}
            style={{ position: "absolute", right: 0, top: 0, bottom: "45%", width: "40%", zIndex: 4 }}
          />
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 4, zIndex: 5 }}>
            {p.photos.map((_, n) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  height: 3.5,
                  borderRadius: 2,
                  background: n === i ? "#fff" : "rgba(255,255,255,.4)",
                }}
              />
            ))}
          </div>
        </>
      )}

      <Stamp text="LIKE" color={GREEN} opacity={likeOp} side="left" />
      <Stamp text="NOPE" color="#ef4444" opacity={nopeOp} side="right" />

      <div style={{ position: "absolute", top: 16, right: 12, zIndex: 5 }}>
        <BalancePill sol={p.wallet_verified ? p.sol_balance : null} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "60px 18px 18px",
          background:
            "linear-gradient(to top, rgba(6,20,12,.92), rgba(6,20,12,.5) 55%, transparent)",
          color: "#fff",
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 9, marginBottom: 6 }}>
          <span style={{ fontSize: 27, fontWeight: 900, lineHeight: 1 }}>
            {p.display_name}
          </span>
          <span style={{ fontSize: 21, fontWeight: 500, opacity: 0.92 }}>{p.age}</span>
          {p.face_verified && (
            <span style={{ marginBottom: 3, display: "inline-flex" }}>
              <ShieldCheck size={19} color={GREEN_LT} strokeWidth={2.8} />
            </span>
          )}
        </div>

        {p.city && (
          <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 10 }}>{p.city}</div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {p.height_cm && <Chip icon={Ruler}>{p.height_cm} cm</Chip>}
          {p.gym !== null && <Chip icon={Dumbbell}>{p.gym ? "Gym" : "No gym"}</Chip>}
          {p.drinks !== null && <Chip icon={Wine}>{p.drinks ? "Drinks" : "Sober"}</Chip>}
          {p.smokes !== null && (
            <Chip icon={Cigarette}>{p.smokes ? "Smoker" : "Non-smoker"}</Chip>
          )}
        </div>

        {p.trades.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              marginBottom: 8,
              color: GREEN_LT,
            }}
          >
            <TrendingUp size={14} /> {p.trades[0]}
          </div>
        )}

        {p.bio && (
          <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.95 }}>{p.bio}</div>
        )}
      </div>
    </div>
  );
}

function BalancePill({ sol }: { sol: number | null }) {
  if (sol === null)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          background: "rgba(255,255,255,.85)",
          color: MUTE,
        }}
      >
        <Wallet size={13} /> No wallet
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 900,
        background: "rgba(255,255,255,.9)",
        color: GREEN_DK,
      }}
    >
      <ShieldCheck size={13} strokeWidth={3} />
      {Number(sol).toFixed(2)} SOL
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11.5,
        fontWeight: 600,
        padding: "4px 9px",
        borderRadius: 999,
        background: "rgba(255,255,255,.16)",
        backdropFilter: "blur(4px)",
        border: "1px solid rgba(255,255,255,.2)",
      }}
    >
      <Icon size={12.5} /> {children}
    </span>
  );
}

function Stamp({
  text,
  color,
  opacity,
  side,
}: {
  text: string;
  color: string;
  opacity: number;
  side: "left" | "right";
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 34,
        [side]: 20,
        transform: `rotate(${side === "left" ? -16 : 16}deg)`,
        zIndex: 6,
        border: `4px solid ${color}`,
        color,
        borderRadius: 10,
        padding: "4px 12px",
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: 1,
        opacity,
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}
