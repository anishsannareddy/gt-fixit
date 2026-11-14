import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentUser } from "@/lib/demo-auth";
import { ROLE_META } from "@/lib/constants";
import { Logo } from "@/components/Logo";
import { BottomTabs, TopNavLinks } from "@/components/NavLinks";
import { SwitchIcon } from "@/components/Icons";
import { signOut } from "./actions";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GT FixIt", template: "%s · GT FixIt" },
  description: "Report and track maintenance issues anywhere on Georgia Tech's campus.",
};

export const viewport: Viewport = {
  themeColor: "#003057",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 bg-gt-navy text-white shadow-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href={user ? ROLE_META[user.role].home : "/"} aria-label="GT FixIt home">
              <Logo />
            </Link>
            {user && <TopNavLinks role={user.role} />}
            {user && (
              <div className="ml-auto flex items-center gap-3">
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-gt-gold">{ROLE_META[user.role].label}</div>
                </div>
                <form action={signOut}>
                  <button
                    className="flex items-center gap-1.5 rounded-lg border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                    title="Switch demo role"
                  >
                    <SwitchIcon className="size-4" />
                    <span>Switch role</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:py-8 ${user ? "pb-28 md:pb-10" : ""}`}>
          {children}
        </main>

        {user && <BottomTabs role={user.role} />}
      </body>
    </html>
  );
}
