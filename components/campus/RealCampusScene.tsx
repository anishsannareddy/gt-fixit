"use client";

import { ContactShadows, Html, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";
import { AREA_META } from "@/lib/campus/areas";
import { buildBuildingMesh, buildRoadGeometry, buildingAtFace, HEIGHT_EXAGGERATION, markBuildingDirty, markColorsDirty, paintBuilding } from "@/lib/campus/geometry";
import { SCALE } from "@/lib/campus/layout";
import { HEAT_META, heatBand } from "@/lib/campus/heat";
import { campusBuildings, campusRoads, displayName, isGT, type CampusBuildingInfo } from "@/lib/campus/zones";
import { Rig, type CampusMode, type Frame } from "./CampusScene";

/**
 * How buildings are coloured:
 *   brand: GT buildings navy with gold roofs, city dimmed (landing page)
 *   zone:  GT buildings by maintenance area
 *   heat:  GT buildings green / yellow / red by open-request count (thresholds in lib/campus/heat.ts)
 */
export type CampusView = "brand" | "zone" | "heat";

export type RealCampusSceneProps = {
  /** hero: slow orbit, no interaction · select / heat: drag, zoom, hover and click GT buildings */
  mode: CampusMode;
  /** OSM id of the selected building. */
  selected?: string | null;
  /** Called when a GT building is clicked or tapped. Surrounding city buildings ignore clicks. */
  onSelect?: (building: CampusBuildingInfo) => void;
  /** Where the open panel sits, so the selected building is framed in the visible part of the screen. */
  panel?: "none" | "bottom" | "right";
  view?: CampusView;
  /** Change this number to fly the camera back to the overview. */
  resetKey?: number;
  /** Open requests per OSM building id (heat view). */
  counts?: Record<string, number>;
  reducedMotion?: boolean;
  /** "phone": lower pixel-ratio ceiling and no antialiasing. Shadows are always one baked contact shadow. */
  quality?: "desktop" | "phone";
  /** Slowly orbit after a few seconds without interaction (student map). */
  autoRotate?: boolean;
};

// Light theme: pale sky, light ground, muted buildings.
const SKY = "#eef3f8";

// Surrounding city: dim, so GT buildings stand out.
const CITY_WALL = new THREE.Color("#d3dae3");
const CITY_ROOF = new THREE.Color("#e8ecf1");
const NON_GT_WALL = new THREE.Color(AREA_META.non_gt.color).multiplyScalar(0.95);
const NON_GT_ROOF = new THREE.Color(AREA_META.non_gt.color).lerp(new THREE.Color("#ffffff"), 0.35);
// Brand view
const GT_WALL = new THREE.Color("#5f86ad");
const GT_ROOF = new THREE.Color("#cfc18c");
// Heat view
// Heat view: walls a shade darker than roofs so each building still reads as a solid block
const HEAT_WALL = Object.fromEntries(Object.entries(HEAT_META).map(([k, m]) => [k, new THREE.Color(m.color).multiplyScalar(0.78)]));
const HEAT_ROOF = Object.fromEntries(Object.entries(HEAT_META).map(([k, m]) => [k, new THREE.Color(m.color).lerp(new THREE.Color("#ffffff"), 0.12)]));
// Hovered / selected building
const PICK_WALL = new THREE.Color("#d2ae3c");
const PICK_ROOF = new THREE.Color("#f5dd85");

/**
 * Two merged meshes: the surrounding city (never raycast) and the clickable GT buildings
 * (raycast through a BVH). Indexes below are into GT_BUILDINGS.
 */
const GT_BUILDINGS = campusBuildings.filter(isGT);
const CITY_BUILDINGS = campusBuildings.filter((b) => !isGT(b));
const INDEX_BY_ID = new Map(GT_BUILDINGS.map((b, i) => [b.id, i]));

/** Bounding rectangle of some buildings' outlines, in scene units. */
function extent(list: typeof campusBuildings, margin = 0): Frame {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of list) {
    const r = b.rings[0];
    for (let i = 0; i < r.length; i += 2) {
      minX = Math.min(minX, r[i]); maxX = Math.max(maxX, r[i]);
      minZ = Math.min(minZ, r[i + 1]); maxZ = Math.max(maxZ, r[i + 1]);
    }
  }
  return { minX: minX * SCALE - margin, maxX: maxX * SCALE + margin, minZ: minZ * SCALE - margin, maxZ: maxZ * SCALE + margin };
}
/** The overview fits every GT building; the camera may look anywhere in the data, plus a margin. */
const GT_FRAME = extent(campusBuildings.filter(isGT), 4);
const ALL_BOUNDS = extent(campusBuildings, 20);

