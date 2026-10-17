"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Loader({
  label,
  presentation = "inline",
}: {
  label: string;
  presentation?: "inline" | "stage" | "screen";
}) {
  const screen = presentation === "screen";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!screen || !mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const blocked: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.classList.contains("loader-frame")) continue;
      child.inert = true;
      blocked.push(child);
    }
    return () => {
      document.body.style.overflow = previous;
      for (const child of blocked) child.inert = false;
    };
  }, [screen, mounted]);

  const frame = (
    <div
      className={`loader-frame ${presentation}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loader-spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );

  if (screen && mounted) return createPortal(frame, document.body);
  return frame;
}
