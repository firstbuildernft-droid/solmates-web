"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Camera, RefreshCw, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

type Phase = "intro" | "camera" | "checking" | "passed" | "failed" | "locked";

export default function FacePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data } = await supabase.rpc("face_status").maybeSingle();
      const status = data as {
        verified: boolean;
        attempts_24h: number;
        attempts_left: number;
        last_reason: string | null;
      } | null;
      if (status?.verified) setPhase("passed");
      else if ((status?.attempts_left ?? 2) <= 0) setPhase("locked");
      else setAttemptsLeft(status?.attempts_left ?? 2);
      setLoading(false);
    })();

    return () => stopCamera();
  }, [router]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 640 },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      // let the video element mount first
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setMessage("We need camera access to verify. Check your browser's permissions and try again.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // center-crop square
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size
    );
    const selfie = canvas.toDataURL("image/jpeg", 0.9);

    stopCamera();
    setPhase("checking");

    try {
      const res = await fetch("/api/face/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfie }),
      });
      const json = await res.json();

      if (json.passed) {
        setPhase("passed");
      } else if (json.error === "limit") {
        setMessage(json.message);
        setPhase("locked");
      } else {
        setMessage(json.message);
        setAttemptsLeft(json.attemptsLeft ?? 0);
        setPhase(json.attemptsLeft <= 0 ? "locked" : "failed");
      }
    } catch {
      setMessage("Connection problem. Please try again.");
      setPhase("failed");
    }
  }

  if (loading) return null;

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "32px 22px 60px",
        fontFamily: font,
        background: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ fontWeight: 900, fontSize: 25, color: INK, margin: "0 0 4px" }}>
          Verify it&apos;s you
        </h1>
        <p style={{ color: MUTE, fontSize: 14, marginBottom: 26, lineHeight: 1.5 }}>
          A quick selfie, matched against your profile photos. It gives you the
          verified badge people look for.
        </p>

        {phase === "passed" && (
          <Center>
            <ShieldCheck size={54} color={GREEN} />
            <Big>You&apos;re verified</Big>
            <Sub>Your badge is now on your profile.</Sub>
            <PrimaryBtn onClick={() => router.push("/profile")}>Done</PrimaryBtn>
          </Center>
        )}

        {phase === "intro" && (
          <>
            <Tips />
            <div style={{ fontSize: 13, color: MUTE, margin: "16px 0", textAlign: "center" }}>
              {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} today
            </div>
            <PrimaryBtn onClick={startCamera}>
              <Camera size={17} /> Start
            </PrimaryBtn>
            {message && <Warn>{message}</Warn>}
          </>
        )}

        {phase === "camera" && (
          <>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "1",
                borderRadius: 20,
                overflow: "hidden",
                background: "#000",
                border: `3px solid ${GREEN}`,
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)", // mirror, feels natural
                }}
              />
            </div>
            <PrimaryBtn onClick={capture}>
              <Camera size={17} /> Take selfie
            </PrimaryBtn>
          </>
        )}

        {phase === "checking" && (
          <Center>
            <RefreshCw size={40} color={GREEN} className="spin" />
            <Big>Checking...</Big>
            <Sub>This takes a couple of seconds.</Sub>
            <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </Center>
        )}

        {phase === "failed" && (
          <Center>
            <TriangleAlert size={44} color="#f59e0b" />
            <Big>Didn&apos;t work</Big>
            <Sub>{message}</Sub>
            <div style={{ fontSize: 13, color: MUTE, margin: "6px 0 4px" }}>
              {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left today
            </div>
            <PrimaryBtn onClick={startCamera}>
              <RefreshCw size={16} /> Try again
            </PrimaryBtn>
          </Center>
        )}

        {phase === "locked" && (
          <Center>
            <TriangleAlert size={44} color={MUTE} />
            <Big>That&apos;s it for today</Big>
            <Sub>
              {message ??
                "You've used both tries. Come back tomorrow and try again in good, even light."}
            </Sub>
            <PrimaryBtn onClick={() => router.push("/profile")}>
              Back to profile
            </PrimaryBtn>
          </Center>
        )}
      </div>
    </main>
  );
}

function Tips() {
  const items = [
    "Face the camera straight on",
    "Good, even light — no strong backlight",
    "No hat, sunglasses, or mask",
    "Just you in the frame",
  ];
  return (
    <div
      style={{
        background: "rgba(34,197,94,.06)",
        border: "1px solid rgba(34,197,94,.2)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      {items.map((t) => (
        <div
          key={t}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13.5,
            color: INK,
            padding: "4px 0",
          }}
        >
          <ShieldCheck size={15} color={GREEN} /> {t}
        </div>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
        padding: "30px 0",
      }}
    >
      {children}
    </div>
  );
}
function Big({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 900, fontSize: 20, color: INK, marginTop: 6 }}>{children}</div>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13.5, color: MUTE, maxWidth: 280, lineHeight: 1.5 }}>{children}</div>;
}
function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        marginTop: 20,
        background: GREEN,
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: 14,
        fontWeight: 800,
        fontSize: 15.5,
        fontFamily: font,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
      }}
    >
      {children}
    </button>
  );
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        fontSize: 13,
        color: "#92400e",
        background: "rgba(245,158,11,.1)",
        border: "1px solid rgba(245,158,11,.3)",
        borderRadius: 10,
        padding: "10px 12px",
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}
