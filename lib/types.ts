export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/** A chunk that lives in the browser for the active research session only. */
export interface SessionDocument {
  id: string;
  source: string;
  text: string;
  page?: number;
  section?: string;
}

export interface LegalSource {
  id: string;
  title: string;
  excerpt: string;
  relevance: number;
  page?: number;
  section?: string;
}

export const QUERY_INTENTS = [
  "legal_research",
  "document_review",
  "legal_process",
  "general_conversation",
  "unrelated",
  "urgent_safety",
] as const;

export type QueryIntent = (typeof QUERY_INTENTS)[number];

export interface QueryPlan {
  intent: QueryIntent;
  searchQuery: string;
  shouldRetrieve: boolean;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  jurisdictionMentioned: string | null;
  riskLevel: "low" | "standard" | "high" | "urgent";
}
