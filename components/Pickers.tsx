"use client";

import { useEffect, useRef, useState } from "react";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// An iOS-style scroll wheel. Snaps to the nearest item on release, and
// the selected row sits in a highlighted band in the middle.
const ITEM_H = 40;

function Wheel({
  values,
  value,
  onChange,
  format,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the wheel scrolled to the current value when it changes
  // externally (e.g. unit switch recomputes the list).
  useEffect(() => {
    const idx = values.indexOf(value);
    if (ref.current && idx >= 0) {
      ref.current.scrollTop = idx * ITEM_H;
    }
  }, [value, values]);

  function onScroll() {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      ref.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      if (values[clamped] !== value) onChange(values[clamped]);
    }, 90);
  }

  return (
    <div style={{ position: "relative", flex: 1, height: ITEM_H * 5 }}>
      {/* center highlight band */}
      <div
        style={{
          position: "absolute",
          top: ITEM_H * 2,
          left: 0,
          right: 0,
          height: ITEM_H,
          background: "rgba(34,197,94,.1)",
          borderTop: `1px solid rgba(34,197,94,.3)`,
          borderBottom: `1px solid rgba(34,197,94,.3)`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          height: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          // hide scrollbar
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div style={{ height: ITEM_H * 2 }} />
        {values.map((v) => (
          <div
            key={v}
            onClick={() => onChange(v)}
            style={{
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              scrollSnapAlign: "center",
              fontSize: v === value ? 20 : 16,
              fontWeight: v === value ? 800 : 500,
              color: v === value ? INK : MUTE,
              fontFamily: font,
              cursor: "pointer",
              transition: "font-size .1s, color .1s",
            }}
          >
            {format ? format(v) : v}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

// ---- Height picker: cm <-> ft/in ----
export function HeightPicker({
  valueCm,
  onSave,
  onClose,
  unit,
  setUnit,
}: {
  valueCm: number | null;
  onSave: (cm: number) => void;
  onClose: () => void;
  unit: "cm" | "ft";
  setUnit: (u: "cm" | "ft") => void;
}) {
  const start = valueCm ?? 175;
  const [cm, setCm] = useState(start);

  const cmValues = Array.from({ length: 251 - 120 }, (_, i) => 120 + i);
  // total inches range for ft/in mode
  const inchMin = Math.round(120 / 2.54); // ~47
  const inchMax = Math.round(250 / 2.54); // ~98
  const inchValues = Array.from({ length: inchMax - inchMin + 1 }, (_, i) => inchMin + i);
  const curInches = Math.round(cm / 2.54);

  return (
    <PickerSheet
      title="Height"
      unit={unit}
      units={[{ v: "cm", t: "cm" }, { v: "ft", t: "ft/in" }]}
      onUnit={(u) => setUnit(u as "cm" | "ft")}
      onClose={onClose}
      onSave={() => { onSave(cm); onClose(); }}
    >
      {unit === "cm" ? (
        <Wheel values={cmValues} value={cm} onChange={setCm} format={(v) => `${v} cm`} />
      ) : (
        <Wheel
          values={inchValues}
          value={curInches}
          onChange={(inches) => setCm(Math.round(inches * 2.54))}
          format={(inches) => `${Math.floor(inches / 12)}'${inches % 12}"`}
        />
      )}
    </PickerSheet>
  );
}

// ---- Weight picker: kg <-> lbs ----
export function WeightPicker({
  valueKg,
  onSave,
  onClose,
  unit,
  setUnit,
}: {
  valueKg: number | null;
  onSave: (kg: number) => void;
  onClose: () => void;
  unit: "kg" | "lbs";
  setUnit: (u: "kg" | "lbs") => void;
}) {
  const [kg, setKg] = useState(valueKg ?? 70);

  const kgValues = Array.from({ length: 251 - 40 }, (_, i) => 40 + i);
  const lbsMin = Math.round(40 * 2.20462);
  const lbsMax = Math.round(250 * 2.20462);
  const lbsValues = Array.from({ length: lbsMax - lbsMin + 1 }, (_, i) => lbsMin + i);
  const curLbs = Math.round(kg * 2.20462);

  return (
    <PickerSheet
      title="Weight"
      unit={unit}
      units={[{ v: "kg", t: "kg" }, { v: "lbs", t: "lbs" }]}
      onUnit={(u) => setUnit(u as "kg" | "lbs")}
      onClose={onClose}
      onSave={() => { onSave(kg); onClose(); }}
    >
      {unit === "kg" ? (
        <Wheel values={kgValues} value={kg} onChange={setKg} format={(v) => `${v} kg`} />
      ) : (
        <Wheel
          values={lbsValues}
          value={curLbs}
          onChange={(lbs) => setKg(Math.round(lbs / 2.20462))}
          format={(lbs) => `${lbs} lbs`}
        />
      )}
    </PickerSheet>
  );
}

// ---- shared sheet chrome ----
function PickerSheet({
  title,
  unit,
  units,
  onUnit,
  onClose,
  onSave,
  children,
}: {
  title: string;
  unit: string;
  units: { v: string; t: string }[];
  onUnit: (u: string) => void;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-sheet-backdrop
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,20,12,.35)",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        data-sheet
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "16px 18px calc(20px + env(safe-area-inset-bottom))",
          fontFamily: font,
          maxWidth: 430,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={onClose} style={txtBtn(MUTE)}>Cancel</button>
          <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>{title}</span>
          <button onClick={onSave} style={txtBtn(GREEN_DK)}>Done</button>
        </div>

        <div style={{ display: "flex", gap: 6, background: "rgba(11,31,18,.05)", borderRadius: 999, padding: 3, marginBottom: 8 }}>
          {units.map((u) => (
            <button
              key={u.v}
              onClick={() => onUnit(u.v)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 999,
                padding: "7px 0",
                fontWeight: 800,
                fontSize: 13,
                fontFamily: font,
                cursor: "pointer",
                background: unit === u.v ? "#fff" : "transparent",
                color: unit === u.v ? INK : MUTE,
                boxShadow: unit === u.v ? "0 1px 3px rgba(11,31,18,.12)" : "none",
              }}
            >
              {u.t}
            </button>
          ))}
        </div>

        <div style={{ display: "flex" }}>{children}</div>
      </div>
    </div>
  );
}

function txtBtn(color: string): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    color,
    fontWeight: 800,
    fontSize: 15,
    fontFamily: font,
    cursor: "pointer",
    padding: "4px 2px",
  };
}
