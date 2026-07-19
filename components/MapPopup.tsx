"use client";

import { useEffect, useRef } from "react";
import { GREEN, INK, MUTE, font } from "@/lib/theme";

// A popup map showing the user's APPROXIMATE area. We load Leaflet from a
// CDN at runtime so there's no build dependency. The coordinates passed in
// are the already-fuzzed ones from the server — we never have the exact
// point on the client, which is the whole privacy design. We draw a soft
// circle instead of a sharp pin to make "approximate" visually honest.

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve(window.L);
    document.head.appendChild(script);
  });
}

export default function MapPopup({
  lat,
  lng,
  city,
  onClose,
}: {
  lat: number | null;
  lng: number | null;
  city: string | null;
  onClose: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapObj.current) return;

      const map = L.map(mapEl.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 12);
      mapObj.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
      }).addTo(map);

      // soft circle = "somewhere around here", not a precise pin
      L.circle([lat, lng], {
        radius: 1200,
        color: GREEN,
        fillColor: GREEN,
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, [lat, lng]);

  return (
    <div
      data-sheet-backdrop
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,20,12,.5)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: font,
      }}
    >
      <div
        data-modal
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>Your location</div>
            <div style={{ fontSize: 12.5, color: MUTE }}>{city || "Approximate area"}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MUTE, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {lat == null || lng == null ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: MUTE, fontSize: 14 }}>
            No location set yet.
          </div>
        ) : (
          <div ref={mapEl} style={{ height: 300, width: "100%", background: "#e8efe9" }} />
        )}

        <div style={{ padding: "11px 16px", fontSize: 11.5, color: MUTE, textAlign: "center", lineHeight: 1.4 }}>
          This is the general area others see as distance — never your exact spot.
        </div>
      </div>
    </div>
  );
}
