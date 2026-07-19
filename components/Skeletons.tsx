"use client";

// Shown while a tab's data loads, instead of a blank screen. The shimmer
// makes a tap feel instant even though the fetch is still in flight — the
// difference between "frozen" and "loading".

import { font } from "@/lib/theme";

const shimmer: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(11,31,18,.06) 25%, rgba(11,31,18,.11) 37%, rgba(11,31,18,.06) 63%)",
  backgroundSize: "400% 100%",
  animation: "sk 1.4s ease infinite",
  borderRadius: 10,
};

function Keyframes() {
  return <style>{`@keyframes sk{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>;
}

// Discover: a single big card placeholder.
export function DeckSkeleton() {
  return (
    <div style={{ flex: 1, padding: "14px 16px", fontFamily: font }}>
      <Keyframes />
      <div style={{ ...shimmer, width: 130, height: 26, marginBottom: 14 }} />
      <div style={{ ...shimmer, width: "100%", aspectRatio: "3 / 4.4", borderRadius: 26 }} />
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 18 }}>
        <div style={{ ...shimmer, width: 56, height: 56, borderRadius: "50%" }} />
        <div style={{ ...shimmer, width: 44, height: 44, borderRadius: "50%" }} />
        <div style={{ ...shimmer, width: 56, height: 56, borderRadius: "50%" }} />
      </div>
    </div>
  );
}

// Matches: a header, a row of match circles, then message rows.
export function MatchesSkeleton() {
  return (
    <div style={{ padding: "16px 18px", fontFamily: font }}>
      <Keyframes />
      <div style={{ ...shimmer, width: 120, height: 26, marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...shimmer, width: 66, height: 66, borderRadius: "50%" }} />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ ...shimmer, width: 56, height: 56, borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <div style={{ ...shimmer, width: "40%", height: 15, marginBottom: 7 }} />
            <div style={{ ...shimmer, width: "70%", height: 13 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile: header, photo grid, a couple of field blocks.
export function ProfileSkeleton() {
  return (
    <div style={{ padding: "28px 20px", fontFamily: font }}>
      <Keyframes />
      <div style={{ ...shimmer, width: 150, height: 30, marginBottom: 22 }} />
      <div style={{ ...shimmer, width: "100%", height: 48, borderRadius: 14, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: "100%", height: 48, borderRadius: 14, marginBottom: 22 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ ...shimmer, aspectRatio: "3/4", borderRadius: 12 }} />
        ))}
      </div>
      <div style={{ ...shimmer, width: "100%", height: 70, borderRadius: 12 }} />
    </div>
  );
}
