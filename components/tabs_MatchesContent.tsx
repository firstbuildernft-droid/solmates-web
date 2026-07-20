"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLongPress, ActionSheet } from "@/components/LongPress";
import { MatchesSkeleton } from "@/components/Skeletons";
import ChatPanel from "@/components/ChatPanel";
import { fetchMatches, type MatchRow } from "@/lib/chat";
import { publicUrl } from "@/lib/photos";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

export default function MatchesContent() {
  const router = useRouter();
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetFor, setSheetFor] = useState<MatchRow | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      setMeId(user.id);
      try {
        setRows(await fetchMatches());
      } catch {
        /* empty state covers it */
      }
      setLoading(false);
    })();
  }, [router]);

  async function unmatch(m: MatchRow) {
    await createClient().rpc("unmatch", { match: m.match_id });
    setRows((rs) => rs.filter((r) => r.match_id !== m.match_id));
  }
  async function block(m: MatchRow) {
    const { blockUser } = await import("@/lib/chat");
    if (meId) await blockUser(meId, m.other_id);
    setRows((rs) => rs.filter((r) => r.match_id !== m.match_id));
  }
  async function report(m: MatchRow) {
    const why = window.prompt(`Report ${m.other_name}? What's wrong (optional):`);
    if (why === null) return;
    await createClient().rpc("report_profile", { target: m.other_id, why: why || null });
    setRows((rs) => rs.filter((r) => r.match_id !== m.match_id));
  }

  if (loading) return <MatchesSkeleton />;

  const fresh = rows.filter((r) => !r.last_message);
  const talking = rows.filter((r) => r.last_message);

  return (
    <div
      style={{
        minHeight: "100dvh",
        fontFamily: font,
        background: "#fff",
        maxWidth: 430,
        margin: "0 auto",
        padding: "14px 0 40px",
      }}
    >
      <h1
        style={{
          fontWeight: 900,
          fontSize: 22,
          color: INK,
          letterSpacing: -0.5,
          padding: "0 18px 12px",
          margin: 0,
        }}
      >
        Matches
      </h1>

      {rows.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 40px",
            color: MUTE,
          }}
        >
          <MessageCircle size={38} color={GREEN} />
          <div style={{ fontWeight: 800, color: INK, fontSize: 16.5, marginTop: 10 }}>
            No matches yet
          </div>
          <div style={{ fontSize: 13, marginTop: 5 }}>
            Keep swiping — they show up here the moment it&apos;s mutual.
          </div>
        </div>
      )}

      {fresh.length > 0 && (
        <>
          <SectionLabel>New matches</SectionLabel>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              padding: "2px 18px 16px",
            }}
          >
            {fresh.map((r) => (
              <button
                key={r.match_id}
                onClick={() => setOpenChatId(r.match_id)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                  width: 72,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    border: `2.5px solid ${GREEN}`,
                    background: r.other_photo
                      ? `center / cover no-repeat url(${publicUrl(r.other_photo)})`
                      : "#e8efe9",
                  }}
                />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: INK,
                    marginTop: 5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.other_name}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {talking.length > 0 && (
        <>
          <SectionLabel>Messages</SectionLabel>
          {talking.map((r) => (
            <MessageRow
              key={r.match_id}
              r={r}
              meId={meId}
              onOpen={() => setOpenChatId(r.match_id)}
              onLong={() => setSheetFor(r)}
            />
          ))}
        </>
      )}
      {openChatId && (
        <div data-slidein style={{ position: "fixed", inset: 0, zIndex: 80, background: "#fff", maxWidth: 430, margin: "0 auto" }}>
          <ChatPanel matchId={openChatId} onClose={() => setOpenChatId(null)} />
        </div>
      )}

      {sheetFor && (
        <ActionSheet
          title={sheetFor.other_name}
          onClose={() => setSheetFor(null)}
          actions={[
            { label: "Unmatch", danger: true, onClick: () => unmatch(sheetFor) },
            { label: "Report", danger: true, onClick: () => report(sheetFor) },
            { label: "Block", danger: true, onClick: () => block(sheetFor) },
          ]}
        />
      )}
    </div>
  );
}

function MessageRow({
  r,
  meId,
  onOpen,
  onLong,
}: {
  r: MatchRow;
  meId: string | null;
  onOpen: () => void;
  onLong: () => void;
}) {
  const lp = useLongPress(onLong);
  return (
    <button
      {...lp.handlers}
      onClick={() => {
        if (!lp.didFire()) onOpen();
      }}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 18px",
        border: "none",
        background: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          flexShrink: 0,
          background: r.other_photo
            ? `center / cover no-repeat url(${publicUrl(r.other_photo)})`
            : "#e8efe9",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>
            {r.other_name}
          </span>
          {r.other_face_verified && (
            <ShieldCheck size={14} color={GREEN} strokeWidth={2.8} />
          )}
          {r.other_wallet_ok && r.other_sol != null && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 900,
                color: GREEN_DK,
                background: "rgba(34,197,94,.12)",
                borderRadius: 999,
                padding: "1.5px 6px",
              }}
            >
              {Number(r.other_sol).toFixed(1)} SOL
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: r.unread > 0 ? INK : MUTE,
            fontWeight: r.unread > 0 ? 700 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: 2,
          }}
        >
          {r.last_sender === meId && "You: "}
          {r.last_message}
        </div>
      </div>
      {r.unread > 0 && (
        <span
          style={{
            background: GREEN,
            color: "#fff",
            fontSize: 11,
            fontWeight: 900,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
          }}
        >
          {r.unread}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        color: MUTE,
        textTransform: "uppercase",
        letterSpacing: 0.7,
        padding: "10px 18px 8px",
      }}
    >
      {children}
    </div>
  );
}
