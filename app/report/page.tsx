import type { Metadata } from "next";
import { requireUser } from "@/lib/demo-auth";
import { getBuildings } from "@/lib/data";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report an issue" };

export default async function ReportPage() {
  await requireUser(["reporter"]);
  const buildings = await getBuildings();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16">
      <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Report an issue</h1>
      <p className="mt-2 text-white/65">Tell us what&apos;s wrong and where. A photo helps the technician come prepared.</p>
      <ReportForm buildings={buildings} />
    </div>
  );
}
