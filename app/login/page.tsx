"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, INK, MUTE, font } from "@/lib/theme";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!email.includes("@")) {
      setError("That doesn't look like an email address.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
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

        {sent ? (
          <>
            <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.5 }}>
              Check your email. We sent a sign-in link to{" "}
              <b style={{ color: INK }}>{email}</b>.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              style={{
                background: "none",
                border: "none",
                color: GREEN,
                fontWeight: 700,
                fontSize: 14,
                padding: "12px 0",
                cursor: "pointer",
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                color: MUTE,
                fontSize: 15,
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              Enter your email and we'll send you a sign-in link. No password
              to remember.
            </p>

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="you@example.com"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid rgba(11,31,18,.14)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16, // 16px or iOS zooms the page on focus
                fontFamily: font,
                outline: "none",
                marginBottom: 10,
              }}
            />

            {error && (
              <div
                style={{
                  color: "#dc2626",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={send}
              disabled={busy}
              style={{
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
              }}
            >
              {busy ? "Sending..." : "Send link"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
