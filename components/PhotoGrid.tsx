"use client";

import { useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { GREEN, INK, MUTE } from "@/lib/theme";
import {
  uploadPhoto,
  deletePhoto,
  reorderPhotos,
  publicUrl,
} from "@/lib/photos";

export type Photo = { id: string; storage_path: string; position: number };

const SLOTS = 6;

export default function PhotoGrid({
  userId,
  photos,
  onChange,
}: {
  userId: string;
  photos: Photo[];
  onChange: (p: Photo[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file twice still fires
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const row = await uploadPhoto(userId, file, photos.length);
      onChange([...photos, row as Photo]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
    setBusy(false);
  }

  async function remove(p: Photo) {
    const next = photos.filter((x) => x.id !== p.id);
    onChange(next);
    await deletePhoto(p.id, p.storage_path);
    await reorderPhotos(next.map((x) => x.id));
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    await reorderPhotos(next.map((x) => x.id));
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        {Array.from({ length: SLOTS }).map((_, i) => {
          const p = photos[i];

          if (!p) {
            const isNext = i === photos.length;
            return (
              <button
                key={`empty-${i}`}
                onClick={() => isNext && !busy && fileRef.current?.click()}
                disabled={!isNext || busy}
                style={{
                  aspectRatio: "3 / 4",
                  borderRadius: 12,
                  border: `1.5px dashed ${isNext ? GREEN : "rgba(11,31,18,.15)"}`,
                  background: isNext ? "rgba(34,197,94,.05)" : "#fafbfa",
                  color: isNext ? GREEN : MUTE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isNext && !busy ? "pointer" : "default",
                }}
              >
                {isNext && <Plus size={22} strokeWidth={2.6} />}
              </button>
            );
          }

          return (
            <div
              key={p.id}
              style={{
                position: "relative",
                aspectRatio: "3 / 4",
                borderRadius: 12,
                overflow: "hidden",
                background: `center / cover no-repeat url(${publicUrl(
                  p.storage_path
                )})`,
                border: "1px solid rgba(11,31,18,.08)",
              }}
            >
              {i === 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    background: GREEN,
                    color: "#fff",
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 999,
                    letterSpacing: 0.3,
                  }}
                >
                  MAIN
                </span>
              )}

              <button
                onClick={() => remove(p)}
                aria-label="Remove photo"
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(6,20,12,.7)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={13} strokeWidth={3} />
              </button>

              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  background:
                    "linear-gradient(to top, rgba(6,20,12,.75), transparent)",
                  padding: "10px 4px 4px",
                }}
              >
                <Arrow onClick={() => move(i, -1)} disabled={i === 0}>
                  <ChevronLeft size={15} strokeWidth={3} />
                </Arrow>
                <Arrow
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1}
                >
                  <ChevronRight size={15} strokeWidth={3} />
                </Arrow>
              </div>
            </div>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={pick}
        style={{ display: "none" }}
      />

      <div style={{ fontSize: 12, color: MUTE, marginTop: 8 }}>
        {busy
          ? "Uploading..."
          : error ?? "Your first photo is the one people see on your card."}
      </div>
    </>
  );
}

function Arrow({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        color: disabled ? "rgba(255,255,255,.25)" : "#fff",
        cursor: disabled ? "default" : "pointer",
        padding: "2px 4px",
        display: "flex",
      }}
    >
      {children}
    </button>
  );
}
