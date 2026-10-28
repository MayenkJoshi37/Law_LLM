import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { PROVIDERS, type ProviderConnection, type ProviderId } from "./provider-config";

export { PROVIDERS, type ProviderConnection, type ProviderId } from "./provider-config";

export const providerSchema = z.object({
  provider: z.enum(PROVIDERS),
  apiKey: z.string().trim().min(12).max(500),
  model: z.string().trim().min(2).max(160).regex(/^[a-zA-Z0-9._:/@-]+$/, "Use a valid provider model identifier."),
});

/** Creates a request-scoped model. API keys are never persisted or logged. */
export function createChatModel(connection: ProviderConnection): BaseChatModel {
  const common = { model: connection.model, temperature: 0.15 };

  switch (connection.provider) {
    case "openai":
      return new ChatOpenAI({ ...common, apiKey: connection.apiKey });
    case "groq":
      return new ChatOpenAI({
        ...common,
        apiKey: connection.apiKey,
        configuration: { baseURL: "https://api.groq.com/openai/v1" },
      });
    case "openrouter":
      return new ChatOpenAI({
        ...common,
        apiKey: connection.apiKey,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
      });
    case "google":
      return new ChatGoogleGenerativeAI({ ...common, apiKey: connection.apiKey });
    case "anthropic":
      return new ChatAnthropic({ ...common, apiKey: connection.apiKey });
  }
}

export function providerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/401|403|authentication|api key|unauthorized|invalid.*key/.test(message)) {
    return "That API key was rejected. Check it and try again.";
  }
  if (/model.*(not found|does not exist)|404/.test(message)) {
    return "That model is not available for this provider or API key. Check the model identifier.";
  }
  if (/429|rate limit|quota|insufficient/.test(message)) {
    return "The provider is rate-limiting this request or the account has no available quota. Try again shortly.";
  }
  return "The provider could not complete that request. Check the model and try again.";
}
