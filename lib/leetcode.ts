import type { ProblemExample, ProblemImage, ProblemSheet, QuestionSession } from "@/lib/question";

const ENDPOINT = "https://leetcode.com/graphql";

export type LeetCodeHit = {
  number: string;
  title: string;
  titleSlug: string;
  difficulty: string;
};

const SEARCH_QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    questions: data {
      difficulty
      frontendQuestionId: questionFrontendId
      title
      titleSlug
    }
  }
}`;

const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    titleSlug
    difficulty
    content
    isPaidOnly
  }
}`;

export function isTitleSlug(value: string) {
  return /^[a-z0-9-]{1,80}$/.test(value);
}

export async function searchLeetCode(query: string): Promise<LeetCodeHit[]> {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q || q.length > 80) return [];

  const data = await graphql<{
    problemsetQuestionList?: {
      questions?: Array<{
        difficulty?: string | null;
        frontendQuestionId?: string | null;
        title?: string | null;
        titleSlug?: string | null;
      } | null> | null;
    } | null;
  }>(SEARCH_QUERY, {
    categorySlug: "",
    skip: 0,
    limit: 12,
    filters: { searchKeywords: q },
  });

  const exact = /^\d+$/.test(q);
  const hits: LeetCodeHit[] = [];
  for (const row of data.problemsetQuestionList?.questions ?? []) {
    const number = String(row?.frontendQuestionId ?? "").trim();
    const title = String(row?.title ?? "").trim();
    const titleSlug = String(row?.titleSlug ?? "").trim();
    if (!number || !title || !isTitleSlug(titleSlug)) continue;
    hits.push({
      number,
      title,
      titleSlug,
      difficulty: String(row?.difficulty ?? "").trim(),
    });
  }

  hits.sort((a, b) => {
    if (exact) {
      const rank = (hit: LeetCodeHit) => (hit.number === q ? 0 : 1);
      const byExact = rank(a) - rank(b);
      if (byExact !== 0) return byExact;
    }
    return Number(a.number) - Number(b.number);
  });

  return hits.slice(0, 8);
}

export async function loadLeetCodeProblem(titleSlug: string): Promise<QuestionSession | null> {
  if (!isTitleSlug(titleSlug)) return null;

  const data = await graphql<{
    question?: {
      questionFrontendId?: string | null;
      title?: string | null;
      difficulty?: string | null;
      content?: string | null;
      isPaidOnly?: boolean | null;
    } | null;
  }>(QUESTION_QUERY, { titleSlug });

  const question = data.question;
  const title = String(question?.title ?? "").trim();
  const number = String(question?.questionFrontendId ?? "").trim();
  if (!title || !number) return null;

  const difficulty = String(question?.difficulty ?? "").trim();
  const html = String(question?.content ?? "");
  const plain = htmlToText(html);
  const { lead, constraints, statement } = splitStatement(plain);
  const notes = [
    ...(difficulty ? [`Difficulty: ${difficulty}`] : []),
    ...constraints,
  ].slice(0, 6);
  const sheet = buildSheet(html);

  return {
    number,
    title,
    problem: lead || title,
    statement:
      statement ||
      (question?.isPaidOnly
        ? "The official statement is not public. Ask them to paste it if the title is not enough."
        : ""),
    sheet: sheet.prompt || sheet.images.length || sheet.examples.length ? sheet : null,
    constraints: notes,
    stage: "understand",
    known: [],
    idea: "",
    next: "",
  };
}

function buildSheet(html: string): ProblemSheet {
  const exampleAt = html.search(/<strong[^>]*class="example"/i);
  const promptHtml = exampleAt === -1 ? html : html.slice(0, exampleAt);
  const prompt = clip(htmlToText(promptHtml), 4000);
  return {
    prompt,
    images: extractImages(html),
    examples: extractExamples(html),
  };
}

function extractImages(html: string): ProblemImage[] {
  const images: ProblemImage[] = [];
  let label = "Diagram";
  const pattern = /<strong[^>]*class="example"[^>]*>([\s\S]*?)<\/strong>|<img\b[^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    if (match[1] !== undefined) {
      const name = decode(match[1]).replace(/:$/, "").trim();
      if (name) label = name;
      continue;
    }
    const src = attr(match[0], "src");
    if (!src.startsWith("https://") || !safeHost(src)) continue;
    const alt = attr(match[0], "alt") || label;
    images.push({ src, alt: clip(alt, 80) });
    if (images.length >= 6) break;
  }
  return images;
}

function extractExamples(html: string): ProblemExample[] {
  const chunks = html.split(/<strong[^>]*class="example"[^>]*>/i).slice(1);
  const examples: ProblemExample[] = [];
  for (const chunk of chunks) {
    const label = decode(chunk.match(/^([^<]*)/)?.[1] ?? "")
      .replace(/:$/, "")
      .trim();
    const pre = chunk.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1] ?? "";
    const text = htmlToText(pre);
    const input = clip(field(text, "Input"), 1500);
    const output = clip(field(text, "Output"), 1500);
    const explanation = clip(field(text, "Explanation"), 800);
    if (!input && !output) continue;
    examples.push({
      label: clip(label || `Example ${examples.length + 1}`, 40),
      input,
      output,
      explanation,
    });
    if (examples.length >= 6) break;
  }
  return examples;
}

function field(text: string, name: string) {
  const match = text.match(new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n(?:Input|Output|Explanation):|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return decode(match?.[2] ?? match?.[3] ?? "").trim();
}

function safeHost(value: string) {
  try {
    return new URL(value).hostname.endsWith("leetcode.com");
  } catch {
    return false;
  }
}

function clip(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "master-kael",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`LeetCode returned ${response.status}.`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message?: string }[] };
  if (!json.data) {
    throw new Error(json.errors?.[0]?.message || "LeetCode returned no data.");
  }
  return json.data;
}

function htmlToText(html: string) {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1")
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h\d|li|pre|tr|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decode(withBreaks)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point > 0 && point < 0x110000 ? String.fromCodePoint(point) : "";
    });
}

function splitStatement(plain: string) {
  const text = plain.replace(/\u00a0/g, " ").trim();
  if (!text) return { lead: "", constraints: [] as string[], statement: "" };

  const constraintMatch = text.split(/\nConstraints:\n/i);
  const before = constraintMatch[0]?.trim() ?? text;
  const after = constraintMatch[1] ?? "";
  const constraints = after
    .split("\n")
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line && !/^example\b/i.test(line) && !/^follow-?up\b/i.test(line))
    .slice(0, 5);

  const lead = before
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("-"))
    ?.slice(0, 500) ?? "";

  const statement = text.length <= 3500 ? text : `${text.slice(0, 3499).trimEnd()}…`;
  return { lead, constraints, statement };
}
