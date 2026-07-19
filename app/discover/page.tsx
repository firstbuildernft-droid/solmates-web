"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, X, Star, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchDeck, swipe, type Candidate } from "@/lib/deck";
import { refreshLocationIfStale, getMyLocation, captureLocation, ensureCity } from "@/lib/location";
import { publicUrl } from "@/lib/photos";
import Card from "@/components/Card";
import Logo from "@/components/Logo";
import { GREEN, GREEN_LT, INK, MUTE, font } from "@/lib/theme";

export default function DiscoverPage() {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flyOut, setFlyOut] = useState<"left" | "right" | null>(null);
  const [matched, setMatched] = useState<Candidate | null>(null);
  const startX = useRef(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) return router.replace("/onboarding");

      setMeId(user.id);
      try {
        // Ensure we have a location on THIS device. If the account has
        // none stored (e.g. first time on this phone), prompt now.
        getMyLocation().then((loc) => {
          if (!loc.has) captureLocation();
          else { refreshLocationIfStale(); ensureCity(); }
        });
        setDeck(await fetchDeck());
      } catch {
        // empty deck renders its own message
      }
      setLoading(false);
    })();
  }, [router]);

  const top = deck[0];

  async function commit(dir: "left" | "right") {
    if (!top || !meId) return;
    const card = top;

    setFlyOut(dir);

    // Optimistic: the card leaves now, the database catches up. Waiting on
    // a round trip before the card moves is what makes a swipe app feel
    // broken.
    setTimeout(async () => {
      setDeck((d) => d.slice(1));
      setDrag(0);
      setFlyOut(null);

      try {
        const matchId = await swipe(meId, card.id, dir);
        if (matchId) setMatched(card);
      } catch {
        // A lost swipe is annoying; a card that snaps back mid-gesture is
        // worse. They'll see this profile again next session.
      }

      // Top up before they hit the bottom.
      setDeck((d) => {
        if (d.length <= 3) fetchDeck().then((more) =>
          setDeck((cur) => {
            const seen = new Set(cur.map((c) => c.id));
            return [...cur, ...more.filter((m) => !seen.has(m.id))];
          })
        );
        return d;
      });
    }, 260);
  }

  function onUp() {
    setDragging(false);
    if (drag > 95) commit("right");
    else if (drag < -95) commit("left");
    else setDrag(0);
  }

  if (loading) return null;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
        background: "#fff",
        maxWidth: 430,
        margin: "0 auto",
      }}
    >
      <div style={{ padding: "12px 18px 8px" }}>
        <Logo size={30} fontSize={21} />
      </div>

      <div
        style={{ flex: 1, position: "relative", margin: "4px 16px 8px", touchAction: "pan-y" }}
        onMouseDown={(e) => {
          startX.current = e.clientX;
          setDragging(true);
        }}
        onMouseMove={(e) => dragging && setDrag(e.clientX - startX.current)}
        onMouseUp={onUp}
        onMouseLeave={() => dragging && onUp()}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          setDragging(true);
        }}
        onTouchMove={(e) => dragging && setDrag(e.touches[0].clientX - startX.current)}
        onTouchEnd={onUp}
      >
        {deck.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: MUTE,
              gap: 10,
            }}
          >
            <Sparkles size={40} color={GREEN} />
            <div style={{ fontWeight: 800, color: INK, fontSize: 17 }}>
              You&apos;re all caught up
            </div>
            <div style={{ fontSize: 13, maxWidth: 220 }}>
              New Solmates drop every day. Check back soon.
            </div>
          </div>
        )}

        {deck.slice(0, 3).reverse().map((p, i, arr) => {
          const isTop = i === arr.length - 1;
          const depth = arr.length - 1 - i;
          const fly =
            flyOut && isTop
              ? `translateX(${flyOut === "right" ? 600 : -600}px) rotate(${
                  flyOut === "right" ? 30 : -30
                }deg)`
              : undefined;

          return (
            <Card
              key={p.id}
              p={p}
              isTop={isTop && !flyOut}
              dragOffset={isTop ? drag : 0}
              style={{
                transform:
                  fly ?? `scale(${1 - depth * 0.045}) translateY(${depth * 10}px)`,
                transition: flyOut && isTop ? "transform .26s ease-in" : "transform .3s ease",
                zIndex: 10 - depth,
                cursor: isTop ? "grab" : "default",
              }}
            />
          );
        })}
      </div>

      {deck.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 18, padding: "6px 0 20px" }}>
          <ActionBtn onClick={() => commit("left")} color="#ef4444" size={58}>
            <X size={28} strokeWidth={3} />
          </ActionBtn>
          <ActionBtn onClick={() => {}} color={GREEN_LT} size={46}>
            <Star size={20} strokeWidth={2.6} fill={GREEN_LT} />
          </ActionBtn>
          <ActionBtn onClick={() => commit("right")} color={GREEN} size={58}>
            <Heart size={26} strokeWidth={3} fill={GREEN} />
          </ActionBtn>
        </div>
      )}

      {matched && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(6,20,12,.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            padding: 30,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 900, color: GREEN_LT, marginBottom: 6 }}>
            It&apos;s a match!
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 22 }}>
            You and {matched.display_name} liked each other
          </div>
          <div
            data-modal
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `center / cover no-repeat url(${publicUrl(matched.photos[0])})`,
              border: `3px solid ${GREEN}`,
              marginBottom: 26,
            }}
          />
          <button
            onClick={() => router.push("/matches")}
            style={{
              background: GREEN,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "12px 22px",
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: font,
              cursor: "pointer",
            }}
          >
            Send a message
          </button>
          <button
            onClick={() => setMatched(null)}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.4)",
              borderRadius: 12,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: font,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            Keep swiping
          </button>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  color,
  size,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  size: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#fff",
        border: `2px solid ${color}`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(11,31,18,.12)",
      }}
    >
      {children}
    </button>
  );
}
