import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { getCurrentUser } from "@/lib/demo-auth";
import { AppShell } from "@/components/shell/AppShell";
import { MotionProvider } from "@/components/ui/Motion";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GT FixIt", template: "%s · GT FixIt" },
  description: "Report and track maintenance issues anywhere on Georgia Tech's campus.",
};

export const viewport: Viewport = {
  themeColor: "#00111f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <MotionProvider>
          <ToastProvider>
            <AppShell user={user}>{children}</AppShell>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
