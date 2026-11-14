"use client";

import dynamic from "next/dynamic";
import { Component, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/useMediaQuery";
import { cn } from "@/components/ui/cn";
import { buildCampus } from "@/lib/campus/layout";
import type { RealCampusSceneProps } from "./RealCampusScene";

// three.js is big and needs the browser, so both scenes load only on the client, after the page shell.
const RealCampusScene = dynamic(() => import("./RealCampusScene"), { ssr: false, loading: () => <SceneLoading /> });
const BlockCampusScene = dynamic(() => import("./CampusScene"), { ssr: false, loading: () => <SceneLoading /> });

function SceneLoading() {
  return (
    <div className="grid h-full w-full place-items-center" aria-hidden="true">
      <div className="size-10 animate-spin rounded-full border-2 border-white/15 border-t-gt-gold" />
    </div>
  );
}

let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

/** Catches a crash in the 3D scene and shows something else instead of a broken page. */
class SceneBoundary extends Component<{ name: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`${this.props.name} failed, showing fallback:`, error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Map data credit. OpenStreetMap's licence requires it wherever the map is shown. */
export function OsmCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      className={cn("rounded-md bg-navy-950/60 px-1.5 py-0.5 text-[0.65rem] text-white/60 backdrop-blur hover:text-white", className)}
    >
      © OpenStreetMap contributors
    </a>
  );
}

/**
 * The 3D campus, sized to fill its parent.
 *
 * Fallback chain:
 *   real campus (OpenStreetMap footprints) → block campus (45 hand-placed boxes) → `fallback`
 * `fallback` is also what shows when the device has no WebGL at all (e.g. a searchable building list).
 */
export function CampusCanvas({
  fallback = null,
  credit = true,
  ...scene
}: Omit<RealCampusSceneProps, "reducedMotion"> & { fallback?: ReactNode; /** Show the © OpenStreetMap credit in the corner. */ credit?: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  // Server render assumes WebGL works; the browser corrects it right after loading if not.
  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const blocks = useMemo(() => buildCampus(), []);
  if (!supported) return <>{fallback}</>;

  return (
    <div className="relative h-full w-full">
      <SceneBoundary
        name="Real campus"
        fallback={
          <SceneBoundary name="Block campus" fallback={fallback}>
            <BlockCampusScene buildings={blocks} mode={scene.mode} reducedMotion={reducedMotion} />
          </SceneBoundary>
        }
      >
        <RealCampusScene {...scene} reducedMotion={reducedMotion} />
      </SceneBoundary>
      {credit && <OsmCredit className="absolute right-2 bottom-2 z-10" />}
    </div>
  );
}
