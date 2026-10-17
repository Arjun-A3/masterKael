export const STAGES = ["understand", "approach", "example", "code", "check", "solved"] as const;

export type Stage = (typeof STAGES)[number];

export type ProblemImage = {
  src: string;
  alt: string;
};

export type ProblemExample = {
  label: string;
  input: string;
  output: string;
  explanation: string;
};

export type ProblemSheet = {
  prompt: string;
  images: ProblemImage[];
  examples: ProblemExample[];
};

export type QuestionSession = {
  number: string;
  title: string;
  problem: string;
  statement: string;
  sheet: ProblemSheet | null;
  constraints: string[];
  stage: Stage;
  known: string[];
  idea: string;
  next: string;
};

export const STAGE_LABEL: Record<Stage, string> = {
  understand: "Understanding the problem",
  approach: "Finding an approach",
  example: "Working an example",
  code: "Writing the solution",
  check: "Checking the answer",
  solved: "Solved",
};

const STAGE_ALIASES: Record<string, Stage> = {
  understand: "understand",
  understanding: "understand",
  approach: "approach",
  approaches: "approach",
  example: "example",
  examples: "example",
  code: "code",
  coding: "code",
  check: "check",
  checking: "check",
  solved: "solved",
  done: "solved",
  answer: "solved",
};

const MARKER = /<<SESSION>>|<session>/i;
const MARKER_KEEP = 11;

export function lessonTitle(question: QuestionSession, fallback = "Problem") {
  const title = question.title.trim();
  if (!title) return fallback;
  return question.number ? `${question.number} · ${title}` : title;
}

export function lessonBrief(question: QuestionSession | null) {
  if (!question?.title && !question?.problem) {
    return "No problem is locked yet. Their next message starts this problem. Capture it in the session block.";
  }
  const lines = [
    `Problem: ${question.number ? `LeetCode ${question.number} ` : ""}${question.title}`.trim(),
    question.statement ? `Official statement:\n${question.statement}` : "",
    question.problem ? `Restatement: ${question.problem}` : "",
    question.constraints.length ? `Constraints: ${question.constraints.join("; ")}` : "",
    `Stage: ${question.stage} (${STAGE_LABEL[question.stage]})`,
    question.idea ? `Current idea: ${question.idea}` : "",
    question.known.length
      ? `Already established:\n- ${question.known.join("\n- ")}`
      : "Already established: nothing yet.",
    question.next
      ? `Previous question, only if their last message did not already address it: ${question.next}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function readQuestion(value: unknown): QuestionSession | null {
  if (!value || typeof value !== "object") return null;
  return parseQuestionUpdate(JSON.stringify(value), null);
}

export function parseQuestionUpdate(
  raw: string,
  previous: QuestionSession | null,
): QuestionSession | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const title = clip(text(row.title) || previous?.title || "", 80);
  const problem = clip(text(row.problem) || previous?.problem || "", 500);
  const statement = clip(text(row.statement) || previous?.statement || "", 3500);
  if (!title && !problem && !statement) return previous;

  const constraints = list(row.constraints, 6, 140);
  const known = list(row.known, 8, 180);
  const stage = asStage(row.stage) ?? previous?.stage ?? "understand";

  return {
    number: asNumber(row.number) || previous?.number || "",
    title,
    problem,
    statement,
    sheet: previous?.sheet ?? readSheet(row.sheet),
    constraints: merge(constraints, previous?.constraints ?? [], 6),
    stage,
    known: merge(known, previous?.known ?? [], 8),
    idea: row.idea === undefined ? (previous?.idea ?? "") : clip(text(row.idea), 240),
    next: row.next === undefined ? (previous?.next ?? "") : clip(text(row.next), 240),
  };
}

export function createSessionSplitter() {
  let pending = "";
  let hidden = "";
  let capturing = false;

  return {
    push(token: string) {
      if (!token) return "";
      if (capturing) {
        hidden += token;
        return "";
      }
      pending += token;
      const match = pending.match(MARKER);
      if (match && match.index !== undefined) {
        const visible = pending.slice(0, match.index).replace(/\s+$/, "");
        hidden = pending.slice(match.index + match[0].length);
        pending = "";
        capturing = true;
        return visible;
      }
      if (pending.length <= MARKER_KEEP) return "";
      const visible = pending.slice(0, pending.length - MARKER_KEEP);
      pending = pending.slice(pending.length - MARKER_KEEP);
      return visible;
    },
    finish() {
      if (capturing) return { visible: "", sessionRaw: hidden };
      const visible = pending;
      pending = "";
      return { visible, sessionRaw: "" };
    },
  };
}

function readSheet(value: unknown): ProblemSheet | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const prompt = clip(text(row.prompt), 4000);
  const images = readImages(row.images);
  const examples = readExamples(row.examples);
  if (!prompt && images.length === 0 && examples.length === 0) return null;
  return { prompt, images, examples };
}

function readImages(value: unknown): ProblemImage[] {
  if (!Array.isArray(value)) return [];
  const images: ProblemImage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const src = safeImage(text(row.src));
    if (!src) continue;
    images.push({ src, alt: clip(text(row.alt) || "Diagram", 80) });
    if (images.length >= 6) break;
  }
  return images;
}

function readExamples(value: unknown): ProblemExample[] {
  if (!Array.isArray(value)) return [];
  const examples: ProblemExample[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const input = clip(text(row.input), 1500);
    const output = clip(text(row.output), 1500);
    if (!input && !output) continue;
    examples.push({
      label: clip(text(row.label) || `Example ${examples.length + 1}`, 40),
      input,
      output,
      explanation: clip(text(row.explanation), 800),
    });
    if (examples.length >= 6) break;
  }
  return examples;
}

function safeImage(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (!url.hostname.endsWith("leetcode.com")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function clip(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max).trimEnd();
}

function merge(incoming: string[], previous: string[], max: number) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of [...incoming, ...previous]) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= max) break;
  }
  return items;
}

function list(value: unknown, max: number, each: number) {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    const item = clip(text(entry), each);
    if (!item) continue;
    items.push(item);
    if (items.length >= max) break;
  }
  return items;
}

function asNumber(value: unknown) {
  const match = text(value).match(/\d{1,4}/);
  return match ? match[0] : "";
}

function asStage(value: unknown): Stage | null {
  const key = text(value).toLowerCase();
  return STAGE_ALIASES[key] ?? null;
}
