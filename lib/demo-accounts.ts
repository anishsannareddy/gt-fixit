/**
 * Demo accounts created by `npm run seed` (same personas as the old role picker).
 * The addresses are clearly fake. They share one password, set by DEMO_ACCOUNT_PASSWORD.
 * The login page lists them only when NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true.
 * (No "server-only" import: the seed script runs this file outside Next.js.)
 */
import type { Role } from "./types";

export const DEMO_ACCOUNTS: { email: string; name: string; role: Role; title: string }[] = [
  { email: "demo.student@gatech.edu", name: "Alex Rivera", role: "reporter", title: "2nd-year CS student · Glenn Hall" },
  { email: "demo.faculty@gatech.edu", name: "Dr. Priya Shah", role: "reporter", title: "Faculty · School of ECE" },
  { email: "demo.tech@gatech.edu", name: "Marcus Reed", role: "technician", title: "HVAC & Electrical Technician" },
  { email: "demo.tech2@gatech.edu", name: "Tasha Coleman", role: "technician", title: "Plumbing Technician" },
  { email: "demo.tech3@gatech.edu", name: "Luis Ortega", role: "technician", title: "General Maintenance Technician" },
  { email: "demo.admin@gatech.edu", name: "Jordan Ellis", role: "admin", title: "Facilities Operations Manager" },
];

export function demoPassword(): string {
  return process.env.DEMO_ACCOUNT_PASSWORD || "GTFixIt-Demo-2026!";
}

export const showDemoAccounts = () => process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
