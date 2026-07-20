"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Ban,
  Globe,
  Bell,
  MapPin,
  LogOut,
  Trash2,
  Pause,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicUrl } from "@/lib/photos";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

type Block = { blocked_id: string; name: string; photo: string | null };

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [paused, setPaused] = useState(false);
  const [unit, setUnit] = useState("km");
  const [notif, setNotif] = useState({ matches: true, messages: true, likes: true });
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlocks, setShowBlocks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("paused, distance_unit, notif_matches, notif_messages, notif_likes")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setPaused(data.paused);
        setUnit(data.distance_unit);
        setNotif({
          matches: data.notif_matches,
          messages: data.notif_messages,
          likes: data.notif_likes,
        });
      }

      const { data: b } = await supabase.rpc("my_blocks");
      setBlocks((b ?? []) as Block[]);
      setLoading(false);
    })();
  }, [router]);

  async function patch(fields: Record<string, unknown>) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update(fields).eq("id", user.id);
  }

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    await patch({ paused: next });
  }

  async function setNotifKey(key: "matches" | "messages" | "likes", v: boolean) {
    setNotif((n) => ({ ...n, [key]: v }));
    await patch({ [`notif_${key}`]: v });
  }

  async function unblock(id: string) {
    setBlocks((bs) => bs.filter((b) => b.blocked_id !== id));
    await createClient().rpc("unblock", { target: id });
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  async function changeEmail() {
    if (!newEmail.includes("@")) { setEmailMsg("Enter a valid email."); return; }
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { setEmailMsg(error.message); return; }
    setEmailMsg("Check your new email for a confirmation code/link to finish the change.");
    setEditingEmail(false);
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      router.replace("/login");
    } else {
      setBusy(false);
      alert("Couldn't delete your account. Please try again.");
    }
  }

  if (loading) return null;

  // ---- blocked users sub-screen ----
  if (showBlocks) {
    return (
      <main style={page}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <Header title="Blocked users" onBack={() => setShowBlocks(false)} />
          {blocks.length === 0 ? (
            <Empty>You haven&apos;t blocked anyone.</Empty>
          ) : (
            blocks.map((b) => (
              <div
                key={b.blocked_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 4px",
                  borderBottom: "0.5px solid rgba(11,31,18,.07)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: b.photo
                      ? `center / cover no-repeat url(${publicUrl(b.photo)})`
                      : "#e8efe9",
                  }}
                />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: INK }}>
                  {b.name}
                </span>
                <button
                  onClick={() => unblock(b.blocked_id)}
                  style={{
                    background: "rgba(34,197,94,.12)",
                    color: GREEN_DK,
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 15px",
                    fontWeight: 800,
                    fontSize: 13,
                    fontFamily: font,
                    cursor: "pointer",
                  }}
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <Header title="Settings" onBack={onClose} />

        <Section>Account</Section>
        <Card>
          {!editingEmail ? (
            <button
              onClick={() => { setEditingEmail(true); setNewEmail(email); setEmailMsg(null); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: font }}
            >
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: INK }}>Email</span>
              <span style={{ fontSize: 13.5, color: MUTE, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
              <span style={{ color: GREEN_DK, fontWeight: 800, fontSize: 12.5 }}>Change</span>
            </button>
          ) : (
            <div style={{ padding: "13px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: INK, marginBottom: 8 }}>New email</div>
              <input
                type="email" inputMode="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid rgba(11,31,18,.14)", borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: font, outline: "none", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditingEmail(false)} style={{ flex: 1, background: "#fff", border: "1px solid rgba(11,31,18,.15)", borderRadius: 999, padding: 10, fontWeight: 800, fontSize: 13.5, fontFamily: font, cursor: "pointer", color: INK }}>Cancel</button>
                <button onClick={changeEmail} style={{ flex: 1, background: GREEN, border: "none", borderRadius: 999, padding: 10, fontWeight: 800, fontSize: 13.5, fontFamily: font, cursor: "pointer", color: "#fff" }}>Save</button>
              </div>
            </div>
          )}
          {emailMsg && <div style={{ fontSize: 12.5, color: MUTE, padding: "0 14px 12px", lineHeight: 1.4 }}>{emailMsg}</div>}
        </Card>

        <Section>Discovery</Section>
        <Card>
          <RowToggle
            icon={Pause}
            label="Pause my profile"
            hint="Hide from everyone's deck. You keep your matches."
            value={paused}
            onChange={togglePause}
          />
        </Card>

        <Section>Privacy &amp; safety</Section>
        <Card>
          <RowNav icon={Ban} label="Blocked users" count={blocks.length} onClick={() => setShowBlocks(true)} />
        </Card>

        <Section>Location</Section>
        <Card>
          <RowChoice
            icon={MapPin}
            label="Distance unit"
            options={[
              { v: "km", t: "km" },
              { v: "mi", t: "mi" },
            ]}
            value={unit}
            onChange={(v) => {
              setUnit(v);
              patch({ distance_unit: v });
            }}
          />
        </Card>

        <Section>Notifications</Section>
        <Card>
          <RowToggle icon={Bell} label="New matches" value={notif.matches} onChange={(v) => setNotifKey("matches", v)} />
          <RowToggle icon={Bell} label="New messages" value={notif.messages} onChange={(v) => setNotifKey("messages", v)} />
          <RowToggle icon={Bell} label="Likes" value={notif.likes} onChange={(v) => setNotifKey("likes", v)} last />
        </Card>

        <Section>Language</Section>
        <Card>
          <RowStatic icon={Globe} label="App language" value="English" badge="More soon" />
        </Card>

        <Section>About</Section>
        <Card>
          <RowNav icon={FileText} label="Terms of Service" onClick={() => {}} />
          <RowNav icon={FileText} label="Privacy Policy" onClick={() => {}} last />
        </Card>

        <div style={{ height: 22 }} />

        <button onClick={signOut} style={bigBtn(false)}>
          <LogOut size={17} /> Sign out
        </button>

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={bigBtn(true)}>
            <Trash2 size={17} /> Delete account
          </button>
        ) : (
          <div
            style={{
              border: "1px solid rgba(220,38,38,.3)",
              background: "rgba(220,38,38,.05)",
              borderRadius: 14,
              padding: 16,
              marginTop: 10,
            }}
          >
            <div style={{ fontWeight: 800, color: "#dc2626", fontSize: 14.5, marginBottom: 4 }}>
              Delete your account?
            </div>
            <div style={{ fontSize: 13, color: MUTE, lineHeight: 1.5, marginBottom: 14 }}>
              This permanently removes your profile, photos, matches, and
              messages. It can&apos;t be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, background: "#fff", border: "1px solid rgba(11,31,18,.15)", borderRadius: 999, padding: 12, fontWeight: 800, fontSize: 14, fontFamily: font, cursor: "pointer", color: INK }}
              >
                Keep my account
              </button>
              <button
                onClick={deleteAccount}
                disabled={busy}
                style={{ flex: 1, background: "#dc2626", border: "none", borderRadius: 999, padding: 12, fontWeight: 800, fontSize: 14, fontFamily: font, cursor: "pointer", color: "#fff" }}
              >
                {busy ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11.5, color: MUTE, margin: "24px 0 8px" }}>
          Solmates v1.0
        </div>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100dvh",
  padding: "20px 18px 60px",
  fontFamily: font,
  background: "#fff",
  display: "flex",
  justifyContent: "center",
};

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
        <ChevronLeft size={26} color={INK} />
      </button>
      <h1 style={{ fontWeight: 900, fontSize: 22, color: INK, margin: 0 }}>{title}</h1>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: MUTE, textTransform: "uppercase", letterSpacing: 0.6, margin: "22px 4px 8px" }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "0.5px solid rgba(11,31,18,.12)", borderRadius: 14, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function rowBase(last?: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "13px 14px",
    borderBottom: last ? "none" : "0.5px solid rgba(11,31,18,.07)",
  };
}

