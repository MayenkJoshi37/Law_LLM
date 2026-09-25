# Lexora — source-grounded legal research

Lexora is a lightweight legal research workspace for asking better questions of statutes, agreements, notices, policies, and case extracts. It is deliberately designed as a **source-first** assistant: uploaded material is retrieved before an answer is generated, and every source-backed proposition should be traceable to a displayed reference.

> **Important:** Lexora provides general informational research assistance, not legal advice. It does not create a lawyer-client relationship and is not a substitute for a qualified lawyer. Always verify current law, jurisdiction, effective dates, and the complete underlying record with a legal professional.

## What changed

The original Flask/Ollama/Chroma demo has been replaced with a Vercel-ready Next.js application:

- Premium, responsive legal-tech chat UI with welcome state, attachment flow, evidence panel, mobile navigation, and subtle motion.
- Streaming chat responses over a standard Server-Sent Events response.
- LangGraph for the deterministic **intake → retrieval** workflow.
- LangChain for OpenAI chat/embedding models, PDF ingestion, text splitting, prompt construction, and in-memory vector retrieval.
- Conversation-aware query planning: recent turns help resolve follow-up questions before retrieval.
- Evidence cards and inline `[S1]` references that reveal the retrieved excerpt, document title, and page where available.
- Explicit abstention for unsupported legal conclusions, unrelated requests, and urgent safety situations.
- No database, authentication, user accounts, durable document store, or background infrastructure.

## Architecture

```text
Browser session
  ├─ uploads PDF / TXT / MD → /api/documents
  │    └─ LangChain PDF loader + recursive splitter → session chunks
  └─ question + recent turns + session chunks → /api/chat (SSE)
       └─ LangGraph: understand query → retrieve evidence
            ├─ ChatOpenAI structured query plan
            └─ MemoryVectorStore + OpenAI embeddings
       └─ ChatOpenAI answer stream → tokens + [S1] source metadata
```

There is no persistent vector store by design. The browser keeps the current session's chunks in `sessionStorage`; the server keeps only a small, best-effort in-memory vector cache to accelerate repeat questions in a warm function. That cache expires after 30 minutes and Vercel may discard it at any time. When it does, the chat route rebuilds the index from the session chunks supplied by the browser. Do not treat the app as long-term document storage.

## Local setup

**Prerequisites:** Node.js 20.9+, pnpm 11+, and an OpenAI API key with access to the chat and embeddings APIs.

```bash
git clone https://github.com/MayenkJoshi37/Law_LLM.git
cd Law_LLM
pnpm install
Copy-Item .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`, then start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Before pushing changes, use:

```bash
pnpm typecheck
pnpm build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Used only on the server for LangChain chat and embedding calls. Never expose this as `NEXT_PUBLIC_*`. |
| `OPENAI_MODEL` | No | Chat model; defaults to `gpt-4o-mini`. |
| `LANGSMITH_TRACING` | No | Set to `true` to enable optional LangSmith tracing. |
| `LANGSMITH_API_KEY` | With tracing | LangSmith API key. |
| `LANGSMITH_PROJECT` | No | Trace project name; defaults to the LangSmith SDK default. |

## Vercel deployment

1. Push this repository to GitHub and import it in Vercel (the detected framework is Next.js).
2. Add `OPENAI_API_KEY` in **Project Settings → Environment Variables** for Preview and Production.
3. Optionally add `OPENAI_MODEL` and LangSmith variables.
4. Deploy. Vercel detects `pnpm-lock.yaml` and runs the `build` script automatically.

The API routes explicitly use the Node.js runtime and configure a 60-second function duration for document parsing and streamed answers. No writable local filesystem, database, or process-local persistence is required for a correct request.

## Product behavior and guardrails

- PDFs, Markdown, and plain text files are accepted; scanned PDFs without an embedded text layer are rejected with a useful message.
- The app limits an upload to five files at 8 MB each and keeps a bounded number of text chunks to stay responsive in a serverless environment.
- The intake stage labels question type, rewrites a retrieval query, resolves follow-ups from recent context, and identifies missing jurisdiction or facts.
- The answer prompt requires citations for material legal claims, refuses to invent citations, distinguishes source text from general application, and explicitly names uncertainty or missing evidence.
- Without sources, the assistant asks for materials rather than giving a purportedly source-grounded conclusion.
- Neither the client nor server writes chat logs, uploaded documents, or embeddings to a database.

## Repository map

```text
app/
  api/chat/route.ts       # SSE endpoint: graph orchestration, retrieval, answer stream
  api/documents/route.ts  # PDF/TXT/MD parsing and chunking
  globals.css             # Responsive visual system and motion
  page.tsx                # Product UI and streaming client
lib/
  legal-rag.ts            # LangGraph workflow and ephemeral vector cache
  prompts.ts              # Query/answer guardrails
  types.ts                # Shared research contracts
.env.example              # Required and optional runtime variables
vercel.json               # Vercel framework configuration
```
