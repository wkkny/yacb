"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  thinking?: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string; detail?: string };
    return data.detail || data.error || response.statusText;
  } catch {
    return response.statusText || "Request failed";
  }
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("Checking LM Studio…");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        const data = (await response.json()) as {
          models?: string[];
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setStatus(data.error ?? "LM Studio unavailable");
          setModels([]);
          return;
        }

        const nextModels = data.models ?? [];
        setModels(nextModels);
        setModel((current) => current || nextModels[0] || "");
        setStatus(
          nextModels.length > 0
            ? "Ready"
            : "LM Studio is up, but no model is loaded",
        );
      } catch {
        if (!cancelled) {
          setStatus("Could not reach the YACB server");
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    const content = input.trim();
    if (!content || isStreaming) return;

    if (!model) {
      setError("Load a model in LM Studio, then refresh.");
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content,
    };
    const assistantId = createId();
    const history = [...messages, userMessage];

    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "", thinking: "" },
    ]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: history.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await readErrorMessage(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let thinkingText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n");
        buffer = chunks.pop() ?? "";

        for (const line of chunks) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  reasoning?: string;
                };
              }>;
            };
            const delta = parsed.choices?.[0]?.delta;
            const reasoning =
              delta?.reasoning_content ?? delta?.reasoning ?? "";
            const contentDelta = delta?.content ?? "";

            if (reasoning) {
              thinkingText += reasoning;
            }
            if (contentDelta) {
              assistantText += contentDelta;
            }
            if (!reasoning && !contentDelta) continue;

            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: assistantText,
                      thinking: thinkingText,
                    }
                  : message,
              ),
            );
          } catch {
            // Ignore malformed SSE chunks.
          }
        }
      }

      if (!assistantText.trim()) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: "(No response from model)" }
              : message,
          ),
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setMessages((current) =>
        current.filter(
          (item) => item.id !== assistantId || item.content.trim().length > 0,
        ),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  const isEmpty = messages.length === 0;

  const composer = (
    <form
      onSubmit={sendMessage}
      className={isEmpty ? "w-full" : "sticky bottom-0 bg-white py-4"}
    >
      {error ? (
        <p className="mb-3 border border-black/20 bg-black/[0.03] px-3 py-2 text-sm text-black">
          {error}
        </p>
      ) : null}
      <div className="rounded-2xl border border-[var(--line)] bg-white p-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={onKeyDown}
          placeholder="Message YACB…"
          disabled={isStreaming}
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 text-black outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-1">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Model</span>
            <select
              className="max-w-full truncate bg-transparent text-xs text-[var(--muted)] outline-none focus:text-black disabled:opacity-50"
              value={model}
              title={status}
              onChange={(event) => setModel(event.target.value)}
              disabled={models.length === 0 || isStreaming}
            >
              {models.length === 0 ? (
                <option value="">No model loaded</option>
              ) : (
                models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="submit"
            disabled={isStreaming || !input.trim() || !model}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition enabled:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <p
        aria-label="YACB"
        className="pointer-events-none fixed top-5 left-5 z-20 font-[family-name:var(--font-display)] text-2xl tracking-tight text-black sm:top-6 sm:left-8 sm:text-3xl"
      >
        YACB
      </p>

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-1">
            <p className="text-sm text-[var(--muted)]">
              {status === "Ready" ? "What do you want to talk about?" : status}
            </p>
            {composer}
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pt-16 pb-4 sm:pt-20">
              {messages.map((message) => {
                const isLiveAssistant =
                  isStreaming &&
                  message.role === "assistant" &&
                  message.id === messages[messages.length - 1]?.id;
                const waitingForReply =
                  isLiveAssistant && !message.content.trim();

                return (
                  <article
                    key={message.id}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl bg-[var(--user-bubble)] px-4 py-3 text-black"
                        : "mr-auto max-w-[90%] px-1 py-1 text-black"
                    }
                  >
                    <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {message.role === "user" ? "You" : "Assistant"}
                    </p>
                    {waitingForReply ? (
                      <p className="text-xs leading-5 text-[var(--muted)] italic">
                        {message.thinking?.trim()
                          ? message.thinking
                          : "Thinking…"}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-7">
                        {message.content}
                        {isLiveAssistant && (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-black align-middle" />
                        )}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            {composer}
          </>
        )}
      </main>
    </div>
  );
}