function RowStatic({ icon: Icon, label, value, badge }: { icon?: React.ElementType; label: string; value: string; badge?: string }) {
  return (
    <div style={rowBase(true)}>
      {Icon && <Icon size={18} color={MUTE} />}
      <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: INK }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10.5, fontWeight: 800, color: GREEN_DK, background: "rgba(34,197,94,.12)", borderRadius: 999, padding: "2px 8px" }}>
          {badge}
        </span>
      )}
      <span style={{ fontSize: 13.5, color: MUTE, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function RowNav({ icon: Icon, label, count, onClick, last }: { icon: React.ElementType; label: string; count?: number; onClick: () => void; last?: boolean }) {
  return (
    <button onClick={onClick} style={{ ...rowBase(last), width: "100%", background: "none", border: "none", borderBottom: last ? "none" : "0.5px solid rgba(11,31,18,.07)", cursor: "pointer", textAlign: "left", fontFamily: font }}>
      <Icon size={18} color={MUTE} />
      <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: INK }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 13, color: MUTE }}>{count}</span>
      )}
      <ChevronRight size={17} color={MUTE} />
    </button>
  );
}

function RowToggle({ icon: Icon, label, hint, value, onChange, last }: { icon: React.ElementType; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={rowBase(last)}>
      <Icon size={18} color={MUTE} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: INK }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: MUTE, marginTop: 1 }}>{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        aria-label={label}
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: value ? GREEN : "rgba(11,31,18,.18)",
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .2s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </button>
    </div>
  );
}

function RowChoice({ icon: Icon, label, options, value, onChange }: { icon: React.ElementType; label: string; options: { v: string; t: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={rowBase(true)}>
      <Icon size={18} color={MUTE} />
      <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: INK }}>{label}</span>
      <div style={{ display: "flex", gap: 4, background: "rgba(11,31,18,.05)", borderRadius: 999, padding: 3 }}>
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "5px 14px",
              fontWeight: 800,
              fontSize: 13,
              fontFamily: font,
              cursor: "pointer",
              background: value === o.v ? "#fff" : "transparent",
              color: value === o.v ? INK : MUTE,
              boxShadow: value === o.v ? "0 1px 3px rgba(11,31,18,.12)" : "none",
            }}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function bigBtn(danger: boolean): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 10,
    background: danger ? "rgba(220,38,38,.06)" : "#fff",
    color: danger ? "#dc2626" : INK,
    border: `1px solid ${danger ? "rgba(220,38,38,.25)" : "rgba(11,31,18,.15)"}`,
    borderRadius: 999,
    padding: 14,
    fontWeight: 800,
    fontSize: 14.5,
    fontFamily: font,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", color: MUTE, fontSize: 13.5, padding: "40px 20px" }}>{children}</div>
  );
}
