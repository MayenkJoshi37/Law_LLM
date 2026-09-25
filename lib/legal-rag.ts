import { Document } from "@langchain/core/documents";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { z } from "zod";
import { answerPrompt, QUERY_UNDERSTANDING_PROMPT } from "./prompts";
import type { ChatTurn, LegalSource, QueryPlan, SessionDocument } from "./types";

const MAX_DOCUMENTS = 60;
const MAX_DOCUMENT_TEXT = 1_500_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 16;

const queryPlanSchema = z.object({
  intent: z.enum([
    "legal_research",
    "document_review",
    "legal_process",
    "general_conversation",
    "unrelated",
    "urgent_safety",
  ]),
  searchQuery: z.string().min(1).max(500),
  shouldRetrieve: z.boolean(),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().max(240).nullable(),
  jurisdictionMentioned: z.string().max(80).nullable(),
  riskLevel: z.enum(["low", "standard", "high", "urgent"]),
});

type VectorCacheEntry = {
  fingerprint: string;
  store: MemoryVectorStore;
  touchedAt: number;
};

type RetrievedEvidence = {
  source: LegalSource;
  /** Kept server-side for answer generation; never sent to the browser. */
  content: string;
};

type LegalRagGlobal = typeof globalThis & {
  __lexoraVectorCache?: Map<string, VectorCacheEntry>;
};

function vectorCache() {
  const target = globalThis as LegalRagGlobal;
  target.__lexoraVectorCache ??= new Map();
  return target.__lexoraVectorCache;
}

function configuredModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.15,
  });
}

function documentFingerprint(documents: SessionDocument[]) {
  return documents
    .map((document) => `${document.id}:${document.text.length}:${document.text.slice(0, 40)}`)
    .join("|");
}

function pruneCache(cache: Map<string, VectorCacheEntry>) {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.touchedAt > CACHE_TTL_MS) cache.delete(key);
  }

  if (cache.size <= CACHE_MAX_ENTRIES) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [key] of oldest.slice(0, cache.size - CACHE_MAX_ENTRIES)) cache.delete(key);
}

function asDocuments(chunks: SessionDocument[]) {
  return chunks.map(
    (chunk) =>
      new Document({
        pageContent: chunk.text,
        metadata: {
          chunkId: chunk.id,
          source: chunk.source,
          page: chunk.page,
          section: chunk.section,
        },
      }),
  );
}

async function getStore(sessionId: string, chunks: SessionDocument[]) {
  const cache = vectorCache();
  pruneCache(cache);
  const fingerprint = documentFingerprint(chunks);
  const existing = cache.get(sessionId);

  if (existing && existing.fingerprint === fingerprint) {
    existing.touchedAt = Date.now();
    return existing.store;
  }

  const store = await MemoryVectorStore.fromDocuments(
    asDocuments(chunks),
    new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY, model: "text-embedding-3-small" }),
  );

  cache.set(sessionId, { fingerprint, store, touchedAt: Date.now() });
  return store;
}

function sourceFromDocument(document: Document, score: number, index: number): RetrievedEvidence {
  const source = String(document.metadata.source || "Uploaded material");
  return {
    source: {
      id: `S${index + 1}`,
      title: source,
      excerpt: document.pageContent.replace(/\s+/g, " ").trim().slice(0, 360),
      relevance: Math.max(0, Math.min(1, score)),
      ...(typeof document.metadata.page === "number" ? { page: document.metadata.page } : {}),
      ...(typeof document.metadata.section === "string" ? { section: document.metadata.section } : {}),
    },
    content: document.pageContent,
  };
}

function sourceBlock(evidence: RetrievedEvidence) {
  const { source } = evidence;
  const location = [source.section, source.page ? `page ${source.page}` : null]
    .filter(Boolean)
    .join(" · ");
  return `[${source.id}] ${source.title}${location ? ` (${location})` : ""}\n${evidence.content}`;
}

function isSimpleConversation(question: string) {
  return /^(hi|hello|hey|thanks|thank you|what can you do)\b/i.test(question.trim());
}

const LegalState = Annotation.Root({
  question: Annotation<string>,
  history: Annotation<ChatTurn[]>,
  documents: Annotation<SessionDocument[]>,
  sessionId: Annotation<string>,
  plan: Annotation<QueryPlan>,
  evidence: Annotation<RetrievedEvidence[]>({ value: (_, next) => next, default: () => [] }),
});

