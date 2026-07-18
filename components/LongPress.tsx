"use client";

import { useEffect, useRef, useState } from "react";
import { GREEN_DK, INK, MUTE, font } from "@/lib/theme";

// Fires after the user holds for ~450ms — long enough not to trigger on a
// normal tap, short enough to feel intentional. Works for touch and mouse.
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      // a little haptic on phones that support it
      if ("vibrate" in navigator) navigator.vibrate?.(12);
      onLongPress();
    }, ms);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return {
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: clear,
      onMouseDown: start,
      onMouseUp: clear,
      onMouseLeave: clear,
    },
    // so the row's onClick can bail if a long-press already fired
    didFire: () => fired.current,
  };
}

export type SheetAction = {
  label: string;
  danger?: boolean;
  onClick: () => void;
};

// iOS-style action sheet that rises from the bottom.
export function ActionSheet({
  title,
  actions,
  onClose,
}: {
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  // lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      data-sheet-backdrop
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,20,12,.35)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        data-sheet
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "0 8px calc(8px + env(safe-area-inset-bottom))",
          fontFamily: font,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,.98)",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          {title && (
            <div
              style={{
                textAlign: "center",
                fontSize: 12.5,
                color: MUTE,
                padding: "13px 16px",
                borderBottom: "0.5px solid rgba(11,31,18,.1)",
              }}
            >
              {title}
            </div>
          )}
          {actions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => {
                a.onClick();
                onClose();
              }}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                borderTop: i === 0 && !title ? "none" : "0.5px solid rgba(11,31,18,.08)",
                padding: "16px",
                fontSize: 16,
                fontWeight: a.danger ? 700 : 500,
                fontFamily: font,
                color: a.danger ? "#dc2626" : INK,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "#fff",
            border: "none",
            borderRadius: 16,
            padding: "16px",
            fontSize: 16,
            fontWeight: 800,
            fontFamily: font,
            color: GREEN_DK,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
