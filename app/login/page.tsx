"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GREEN, INK, MUTE, font } from "@/lib/theme";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function sendCode() {
    if (!email.includes("@")) {
      setError("That doesn't look like an email address.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    // No emailRedirectTo -> Supabase sends a 6-digit CODE instead of a
    // magic link. shouldCreateUser lets brand-new emails sign up.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setBusy(false);
    if (error) return setError(error.message);
    setStep("code");
    setTimeout(() => codeRef.current?.focus(), 100);
  }

  async function verify() {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setBusy(false);
      setError("That code didn't work. Check it and try again.");
      return;
    }

    // Signed in. Send them to onboarding (which forwards to the deck if
    // they've already onboarded).
    router.replace("/onboarding");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: font,
        background: "#fff",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ marginBottom: 10 }}>
          <Logo size={44} fontSize={32} />
        </div>

        {step === "email" ? (
          <>
            <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
              Enter your email and we&apos;ll send you a 6-digit code. No
              password to remember.
            </p>

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
              placeholder="you@example.com"
              style={inputStyle}
            />

            {error && <ErrorText>{error}</ErrorText>}

            <button onClick={sendCode} disabled={busy} style={btnStyle(busy)}>
              {busy ? "Sending..." : "Send code"}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.5, marginBottom: 6 }}>
              We sent a 6-digit code to <b style={{ color: INK }}>{email}</b>.
            </p>
            <p style={{ color: MUTE, fontSize: 13, marginBottom: 20 }}>
              Enter it below. It expires in a few minutes.
            </p>

            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="000000"
              style={{
                ...inputStyle,
                textAlign: "center",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 8,
                fontFamily: "monospace",
              }}
            />

            {error && <ErrorText>{error}</ErrorText>}

            <button onClick={verify} disabled={busy} style={btnStyle(busy)}>
              {busy ? "Verifying..." : "Verify"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button
                onClick={() => { setStep("email"); setCode(""); setError(null); }}
                style={linkBtn}
              >
                Change email
              </button>
              <button onClick={sendCode} disabled={busy} style={linkBtn}>
                Resend code
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(11,31,18,.14)",
  borderRadius: 12,
  padding: "14px 16px",
  fontSize: 16,
  fontFamily: font,
  outline: "none",
  marginBottom: 10,
};

function btnStyle(busy: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: busy ? MUTE : GREEN,
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "14px",
    fontWeight: 800,
    fontSize: 15.5,
    fontFamily: font,
    cursor: busy ? "default" : "pointer",
  };
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: GREEN,
  fontWeight: 700,
  fontSize: 13.5,
  padding: "10px 0",
  cursor: "pointer",
  fontFamily: font,
};

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
      {children}
    </div>
  );
}