async function understandQuestion(state: typeof LegalState.State) {
  if (isSimpleConversation(state.question)) {
    return {
      plan: {
        intent: "general_conversation",
        searchQuery: state.question,
        shouldRetrieve: false,
        needsClarification: false,
        clarificationQuestion: null,
        jurisdictionMentioned: null,
        riskLevel: "low",
      } satisfies QueryPlan,
    };
  }

  const history = state.history
    .slice(-6)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");
  const planner = configuredModel().withStructuredOutput(queryPlanSchema, { name: "legal_query_plan" });
  const plan = await planner.invoke([
    ["system", QUERY_UNDERSTANDING_PROMPT],
    [
      "human",
      `Recent conversation:\n${history || "(none)"}\n\nLatest message:\n${state.question}\n\nUploaded source count: ${state.documents.length}`,
    ],
  ]);
  return { plan };
}

async function retrieveEvidence(state: typeof LegalState.State) {
  if (!state.documents.length || !state.plan.shouldRetrieve) return { evidence: [] };
  const store = await getStore(state.sessionId, state.documents);
  const hits = await store.similaritySearchWithScore(state.plan.searchQuery, Math.min(6, state.documents.length));
  return { evidence: hits.map(([document, score], index) => sourceFromDocument(document, score, index)) };
}

function nextStep(state: typeof LegalState.State) {
  if (state.plan.shouldRetrieve && state.documents.length > 0) return "retrieve";
  return "finish";
}

const legalWorkflow = new StateGraph(LegalState)
  .addNode("understand", understandQuestion)
  .addNode("retrieve", retrieveEvidence)
  .addEdge(START, "understand")
  .addConditionalEdges("understand", nextStep, { retrieve: "retrieve", finish: END })
  .addEdge("retrieve", END)
  .compile();

export function normalizeDocuments(value: unknown): SessionDocument[] {
  if (!Array.isArray(value)) return [];
  const chunks: SessionDocument[] = [];
  let textLength = 0;

  for (const item of value.slice(0, MAX_DOCUMENTS)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<SessionDocument>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.source !== "string" ||
      typeof candidate.text !== "string"
    ) {
      continue;
    }

    const text = candidate.text.trim().slice(0, 12_000);
    if (!text || textLength + text.length > MAX_DOCUMENT_TEXT) break;
    textLength += text.length;
    chunks.push({
      id: candidate.id.slice(0, 100),
      source: candidate.source.slice(0, 180),
      text,
      ...(typeof candidate.page === "number" ? { page: candidate.page } : {}),
      ...(typeof candidate.section === "string" ? { section: candidate.section.slice(0, 160) } : {}),
    });
  }

  return chunks;
}

export async function prepareLegalResearch(input: {
  question: string;
  history: ChatTurn[];
  documents: SessionDocument[];
  sessionId: string;
}) {
  return legalWorkflow.invoke({
    question: input.question,
    history: input.history,
    documents: input.documents,
    sessionId: input.sessionId,
  });
}

export async function streamLegalAnswer(input: {
  question: string;
  plan: QueryPlan;
  evidence: RetrievedEvidence[];
  history: ChatTurn[];
}) {
  const sourceText = input.evidence.map(sourceBlock).join("\n\n");
  const planText = [
    `Intent: ${input.plan.intent}`,
    `Retrieval query: ${input.plan.searchQuery}`,
    input.plan.jurisdictionMentioned ? `Jurisdiction mentioned: ${input.plan.jurisdictionMentioned}` : null,
    input.plan.needsClarification && input.plan.clarificationQuestion
      ? `Potential ambiguity: ${input.plan.clarificationQuestion}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const conversation: ["user" | "assistant", string][] = input.history
    .slice(-8)
    .map((turn) => [turn.role, turn.content]);
  return configuredModel().stream([
    ["system", answerPrompt({ question: input.question, plan: planText, sources: sourceText })],
    ...conversation,
    ["human", input.question],
  ]);
}

export function fallbackFor(plan: QueryPlan, hasDocuments: boolean) {
  if (plan.intent === "urgent_safety") {
    return "If someone may be in immediate danger, please contact local emergency services now. I can help organize non-urgent legal research after immediate safety is addressed.";
  }
  if (plan.intent === "unrelated") {
    return "I’m designed for legal research and document-based questions. I can help you unpack a legal issue, compare clauses, or trace a question to the sources you upload.";
  }
  if (!hasDocuments && plan.shouldRetrieve) {
    const question = plan.clarificationQuestion || "Which jurisdiction and source material should I use?";
    return `I don’t have source material in this research session, so I can’t give a source-grounded legal conclusion. Upload the relevant statute, agreement, notice, case extract, or policy, then I’ll cite it directly. ${question}`;
  }
  return null;
}
