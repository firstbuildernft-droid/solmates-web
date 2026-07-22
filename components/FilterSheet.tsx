"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// Filters persist on the profile row, so they're the same next time and on
// every device. Saving refetches the deck via onSaved().
//
// Everything is a slider — no typing. The age one is a dual-thumb range
// built from two stacked native sliders, which is the only way to get a
// real two-handle range without pulling in a library.

type Filters = {
  min_age: number;
  max_age: number;
  max_km: number | null;
  min_sol: number;
  verified_only: boolean;
};

const AGE_MIN = 18;
const AGE_MAX = 70;  // top of the slider means "70+", stored as 99
const KM_MAX = 250;  // top means "anywhere", stored as null
const SOL_MAX = 100;

const DEFAULTS: Filters = {
  min_age: AGE_MIN,
  max_age: AGE_MAX,
  max_km: null,
  min_sol: 0,
  verified_only: false,
};

export default function FilterSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await createClient().rpc("my_filters").maybeSingle();
      const row = data as Filters | null;
      if (!row) return;
      setF({
        min_age: clamp(row.min_age ?? AGE_MIN, AGE_MIN, AGE_MAX),
        max_age: row.max_age >= 99 ? AGE_MAX : clamp(row.max_age ?? AGE_MAX, AGE_MIN, AGE_MAX),
        max_km: row.max_km,
        min_sol: clamp(Number(row.min_sol ?? 0), 0, SOL_MAX),
        verified_only: !!row.verified_only,
      });
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("set_filters", {
      min_age: f.min_age,
      max_age: f.max_age >= AGE_MAX ? 99 : f.max_age,
      max_km: f.max_km,
      min_sol: f.min_sol,
      verified_only: f.verified_only,
    });
    setBusy(false);
    if (error) return alert("Couldn't save filters: " + error.message);
    onSaved();
    onClose();
  }

  const kmSlider = f.max_km ?? KM_MAX;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,20,12,.35)",
        zIndex: 75,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        fontFamily: font,
      }}
    >
      <style>{sliderCss}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "16px 20px calc(22px + env(safe-area-inset-bottom))",
          maxWidth: 430,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          maxHeight: "88dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setF(DEFAULTS)} style={txtBtn(MUTE)}>Reset</button>
          <span style={{ fontWeight: 900, fontSize: 16, color: INK }}>Filters</span>
          <button onClick={save} disabled={busy} style={txtBtn(GREEN_DK)}>
            {busy ? "Saving…" : "Done"}
          </button>
        </div>

        {/* ---- age (two thumbs) ---- */}
        <Row
          label="Age"
          value={
            f.min_age === AGE_MIN && f.max_age >= AGE_MAX
              ? "Any"
              : `${f.min_age} – ${f.max_age >= AGE_MAX ? "70+" : f.max_age}`
          }
        />
        <div className="sm-slider">
          <div className="sm-track" />
          <div
            className="sm-fill"
            style={{
              left: `${pct(f.min_age, AGE_MIN, AGE_MAX)}%`,
              right: `${100 - pct(f.max_age, AGE_MIN, AGE_MAX)}%`,
            }}
          />
          <input
            type="range"
            min={AGE_MIN}
            max={AGE_MAX}
            value={f.min_age}
            onChange={(e) =>
              setF((s) => ({ ...s, min_age: Math.min(Number(e.target.value), s.max_age - 1) }))
            }
            className="sm-range"
          />
          <input
            type="range"
            min={AGE_MIN}
            max={AGE_MAX}
            value={f.max_age}
            onChange={(e) =>
              setF((s) => ({ ...s, max_age: Math.max(Number(e.target.value), s.min_age + 1) }))
            }
            className="sm-range"
          />
        </div>

        {/* ---- distance ---- */}
        <Row label="Maximum distance" value={f.max_km === null ? "Anywhere" : `${f.max_km} km`} />
        <Single
          min={1}
          max={KM_MAX}
          value={kmSlider}
          onChange={(v) => setF({ ...f, max_km: v >= KM_MAX ? null : v })}
        />
        <Hint>People without a location set are always included.</Hint>

        {/* ---- wallet balance ---- */}
        <Row label="Minimum wallet balance" value={f.min_sol === 0 ? "Any" : `${f.min_sol}+ SOL`} />
        <Single
          min={0}
          max={SOL_MAX}
          value={f.min_sol}
          onChange={(v) => setF({ ...f, min_sol: v })}
        />
        <Hint>Above &quot;Any&quot;, only people with a verified wallet show up.</Hint>

        {/* ---- verified only ---- */}
        <div style={{ height: 24 }} />
        <button
          onClick={() => setF({ ...f, verified_only: !f.verified_only })}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: f.verified_only ? "rgba(34,197,94,.09)" : "rgba(11,31,18,.03)",
            border: `1px solid ${f.verified_only ? "rgba(34,197,94,.35)" : "rgba(11,31,18,.1)"}`,
            borderRadius: 14,
            padding: "13px 15px",
            cursor: "pointer",
            fontFamily: font,
            textAlign: "left",
          }}
        >
          <ShieldCheck size={19} color={f.verified_only ? GREEN : MUTE} />
          <span style={{ flex: 1, fontWeight: 800, fontSize: 14, color: INK }}>
            Verified people only
          </span>
          <Switch on={f.verified_only} />
        </button>
        <Hint>Wallet-verified or face-verified both count.</Hint>
      </div>
    </div>
  );
}

