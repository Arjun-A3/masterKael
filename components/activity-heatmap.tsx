"use client";

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import {
  buildWeeks,
  describeDay,
  heatLevel,
  monthLabels,
  totalMessages,
  type ActivityDay,
} from "@/lib/heatmap";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ActivityHeatmap({
  days,
  ready,
  failed,
}: {
  days: ActivityDay[];
  ready: boolean;
  failed: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const weeks = buildWeeks(days);
  const labels = monthLabels(weeks);
  const total = totalMessages(weeks);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollLeft = node.scrollWidth;
  }, []);

  const summary = failed
    ? "Practice could not load."
    : !ready
      ? "Loading practice."
      : total === 0
        ? "No messages in the past year."
        : total === 1
          ? "1 message in the past year."
          : `${total} messages in the past year.`;

  const countLabel = failed
    ? "Could not load"
    : !ready
      ? "…"
      : total === 0
        ? "No messages yet"
        : total === 1
          ? "1 this year"
          : `${total} this year`;

  function showTip(event: MouseEvent<HTMLElement>, text: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const raw = rect.left + rect.width / 2;
    const x = Math.min(window.innerWidth - 110, Math.max(110, raw));
    setTip({ text, x, y: rect.top });
  }

  return (
    <figure className="heat" aria-label={summary}>
      <figcaption className="heat-caption">
        <span>Practice</span>
        <span>{countLabel}</span>
      </figcaption>
      <div
        className="heat-scroll"
        ref={scrollerRef}
        onScroll={() => setTip(null)}
        onMouseLeave={() => setTip(null)}
      >
        <div className="heat-months" aria-hidden="true">
          {labels.map((label, index) => (
            <span key={weeks[index]?.[0]?.key ?? index}>{label}</span>
          ))}
        </div>
        <div className="heat-body">
          <div className="heat-days" aria-hidden="true">
            {DAY_LABELS.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
          <div className="heat-cols">
            {weeks.map((week) => (
              <div className="heat-col" key={week[0]?.key ?? "week"}>
                {week.map((cell) =>
                  cell.future ? (
                    <span key={cell.key} className="heat-cell is-future" />
                  ) : (
                    <time
                      key={cell.key}
                      className="heat-cell"
                      dateTime={cell.key}
                      data-level={heatLevel(cell.count)}
                      onMouseEnter={(event) => showTip(event, describeDay(cell))}
                      onClick={(event) => showTip(event, describeDay(cell))}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} data-level={level} />
        ))}
        <span>More</span>
      </div>
      {tip ? (
        <div className="heat-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          {tip.text}
        </div>
      ) : null}
    </figure>
  );
}
