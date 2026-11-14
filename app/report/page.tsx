import type { Metadata } from "next";
import { requireUser } from "@/lib/demo-auth";
import { getBuildings } from "@/lib/data";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report an issue" };

export default async function ReportPage() {
  await requireUser(["reporter"]);
  const buildings = await getBuildings();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gt-navy md:text-3xl">Report an issue</h1>
      <p className="mt-1 text-slate-600">Tell us what&apos;s wrong and where. A photo helps the technician come prepared.</p>
      <ReportForm buildings={buildings} />
    </div>
  );
}
