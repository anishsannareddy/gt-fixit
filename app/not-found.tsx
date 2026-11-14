import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card m-4 mx-auto mt-10 w-[calc(100%-2rem)] max-w-lg p-6 text-center">
      <h1 className="text-xl font-bold text-gt-navy">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">That request doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary mt-5">Go home</Link>
    </div>
  );
}
