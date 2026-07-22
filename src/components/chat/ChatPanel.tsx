"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, ExternalLink, LoaderCircle, RotateCcw, Sparkles, User } from "lucide-react";
import { respond, type ChatReply } from "@/src/lib/chatbot/engine";
import { AssistantModel } from "@/src/lib/chatbot/model";
import { formatFa } from "@/src/lib/chatbot/persian";
import type { Answer } from "@/src/lib/chatbot/skills";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: ChatReply };

const starters = [
  "برای ۱۶ دوربین ۴ مگاپیکسل و ۳۰ روز آرشیو چقدر هارد لازم است؟",
  "لنز مناسب برای شناسایی چهره در ۲۵ متری چیست؟",
  "فرق H.264 و H.265 چیست؟",
  "بودجه PoE برای ۱۲ دوربین چقدر باشد؟",
  "برای مغازه چه سیستمی پیشنهاد می‌دهی؟"
];

const greeting: Answer = {
  source: "system",
  title: "سلام 👋",
  lines: [
    "من دستیار فنی همیار دوربین هستم.",
    "",
    "درباره انتخاب دوربین، محاسبات پروژه و مشخصات فنی بپرسید. اگر عدد و واحد را در جمله بیاورید، مستقیم محاسبه می‌کنم."
  ]
};

let messageCounter = 0;
const nextId = () => `m${(messageCounter += 1)}`;

const welcomeMessage = (): Message => ({
  id: nextId(),
  role: "assistant",
  reply: {
    answer: greeting,
    intent: "greeting",
    confidence: 1,
    reasoning: { intents: [], articles: [], modelReady: false, slots: [] }
  }
});

export function ChatPanel({ variant }: { variant: "floating" | "page" }) {
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage()]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    AssistantModel.getInstance().start();
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, pending]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    setMessages((current) => [...current, { id: nextId(), role: "user", text: trimmed }]);
    setPending(true);
    try {
      const reply = await respond(trimmed);
      setMessages((current) => [...current, { id: nextId(), role: "assistant", reply }]);
    } finally {
      setPending(false);
    }
  }, [pending]);

  const reset = useCallback(() => {
    setMessages([welcomeMessage()]);
    inputRef.current?.focus();
  }, []);

  const showStarters = messages.length === 1;

  return (
    <div className={`chat-panel chat-panel-${variant}`}>
      {variant === "page" ? (
        <div className="chat-toolbar">
          <span className="chat-toolbar-title">
            <Sparkles size={15} aria-hidden="true" />
            دستیار فنی
          </span>
          <button type="button" onClick={reset} aria-label="گفت‌وگوی جدید" title="گفت‌وگوی جدید">
            <RotateCcw size={15} aria-hidden="true" />
            <span>گفت‌وگوی جدید</span>
          </button>
        </div>
      ) : null}

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((message) =>
          message.role === "user" ? (
            <div className="chat-row chat-row-user" key={message.id}>
              <div className="chat-bubble chat-bubble-user">{message.text}</div>
              <span className="chat-avatar chat-avatar-user"><User size={15} aria-hidden="true" /></span>
            </div>
          ) : (
            <div className="chat-row chat-row-assistant" key={message.id}>
              <span className="chat-avatar chat-avatar-bot"><Sparkles size={15} aria-hidden="true" /></span>
              <AnswerCard reply={message.reply} onFollowUp={send} />
            </div>
          )
        )}

        {pending ? (
          <div className="chat-row chat-row-assistant">
            <span className="chat-avatar chat-avatar-bot"><Sparkles size={15} aria-hidden="true" /></span>
            <div className="chat-bubble chat-bubble-bot chat-thinking">
              <LoaderCircle size={16} className="is-spinning" aria-hidden="true" />
              <span>در حال بررسی...</span>
            </div>
          </div>
        ) : null}

        {showStarters ? (
          <div className="chat-starters">
            {starters.map((starter) => (
              <button type="button" key={starter} onClick={() => send(starter)}>{starter}</button>
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          placeholder="سوالتان را بنویسید..."
          aria-label="پیام شما"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" disabled={pending || !input.trim()} aria-label="ارسال پیام">
          <CornerDownLeft size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function AnswerCard({ reply, onFollowUp }: { reply: ChatReply; onFollowUp: (text: string) => void }) {
  const { answer } = reply;
  const href = useMemo(() => toolHref(answer.tool?.slug), [answer.tool?.slug]);

  return (
    <div className="chat-bubble chat-bubble-bot">
      <div className="chat-answer-head">
        <strong>{answer.title}</strong>
        <span className={`chat-source chat-source-${answer.source}`}>{sourceLabel(answer.source)}</span>
      </div>

      <div className="chat-answer-body">
        {answer.lines.map((line, index) => <RichLine key={index} line={line} />)}
      </div>

      {answer.assumptions?.length ? (
        <details className="chat-assumptions">
          <summary>فرض‌ها و مبانی محاسبه ({formatFa(answer.assumptions.length)})</summary>
          <ul>{answer.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </details>
      ) : null}

      {href && answer.tool ? (
        <Link className="chat-tool-link" href={href}>
          <ExternalLink size={14} aria-hidden="true" />
          <span>{answer.tool.label}</span>
        </Link>
      ) : null}

      {answer.followUps?.length ? (
        <div className="chat-followups">
          {answer.followUps.map((item) => (
            <button type="button" key={item} onClick={() => onFollowUp(item)}>{item}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Minimal inline formatting: `**bold**`, bullet lines and `---` separators. */
function RichLine({ line }: { line: string }) {
  if (line === "") return <div className="chat-spacer" />;
  if (line === "---") return <hr />;

  const segments = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p className={line.startsWith("•") ? "chat-line chat-line-bullet" : "chat-line"}>
      {segments.map((segment, index) =>
        segment.startsWith("**") && segment.endsWith("**") ? (
          <strong key={index}>{segment.slice(2, -2)}</strong>
        ) : (
          <Fragment key={index}>{segment}</Fragment>
        )
      )}
    </p>
  );
}

function toolHref(slug?: string) {
  if (!slug) return null;
  if (slug === "__catalog__") return "/catalog";
  if (slug === "__planner__") return "/planner";
  if (slug === "__contacts__") return "/contacts";
  if (slug === "__login__") return "/login";
  return `/calculators/${slug}`;
}

function sourceLabel(source: Answer["source"]) {
  if (source === "calculation") return "محاسبه";
  if (source === "knowledge") return "راهنمای فنی";
  if (source === "catalog") return "کاتالوگ";
  return "دستیار";
}
