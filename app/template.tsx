import { PageTransition } from "@/components/ui/Motion";

// A template re-mounts on every navigation, so each page fades in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
