"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flame, MessageCircle, User, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, MUTE, font } from "@/lib/theme";

const HIDE_ON = ["/login", "/onboarding", "/auth", "/admin", "/settings", "/profile/preview"];

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const [gender, setGender] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [matchesBadge, setMatchesBadge] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setShow(false);

      const { data } = await supabase
        .from("profiles")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();

      setGender(data?.gender ?? null);
      setShow(!!data);

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

    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, [path]);

  const inThread = /^\/matches\/[^/]+$/.test(path);
  if (!show || inThread || HIDE_ON.some((p) => path.startsWith(p))) return null;

  const tabs = [
    { href: "/discover", icon: Flame, label: "Discover", badge: 0 },
    { href: "/matches", icon: MessageCircle, label: "Matches", badge: matchesBadge },
    ...(gender === "man"
      ? [{ href: "/verify", icon: ShieldCheck, label: "Verify", badge: 0 }]
      : []),
    { href: "/profile", icon: User, label: "Profile", badge: 0 },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        background: "#fff",
        borderTop: "1px solid rgba(11,31,18,.08)",
        maxWidth: 430,
        margin: "0 auto",
        zIndex: 30,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ href, icon: Icon, label, badge }) => {
        const active = path === href;
        return (
          <button
            key={href}
            data-tap
            onClick={() => router.push(href)}
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
            }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={21} strokeWidth={active ? 2.6 : 2} />
              {badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -9,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 900,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    border: "2px solid #fff",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
