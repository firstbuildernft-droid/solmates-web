"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flame, MessageCircle, User, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GREEN, MUTE, font } from "@/lib/theme";

// Lives in layout.tsx, so it's on every page — and hides itself on the
// ones where it shouldn't be.

const HIDE_ON = ["/login", "/onboarding", "/auth", "/admin"];

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const [gender, setGender] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
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
    })();
  }, [path]);

  // Hidden inside a chat thread — /matches is a tab, /matches/abc123 is a
  // full screen and the tab bar would sit on top of the message box.
  const inThread = /^\/matches\/[^/]+$/.test(path);
  if (!show || inThread || HIDE_ON.some((p) => path.startsWith(p))) return null;

  const tabs = [
    { href: "/discover", icon: Flame, label: "Discover" },
    { href: "/matches", icon: MessageCircle, label: "Matches" },
    // Women don't link wallets, so they never see the tab.
    ...(gender === "man"
      ? [{ href: "/verify", icon: ShieldCheck, label: "Verify" }]
      : []),
    { href: "/profile", icon: User, label: "Profile" },
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
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        return (
          <button
            key={href}
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
            }}
          >
            <Icon size={21} strokeWidth={active ? 2.6 : 2} />
            <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
