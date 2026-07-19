"use client";

import {
  ShieldCheck,
  Wallet,
  Ruler,
  Dumbbell,
  Wine,
  Cigarette,
  TrendingUp,
  MapPin,
  Quote,
  X,
} from "lucide-react";
import { GREEN, GREEN_DK, GREEN_LT, INK, MUTE, font } from "@/lib/theme";
import { publicUrl } from "@/lib/photos";
import type { Candidate } from "@/lib/deck";

// The tap-to-expand full profile. Bumble-style: photos and info blocks
// interleaved down a scroll, instead of one photo with everything stacked.
// Built by weaving the photo list and the "info sections" together so it
// reads photo / info / photo / prompt / photo / ...

export default function ExpandedProfile({
  p,
  onClose,
}: {
  p: Candidate;
  onClose: () => void;
}) {
  // Build the interleaved sections between photos.
  const infoBlocks: React.ReactNode[] = [];

  // 0: name + basics (always first, under photo 1)
  infoBlocks.push(
    <Section key="head">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 27, fontWeight: 900, color: INK }}>{p.display_name}</span>
        <span style={{ fontSize: 21, fontWeight: 500, color: MUTE }}>{p.age}</span>
        {p.face_verified && <ShieldCheck size={20} color={GREEN} strokeWidth={2.6} style={{ marginBottom: 3 }} />}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {p.distance_km != null && (
          <Chip icon={MapPin}>
            {p.distance_km < 1 ? "Less than 1 km away" : `${p.distance_km} km away`}
          </Chip>
        )}
        {p.height_cm && <Chip icon={Ruler}>{p.height_cm} cm</Chip>}
        {p.gym !== null && <Chip icon={Dumbbell}>{p.gym ? "Gym" : "No gym"}</Chip>}
        {p.drinks !== null && <Chip icon={Wine}>{p.drinks ? "Drinks" : "Sober"}</Chip>}
        {p.smokes !== null && <Chip icon={Cigarette}>{p.smokes ? "Smoker" : "Non-smoker"}</Chip>}
      </div>
    </Section>
  );

  // bio
  if (p.bio) {
    infoBlocks.push(
      <Section key="bio">
        <Quote size={18} color={GREEN} style={{ marginBottom: 6 }} />
        <div style={{ fontSize: 16, lineHeight: 1.55, color: INK }}>{p.bio}</div>
      </Section>
    );
  }

  // wallet
  infoBlocks.push(
    <Section key="wallet">
      {p.wallet_verified && p.sol_balance != null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(34,197,94,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={22} color={GREEN_DK} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: INK }}>{Number(p.sol_balance).toFixed(2)} SOL</div>
            <div style={{ fontSize: 12.5, color: MUTE }}>Verified wallet</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTE }}>
          <Wallet size={18} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>No verified wallet</span>
        </div>
      )}
      {p.trades.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {p.trades.map((t, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,.1)", color: GREEN_DK, border: "1px solid rgba(34,197,94,.25)", borderRadius: 999, padding: "5px 10px", fontSize: 12.5, fontWeight: 700 }}>
              <TrendingUp size={13} /> {t}
            </span>
          ))}
        </div>
      )}
    </Section>
  );

  // prompts — each its own block
  const qs = p.prompt_qs ?? [];
  const as = p.prompt_as ?? [];
  qs.forEach((q, i) => {
    infoBlocks.push(
      <Section key={`prompt-${i}`}>
        <div style={{ fontSize: 13, fontWeight: 700, color: MUTE, marginBottom: 6 }}>{q}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: INK, lineHeight: 1.4 }}>{as[i]}</div>
      </Section>
    );
  });

  // Weave photos and info blocks: photo, info, photo, info, ...
  const rows: React.ReactNode[] = [];
  const maxLen = Math.max(p.photos.length, infoBlocks.length);
  for (let i = 0; i < maxLen; i++) {
    if (p.photos[i]) {
      rows.push(
        <div
          key={`photo-${i}`}
          style={{
            width: "100%",
            aspectRatio: "4 / 5",
            background: `center / cover no-repeat url(${publicUrl(p.photos[i])})`,
            borderRadius: 18,
          }}
        />
      );
    }
    if (infoBlocks[i]) rows.push(infoBlocks[i]);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "#fff",
        overflowY: "auto",
        fontFamily: font,
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", justifyContent: "flex-end", padding: 12, background: "linear-gradient(to bottom, rgba(255,255,255,.95), transparent)" }}>
        <button
          onClick={onClose}
          data-tap
          style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#fff", boxShadow: "0 2px 10px rgba(11,31,18,.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: INK }}
        >
          <X size={20} strokeWidth={2.6} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 14px 40px", marginTop: -50 }}>
        {rows}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid rgba(11,31,18,.1)", borderRadius: 18, padding: "18px 18px" }}>
      {children}
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 999, background: "rgba(11,31,18,.05)", color: INK }}>
      <Icon size={13} /> {children}
    </span>
  );
}
