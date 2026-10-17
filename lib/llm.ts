import { MASTER_PROMPT } from "@/lib/prompts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export function modelConfigError(): string | null {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return "Add GROQ_API_KEY on the server. Create a free key at console.groq.com.";
  }
  return null;
}

function trimHistory(messages: ChatTurn[]): ChatTurn[] {
  const recent = messages.slice(-30);
  const kept: ChatTurn[] = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    total += recent[i].content.length;
    if (total > 32000 && kept.length > 0) break;
    kept.push(recent[i]);
  }
  return kept.reverse();
}

export async function* streamReply(
  history: ChatTurn[],
  signal?: AbortSignal,
  brief?: string,
): AsyncGenerator<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error(modelConfigError() ?? "GROQ_API_KEY is not set");
  }

  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  const tools = builtInTools(model);

  const response = await fetch(GROQ_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_completion_tokens: 2048,
      reasoning_effort: "low",
      include_reasoning: false,
      stream: true,
      ...(tools ? { tools } : {}),
      messages: [
        {
          role: "system",
          content: `${MASTER_PROMPT}\n\nLesson brief:\n${brief || "No problem is locked yet."}`,
        },
        ...trimHistory(history),
      ],
    }),
  });

  if (!response.ok) {
    const detail = await safeError(response);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Groq rejected the API key. Check GROQ_API_KEY. ${detail}`.trim());
    }
    if (response.status === 429) {
      throw new Error(detail || "Groq is rate limiting this key. Wait a moment and send that again.");
    }
    throw new Error(detail || `Groq returned ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string" && content) yield content;
    return;
  }

  if (!response.body) {
    throw new Error("Groq returned an empty stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const token = tokenFromLine(line);
      if (token) yield token;
    }
  }

  const tail = tokenFromLine(buffer);
  if (tail) yield tail;
}

function builtInTools(model: string) {
  if (model !== "openai/gpt-oss-20b" && model !== "openai/gpt-oss-120b") return null;
  return [{ type: "browser_search" }, { type: "code_interpreter" }];
}

function tokenFromLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return;
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return;
  try {
    const json = JSON.parse(data) as {
      error?: { message?: string };
      choices?: { delta?: { content?: string | null } }[];
    };
    if (json.error?.message) {
      throw new Error(json.error.message);
    }
    const content = json.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

async function safeError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof json.error === "string") return json.error;
    if (json.error?.message) return json.error.message;
  } catch {
    return "";
  }
  return "";
}
