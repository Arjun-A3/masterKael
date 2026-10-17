"use client";

import { useEffect } from "react";
import type { ProblemExample, ProblemSheet, QuestionSession } from "@/lib/question";

export function ProblemDock({
  question,
  open,
  onToggle,
  onClose,
}: {
  question: QuestionSession | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ready = Boolean(question?.title);
  const sheet = question ? viewOf(question) : null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={open && ready ? "dock open" : "dock"}>
      {open && ready ? (
        <button type="button" className="sheet-scrim" aria-label="Close problem" onClick={onClose} />
      ) : null}
      <aside
        id="problem-sheet"
        className="sheet"
        aria-label="Problem"
        aria-hidden={!open || !ready}
      >
        {question && sheet ? <SheetBody question={question} sheet={sheet} onClose={onClose} /> : null}
      </aside>
      <button
        type="button"
        className={open && ready ? "rail-tab active" : "rail-tab"}
        aria-expanded={open && ready}
        aria-controls="problem-sheet"
        disabled={!ready}
        onClick={onToggle}
      >
        <span className="rail-num">{question?.number || "—"}</span>
        <span className="rail-name">{question?.title || "Problem"}</span>
      </button>
    </div>
  );
}

function SheetBody({
  question,
  sheet,
  onClose,
}: {
  question: QuestionSession;
  sheet: ProblemSheet;
  onClose: () => void;
}) {
  const title = question.number ? `${question.number} · ${question.title}` : question.title;
  return (
    <div className="sheet-body">
      <header className="sheet-head">
        <div>
          <p className="eyebrow">Problem</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="sheet-close" onClick={onClose}>
          Close
        </button>
      </header>

      <section>
        <h3>Question</h3>
        {sheet.prompt ? <p className="sheet-copy">{sheet.prompt}</p> : <p className="sheet-empty">The statement is still loading.</p>}
        {question.constraints.length > 0 ? (
          <ul className="sheet-notes">
            {question.constraints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h3>Diagram</h3>
        {sheet.images.length > 0 ? (
          <div className="diagrams">
            {sheet.images.map((image) => (
              <figure key={image.src}>
                <img src={image.src} alt={image.alt || "Diagram"} referrerPolicy="no-referrer" />
                {image.alt && image.alt !== "Diagram" ? <figcaption>{image.alt}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : (
          <p className="sheet-empty">No diagram with this problem.</p>
        )}
      </section>

      <section>
        <h3>Test cases</h3>
        {sheet.examples.length > 0 ? (
          <div className="cases">
            {sheet.examples.map((example) => (
              <ExampleCard key={`${example.label}:${example.input}`} example={example} />
            ))}
          </div>
        ) : (
          <p className="sheet-empty">No published examples for this problem.</p>
        )}
      </section>
    </div>
  );
}

function ExampleCard({ example }: { example: ProblemExample }) {
  return (
    <article className="case">
      <h4>{example.label}</h4>
      {example.input ? (
        <p>
          <span>Input</span>
          <code>{example.input}</code>
        </p>
      ) : null}
      {example.output ? (
        <p>
          <span>Output</span>
          <code>{example.output}</code>
        </p>
      ) : null}
      {example.explanation ? <p className="case-note">{example.explanation}</p> : null}
    </article>
  );
}

function viewOf(question: QuestionSession): ProblemSheet {
  if (question.sheet) return question.sheet;
  return plainSheet(question.statement || question.problem);
}

function plainSheet(text: string): ProblemSheet {
  const parts = text.split(/\n(?=Example \d+:)/i);
  const prompt = (parts[0] ?? "").replace(/\nConstraints:[\s\S]*$/i, "").trim();
  const examples: ProblemExample[] = [];
  for (const part of parts.slice(1)) {
    const label = part.match(/^Example \d+/i)?.[0] ?? `Example ${examples.length + 1}`;
    const body = part.replace(/^Example \d+:?\s*/i, "");
    const input = grab(body, "Input");
    const output = grab(body, "Output");
    const explanation = grab(body, "Explanation");
    if (!input && !output) continue;
    examples.push({ label, input, output, explanation });
  }
  return { prompt, images: [], examples };
}

function grab(text: string, name: string) {
  const match = text.match(new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n(?:Input|Output|Explanation|Constraints):|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}
