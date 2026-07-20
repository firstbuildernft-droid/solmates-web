"use client";
import { ChatSkeleton } from "@/components/Skeletons";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, ShieldCheck, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMatches,
  fetchMessages,
  sendMessage,
  markRead,
  blockUser,
  type Message,
  type MatchRow,
} from "@/lib/chat";
import { publicUrl } from "@/lib/photos";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

export default function ChatPanel({ matchId, initialMeta, onClose }: { matchId: string; initialMeta?: MatchRow; onClose: () => void }) {
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MatchRow | null>(initialMeta ?? null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      setMeId(user.id);

      // RLS means a match you're not in simply isn't in this list.
      const rows = await fetchMatches();
      const m = rows.find((r) => r.match_id === matchId);
      if (!m) return onClose();
      setMeta(m);

      setMsgs(await fetchMessages(matchId));
      setLoading(false);
      await markRead(matchId, user.id);

      // Live messages. The stream honours RLS too — you only ever receive
      // rows you could have selected — so the policies from 0001 are
      // securing this, not the filter below.
      channel = supabase
        .channel(`match:${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            const m = payload.new as Message;
            // Our own sends already appended optimistically — dedupe by id
            // or you get every message twice.
            setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
            if (m.sender_id !== user.id) markRead(matchId, user.id);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, [matchId, router]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || !meId) return;
    setText("");
    try {
      const row = await sendMessage(matchId, meId, body);
      setMsgs((cur) => (cur.some((x) => x.id === row.id) ? cur : [...cur, row]));
    } catch {
      setText(body); // put it back rather than silently eating it
    }
  }

  async function block() {
    if (!meId || !meta) return;
    await blockUser(meId, meta.other_id);
    onClose();
  }

  async function unmatch() {
    if (!meta) return;
    await createClient().rpc("unmatch", { match: matchId });
    onClose();
  }

  async function report() {
    if (!meta) return;
    const why = window.prompt(
      `Report ${meta.other_name}? Tell us what's wrong (optional):`
    );
    // null means they hit Cancel — do nothing. Empty string is a valid
    // "report with no reason", so we check for null specifically.
    if (why === null) return;
    await createClient().rpc("report_profile", {
      target: meta.other_id,
      why: why || null,
    });
    onClose();
  }

  if (!meta) return <ChatSkeleton />;

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
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(11,31,18,.07)",
          position: "relative",
        }}
      >
        <button
          onClick={() => onClose()}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}
        >
          <ChevronLeft size={24} color={INK} />
        </button>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: meta.other_photo
              ? `center / cover no-repeat url(${publicUrl(meta.other_photo)})`
              : "#e8efe9",
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontWeight: 800, fontSize: 15.5, color: INK }}>
              {meta.other_name}
            </span>
            {meta.other_face_verified && (
              <ShieldCheck size={14} color={GREEN} strokeWidth={2.8} />
            )}
          </div>
          {meta.other_wallet_ok && meta.other_sol != null && (
            <div style={{ fontSize: 11.5, color: GREEN_DK, fontWeight: 800 }}>
              {Number(meta.other_sol).toFixed(2)} SOL · verified
            </div>
          )}
        </div>
        <button
          onClick={() => setMenu(!menu)}
          style={{ background: "none", border: "none", cursor: "pointer", color: MUTE, padding: 4 }}
        >
          <Ban size={18} />
        </button>

        {menu && (
          <div
            style={{
              position: "absolute",
              top: 56,
              right: 12,
              background: "#fff",
              border: "1px solid rgba(11,31,18,.1)",
              borderRadius: 12,
              boxShadow: "0 8px 28px rgba(11,31,18,.14)",
              padding: 6,
              zIndex: 20,
              width: 230,
            }}
          >
            <button onClick={unmatch} style={menuItem}>
              Unmatch
            </button>
            <div style={menuHint}>
              Removes the match and deletes this chat for both of you.
            </div>

            <button onClick={report} style={{ ...menuItem, color: "#dc2626" }}>
              Report {meta.other_name}
            </button>
            <div style={menuHint}>
              Flags them for review and hides them from you. They&apos;re not
              told.
            </div>

            <button onClick={block} style={{ ...menuItem, color: "#dc2626" }}>
              Block {meta.other_name}
            </button>
            <div style={menuHint}>
              You&apos;ll never see each other again.
            </div>
          </div>
        )}
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        {msgs.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: MUTE,
              fontSize: 13,
              padding: "40px 30px",
              lineHeight: 1.5,
            }}
          >
            You matched with {meta.other_name}. Say something.
          </div>
        )}

        {msgs.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div
              key={m.id}
              data-msg
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 7,
              }}
            >
              <div
                style={{
                  maxWidth: "76%",
                  padding: "9px 13px",
                  borderRadius: 17,
                  borderBottomRightRadius: mine ? 5 : 17,
                  borderBottomLeftRadius: mine ? 17 : 5,
                  background: mine ? GREEN : "#f0f3f1",
                  color: mine ? "#fff" : INK,
                  fontSize: 14.5,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* composer */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 12px",
          borderTop: "1px solid rgba(11,31,18,.07)",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message"
          maxLength={2000}
          style={{
            flex: 1,
            border: "1px solid rgba(11,31,18,.13)",
            borderRadius: 999,
            padding: "11px 16px",
            fontSize: 16, // 16 or iOS zooms on focus
            fontFamily: font,
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: text.trim() ? GREEN : "#e3e9e4",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: text.trim() ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

const menuItem: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  textAlign: "left",
  padding: "9px 10px",
  borderRadius: 8,
  color: "#0b1f12",
  fontWeight: 800,
  fontSize: 13.5,
  cursor: "pointer",
};

const menuHint: React.CSSProperties = {
  fontSize: 11,
  color: "#6b8377",
  padding: "0 10px 8px",
  lineHeight: 1.35,
};
