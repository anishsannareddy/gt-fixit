/**
 * The ONLY file that talks to an AI provider. Everything else calls `generateStructured`,
 * so swapping OpenAI for another provider means rewriting just this file.
 *
 * Server-only by convention: it reads OPENAI_API_KEY (never NEXT_PUBLIC_) and is imported only
 * from lib/ai/service.ts (which has `import "server-only"`) and from scripts. It has no
 * "server-only" import itself so `npm run ai:backfill` can use it outside Next.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

/** OpenAI's small, fast, low-cost model (checked against developers.openai.com/api/docs/models, Nov 2026). */
export const DEFAULT_MODEL = "gpt-6-luna";

export class AiUnavailable extends Error {}

export type StructuredRequest<T> = {
  /** Schema name the model sees. */
  name: string;
  /** Sent to the model as a strict JSON schema. Callers still re-validate the result. */
  schema: z.ZodType<T>;
  system: string;
  input: string;
  timeoutMs?: number;
};
export type StructuredResult = { data: unknown; model: string };
export type GenerateStructured = <T>(req: StructuredRequest<T>) => Promise<StructuredResult>;

export function aiEnabled(): boolean {
  return process.env.AI_PROVIDER !== "off" && Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!aiEnabled()) throw new AiUnavailable(process.env.AI_PROVIDER === "off" ? "AI is turned off (AI_PROVIDER=off)." : "OPENAI_API_KEY is not set.");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 8_000 });
  return client;
}

/** One structured-output call (Responses API + strict JSON schema). Throws on any failure. */
export const generateStructured: GenerateStructured = async ({ name, schema, system, input, timeoutMs = 8_000 }) => {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const response = await getClient().responses.parse(
    {
      model,
      instructions: system,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 600,
      store: false,
      text: { format: zodTextFormat(schema, name) },
    },
    { timeout: timeoutMs },
  );
  if (response.output_parsed == null) throw new Error(`No structured output (status: ${response.status ?? "unknown"}).`);
  return { data: response.output_parsed, model };
};
