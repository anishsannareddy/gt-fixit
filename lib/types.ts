import type { Area } from "./campus/areas";

export type Role = "reporter" | "technician" | "admin";
export type Status = "submitted" | "assigned" | "in_progress" | "resolved";
export type Priority = "low" | "medium" | "high" | "urgent";
export type BuildingType = "residence" | "academic" | "dining" | "athletic" | "other";

export type Building = {
  id: number;
  name: string;
  short_name: string | null;
  /** Other names people search for (old names, map labels). */
  aliases: string[];
  type: BuildingType;
  /** GT building number, when known. */
  number: string | null;
  /** GT Facilities maintenance area. */
  area: Area;
  lat: number | null;
  lng: number | null;
  /** OpenStreetMap id: links this row to its footprint in the 3D campus. */
  osm_id: string | null;
};

export type User = {
  id: string;
  name: string;
  role: Role;
  title: string | null;
  /** Sign-in email (null for seeded background reporters, who have no login). */
  email: string | null;
  is_demo: boolean;
  /** Technician queue: sort by AI urgency (saved per user). */
  smart_sort?: boolean;
};

/** A maintenance request. (Named Ticket so it doesn't clash with the built-in `Request` type.) */
export type Ticket = {
  id: number;
  title: string;
  description: string;
  building_id: number;
  location_detail: string;
  /** Maintenance area, copied from the building when the request was created. */
  area: Area;
  category: string;
  priority: Priority;
  status: Status;
  reporter_id: string;
  assignee_id: string | null;
  photo_url: string | null;
  /** Issue group (duplicate reports of one problem share a group). */
  group_id: number;
  /** 'private': only the reporter and staff see it; never grouped or listed in Active issues. */
  visibility: "public" | "private";
  /** AI suggestion, set once at submission. Never replaces the reporter's `priority`. */
  ai_urgency: Priority | null;
  ai_reason: string | null;
  ai_category: string | null;
  ai_safety: boolean;
  ai_status: AiStatus;
  ai_model: string | null;
  ai_at: string | null;
  /** Smart Sort reviewed the urgency (reported Urgent/High, or a Medium/Low hazard that was escalated). */
  ai_reviewed: boolean;
  /** Technician's accepted/overridden urgency. */
  triage_urgency: Priority | null;
  triage_by: string | null;
  triage_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type AiStatus = "pending" | "done" | "fallback";

export type IssueGroup = {
  id: number;
  building_id: number;
  category: string;
  title: string;
  created_at: string;
  updated_at: string;
};

/** Ticket joined with the related rows most screens need. */
export type TicketWithRelations = Ticket & {
  building: Pick<Building, "id" | "name" | "short_name" | "type" | "number"> | null;
  reporter: Pick<User, "id" | "name"> | null;
  assignee: Pick<User, "id" | "name"> | null;
};

export type TicketEvent = {
  id: number;
  request_id: number;
  actor_id: string | null;
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  created_at: string;
  actor: Pick<User, "id" | "name" | "role"> | null;
};
