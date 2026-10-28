export const PROVIDERS = ["openai", "google", "groq", "anthropic", "openrouter"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export type ProviderConnection = {
  provider: ProviderId;
  apiKey: string;
  model: string;
};

export const providerDetails: Record<ProviderId, { name: string; recommendedModel: string; example: string }> = {
  openai: { name: "OpenAI", recommendedModel: "gpt-4o-mini", example: "gpt-4o-mini" },
  google: { name: "Google Gemini", recommendedModel: "gemini-2.0-flash", example: "gemini-2.0-flash" },
  groq: { name: "Groq", recommendedModel: "openai/gpt-oss-20b", example: "openai/gpt-oss-20b" },
  anthropic: { name: "Anthropic Claude", recommendedModel: "claude-3-5-haiku-latest", example: "claude-3-5-haiku-latest" },
  openrouter: { name: "OpenRouter", recommendedModel: "openai/gpt-4o-mini", example: "openai/gpt-4o-mini" },
};
