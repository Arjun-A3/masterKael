"use client";

import { useEffect, useRef } from "react";

export function guideStorageKey(userId: string) {
  return `master-kael:guide:${userId}`;
}

export function GuideModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-lead"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-scroll">
          <p className="eyebrow">Welcome</p>
          <h2 id="guide-title">What this is</h2>
          <p id="guide-lead">
            master kael practices one LeetCode problem with you. He asks a question,
            then waits. He gives the solution only if you ask for it.
          </p>
          <ol className="guide-steps">
            <li>
              <span>1</span>
              <p>
                <strong>Pick a problem.</strong>
                Search its number, or start with Two Sum, 3Sum, or LRU Cache.
              </p>
            </li>
            <li>
              <span>2</span>
              <p>
                <strong>Answer in the box.</strong>
                Say what you think. A guess is fine. If you are stuck, say so.
              </p>
            </li>
            <li>
              <span>3</span>
              <p>
                <strong>Stay on that problem.</strong>
                Press New problem for a different one. On a phone, the menu opens your list.
              </p>
            </li>
          </ol>
          <p className="guide-note">The info button in the header opens this again.</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-ack" ref={closeRef} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
