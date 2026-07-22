"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// Filters persist on the profile row, so they're the same next time and on
// every device. Saving refetches the deck via onSaved().

type Filters = {
  min_age: number;
  max_age: number;
  max_km: number | null;
  min_sol: number;
  verified_only: boolean;
};

const DEFAULTS: Filters = {
  min_age: 18,
  max_age: 99,
  max_km: null,
  min_sol: 0,
  verified_only: false,
};

const KM_STEPS = [10, 25, 50, 100, 250, null]; // null = anywhere
const SOL_STEPS = [0, 1, 5, 10, 50, 100];

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
      if (row) {
        setF({
          min_age: row.min_age ?? 18,
          max_age: row.max_age ?? 99,
          max_km: row.max_km,
          min_sol: Number(row.min_sol ?? 0),
          verified_only: !!row.verified_only,
        });
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { error } = await createClient().rpc("set_filters", {
      min_age: f.min_age,
      max_age: f.max_age,
      max_km: f.max_km,
      min_sol: f.min_sol,
      verified_only: f.verified_only,
    });
    setBusy(false);
    if (error) {
      alert("Couldn't save filters: " + error.message);
      return;
    }
    onSaved();
    onClose();
  }

  function reset() {
    setF(DEFAULTS);
  }

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "16px 18px calc(20px + env(safe-area-inset-bottom))",
          maxWidth: 430,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          maxHeight: "88dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={reset} style={txtBtn(MUTE)}>Reset</button>
          <span style={{ fontWeight: 900, fontSize: 16, color: INK }}>Filters</span>
          <button onClick={save} disabled={busy} style={txtBtn(GREEN_DK)}>
            {busy ? "Saving…" : "Done"}
          </button>
        </div>

        {/* ---- age ---- */}
        <Label>Age</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <NumBox
            value={f.min_age}
            min={18}
            max={f.max_age}
            onChange={(v) => setF({ ...f, min_age: v })}
          />
          <span style={{ color: MUTE, fontWeight: 700 }}>to</span>
          <NumBox
            value={f.max_age}
            min={f.min_age}
            max={99}
            onChange={(v) => setF({ ...f, max_age: v })}
          />
        </div>
        <Hint>Only shows people in this range.</Hint>

        {/* ---- distance ---- */}
        <Label>Maximum distance</Label>
        <Pills
          options={KM_STEPS.map((k) => ({ v: k, t: k === null ? "Anywhere" : `${k} km` }))}
          value={f.max_km}
          onChange={(v) => setF({ ...f, max_km: v as number | null })}
        />
        <Hint>People without a location are always included.</Hint>

        {/* ---- sol balance ---- */}
        <Label>Minimum wallet balance</Label>
        <Pills
          options={SOL_STEPS.map((s) => ({ v: s, t: s === 0 ? "Any" : `${s}+ SOL` }))}
          value={f.min_sol}
          onChange={(v) => setF({ ...f, min_sol: v as number })}
        />
        <Hint>
          Above &quot;Any&quot;, only people with a verified wallet show up.
        </Hint>

        {/* ---- verified only ---- */}
        <Label>Verified only</Label>
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
            Show verified people only
          </span>
          <Switch on={f.verified_only} />
        </button>
        <Hint>Wallet-verified or face-verified both count.</Hint>
      </div>
    </div>
  );
}

/* ---------------- bits ---------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 900, color: MUTE, letterSpacing: ".04em", textTransform: "uppercase", margin: "18px 0 8px" }}>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: MUTE, marginTop: 7, lineHeight: 1.4 }}>{children}</div>;
}

function NumBox({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        onChange(Math.max(min, Math.min(max, Math.round(n))));
      }}
      style={{
        flex: 1,
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid rgba(11,31,18,.14)",
        borderRadius: 12,
        padding: "11px 14px",
        fontSize: 16,
        fontWeight: 800,
        fontFamily: font,
        color: INK,
        outline: "none",
        textAlign: "center",
      }}
    />
  );
}

function Pills({
  options,
  value,
  onChange,
}: {
  options: { v: number | null; t: string }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            style={{
              border: `1px solid ${on ? "rgba(34,197,94,.45)" : "rgba(11,31,18,.12)"}`,
              background: on ? "rgba(34,197,94,.12)" : "#fff",
              color: on ? GREEN_DK : INK,
              borderRadius: 999,
              padding: "8px 14px",
              fontWeight: 800,
              fontSize: 13,
              fontFamily: font,
              cursor: "pointer",
            }}
          >
            {o.t}
          </button>
        );
      })}
    </div>
  );
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