/** Scene-space anchor points for a building: centre, roof height, and how far its outline reaches. */
function anchor(b: CampusBuildingInfo) {
  const ring = b.rings[0];
  let reach = 0;
  for (let i = 0; i < ring.length; i += 2) reach = Math.max(reach, Math.hypot(ring[i] - b.x, ring[i + 1] - b.z));
  return { x: b.x * SCALE, z: b.z * SCALE, top: b.h * SCALE * HEIGHT_EXAGGERATION, reach: reach * SCALE };
}

function BuildingLabel({ b, count }: { b: CampusBuildingInfo; count?: number }) {
  const a = anchor(b);
  return (
    <Html position={[a.x, a.top + 2.4, a.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-panel">
        {b.zone && <span className="size-2.5 rounded-full ring-1 ring-slate-300" style={{ background: AREA_META[b.zone].color }} />}
        {displayName(b)}
        {b.zone && <span className="font-normal text-ink-muted">{AREA_META[b.zone].label}</span>}
        {count !== undefined && <span className="rounded-full bg-gt-gold px-1.5 font-mono text-[0.65rem] text-navy-950">{count} open</span>}
      </div>
    </Html>
  );
}

const AREA_WALL = Object.fromEntries(Object.entries(AREA_META).map(([k, m]) => [k, new THREE.Color(m.color).multiplyScalar(0.68)] /* darker walls so every building separates from the pale ground */));
const AREA_ROOF = Object.fromEntries(Object.entries(AREA_META).map(([k, m]) => [k, new THREE.Color(m.color).lerp(new THREE.Color("#ffffff"), 0.18)]));

/**
 * The real Georgia Tech campus: OpenStreetMap footprints extruded to their real heights.
 * All ~2,500 buildings are ONE merged mesh and all roads another, so the whole scene is a
 * handful of draw calls — that's what keeps it smooth on a phone. Colour changes just rewrite
 * each building's block of vertex colours.
 */
function Campus({
  view,
  counts,
  interactive,
  selected,
  onSelect,
}: {
  view: CampusView;
  counts?: Record<string, number>;
  interactive: boolean;
  selected: number | null;
  onSelect?: (b: CampusBuildingInfo) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gtMesh = useMemo(() => {
    const m = buildBuildingMesh(GT_BUILDINGS);
    // Bounding-volume tree, built once: hover/click raycasts test a few dozen triangles instead of all of them.
    m.geometry.computeBoundsTree = computeBoundsTree;
    m.geometry.computeBoundsTree();
    return m;
  }, []);
  const cityMesh = useMemo(() => buildBuildingMesh(CITY_BUILDINGS), []);
  const roads = useMemo(() => buildRoadGeometry(campusRoads), []);
  // With reduced motion the scene only redraws on request, so ask for a frame after recolouring.
  const invalidate = useThree((three) => three.invalidate);

  // Base colour of a GT building in the current view.
  const base = useMemo(() => {
    return (i: number): [THREE.Color, THREE.Color] => {
      const b = GT_BUILDINGS[i];
      if (view === "zone") return [AREA_WALL[b.zone], AREA_ROOF[b.zone]];
      if (view === "heat") {
        const band = heatBand(counts?.[b.id] ?? 0);
        return [HEAT_WALL[band], HEAT_ROOF[band]];
      }
      return [GT_WALL, GT_ROOF];
    };
  }, [view, counts]);

  // The city only changes with the view.
  useEffect(() => {
    CITY_BUILDINGS.forEach((b, i) => {
      if (b.zone === "non_gt" && view !== "brand") paintBuilding(cityMesh, i, NON_GT_WALL, NON_GT_ROOF);
      else paintBuilding(cityMesh, i, CITY_WALL, CITY_ROOF);
    });
    markColorsDirty(cityMesh);
    invalidate();
  }, [cityMesh, view, invalidate]);

  // Full GT repaint only when the view or the counts change…
  const lit = useRef<number[]>([]);
  useEffect(() => {
    GT_BUILDINGS.forEach((_, i) => paintBuilding(gtMesh, i, ...base(i)));
    lit.current = [];
    markColorsDirty(gtMesh);
    invalidate();
  }, [gtMesh, base, invalidate]);

  // …while hover and selection repaint just the buildings that changed (no per-move full upload).
  useEffect(() => {
    const next = [hovered, selected].filter((i): i is number => i != null);
    for (const i of lit.current) {
      if (next.includes(i)) continue;
      paintBuilding(gtMesh, i, ...base(i));
      markBuildingDirty(gtMesh, i);
    }
    for (const i of next) {
      paintBuilding(gtMesh, i, PICK_WALL, PICK_ROOF);
      markBuildingDirty(gtMesh, i);
    }
    lit.current = next;
    invalidate();
  }, [gtMesh, base, hovered, selected, invalidate]);

  const gtAt = (e: ThreeEvent<MouseEvent | PointerEvent>) => (e.faceIndex == null ? null : buildingAtFace(gtMesh, e.faceIndex));
  const handlers = interactive
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (e.buttons) return; // dragging the camera: no hover changes
          const i = gtAt(e);
          setHovered(i);
          document.body.style.cursor = i != null ? "pointer" : "";
        },
        onPointerOut: () => {
          setHovered(null);
          document.body.style.cursor = "";
        },
        // e.delta = how far the pointer moved between press and release; ignore drags
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const i = gtAt(e);
          if (i != null && e.delta <= 6) onSelect?.(GT_BUILDINGS[i]);
        },
      }
    : {};
  const selectedAnchor = selected != null ? anchor(GT_BUILDINGS[selected]) : null;

  // Free GPU memory when the scene goes away
  useEffect(
    () => () => {
      gtMesh.geometry.dispose();
      cityMesh.geometry.dispose();
      roads.dispose();
    },
    [gtMesh, cityMesh, roads],
  );

  return (
    <group>
      {/* ground disc: fades into the fog at its edge */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} raycast={() => null}>
        <circleGeometry args={[700, 64]} />
        <meshLambertMaterial color="#e3e9ef" />
      </mesh>
      <mesh geometry={roads} raycast={() => null}>
        <meshBasicMaterial vertexColors />
      </mesh>
      {/* the city is never picked, so it skips raycasting entirely */}
      <mesh geometry={cityMesh.geometry} raycast={() => null}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={gtMesh.geometry} raycast={bvhRaycast} {...handlers}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {selectedAnchor && (
        <mesh rotation-x={-Math.PI / 2} position={[selectedAnchor.x, 0.12, selectedAnchor.z]} raycast={() => null}>
          <ringGeometry args={[selectedAnchor.reach + 0.6, selectedAnchor.reach + 1.1, 56]} />
          <meshBasicMaterial color="#003057" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {view === "heat" && <HotSpotPins counts={counts} />}
      {hovered != null && hovered !== selected && (
        <BuildingLabel b={GT_BUILDINGS[hovered]} count={view === "heat" ? (counts?.[GT_BUILDINGS[hovered].id] ?? 0) : undefined} />
      )}
      {selected != null && <BuildingLabel b={GT_BUILDINGS[selected]} count={view === "heat" ? (counts?.[GT_BUILDINGS[selected].id] ?? 0) : undefined} />}
    </group>
  );
}

/**
 * Red ("hot spot") buildings get a tall pin above the roof with a ring that gently pulses,
 * so they stand out even for people who can't tell red from green. Static with reduced motion.
 */
function HotSpotPins({ counts }: { counts?: Record<string, number> }) {
  const reduced = useThree((t) => t.frameloop === "demand");
  const spots = useMemo(
    () =>
      campusBuildings
        .filter((b) => isGT(b) && heatBand(counts?.[b.id] ?? 0) === "red")
        .map((b) => ({ id: b.id, ...anchor(b) })),
    [counts],
  );
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    rings.current.forEach((m, i) => {
      if (!m) return;
      const phase = (t * 0.6 + i * 0.17) % 1; // 0 → 1 every ~1.7s
      m.scale.setScalar(1 + phase * 1.6);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - phase);
    });
  });
  return (
    <group>
      {spots.map((p, i) => (
        <group key={p.id} position={[p.x, 0, p.z]}>
          {/* pin: thin stem + head, standing well above the roof */}
          <mesh position-y={p.top + 4}>
            <cylinderGeometry args={[0.18, 0.18, 8, 6]} />
            <meshBasicMaterial color={HEAT_META.red.color} />
          </mesh>
          <mesh position-y={p.top + 9}>
            <octahedronGeometry args={[1.5, 0]} />
            <meshStandardMaterial color={HEAT_META.red.color} emissive={HEAT_META.red.color} emissiveIntensity={0.35} flatShading />
          </mesh>
          {/* pulsing ring on the ground */}
          <mesh ref={(m) => { rings.current[i] = m; }} rotation-x={-Math.PI / 2} position-y={0.15}>
            <ringGeometry args={[p.reach + 0.5, p.reach + 1.3, 48]} />
            <meshBasicMaterial color={HEAT_META.red.color} transparent opacity={reduced ? 0.6 : 0.75} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const MAX_DPR = 1.5;
const LOW_DPR = 1;

/** Raycast through the BVH, stopping at the first hit (all we need for picking). */
function bvhRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, hits: THREE.Intersection[]) {
  (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  acceleratedRaycast.call(this, raycaster, hits);
}

/**
 * Two quality steps: drop the pixel ratio to LOW_DPR when the frame rate falls, go back up when it
 * recovers, and stay low if it keeps flip-flopping. Each change resizes the canvas (costly), so it
 * happens rarely. Lives in its own component and calls the renderer directly: no scene re-renders.
 */
function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  // Start watching only after the scene has loaded, so the first slow frames don't count.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  // Explicit bounds: the defaults treat anything under 60 fps as "declining" on 120 Hz screens.
  return <PerformanceMonitor bounds={() => [40, 55]} onDecline={() => setDpr(LOW_DPR)} onIncline={() => setDpr(MAX_DPR)} flipflops={8} onFallback={() => setDpr(LOW_DPR)} />;
}

export default function RealCampusScene({
  mode,
  quality = "desktop",
  autoRotate = false,
  view = "brand",
  counts,
  selected = null,
  onSelect,
  panel = "none",
  reducedMotion = false,
  resetKey = 0,
}: RealCampusSceneProps) {
  const selectedIndex = selected != null ? (INDEX_BY_ID.get(selected) ?? null) : null;
  const target = useMemo(() => {
    if (selectedIndex == null) return null;
    const a = anchor(GT_BUILDINGS[selectedIndex]);
    return { x: a.x, z: a.z };
  }, [selectedIndex]);

  return (
    <Canvas
      // Capped at 1.5 (phones render far fewer pixels than their 3x screens); AdaptiveQuality may drop it to 1.
      dpr={MAX_DPR}
      camera={{ fov: 32, near: 1, far: 2000, position: [0, 90, 150] }}
      gl={{ antialias: quality === "desktop", alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-label="3D map of the Georgia Tech campus"
      role="img"
    >
      <AdaptiveQuality />
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 320, 900]} />
      <hemisphereLight args={["#ffffff", "#c9d3dd", 1.6]} />
      {/* No shadow maps: the lights only shade faces, and one contact shadow is baked once (frames=1). */}
      <directionalLight position={[-120, 170, 90]} intensity={1.5} color="#fff6e3" />
      <directionalLight position={[110, 60, -90]} intensity={0.35} color="#dbe8f5" />
      <ContactShadows position={[0, 0.02, 0]} scale={380} resolution={1024} blur={2.2} opacity={0.32} far={40} frames={1} color="#2a3f55" />

      <Campus view={view} counts={counts} interactive={mode !== "hero"} selected={selectedIndex} onSelect={onSelect} />

      <Rig
        mode={mode}
        target={target}
        panel={panel}
        reducedMotion={reducedMotion}
        frame={GT_FRAME}
        bounds={ALL_BOUNDS}
        resetKey={resetKey}
        autoRotate={autoRotate}
      />
    </Canvas>
  );
}
