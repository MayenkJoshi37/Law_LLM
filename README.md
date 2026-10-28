# Kaisan Legal

Kaisan Legal is a lightweight, source-grounded legal research workspace. Upload legal materials, connect your own LLM provider, and receive streamed answers that cite the retrieved text.

> Kaisan Legal provides informational research support only. It is not legal advice, does not create a lawyer-client relationship, and is not a substitute for a qualified lawyer.

## What it does

- Guides each new browser session through provider selection, API-key entry, model selection, connection verification, and the research workspace.
- Supports OpenAI, Google Gemini, Groq, Anthropic Claude, and OpenRouter. The exact selected provider and model are displayed before entering the workspace.
- Accepts PDF, TXT, and Markdown files (up to five files, 8 MB each), then uses LangChain loaders and splitting to prepare session-only chunks.
- Uses a LangGraph intake → retrieval workflow, a provider-neutral in-memory vector index, conversation context, and a streamed LangChain answer model.
- Shows retrieved material as source cards and inline `[S1]` citations. Prompts explicitly distinguish supplied material from general reasoning and require abstention when evidence is missing.

## Credential and data handling

This is a bring-your-own-key application. A provider key is held only in live React memory; it is not placed in `localStorage`, `sessionStorage`, a database, logs, source control, or Vercel environment variables. The browser sends it over HTTPS only to the request-scoped Vercel API call that invokes the selected provider. Reloading the page clears it.

Uploaded chunks live in browser `sessionStorage` for the active session. The server may maintain a small, expiring in-memory retrieval cache for warm requests; it is never required for correctness and is not durable storage.

## Local setup

Prerequisites: Node.js 20.9+ and pnpm 11+.

```bash
git clone https://github.com/MayenkJoshi37/Law_LLM.git
cd Law_LLM
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), select a provider, enter a key, confirm the model, verify the connection, and upload a text-based PDF, TXT, or Markdown file.

No provider key is required in `.env.local`. `.env.example` contains only optional tracing placeholders; do not add `NEXT_PUBLIC_*` provider secrets.

Before shipping changes:

```bash
pnpm typecheck
pnpm build
```

## Vercel deployment

1. Push the repository to GitHub and import it into Vercel as a Next.js project.
2. Use Node.js 20.9 or later (Vercel detects the lockfile and runs `pnpm build`).
3. Do **not** add end-user provider keys to Vercel environment variables. Each user configures their own provider at runtime.
4. Deploy. The document and chat routes use Vercel's Node.js runtime and stream standard SSE responses.

No database, authentication, filesystem persistence, or background worker is needed. Vercel's 60-second route duration is configured for parsing and streamed research answers.

## Architecture

```text
Landing → provider + key → model → verify → research workspace
Browser upload → /api/documents → LangChain PDF/text split → session chunks
Browser question + session connection → /api/chat (SSE)
  → LangGraph: understand question → retrieve evidence
  → selected LangChain provider model → streamed cited answer
```

## Repository map

```text
app/api/chat/route.ts                streamed research endpoint
app/api/documents/route.ts           PDF/TXT/MD processing
app/api/providers/verify/route.ts    request-scoped provider validation
components/onboarding.tsx            landing and setup flow
lib/providers.ts                     provider model factories and validation
lib/legal-rag.ts                     LangGraph workflow and retrieval cache
lib/prompts.ts                       legal guardrails
```
