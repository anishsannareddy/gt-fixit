import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getBuildings } from "@/lib/data";
import { ReportMap } from "./ReportMap";

export const metadata: Metadata = { title: "Campus map" };

export default async function ReportPage() {
  await requireUser(["reporter"]);
  const buildings = await getBuildings();
  return <ReportMap buildings={buildings} />;
}
