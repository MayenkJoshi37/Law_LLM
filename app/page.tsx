"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ChatTurn, LegalSource, QueryPlan, SessionDocument } from "@/lib/types";

type Message = ChatTurn & {
  id: string;
  sources?: LegalSource[];
  streaming?: boolean;
  error?: boolean;
};

type UploadStatus = "idle" | "uploading" | "error";

const starterQuestions = [
  "What does this agreement say about termination?",
  "Identify the notice period and any exceptions.",
  "Summarize the remedies described in these materials.",
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<string, React.ReactNode> = {
    spark: <><path d="m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3Z" /><path d="m19 16-.65 2.35L16 19l2.35.65L19 22l.65-2.35L22 19l-2.35-.65L19 16Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    file: <><path d="M14 2.75H6.5A2.5 2.5 0 0 0 4 5.25v13.5a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5V8.75L14 2.75Z" /><path d="M14 2.75v6h6M8 13h8M8 16.5h5" /></>,
    paperclip: <><path d="m20.5 11.5-8.1 8.1a5 5 0 0 1-7.1-7.1l8.1-8.1a3.5 3.5 0 0 1 5 5L10 17.6a2 2 0 1 1-2.8-2.8l7.55-7.55" /></>,
    send: <><path d="m21 3-7.1 18-3.9-7-7-3.9L21 3Z" /><path d="m10 14 4-4" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 3 8.8 7 10 4-1.2 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l.7 13h10.6L18 7" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    stop: <rect x="7" y="7" width="10" height="10" rx="1" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v5M12 7h.01" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function uniqueSources(documents: SessionDocument[]) {
  return [...new Set(documents.map((document) => document.source))];
}

function InlineText({ value, onCitation }: { value: string; onCitation: (id: string) => void }) {
  const parts = value.split(/(\[S\d+\]|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        const citation = part.match(/^\[(S\d+)\]$/);
        if (citation) {
          return <button className="inline-citation" onClick={() => onCitation(citation[1])} key={`${part}-${index}`}>{citation[1]}</button>;
        }
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function AnswerText({ value, onCitation }: { value: string; onCitation: (id: string) => void }) {
  return (
    <div className="answer-copy">
      {value.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div className="copy-gap" key={`gap-${index}`} />;
        if (/^#{1,3}\s/.test(trimmed)) return <h3 key={index}><InlineText value={trimmed.replace(/^#{1,3}\s/, "")} onCitation={onCitation} /></h3>;
        if (/^[-*]\s+/.test(trimmed)) return <div className="copy-bullet" key={index}><span>•</span><p><InlineText value={trimmed.replace(/^[-*]\s+/, "")} onCitation={onCitation} /></p></div>;
        if (/^\d+[.)]\s+/.test(trimmed)) return <div className="copy-bullet" key={index}><span>{trimmed.match(/^\d+/)?.[0]}.</span><p><InlineText value={trimmed.replace(/^\d+[.)]\s+/, "")} onCitation={onCitation} /></p></div>;
        return <p key={index}><InlineText value={trimmed} onCitation={onCitation} /></p>;
      })}
    </div>
  );
}

function SourceCard({ source, onSelect, compact = false }: { source: LegalSource; onSelect: () => void; compact?: boolean }) {
  return (
    <button className={`source-card ${compact ? "source-card-compact" : ""}`} onClick={onSelect}>
      <span className="source-index">{source.id}</span>
      <span className="source-card-body">
        <span className="source-card-title">{source.title}</span>
        <span className="source-card-meta">{[source.section, source.page ? `p. ${source.page}` : null].filter(Boolean).join(" · ") || "Uploaded source"}</span>
        {!compact && <span className="source-card-excerpt">{source.excerpt}</span>}
      </span>
      <span className="source-card-arrow"><Icon name="chevron" size={15} /></span>
    </button>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<SessionDocument[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState("");
  const [selectedSource, setSelectedSource] = useState<LegalSource | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [planLabel, setPlanLabel] = useState("Ready to research");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const documentNames = useMemo(() => uniqueSources(documents), [documents]);
  const allSources = useMemo(
    () => messages.flatMap((message) => message.sources || []),
    [messages],
  );

  useEffect(() => {
    const existing = sessionStorage.getItem("lexora-session-id");
    const id = existing || crypto.randomUUID();
    sessionStorage.setItem("lexora-session-id", id);
    setSessionId(id);
    try {
      const stored = sessionStorage.getItem("lexora-session-documents");
      if (stored) setDocuments(JSON.parse(stored));
    } catch {
      sessionStorage.removeItem("lexora-session-documents");
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    try {
      sessionStorage.setItem("lexora-session-documents", JSON.stringify(documents));
    } catch {
      // The UI remains functional if the browser declines session storage for a large document set.
    }
  }, [documents, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth", block: "end" });
  }, [messages, isStreaming]);

  function resizeComposer(target: HTMLTextAreaElement) {
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 168)}px`;
  }

  function updateDraft(value: string) {
    setDraft(value);
    requestAnimationFrame(() => composerRef.current && resizeComposer(composerRef.current));
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || uploadStatus === "uploading") return;
    setUploadStatus("uploading");
    setUploadError("");
    const formData = new FormData();
    [...files].forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not process those documents.");
      setDocuments((current) => [...current, ...body.documents].slice(0, 60));
      setUploadStatus("idle");
    } catch (error) {
      setUploadStatus("error");
      setUploadError(error instanceof Error ? error.message : "Could not process those documents.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(event.target.files);
  }

  function chooseStarter(question: string) {
    updateDraft(question);
    composerRef.current?.focus();
  }

  function resetResearch() {
    abortRef.current?.abort();
    setMessages([]);
    setDocuments([]);
    setDraft("");
    setSelectedSource(null);
    setIsStreaming(false);
    setPlanLabel("Ready to research");
    const id = crypto.randomUUID();
    sessionStorage.setItem("lexora-session-id", id);
    sessionStorage.removeItem("lexora-session-documents");
    setSessionId(id);
    setMobileMenuOpen(false);
  }

  function addAssistantText(id: string, text: string) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, content: message.content + text } : message));
  }

  function updateAssistant(id: string, update: Partial<Message>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...update } : message));
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: message };
    const assistantId = crypto.randomUUID();
    const priorHistory = messages
      .filter((item) => !item.streaming && item.content)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setDraft("");
    if (composerRef.current) composerRef.current.style.height = "auto";
    setIsStreaming(true);
    setPlanLabel("Reviewing your question");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: priorHistory, documents, sessionId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "The research service did not respond.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (!completed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const block of events) {
          const eventName = block.match(/^event:\s*(.+)$/m)?.[1];
          const rawData = block.match(/^data:\s*(.+)$/m)?.[1];
          if (!eventName || !rawData) continue;
          const payload = JSON.parse(rawData) as { text?: string; message?: string; sources?: LegalSource[]; plan?: QueryPlan };
          if (eventName === "sources") {
            updateAssistant(assistantId, { sources: payload.sources || [] });
            setPlanLabel(payload.sources?.length ? `${payload.sources.length} sources retrieved` : "No matching sources found");
          }
          if (eventName === "token" && payload.text) addAssistantText(assistantId, payload.text);
          if (eventName === "error") throw new Error(payload.message || "Research could not be completed.");
          if (eventName === "done") completed = true;
        }
      }
      updateAssistant(assistantId, { streaming: false });
    } catch (error) {
      if (controller.signal.aborted) {
        updateAssistant(assistantId, { streaming: false, content: "Response stopped." });
      } else {
        updateAssistant(assistantId, {
          streaming: false,
          error: true,
          content: error instanceof Error ? error.message : "Research could not be completed.",
        });
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setPlanLabel("Ready to research");
    }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function showSource(source: LegalSource) {
    setSelectedSource(source);
    setSourceDrawerOpen(true);
  }

  return (
    <main className="app-shell">
      <aside className={`navigation ${mobileMenuOpen ? "navigation-open" : ""}`}>
        <div className="nav-brand">
          <div className="brand-mark"><Icon name="spark" size={19} /></div>
          <span>lexora</span>
          <button className="mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><Icon name="x" /></button>
        </div>
        <button className="new-research" onClick={resetResearch}><Icon name="plus" size={17} /><span>New research</span><kbd>⌘ K</kbd></button>

        <div className="nav-section">
          <p className="nav-label">This session</p>
          <div className="session-card">
            <span className="session-icon"><Icon name="shield" size={16} /></span>
            <div><strong>Private workspace</strong><small>Not retained after session</small></div>
          </div>
        </div>

        <div className="nav-section source-library">
          <div className="nav-label-row"><p className="nav-label">Source materials</p><span>{documentNames.length}</span></div>
          {uploadStatus === "uploading" && <div className="source-loading"><span className="mini-spinner" /> Processing materials</div>}
          {!documentNames.length && uploadStatus !== "uploading" && <p className="empty-sources">Attach statutes, agreements, notices, or case extracts to ground your research.</p>}
          {documentNames.map((name) => <div className="source-library-item" key={name}><Icon name="file" size={15} /><span title={name}>{name}</span></div>)}
          {uploadError && <p className="upload-error">{uploadError}</p>}
        </div>

        <div className="nav-bottom">
          <div className="notice-compact"><Icon name="info" size={15} /><span>Informational research, not legal advice.</span></div>
          <button className="clear-session" onClick={resetResearch}><Icon name="trash" size={15} /> Clear session</button>
        </div>
      </aside>
      {mobileMenuOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}

      <section className="workspace">
        <header className="workspace-header">
          <button className="menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="header-title"><span className="status-dot" /> <span>{planLabel}</span></div>
          <div className="header-actions">
            <span className="session-badge"><Icon name="shield" size={14} /> Session-only</span>
            <button className="evidence-button" onClick={() => setSourceDrawerOpen(true)}><Icon name="search" size={16} /> Evidence <span>{allSources.length || "–"}</span></button>
          </div>
        </header>

        <div className="conversation-area">
          {!messages.length ? (
            <section className="welcome-state">
              <div className="eyebrow"><span /> Source-grounded legal research</div>
              <h1>Legal clarity,<br /><em>without the fog.</em></h1>
              <p>Ask a question, add source material, and follow each answer back to the evidence. Lexora helps you examine legal text — it does not replace professional counsel.</p>
              <div className="welcome-actions">
                <button className="primary-action" onClick={() => fileInputRef.current?.click()}><Icon name="paperclip" size={17} /> Add source material</button>
                <button className="text-action" onClick={() => composerRef.current?.focus()}>Ask without documents <Icon name="arrow" size={16} /></button>
              </div>
              <div className="starter-grid">
                {starterQuestions.map((question, index) => <button className="starter-card" key={question} onClick={() => chooseStarter(question)}><span>0{index + 1}</span><p>{question}</p><Icon name="arrow" size={16} /></button>)}
              </div>
            </section>
          ) : (
            <section className="message-thread" aria-live="polite">
              {messages.map((message, messageIndex) => (
                <article className={`message ${message.role === "user" ? "message-user" : "message-assistant"}`} key={message.id}>
                  {message.role === "assistant" && <div className="assistant-avatar"><Icon name="spark" size={15} /></div>}
                  <div className="message-content">
                    <div className="message-label">{message.role === "user" ? "You" : "Lexora"}{message.streaming && <span className="streaming-label"><i /> Analysing</span>}</div>
                    {message.role === "user" ? <p className="user-copy">{message.content}</p> : (
                      <>
                        {message.content ? <AnswerText value={message.content} onCitation={(id) => {
                          const source = message.sources?.find((item) => item.id === id) || allSources.find((item) => item.id === id);
                          if (source) showSource(source);
                        }} /> : <div className="thinking"><span /><span /><span /></div>}
                        {message.sources && message.sources.length > 0 && !message.streaming && <div className="answer-sources"><p><Icon name="file" size={14} /> Referenced materials</p><div>{message.sources.map((source) => <SourceCard source={source} compact onSelect={() => showSource(source)} key={source.id} />)}</div></div>}
                        {message.error && <button className="retry-button" onClick={() => {
                          const previousQuestion = messages
                            .slice(0, messageIndex)
                            .reverse()
                            .find((item) => item.role === "user")?.content;
                          if (previousQuestion) chooseStarter(previousQuestion);
                        }}><Icon name="arrow" size={15} /> Try again</button>}
                      </>
                    )}
                  </div>
                </article>
              ))}
              <div ref={bottomRef} />
            </section>
          )}
        </div>

        <div className="composer-wrap">
          <form className={`composer ${isStreaming ? "composer-busy" : ""}`} onSubmit={sendMessage}>
            <input ref={fileInputRef} className="visually-hidden" id="source-upload" type="file" multiple accept=".pdf,.txt,.md,text/plain,application/pdf,text/markdown" onChange={onFileChange} />
            <button type="button" className="attach-button" onClick={() => fileInputRef.current?.click()} disabled={uploadStatus === "uploading"} aria-label="Attach sources"><Icon name="paperclip" size={19} /></button>
            <textarea ref={composerRef} value={draft} onChange={(event) => updateDraft(event.target.value)} onKeyDown={keyDown} placeholder="Ask about your legal materials…" rows={1} aria-label="Your legal research question" />
            {isStreaming ? <button type="button" className="stop-button" onClick={() => abortRef.current?.abort()} aria-label="Stop generating"><Icon name="stop" size={16} /></button> : <button type="submit" className="send-button" disabled={!draft.trim()} aria-label="Send question"><Icon name="send" size={17} /></button>}
          </form>
          <div className="composer-meta"><span><Icon name="shield" size={13} /> Informational assistance only — not a substitute for a qualified lawyer.</span><span className="desktop-only"><kbd>Enter</kbd> to send · <kbd>Shift Enter</kbd> for a new line</span></div>
        </div>
      </section>

      <aside className={`evidence-panel ${sourceDrawerOpen ? "evidence-panel-open" : ""}`}>
        <div className="evidence-head"><div><p className="panel-kicker">Traceability</p><h2>Evidence</h2></div><button onClick={() => setSourceDrawerOpen(false)} aria-label="Close evidence"><Icon name="x" size={18} /></button></div>
        {selectedSource ? (
          <div className="source-detail">
            <span className="detail-citation">{selectedSource.id}</span>
            <h3>{selectedSource.title}</h3>
            <p className="detail-meta">{[selectedSource.section, selectedSource.page ? `Page ${selectedSource.page}` : null].filter(Boolean).join(" · ") || "Uploaded material"}</p>
            <div className="detail-rule" />
            <p className="detail-excerpt">{selectedSource.excerpt}</p>
            <button className="back-to-sources" onClick={() => setSelectedSource(null)}>← All retrieved materials</button>
          </div>
        ) : allSources.length ? (
          <div className="evidence-list"><p className="evidence-intro">Select a reference to inspect the text used in this conversation.</p>{allSources.map((source, index) => <SourceCard source={source} onSelect={() => setSelectedSource(source)} key={`${source.id}-${index}`} />)}</div>
        ) : (
          <div className="evidence-empty"><div className="evidence-empty-icon"><Icon name="search" size={20} /></div><h3>Evidence will appear here</h3><p>Attach legal materials and ask a focused question. Sources used in an answer will be shown here.</p></div>
        )}
        <div className="evidence-foot"><Icon name="info" size={14} /><span>References show retrieved excerpts, not a complete legal record.</span></div>
      </aside>
      {sourceDrawerOpen && <button className="evidence-backdrop" onClick={() => setSourceDrawerOpen(false)} aria-label="Close evidence" />}
    </main>
  );
}
