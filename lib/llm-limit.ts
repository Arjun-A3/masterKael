export type LlmLimitCode = "rate_limit" | "too_large";

export class LlmError extends Error {
  readonly code: LlmLimitCode;

  constructor(message: string, code: LlmLimitCode) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

type GroqFailure = {
  status: number;
  message: string;
  code?: string;
  headers?: Headers;
};

export function llmFailure({ status, message, code, headers }: GroqFailure): Error {
  if (isOversized(status, message)) {
    return new LlmError(
      "This request is larger than the model can take. Shorten the message, or start a new lesson.",
      "too_large",
    );
  }
  if (isRateLimit(status, message, code)) {
    return new LlmError(rateLimitNotice(message, headers), "rate_limit");
  }
  if (status === 401 || status === 403) {
    return new Error(`Groq rejected the API key. Check GROQ_API_KEY. ${message}`.trim());
  }
  return new Error(message || `Groq returned ${status}.`);
}

function isOversized(status: number, message: string): boolean {
  return status === 413 || /request too large|reduce your message size/i.test(message);
}

function isRateLimit(status: number, message: string, code?: string): boolean {
  if (status === 429 || code === "rate_limit_exceeded") return true;
  return /rate limit reached/i.test(message);
}

function rateLimitNotice(message: string, headers?: Headers): string {
  const waitMs = retryDelayMs(message, headers);
  const wait = waitMs == null ? null : formatWait(waitMs);
  const window = limitWindow(message);
  if (window === "day") {
    return wait
      ? `master kael is paused until the daily limit resets. Try again in ${wait}.`
      : "master kael is paused until the daily limit resets. Try again later.";
  }
  return wait
    ? `master kael is paused until the limit resets. Try again in ${wait}.`
    : "master kael is paused until the limit resets. Wait a moment and send that again.";
}

function limitWindow(message: string): "day" | "minute" | null {
  if (/\b(TPD|RPD)\b|per day/i.test(message)) return "day";
  if (/\b(TPM|RPM|ITPM|OTPM)\b|per minute/i.test(message)) return "minute";
  return null;
}

function retryDelayMs(message: string, headers?: Headers): number | null {
  const fromMessage = durationFromMessage(message);
  if (fromMessage != null) return fromMessage;

  const retryAfter = headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
    const when = Date.parse(retryAfter);
    if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  }

  const window = limitWindow(message);
  if (window === "day") return parseDuration(headers?.get("x-ratelimit-reset-requests") ?? "");
  if (window === "minute" && /tokens per minute|\b(TPM|ITPM|OTPM)\b/i.test(message)) {
    return parseDuration(headers?.get("x-ratelimit-reset-tokens") ?? "");
  }
  return null;
}

function durationFromMessage(message: string): number | null {
  const match = message.match(/try again in\s+(\S+)/i);
  if (!match) return null;
  const token = match[1].replace(/[.,;:]+$/, "");
  if (!/\d/.test(token) || !/[hms]/i.test(token)) return null;
  return parseDuration(token);
}

export function parseDuration(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const match = text.match(
    /^(?:(\d+(?:\.\d+)?)ms)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i,
  );
  if (!match) return null;
  const [, millis, hours, minutes, seconds] = match;
  if (!millis && !hours && !minutes && !seconds) return null;
  const total =
    Number(hours ?? 0) * 3_600_000 +
    Number(minutes ?? 0) * 60_000 +
    Number(seconds ?? 0) * 1_000 +
    Number(millis ?? 0);
  if (!Number.isFinite(total)) return null;
  return Math.round(total);
}

export function formatWait(ms: number): string {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return unit(totalSeconds, "second");
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return unit(totalMinutes, "minute");
  if (totalMinutes < 60 * 24) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return joinWait(unit(hours, "hour"), minutes ? unit(minutes, "minute") : "");
  }
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  return joinWait(unit(days, "day"), hours ? unit(hours, "hour") : "");
}

function unit(count: number, name: string): string {
  return `${count} ${name}${count === 1 ? "" : "s"}`;
}

function joinWait(lead: string, rest: string): string {
  return rest ? `${lead} ${rest}` : lead;
}
