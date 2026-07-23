"use client";

import { useEffect, useState } from "react";
import { Flame, MessageCircle, User, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, MUTE, font } from "@/lib/theme";
import DiscoverContent from "@/components/tabs_DiscoverContent";
import MatchesContent from "@/components/tabs_MatchesContent";
import ProfileContent from "@/components/tabs_ProfileContent";
import VerifyContent from "@/components/tabs_VerifyContent";

type Tab = "discover" | "matches" | "profile" | "verify";

// The whole tab experience in ONE component with NO routing between tabs.
// Tapping a tab flips `active` state -> instant, synchronous, no router,
// no route transition, no flash. All three tab contents stay mounted;
// only `display` changes. This is how a native tab bar behaves.
//
// Verify is now an in-shell tab too. Chat threads and settings remain
// real routes (they open on top of the tabs).

export default function TabShell({ active }: { active: Tab }) {
  const [tab, setTab] = useState<Tab>(active);
  const [gender, setGender] = useState<string | null>(null);
  const [matchesBadge, setMatchesBadge] = useState(0);

  // Keep the URL in sync WITHOUT causing a navigation/re-render of content.
  // history.replaceState changes the address bar silently — no Next.js
  // route change, so no flash. Deep links still land on the right tab
  // because each route passes the correct `active`.
  function go(next: Tab) {
    setTab(next);
    const path = "/" + next;
    window.history.replaceState(null, "", path);
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle();
      setGender(data?.gender ?? null);
      const refresh = async () => {
        const { data: c } = await supabase.rpc("badge_counts").maybeSingle();
        const counts = c as { new_matches: number; unread_msgs: number } | null;
        setMatchesBadge((counts?.new_matches ?? 0) + (counts?.unread_msgs ?? 0));
      };
      refresh();
      channel = supabase
        .channel("badges")
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
        .subscribe();
    })();
    return () => { if (channel) createClient().removeChannel(channel); };
  }, []);

  const navTabs: { key: Tab; icon: any; label: string; badge: number }[] = [
    { key: "discover", icon: Flame, label: "Discover", badge: 0 },
    { key: "matches", icon: MessageCircle, label: "Matches", badge: matchesBadge },
    { key: "verify" as const, icon: ShieldCheck, label: "Verify", badge: 0 },
    { key: "profile", icon: User, label: "Profile", badge: 0 },
  ];

  return (
    <>
      <div style={{ display: tab === "discover" ? "block" : "none", minHeight: "100dvh" }}>
        <DiscoverContent />
      </div>
      <div style={{ display: tab === "matches" ? "block" : "none", minHeight: "100dvh" }}>
        <MatchesContent />
      </div>
      <div style={{ display: tab === "profile" ? "block" : "none", minHeight: "100dvh" }}>
        <ProfileContent />
      </div>
      <div style={{ display: tab === "verify" ? "block" : "none", minHeight: "100dvh" }}>
        <VerifyContent />
      </div>

      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
          background: "#fff", borderTop: "1px solid rgba(11,31,18,.08)",
          maxWidth: 430, margin: "0 auto", zIndex: 30,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {navTabs.map(({ key, icon: Icon, label, badge }) => (
          <NavBtn
            key={key}
            icon={Icon}
            label={label}
            badge={badge}
            active={key === tab}
            onClick={() => go(key as Tab)}
          />
        ))}
      </nav>
    </>
  );
}

function NavBtn({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  badge: number;
  active: boolean;
  onClick: () => void;
}) {
  const [press, setPress] = useState(false);
  const [fill, setFill] = useState(false);

  function fire() {
    setFill(true);
    setTimeout(() => setFill(false), 340);
    onClick();
  }

  return (
    <button
      onClick={fire}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      style={{
        flex: 1,
        background: "none",
        border: "none",
        padding: "9px 0 8px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        color: active ? GREEN : MUTE,
        fontFamily: font,
        position: "relative",
        WebkitTapHighlightColor: "transparent",
        transform: press ? "scale(.9) translateY(1px)" : "scale(1)",
        transition: "transform .18s cubic-bezier(.22,1.5,.4,1), color .2s ease",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: 21,
          height: 21,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* A solid copy of the SAME icon sits underneath and fades in on
            tap, so the green lands inside the icon's own shape rather
            than behind it as a generic blob. */}
        <Icon
          size={21}
          strokeWidth={active ? 2.6 : 2}
          fill={GREEN}
          stroke={GREEN}
          style={{
            position: "absolute",
            inset: 0,
            opacity: fill ? 1 : 0,
            transform: fill ? "scale(1)" : "scale(.55)",
            transformOrigin: "50% 50%",
            transition: fill
              ? "opacity .1s ease, transform .3s cubic-bezier(.22,1,.36,1)"
              : "opacity .25s ease, transform .25s ease",
          }}
        />
        <Icon
          size={21}
          strokeWidth={active ? 2.6 : 2}
          style={{ position: "relative" }}
        />
        {badge > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -9, background: "#ef4444",
            color: "#fff", fontSize: 10, fontWeight: 900, minWidth: 17, height: 17,
            borderRadius: 999, display: "flex", alignItems: "center",
            justifyContent: "center", padding: "0 4px", border: "2px solid #fff",
            zIndex: 2,
          }}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, position: "relative" }}>{label}</span>
    </button>
  );
}
