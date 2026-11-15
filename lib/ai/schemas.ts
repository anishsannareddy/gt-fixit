import { z } from "zod";
import { CATEGORIES } from "../constants";

export const URGENCIES = ["low", "medium", "high", "urgent"] as const;

/**
 * What the model returns for one new request. Kept simple (no length limits) so it works as a
 * strict JSON schema; lengths are enforced after parsing in triage.ts.
 */
export const TriageSchema = z.object({
  urgency: z.enum(URGENCIES),
  reason: z.string(),
  category: z.enum(CATEGORIES),
  safety_hazard: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  match_group_id: z.number().nullable(),
  group_title: z.string(),
});
export type TriageModelOutput = z.infer<typeof TriageSchema>;

/** Report form: which active issues (if any) describe the same problem as the draft. */
export const SimilarSchema = z.object({
  matches: z.array(z.object({ group_id: z.number(), same_problem: z.boolean() })),
});
export type SimilarModelOutput = z.infer<typeof SimilarSchema>;
