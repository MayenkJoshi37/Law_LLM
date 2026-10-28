import { NextRequest } from "next/server";
import { fallbackFor, normalizeDocuments, prepareLegalResearch, streamLegalAnswer } from "@/lib/legal-rag";
import { providerErrorMessage, providerSchema } from "@/lib/providers";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

function event(name: string, value: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
}

function safeHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-10)
    .flatMap((turn) => {
      if (!turn || typeof turn !== "object") return [];
      const candidate = turn as Partial<ChatTurn>;
      if (
        (candidate.role !== "user" && candidate.role !== "assistant") ||
        typeof candidate.content !== "string"
      ) {
        return [];
      }
      return [{ role: candidate.role, content: candidate.content.slice(0, 8_000) }];
    });
}

function safeSessionId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,100}$/.test(value)
    ? value
    : crypto.randomUUID();
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const question = typeof body.message === "string" ? body.message.trim().slice(0, 6_000) : "";
  if (!question) return Response.json({ error: "Enter a question to begin research." }, { status: 400 });

  const documents = normalizeDocuments(body.documents);
  const history = safeHistory(body.history);
  const sessionId = safeSessionId(body.sessionId);
  const connection = providerSchema.safeParse(body.connection);
  if (!connection.success) {
    return Response.json(
      { error: "Connect an LLM provider and model before starting research." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const research = await prepareLegalResearch({ question, history, documents, sessionId, connection: connection.data });
        controller.enqueue(event("sources", {
          sources: research.evidence.map((item) => item.source),
          plan: research.plan,
        }));

        const fallback = fallbackFor(research.plan, documents.length > 0);
        if (fallback) {
          controller.enqueue(event("token", { text: fallback }));
        } else {
          const answer = await streamLegalAnswer({
            question,
            plan: research.plan,
            evidence: research.evidence,
            history,
            connection: connection.data,
          });
          for await (const chunk of answer) {
            const text = typeof chunk.content === "string" ? chunk.content : "";
            if (text) controller.enqueue(event("token", { text }));
          }
        }
        controller.enqueue(event("done", {}));
      } catch (error) {
        controller.enqueue(event("error", { message: providerErrorMessage(error) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
