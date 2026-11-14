"use client";

import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/useMediaQuery";
import type { CampusSceneProps } from "./CampusScene";

// three.js is big and needs the browser, so load it only on the client, after the page shell.
const CampusScene = dynamic(() => import("./CampusScene"), { ssr: false, loading: () => <SceneLoading /> });

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

/** If the 3D scene crashes (lost GPU context, old device…), show the fallback instead of a broken page. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("3D campus failed, showing fallback:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The 3D campus, sized to fill its parent.
 * `fallback` is shown when WebGL isn't available (e.g. a searchable building list).
 */
export function CampusCanvas({ fallback = null, ...scene }: Omit<CampusSceneProps, "reducedMotion"> & { fallback?: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  // Server render assumes WebGL works; the browser corrects it right after loading if not.
  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  if (!supported) return <>{fallback}</>;
  return (
    <SceneBoundary fallback={fallback}>
      <CampusScene {...scene} reducedMotion={reducedMotion} />
    </SceneBoundary>
  );
}
