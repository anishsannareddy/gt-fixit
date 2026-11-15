import type { ActiveIssue } from "@/lib/issues";

/** Stable React key that resets an IssueCard's local state when the server data changes (e.g. AutoRefresh). */
export const issueKey = (i: ActiveIssue) => `${i.id}-${i.affected}-${i.voted}-${i.status}`;
