import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getBuildings } from "@/lib/data";
import { getActiveIssues } from "@/lib/issues";
import { ReportMap } from "./ReportMap";

export const metadata: Metadata = { title: "Campus map" };

export default async function ReportPage() {
  const user = await requireUser(["reporter"]);
  const [buildings, issues] = await Promise.all([getBuildings(), getActiveIssues(user.id)]);
  return <ReportMap buildings={buildings} issues={issues} />;
}
