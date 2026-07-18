"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// The one screen that turns an auth user into a Solmates profile.
// Ends with a row in `profiles`. That's the whole job of step 1.

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<"man" | "woman" | null>(null);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already onboarded? Don't make them do it twice.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (data) router.replace("/");
      else setChecking(false);
    })();
  }, [router]);

  function ageFrom(d: string) {
    const b = new Date(d);
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a;
  }

  async function submit() {
    if (!name.trim()) return setError("Add your first name.");
    if (!birthdate) return setError("Add your birthday.");
    if (ageFrom(birthdate) < 18)
      return setError("You must be 18 or over to use Solmates.");
    if (!gender) return setError("Pick one.");

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: name.trim(),
      birthdate,
      gender,
      city: city.trim() || null,
      onboarded: true,
    });

    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/");
  }

  if (checking) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px 24px",
        fontFamily: font,
        background: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 26,
            color: INK,
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          A bit about you
        </div>
        <p style={{ color: MUTE, fontSize: 14, marginBottom: 26 }}>
          You can add photos, your wallet and the rest right after this.
        </p>

        <Label>First name</Label>
        <Input value={name} onChange={setName} placeholder="Onur" />

        <Label>Birthday</Label>
        <Input value={birthdate} onChange={setBirthdate} type="date" />
        <Hint>Shown as your age. Nobody sees the date.</Hint>

        <Label>I am a</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["man", "woman"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              style={{
                flex: 1,
                padding: 13,
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                fontFamily: font,
                cursor: "pointer",
                textTransform: "capitalize",
                border:
                  gender === g
                    ? `2px solid ${GREEN}`
                    : "1px solid rgba(11,31,18,.12)",
                background: gender === g ? "rgba(34,197,94,.1)" : "#fff",
                color: gender === g ? GREEN_DK : INK,
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <Label>City</Label>
        <Input value={city} onChange={setCity} placeholder="Istanbul" />

        {error && (
          <div
            style={{
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 600,
              margin: "4px 0 12px",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            marginTop: 12,
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
          {busy ? "Saving..." : "Continue"}
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
        margin: "16px 0 7px",
      }}
    >
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: MUTE, marginTop: -4 }}>{children}</div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid rgba(11,31,18,.14)",
        borderRadius: 12,
        padding: "13px 15px",
        fontSize: 16,
        fontFamily: font,
        outline: "none",
      }}
    />
  );
}
