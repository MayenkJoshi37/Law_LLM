import { NextRequest } from "next/server";
import { createChatModel, providerErrorMessage, providerSchema } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: { connection?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const parsed = providerSchema.safeParse(body.connection);
  if (!parsed.success) {
    return Response.json({ error: "Choose a provider, enter an API key, and use a valid model identifier." }, { status: 400 });
  }

  try {
    await createChatModel(parsed.data).invoke([["human", "Reply with the single word: ready"]]);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: providerErrorMessage(error) }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
