import type { Area } from "./campus/areas";

export type Role = "reporter" | "technician" | "admin";
export type Status = "submitted" | "assigned" | "in_progress" | "resolved";
export type Priority = "low" | "medium" | "high" | "urgent";
export type BuildingType = "residence" | "academic" | "dining" | "athletic" | "other";

export type Building = {
  id: number;
  name: string;
  short_name: string | null;
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
  is_demo: boolean;
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
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
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
