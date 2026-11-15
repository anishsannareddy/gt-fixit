"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a page current while other people work: refreshes the server data every `seconds`
 * (only while the tab is visible) and whenever the tab regains focus.
 * Renders nothing. (Live push would need public database read access, which we don't allow.)
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, seconds * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
