"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { ConfirmModal } from "@/components/confirm-modal";
import { MessageBody } from "@/components/message-body";
import { ProblemDock } from "@/components/problem-dock";
import { STAGE_LABEL, lessonTitle, type QuestionSession } from "@/lib/question";

type Lesson = {
  id: string;
  title: string;
  updatedAt: string;
};

type ActivityDay = {
  date: string;
  count: number;
};

const EMPTY_ACTIVITY: ActivityDay[] = [];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const STARTERS = [
  { number: "1", title: "Two Sum", titleSlug: "two-sum" },
  { number: "15", title: "3Sum", titleSlug: "3sum" },
  { number: "146", title: "LRU Cache", titleSlug: "lru-cache" },
];

type LeetCodeHit = {
  number: string;
  title: string;
  titleSlug: string;
  difficulty: string;
};

function bucket(iso: string) {
  const date = new Date(iso);
  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(date)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Earlier";
}

function groupLessons(lessons: Lesson[]) {
  const groups: { label: string; items: Lesson[] }[] = [];
  for (const lesson of lessons) {
    const label = bucket(lesson.updatedAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(lesson);
    else groups.push({ label, items: [lesson] });
  }
  return groups;
}

type RevealState = {
  id: string;
  target: string;
  shown: string;
  live: boolean;
  frame: number;
  last: number;
  settled: boolean;
};

function freshReveal(id = ""): RevealState {
  return {
    id,
    target: "",
    shown: "",
    live: Boolean(id),
    frame: 0,
    last: 0,
    settled: false,
  };
}

function advanceReveal(shown: string, target: string, elapsedMs: number) {
  if (shown.length >= target.length) return shown;
  const rest = target.slice(shown.length);
  const budget = Math.min(6, Math.max(1, Math.round((Math.max(elapsedMs, 16) / 1000) * 140)));
  const lineBreak = rest.indexOf("\n");
  const step = lineBreak === -1 ? budget : Math.min(budget, lineBreak + 1);
  return shown + rest.slice(0, step);
}

export function ChatApp({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activity, setActivity] = useState<ActivityDay[] | null>(null);
  const [activityFailed, setActivityFailed] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState<QuestionSession | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeetCodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const revealRef = useRef<RevealState>(freshReveal());
  const pumpRef = useRef<() => void>(() => {});

  const loadList = useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as { conversations: Lesson[] };
    setLessons(data.conversations);
  }, []);

  const loadActivity = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`/api/activity?tz=${encodeURIComponent(tz)}`);
    if (response.status === 401) {
      window.location.href = "/";
      return;
    }
    if (!response.ok) {
      setActivityFailed(true);
      return;
    }
    const data = (await response.json()) as { days?: ActivityDay[] };
    setActivityFailed(false);
    setActivity(data.days ?? []);
  }, []);

  useEffect(() => {
    void loadList();
    void loadActivity();
  }, [loadList, loadActivity]);

  useEffect(() => {
    return () => {
      if (revealRef.current.frame) cancelAnimationFrame(revealRef.current.frame);
    };
  }, []);

  function settleReveal() {
    const state = revealRef.current;
    if (state.settled) return;
    state.settled = true;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    setSending(false);
    inputRef.current?.focus();
  }

  pumpRef.current = () => {
    const state = revealRef.current;
    if (state.settled || !state.id) return;
    const now = performance.now();
    const elapsed = state.last ? now - state.last : 16;
    state.last = now;

    if (state.shown.length >= state.target.length) {
      state.frame = 0;
      if (!state.live) settleReveal();
      return;
    }

    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = instant ? state.target : advanceReveal(state.shown, state.target, elapsed);
    state.shown = next;
    const id = state.id;
    setMessages((current) => {
      if (revealRef.current.id !== id) return current;
      return current.map((item) => (item.id === id ? { ...item, content: next } : item));
    });
    state.frame = requestAnimationFrame(() => pumpRef.current());
  };

  function armReveal(id: string) {
    if (revealRef.current.frame) cancelAnimationFrame(revealRef.current.frame);
    revealRef.current = freshReveal(id);
  }

  function pushReveal(token: string) {
    revealRef.current.target += token;
    if (!revealRef.current.frame) {
      revealRef.current.frame = requestAnimationFrame(() => pumpRef.current());
    }
  }

  useEffect(() => {
    if (question?.title) setSheetOpen(true);
    else setSheetOpen(false);
  }, [question?.number, question?.title]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void fetch(`/api/leetcode?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (response) => {
          if (response.status === 401) {
            window.location.href = "/";
            return;
          }
          const data = (await response.json().catch(() => ({}))) as {
            questions?: LeetCodeHit[];
            error?: string;
          };
          if (!response.ok) throw new Error(data.error || "Could not search LeetCode.");
          setHits(data.questions ?? []);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setHits([]);
          setSearchError(cause instanceof Error ? cause.message : "Could not search LeetCode.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !stickRef.current) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, sending]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    stickRef.current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  }

  function startNew() {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setQuestion(null);
    setError(null);
    setNavOpen(false);
    inputRef.current?.focus();
  }

  async function openLesson(id: string) {
    if (sending || id === conversationId) {
      setNavOpen(false);
      return;
    }
    setOpening(true);
    setError(null);
    setNavOpen(false);
    setConversationId(id);
    setQuestion(null);
    setMessages([]);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!response.ok) throw new Error("Could not open that problem.");
      const data = (await response.json()) as {
        messages: ChatMessage[];
        question: QuestionSession | null;
      };
      setMessages(data.messages);
      setQuestion(data.question);
      stickRef.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open that problem.");
    } finally {
      setOpening(false);
    }
  }

  function askRemove(lesson: Lesson) {
    if (sending) return;
    setPendingDelete(lesson);
  }

  async function removeLesson(id: string) {
    if (sending) return;
    setPendingDelete(null);
    const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete that problem.");
      return;
    }
    void loadActivity();
    setLessons((current) => current.filter((lesson) => lesson.id !== id));
    if (conversationId === id) startNew();
  }

  function chooseProblem(hit: {
    number: string;
    title: string;
    titleSlug: string;
    difficulty?: string;
  }) {
    setQuery("");
    setHits([]);
    setQuestion({
      number: hit.number,
      title: hit.title,
      problem: "",
      statement: "",
      sheet: null,
      constraints: hit.difficulty ? [`Difficulty: ${hit.difficulty}`] : [],
      stage: "understand",
      known: [],
      idea: "",
      next: "",
    });
    void send(
      `Let's solve LeetCode ${hit.number}, ${hit.title}. Stay on this problem and ask me one question at a time until we have a working answer.`,
      hit.titleSlug,
    );
  }

  async function send(text: string, titleSlug?: string) {
    const draft = text.trim();
    if (!draft || sending) return;

    const priorId = conversationId;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: draft,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    setInput("");
    setError(null);
    setSending(true);
    stickRef.current = true;
    armReveal(assistantMessage.id);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let assistantText = "";
    let nextId = priorId;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: priorId,
          message: draft,
          ...(titleSlug && !priorId ? { titleSlug } : {}),
        }),
      });

      if (response.status === 401) {
        window.location.href = "/";
        return;
      }

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "master kael could not answer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            conversationId?: string;
            token?: string;
            session?: QuestionSession;
            error?: string;
            done?: boolean;
          };
          if (payload.conversationId) {
            nextId = payload.conversationId;
            setConversationId(payload.conversationId);
          }
          if (payload.session?.title || payload.session?.problem) {
            const session = payload.session;
            setQuestion(session);
            const title = lessonTitle(session, "Problem");
            setLessons((current) => {
              const id = nextId;
              if (!id) return current;
              if (current.some((lesson) => lesson.id === id)) {
                return current.map((lesson) => (lesson.id === id ? { ...lesson, title } : lesson));
              }
              return [{ id, title, updatedAt: new Date().toISOString() }, ...current];
            });
          }
          if (payload.token) {
            assistantText += payload.token;
            pushReveal(payload.token);
          }
          if (payload.error) throw new Error(payload.error);
        }
      }

      if (!assistantText.trim()) {
        throw new Error("master kael returned an empty reply.");
      }
      void loadList();
      void loadActivity();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "master kael could not answer.";
      if (!assistantText.trim()) {
        if (revealRef.current.frame) cancelAnimationFrame(revealRef.current.frame);
        revealRef.current = freshReveal();
        setMessages((current) =>
          current.filter(
            (item) => item.id !== userMessage.id && item.id !== assistantMessage.id,
          ),
        );
        setInput(draft);
        if (!priorId) {
          setConversationId(null);
          setQuestion(null);
        } else setConversationId(priorId);
      }
      setError(detail);
      if (nextId && assistantText.trim()) {
        void loadList();
        void loadActivity();
      }
    } finally {
      const state = revealRef.current;
      state.live = false;
      if (!state.id || state.shown.length >= state.target.length) settleReveal();
      else if (!state.frame) state.frame = requestAnimationFrame(() => pumpRef.current());
    }
  }

  const initial = (user.name || user.email || "P").slice(0, 1).toUpperCase();

  return (
    <div className={["app", navOpen ? "nav-open" : "", sheetOpen ? "sheet-open" : ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="scrim"
        aria-label="Close lessons"
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar">
        <div className="side-head">
          <a className="mark" href="/chat">
            <span className="blade" aria-hidden="true" />
            master kael
          </a>
          <button type="button" className="new-lesson" onClick={startNew}>
            New problem
          </button>
        </div>
        <div className="lessons">
          {lessons.length === 0 ? (
            <p className="empty-side">No problems yet.</p>
          ) : (
            groupLessons(lessons).map((group) => (
              <section key={group.label}>
                <h2>{group.label}</h2>
                <ul>
                  {group.items.map((lesson) => (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        className={lesson.id === conversationId ? "lesson active" : "lesson"}
                        onClick={() => void openLesson(lesson.id)}
                      >
                        {lesson.title}
                      </button>
                      <button
                        type="button"
                        className="trash"
                        aria-label={`Delete ${lesson.title}`}
                        onClick={() => askRemove(lesson)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <footer className="side-foot">
          <ActivityHeatmap
            days={activity ?? EMPTY_ACTIVITY}
            ready={activity !== null}
            failed={activityFailed}
          />
          <div className="side-foot-row">
            <div className="whoami">
              {user.image ? (
                <img src={user.image} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="avatar">{initial}</span>
              )}
              <div>
                <strong>{user.name || "Apprentice"}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <form action={logout}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </footer>
      </aside>

      <main className="stage">
        <header className="stage-bar">
          <button
            type="button"
            className="menu"
            aria-label="Open problems"
            onClick={() => {
              setSheetOpen(false);
              setNavOpen(true);
            }}
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <p className="eyebrow">
              {question ? STAGE_LABEL[question.stage] : "The archive"}
            </p>
            <h1>
              {question?.title
                ? lessonTitle(question)
                : "master kael"}
            </h1>
          </div>
        </header>

        {question && hasDossier(question) ? <QuestionDossier question={question} /> : null}

        <div className="log" ref={scrollerRef} onScroll={onScroll}>
          {opening ? <p className="status">Opening the problem…</p> : null}
          {!opening && messages.length === 0 ? (
            <div className="empty">
              <p className="eyebrow">One problem at a time</p>
              <h2>Search a LeetCode number. We will talk that problem through until you have the answer.</h2>
              <p>
                Each problem keeps its own conversation: the statement, what you have
                already established, and the question still in front of you.
              </p>
              <form
                className="finder"
                onSubmit={(event) => {
                  event.preventDefault();
                  const exact = hits.find((hit) => hit.number === query.trim());
                  const pick = exact ?? (hits.length === 1 ? hits[0] : undefined);
                  if (pick) chooseProblem(pick);
                }}
              >
                <label htmlFor="leetcode-number">LeetCode number</label>
                <input
                  id="leetcode-number"
                  value={query}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="15"
                  disabled={sending}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </form>
              {searching ? <p className="status">Searching…</p> : null}
              {searchError ? <p className="error">{searchError}</p> : null}
              {query.trim() && !searching && !searchError && hits.length === 0 ? (
                <p className="status">No LeetCode problem matches that.</p>
              ) : null}
              {hits.length > 0 ? (
                <div className="starters">
                  {hits.map((hit) => (
                    <button
                      key={hit.titleSlug}
                      type="button"
                      onClick={() => chooseProblem(hit)}
                      disabled={sending}
                    >
                      <span>{hit.number}</span>
                      <strong>{hit.title}</strong>
                      <em>{hit.difficulty || "Open this problem"}</em>
                    </button>
                  ))}
                </div>
              ) : query.trim() ? null : (
                <div className="starters">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter.titleSlug}
                      type="button"
                      onClick={() => chooseProblem(starter)}
                      disabled={sending}
                    >
                      <span>{starter.number}</span>
                      <strong>{starter.title}</strong>
                      <em>Open this problem</em>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {messages.map((message, index) => {
            const streaming =
              sending &&
              message.role === "assistant" &&
              index === messages.length - 1;
            return (
              <article
                key={message.id}
                className={message.role === "user" ? "turn user" : "turn master"}
              >
                <p className="who">
                  {message.role === "user" ? user.name || "You" : "master kael"}
                </p>
                {message.content ? (
                  <MessageBody text={message.content} streaming={streaming} />
                ) : streaming ? (
                  <p className="waiting">Considering the problem…</p>
                ) : null}
              </article>
            );
          })}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          {error ? <p className="error">{error}</p> : null}
          <label className="sr-only" htmlFor="prompt">
            Message master kael
          </label>
          <textarea
            id="prompt"
            ref={inputRef}
            rows={3}
            value={input}
            placeholder={
              question
                ? "Answer master kael, or ask for the other approaches"
                : "Name a LeetCode problem to start"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <div className="composer-row">
            <p>Enter to send · Shift+Enter for a new line</p>
            <button type="submit" className="send" disabled={sending || !input.trim()}>
              {sending ? "Listening" : question ? "Reply" : "Start"}
            </button>
          </div>
        </form>
      </main>
      {pendingDelete ? (
        <ConfirmModal
          title="Delete this problem?"
          body={`${pendingDelete.title} will leave your lessons. The conversation goes with it.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeLesson(pendingDelete.id)}
        />
      ) : null}
      <ProblemDock
        question={question}
        open={sheetOpen}
        onToggle={() => {
          if (!question?.title) return;
          setNavOpen(false);
          setSheetOpen((current) => !current);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

function hasDossier(question: QuestionSession) {
  return Boolean(
    question.problem ||
      question.constraints.length ||
      question.idea ||
      question.known.length ||
      (question.stage !== "solved" && question.next),
  );
}

function QuestionDossier({ question }: { question: QuestionSession }) {
  return (
    <section className="dossier" aria-label="Problem session">
      {question.stage !== "solved" && question.next ? (
        <p className="next">
          <span>Still to answer</span>
          {question.next}
        </p>
      ) : null}
      {question.problem ? (
        <p className="problem">{question.problem}</p>
      ) : null}
      {question.constraints.length > 0 ? (
        <p className="constraints">{question.constraints.join(" · ")}</p>
      ) : null}
      {question.idea ? (
        <p className="idea">
          <span>Current idea</span>
          {question.idea}
        </p>
      ) : null}
      {question.known.length > 0 ? (
        <>
          <p className="kicker">Established</p>
          <ul>
            {question.known.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
