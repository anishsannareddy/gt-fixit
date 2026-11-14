import type { Priority, Role, Status } from "./types";

export const PHOTO_BUCKET = "request-photos";

export const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "HVAC / Temperature",
  "Elevator",
  "Lighting",
  "Doors & Locks",
  "Furniture",
  "Custodial / Cleaning",
  "Pest Control",
  "Appliances",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES: Status[] = ["submitted", "assigned", "in_progress", "resolved"];
export const OPEN_STATUSES: Status[] = ["submitted", "assigned", "in_progress"];

/** Badge styling: tinted background + dark text, and always a text label (never color alone). */
export const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  submitted: { label: "Submitted", badge: "bg-slate-100 text-slate-800 ring-slate-300", dot: "bg-slate-500" },
  assigned: { label: "Assigned", badge: "bg-blue-50 text-blue-900 ring-blue-200", dot: "bg-blue-600" },
  in_progress: { label: "In progress", badge: "bg-amber-50 text-amber-900 ring-amber-300", dot: "bg-amber-500" },
  resolved: { label: "Resolved", badge: "bg-green-50 text-green-900 ring-green-300", dot: "bg-green-600" },
};

export const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_META: Record<Priority, { label: string; badge: string; hint: string }> = {
  low: { label: "Low", badge: "bg-slate-50 text-slate-700 ring-slate-200", hint: "Cosmetic, no rush" },
  medium: { label: "Medium", badge: "bg-sky-50 text-sky-900 ring-sky-200", hint: "Annoying, fix this week" },
  high: { label: "High", badge: "bg-orange-50 text-orange-900 ring-orange-300", hint: "Disrupts daily use" },
  urgent: { label: "Urgent", badge: "bg-red-50 text-red-900 ring-red-300", hint: "Safety risk or flooding" },
};

export const ROLE_META: Record<Role, { label: string; home: string; blurb: string }> = {
  reporter: {
    label: "Student / Faculty",
    home: "/report",
    blurb: "Report an issue in any building or dorm and track its progress.",
  },
  technician: {
    label: "Technician",
    home: "/tech",
    blurb: "Work the maintenance queue: claim, start and resolve requests.",
  },
  admin: {
    label: "Admin",
    home: "/admin",
    blurb: "See campus-wide analytics and manage every request.",
  },
};

export const BUILDING_TYPE_LABEL = {
  residence: "Residence halls",
  academic: "Academic & research",
  dining: "Dining",
  athletic: "Athletics & recreation",
  other: "Other campus buildings",
} as const;
