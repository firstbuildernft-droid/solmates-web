"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ruler, Dumbbell, Wine, Cigarette, TrendingUp, X, ShieldCheck, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";
import PhotoGrid, { type Photo } from "@/components/PhotoGrid";

type Trade = { id: string; label: string };

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeInput, setTradeInput] = useState("");
  const [faceVerified, setFaceVerified] = useState(false);

  const [bio, setBio] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gym, setGym] = useState<boolean | null>(null);
  const [drinks, setDrinks] = useState<boolean | null>(null);
  const [smokes, setSmokes] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      setUserId(user.id);

      const [{ data: profile }, { data: ph }, { data: tr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("photos")
          .select("id, storage_path, position")
          .eq("user_id", user.id)
          .order("position"),
        supabase
          .from("trades")
          .select("id, label")
          .eq("user_id", user.id)
          .order("position"),
      ]);

      if (!profile) return router.replace("/onboarding");

      setBio(profile.bio ?? "");
      setHeight(profile.height_cm?.toString() ?? "");
      setWeight(profile.weight_kg?.toString() ?? "");
      setGym(profile.gym);
      setDrinks(profile.drinks);
      setSmokes(profile.smokes);
      setFaceVerified(profile.face_verified ?? false);
      setPhotos(ph ?? []);
      setTrades(tr ?? []);
      setLoading(false);
    })();
  }, [router]);

  async function save() {
    if (!userId) return;
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        bio: bio.trim() || null,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        gym,
        drinks,
        smokes,
      })
      .eq("id", userId);

    if (error) return setError(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addTrade() {
    const label = tradeInput.trim();
    if (!label || !userId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trades")
      .insert({ user_id: userId, label, position: trades.length })
      .select("id, label")
      .single();
    if (error) return setError(error.message);
    setTrades([...trades, data]);
    setTradeInput("");
  }

  async function removeTrade(id: string) {
    setTrades(trades.filter((t) => t.id !== id));
    await createClient().from("trades").delete().eq("id", id);
  }

  if (loading || !userId) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px 60px",
        fontFamily: font,
        background: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 22px" }}>
          <h1 style={{ fontWeight: 900, fontSize: 26, color: INK, letterSpacing: -0.5, margin: 0 }}>
            My profile
          </h1>
          <Link href="/settings" aria-label="Settings" style={{ display: "flex", color: MUTE, padding: 4 }}>
            <Settings size={23} />
          </Link>
        </div>

        {!faceVerified && (
          <Link
            href="/face"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              textDecoration: "none",
              background: "rgba(34,197,94,.08)",
              border: "1px solid rgba(34,197,94,.28)",
              borderRadius: 14,
              padding: "13px 15px",
              marginBottom: 22,
            }}
          >
            <ShieldCheck size={22} color={GREEN} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: INK }}>
                Verify it&apos;s you
              </div>
              <div style={{ fontSize: 12.5, color: MUTE }}>
                Quick selfie for the verified badge
              </div>
            </div>
            <span style={{ color: GREEN_DK, fontWeight: 800, fontSize: 20 }}>›</span>
          </Link>
        )}

        {faceVerified && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "rgba(34,197,94,.1)",
              borderRadius: 14,
              padding: "12px 15px",
              marginBottom: 22,
            }}
          >
            <ShieldCheck size={20} color={GREEN} />
            <span style={{ fontWeight: 800, fontSize: 14, color: GREEN_DK }}>
              Face verified
            </span>
          </div>
        )}

        <Label>Photos</Label>
        <PhotoGrid userId={userId} photos={photos} onChange={setPhotos} />

        <Label>About you</Label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Solana degen by night, yoga by morning."
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid rgba(11,31,18,.14)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 15,
            fontFamily: font,
            outline: "none",
            resize: "none",
          }}
        />
        <div style={{ fontSize: 11.5, color: MUTE, textAlign: "right" }}>
          {bio.length}/300
        </div>

        <Label>Basics</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <NumField
            icon={Ruler}
            label="Height"
            unit="cm"
            value={height}
            onChange={setHeight}
          />
          <NumField
            icon={Dumbbell}
            label="Weight"
            unit="kg"
            value={weight}
            onChange={setWeight}
          />
        </div>

        <Label>Habits</Label>
        <Toggle icon={Dumbbell} label="Gym" value={gym} onChange={setGym} />
        <Toggle icon={Wine} label="Drinks" value={drinks} onChange={setDrinks} />
        <Toggle
          icon={Cigarette}
          label="Smokes"
          value={smokes}
          onChange={setSmokes}
        />

        <Label>Best trades</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={tradeInput}
            onChange={(e) => setTradeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTrade()}
            placeholder="WIF +410%"
            style={{
              flex: 1,
              border: "1px solid rgba(11,31,18,.14)",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 15,
              fontFamily: font,
              outline: "none",
            }}
          />
          <button
            onClick={addTrade}
            style={{
              background: "rgba(34,197,94,.12)",
              color: GREEN_DK,
              border: "none",
              borderRadius: 12,
              padding: "0 18px",
              fontWeight: 800,
              fontSize: 14,
              fontFamily: font,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {trades.map((t) => (
            <span
              key={t.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(34,197,94,.1)",
                color: GREEN_DK,
                border: "1px solid rgba(34,197,94,.25)",
                borderRadius: 999,
                padding: "5px 8px 5px 10px",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <TrendingUp size={13} />
              {t.label}
              <button
                onClick={() => removeTrade(t.id)}
                aria-label={`Remove ${t.label}`}
                style={{
                  background: "none",
                  border: "none",
                  color: GREEN_DK,
                  cursor: "pointer",
                  display: "flex",
                  padding: 0,
                }}
              >
                <X size={13} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12, color: MUTE, marginTop: 8 }}>
          Typed in by you, so treat them as talk — nothing here is checked
          against the chain.
        </div>

        {error && (
          <div
            style={{
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 600,
              marginTop: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={save}
          style={{
            width: "100%",
            marginTop: 26,
            background: saved ? GREEN_DK : GREEN,
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: 14,
            fontWeight: 800,
            fontSize: 15.5,
            fontFamily: font,
            cursor: "pointer",
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        color: MUTE,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        margin: "24px 0 9px",
      }}
    >
      {children}
    </div>
  );
}

function NumField({
  icon: Icon,
  label,
  unit,
  value,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        border: "1px solid rgba(11,31,18,.12)",
        borderRadius: 12,
        padding: "9px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          color: MUTE,
          fontSize: 11.5,
          fontWeight: 700,
        }}
      >
        <Icon size={13} /> {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <input
          value={value}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="—"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            fontSize: 16,
            fontWeight: 800,
            color: INK,
            fontFamily: font,
            padding: 0,
          }}
        />
        <span style={{ fontSize: 12, color: MUTE, fontWeight: 700 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

function Toggle({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid rgba(11,31,18,.06)",
      }}
    >
      <Icon size={17} color={MUTE} />
      <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: INK }}>
        {label}
      </span>
      {[
        { v: true, t: "Yes" },
        { v: false, t: "No" },
      ].map(({ v, t }) => (
        <button
          key={t}
          onClick={() => onChange(v)}
          style={{
            border:
              value === v ? `1.5px solid ${GREEN}` : "1px solid rgba(11,31,18,.12)",
            background: value === v ? "rgba(34,197,94,.1)" : "#fff",
            color: value === v ? GREEN_DK : MUTE,
            borderRadius: 999,
            padding: "5px 14px",
            fontWeight: 800,
            fontSize: 12.5,
            fontFamily: font,
            cursor: "pointer",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
