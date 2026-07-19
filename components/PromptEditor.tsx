"use client";

import { useEffect, useState } from "react";
import { Plus, X, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROMPT_LIBRARY } from "@/lib/prompts";
import { GREEN, GREEN_DK, INK, MUTE, font } from "@/lib/theme";

type Prompt = { id: string; prompt: string; answer: string };

const MAX = 3;

export default function PromptEditor({ userId }: { userId: string }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("prompts")
        .select("id, prompt, answer")
        .eq("user_id", userId)
        .order("position");
      setPrompts((data ?? []) as Prompt[]);
      setLoading(false);
    })();
  }, [userId]);

  const usedPrompts = new Set(prompts.map((p) => p.prompt));
  const available = PROMPT_LIBRARY.filter((q) => !usedPrompts.has(q));

  async function add() {
    if (!chosen || !answer.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("prompts")
      .insert({ user_id: userId, prompt: chosen, answer: answer.trim(), position: prompts.length })
      .select("id, prompt, answer")
      .single();
    if (!error && data) {
      setPrompts([...prompts, data]);
      setChosen(null);
      setAnswer("");
      setPicking(false);
    }
  }

  async function remove(id: string) {
    setPrompts(prompts.filter((p) => p.id !== id));
    await createClient().from("prompts").delete().eq("id", id);
  }

  if (loading) return null;

  return (
    <>
      {prompts.map((p) => (
        <div key={p.id} style={{ border: "0.5px solid rgba(11,31,18,.12)", borderRadius: 14, padding: "13px 15px", marginBottom: 8, position: "relative" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTE, marginBottom: 4 }}>{p.prompt}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.4, paddingRight: 22 }}>{p.answer}</div>
          <button
            onClick={() => remove(p.id)}
            aria-label="Remove"
            style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: MUTE, cursor: "pointer", padding: 2, display: "flex" }}
          >
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
      ))}

      {prompts.length < MAX && !picking && (
        <button
          onClick={() => setPicking(true)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "rgba(34,197,94,.06)", border: "1.5px dashed rgba(34,197,94,.4)", borderRadius: 14, padding: "13px", color: GREEN_DK, fontWeight: 800, fontSize: 14, fontFamily: font, cursor: "pointer" }}
        >
          <Plus size={17} /> Add a prompt
        </button>
      )}

      {picking && (
        <div style={{ border: "1px solid rgba(34,197,94,.3)", borderRadius: 14, padding: 14, background: "rgba(34,197,94,.03)" }}>
          {!chosen ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Quote size={15} color={GREEN} /> Pick a prompt
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {available.map((q) => (
                  <button
                    key={q}
                    onClick={() => setChosen(q)}
                    style={{ textAlign: "left", background: "#fff", border: "0.5px solid rgba(11,31,18,.12)", borderRadius: 10, padding: "11px 13px", fontSize: 14, fontWeight: 600, color: INK, fontFamily: font, cursor: "pointer" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button onClick={() => setPicking(false)} style={{ marginTop: 10, background: "none", border: "none", color: MUTE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 8 }}>{chosen}</div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={250}
                rows={3}
                autoFocus
                placeholder="Your answer…"
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid rgba(11,31,18,.14)", borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: font, outline: "none", resize: "none" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button onClick={() => { setChosen(null); setAnswer(""); }} style={{ background: "none", border: "none", color: MUTE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}>
                  Back
                </button>
                <button
                  onClick={add}
                  disabled={!answer.trim()}
                  style={{ background: answer.trim() ? GREEN : "#c8d6cc", color: "#fff", border: "none", borderRadius: 999, padding: "8px 20px", fontWeight: 800, fontSize: 13.5, fontFamily: font, cursor: answer.trim() ? "pointer" : "default" }}
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