/* ---------------- bits ---------------- */

function Single({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="sm-slider">
      <div className="sm-track" />
      <div className="sm-fill" style={{ left: 0, right: `${100 - pct(value, min, max)}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sm-range"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "22px 0 0" }}>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: GREEN_DK }}>{value}</span>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: MUTE, marginTop: 7, lineHeight: 1.4 }}>{children}</div>;
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        background: on ? GREEN : "rgba(11,31,18,.16)",
        position: "relative",
        flexShrink: 0,
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .15s",
        }}
      />
    </span>
  );
}

function pct(v: number, min: number, max: number) {
  return ((v - min) / (max - min)) * 100;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function txtBtn(color: string): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    color,
    fontWeight: 800,
    fontSize: 14.5,
    fontFamily: font,
    cursor: "pointer",
    padding: "4px 2px",
  };
}

/* Native range inputs can't be styled inline (thumbs need vendor
   pseudo-elements), so the slider chrome lives here. For the age range,
   two transparent inputs stack on one track — only the thumbs catch
   pointer events, so each handle stays independently draggable. */
const sliderCss = `
.sm-slider { position: relative; height: 34px; margin-top: 10px; }
.sm-track {
  position: absolute; left: 0; right: 0; top: 15px; height: 4px;
  border-radius: 999px; background: rgba(11,31,18,.11);
}
.sm-fill {
  position: absolute; top: 15px; height: 4px;
  border-radius: 999px; background: #22c55e;
}
.sm-range {
  position: absolute; left: 0; top: 0; width: 100%; height: 34px;
  margin: 0; padding: 0; background: none;
  -webkit-appearance: none; appearance: none; pointer-events: none;
}
.sm-range:focus { outline: none; }
.sm-range::-webkit-slider-runnable-track { background: none; height: 34px; }
.sm-range::-moz-range-track { background: none; height: 34px; }
.sm-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; pointer-events: auto;
  width: 26px; height: 26px; border-radius: 50%; margin-top: 4px;
  background: #fff; border: 1px solid rgba(11,31,18,.1);
  box-shadow: 0 2px 7px rgba(11,31,18,.22); cursor: grab;
}
.sm-range::-webkit-slider-thumb:active { cursor: grabbing; }
.sm-range::-moz-range-thumb {
  pointer-events: auto; width: 26px; height: 26px; border-radius: 50%;
  background: #fff; border: 1px solid rgba(11,31,18,.1);
  box-shadow: 0 2px 7px rgba(11,31,18,.22); cursor: grab;
}
`;
