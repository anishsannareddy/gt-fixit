import type { Role, Status } from "./types";

/**
 * Who may permanently delete a request (checked on the server in deleteRequest):
 *   - admins: any request, any status (spam, duplicates, mistakes)
 *   - students: their own request, unless work has started (In progress) or it's Resolved
 *   - technicians: never
 */
export function canDeleteRequest(viewer: { id: string; role: Role }, t: { reporter_id: string; status: Status }): boolean {
  if (viewer.role === "admin") return true;
  if (viewer.role === "reporter") return t.reporter_id === viewer.id && (t.status === "submitted" || t.status === "assigned");
  return false;
}

/** Storage path inside the photo bucket, from a stored public URL (".../request-photos/requests/<uuid>.jpg"). */
export function photoPathFromUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return /^requests\/[0-9a-f-]{36}\.jpg$/.test(path) ? path : null;
}
