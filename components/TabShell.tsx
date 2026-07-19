"use client";

import DiscoverContent from "@/components/tabs_DiscoverContent";
import MatchesContent from "@/components/tabs_MatchesContent";
import ProfileContent from "@/components/tabs_ProfileContent";

// All three tabs mounted together; only `display` changes between them.
// Nothing unmounts on tab switch, so it's instant with no flash — the
// Instagram behaviour. Each tab still loads its own data the first time
// it appears (with its skeleton); after that it's kept alive.

export default function TabShell({ active }: { active: "discover" | "matches" | "profile" }) {
  return (
    <>
      <div style={{ display: active === "discover" ? "flex" : "none", flexDirection: "column", minHeight: "100dvh" }}>
        <DiscoverContent />
      </div>
      <div style={{ display: active === "matches" ? "block" : "none", minHeight: "100dvh" }}>
        <MatchesContent />
      </div>
      <div style={{ display: active === "profile" ? "block" : "none", minHeight: "100dvh" }}>
        <ProfileContent />
      </div>
    </>
  );
}
