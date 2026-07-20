"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";
import Logo from "@/components/Logo";

type Mode = "landing" | "email" | "phone" | "code";
type Intent = "signup" | "signin";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("landing");
  const [intent, setIntent] = useState<Intent>("signup");
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Restore an in-progress code step if the mobile browser reloads.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("login_state");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.mode === "code") {
          setChannel(s.channel);
          setEmail(s.email || "");
          setPhone(s.phone || "");
          setIntent(s.intent || "signup");
          setMode("code");
        }
      }
    } catch {}
  }, []);

  async function sendEmail() {
    if (!email.includes("@")) return setError("That doesn't look like an email.");
    setBusy(true);
    setError(null);

    const supabase = createClient();
    // shouldCreateUser controls signup vs signin:
    //  - Sign up: create if new (true). If it already exists, Supabase
    //    still just sends a code — we can't easily block, so we allow it.
    //  - Sign in: don't create (false). If no account, Supabase errors,
    //    and we tell them to sign up.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: intent === "signup" },
    });

    setBusy(false);
    if (error) {
      if (intent === "signin" && /not found|no user|signups/i.test(error.message)) {
        return setError("No account with that email. Try signing up instead.");
      }
      return setError(error.message);
    }
    goCode();
  }

  async function sendPhone() {
    const clean = phone.replace(/[^\d+]/g, "");
    if (clean.length < 8) return setError("Enter a valid phone number with country code.");
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: clean,
      options: { shouldCreateUser: intent === "signup" },
    });

    setBusy(false);
    if (error) {
      if (intent === "signin" && /not found|no user|signups/i.test(error.message)) {
        return setError("No account with that number. Try signing up instead.");
      }
      return setError(error.message);
    }
    goCode();
  }

  function goCode() {
    setMode("code");
    try {
      sessionStorage.setItem("login_state", JSON.stringify({ mode: "code", channel, email, phone, intent }));
    } catch {}
    setTimeout(() => codeRef.current?.focus(), 100);
  }

  async function verify() {
    if (code.length < 6) return setError("Enter the code we sent you.");
    setBusy(true);
    setError(null);

    const supabase = createClient();
    let error;

    if (channel === "email") {
      let r = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (r.error) r = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      error = r.error;
    } else {
      const clean = phone.replace(/[^\d+]/g, "");
      let r = await supabase.auth.verifyOtp({ phone: clean, token: code, type: "sms" });
      if (r.error) r = await supabase.auth.verifyOtp({ phone: clean, token: code, type: "phone_change" });
      error = r.error;
    }

    if (error) {
      setBusy(false);
      return setError(error.message || "That code didn't work. Try again.");
    }

    try { sessionStorage.removeItem("login_state"); } catch {}

    // Make sure the session is actually established before navigating.
    // Redirecting too early lands on a page whose auth check runs before
    // the session cookie is readable, which bounces back to /login.
    await supabase.auth.getSession();

    // Decide destination based on whether they've onboarded, so existing
    // users skip the onboarding hop entirely (one redirect, not three).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let dest = "/onboarding";
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.onboarded) dest = "/discover";
    }

    // Hard navigation (not router.replace) so the browser reloads with the
    // session cookie fully in place — the middleware then sees a logged-in
    // user and doesn't bounce.
    window.location.href = dest;
  }

  function back() {
    setError(null);
    setCode("");
    try { sessionStorage.removeItem("login_state"); } catch {}
    if (mode === "code") setMode(channel);
    else setMode("landing");
  }

  return (
    <main style={wrap}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        {mode !== "landing" && (
          <button onClick={back} style={backBtn} aria-label="Back">
            <ChevronLeft size={24} color={INK} />
          </button>
        )}

        <div style={{ marginBottom: 10 }}>
          <Logo size={44} fontSize={32} />
        </div>

        {/* LANDING: sign up vs sign in */}
        {mode === "landing" && (
          <>
            <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.5, marginBottom: 26 }}>
              Meet verified traders near you. No passwords — just a quick code.
            </p>
            <button
              onClick={() => { setIntent("signup"); setMode("email"); setChannel("email"); }}
              style={primaryBtn(false)}
            >
              Sign up
            </button>
            <button
              onClick={() => { setIntent("signin"); setMode("email"); setChannel("email"); }}
              style={secondaryBtn}
            >
              Sign in
            </button>
          </>
        )}

        {/* EMAIL entry */}
        {mode === "email" && (
          <>
            <H>{intent === "signup" ? "Sign up" : "Sign in"} with email</H>
            <input
              type="email" inputMode="email" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendEmail()}
              placeholder="you@example.com" style={input}
            />
            {error && <Err>{error}</Err>}
            <button onClick={sendEmail} disabled={busy} style={primaryBtn(busy)}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button onClick={() => { setMode("phone"); setChannel("phone"); setError(null); }} style={switchBtn}>
              <Phone size={15} /> Use phone number instead
            </button>
          </>
        )}

        {/* PHONE entry */}
        {mode === "phone" && (
          <>
            <H>{intent === "signup" ? "Sign up" : "Sign in"} with phone</H>
            <input
              type="tel" inputMode="tel" autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendPhone()}
              placeholder="+90 5XX XXX XX XX" style={input}
            />
            <div style={{ fontSize: 12, color: MUTE, marginBottom: 10, marginTop: -2 }}>
              Include your country code (e.g. +90 for Turkey).
            </div>
            {error && <Err>{error}</Err>}
            <button onClick={sendPhone} disabled={busy} style={primaryBtn(busy)}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button onClick={() => { setMode("email"); setChannel("email"); setError(null); }} style={switchBtn}>
              <Mail size={15} /> Use email instead
            </button>
          </>
        )}

        {/* CODE entry */}
        {mode === "code" && (
          <>
            <H>Enter your code</H>
            <p style={{ color: MUTE, fontSize: 14, marginBottom: 18 }}>
              Sent to <b style={{ color: INK }}>{channel === "email" ? email : phone}</b>.
            </p>
            <input
              ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={8} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="000000"
              style={{ ...input, textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: 6, fontFamily: "monospace" }}
            />
            {error && <Err>{error}</Err>}
            <button onClick={verify} disabled={busy} style={primaryBtn(busy)}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button onClick={channel === "email" ? sendEmail : sendPhone} disabled={busy} style={switchBtn}>
              Resend code
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", padding: 24,
  fontFamily: font, background: "#fff",
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid rgba(11,31,18,.14)",
  borderRadius: 12, padding: "14px 16px", fontSize: 16, fontFamily: font,
  outline: "none", marginBottom: 10,
};
const backBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0,
  display: "flex", marginBottom: 8,
};
function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    width: "100%", marginTop: 4, marginBottom: 10, background: busy ? MUTE : GREEN,
    color: "#fff", border: "none", borderRadius: 999, padding: 14,
    fontWeight: 800, fontSize: 15.5, fontFamily: font, cursor: busy ? "default" : "pointer",
  };
}
const secondaryBtn: React.CSSProperties = {
  width: "100%", background: "#fff", color: GREEN_DK, border: `1.5px solid ${GREEN}`,
  borderRadius: 999, padding: 14, fontWeight: 800, fontSize: 15.5, fontFamily: font, cursor: "pointer",
};
const switchBtn: React.CSSProperties = {
  width: "100%", background: "none", border: "none", color: GREEN_DK,
  fontWeight: 700, fontSize: 13.5, padding: "12px 0", cursor: "pointer",
  fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};
function H({ children }: { children: React.ReactNode }) {
  return <h1 style={{ fontWeight: 900, fontSize: 22, color: INK, margin: "0 0 16px" }}>{children}</h1>;
}
function Err({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{children}</div>;
}
