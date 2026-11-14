"use client";

import { Html, Sparkles } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AREA_META } from "@/lib/campus/areas";
import { buildBuildingMesh, buildRoadGeometry, buildingAtFace, HEIGHT_EXAGGERATION, markColorsDirty, paintBuilding } from "@/lib/campus/geometry";
import { SCALE } from "@/lib/campus/layout";
import { campusBuildings, campusRoads, displayName, isGT, type CampusBuildingInfo } from "@/lib/campus/zones";
import { FOG, Rig, type CampusMode } from "./CampusScene";

/**
 * How buildings are coloured:
 *   brand: GT buildings navy with gold roofs, city dimmed (landing page)
 *   zone:  GT buildings by maintenance area
 *   heat:  GT buildings by open-request count (cool navy → gold)
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
  /** Open requests per OSM building id (heat view). */
  counts?: Record<string, number>;
  reducedMotion?: boolean;
};

// Surrounding city: dim, so GT buildings stand out.
const CITY_WALL = new THREE.Color("#0f3353");
const CITY_ROOF = new THREE.Color("#184668");
const NON_GT_WALL = new THREE.Color(AREA_META.non_gt.color).multiplyScalar(0.55);
const NON_GT_ROOF = new THREE.Color(AREA_META.non_gt.color).multiplyScalar(0.8);
// Brand view
const GT_WALL = new THREE.Color("#2f74b0");
const GT_ROOF = new THREE.Color("#d9cc97");
// Heat view
const COOL = new THREE.Color("#1f5688");
const HOT = new THREE.Color("#f2d16b");
// Hovered / selected building
const PICK_WALL = new THREE.Color("#e8cf7a");
const PICK_ROOF = new THREE.Color("#fff3c4");

const INDEX_BY_ID = new Map(campusBuildings.map((b, i) => [b.id, i]));

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
      <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-panel">
        {b.zone && <span className="size-2.5 rounded-full ring-1 ring-white/30" style={{ background: AREA_META[b.zone].color }} />}
        {displayName(b)}
        {b.zone && <span className="font-normal text-white/60">{AREA_META[b.zone].label}</span>}
        {count !== undefined && <span className="rounded-full bg-gt-gold px-1.5 font-mono text-[0.65rem] text-navy-950">{count} open</span>}
      </div>
    </Html>
  );
}

const AREA_WALL = Object.fromEntries(Object.entries(AREA_META).map(([k, m]) => [k, new THREE.Color(m.color).multiplyScalar(0.8)]));
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
  const mesh = useMemo(() => buildBuildingMesh(campusBuildings), []);
  const roads = useMemo(() => buildRoadGeometry(campusRoads), []);
  // With reduced motion the scene only redraws on request, so ask for a frame after recolouring.
  const invalidate = useThree((three) => three.invalidate);

  useEffect(() => {
    const max = Math.max(1, ...Object.values(counts ?? {}));
    const wall = new THREE.Color();
    const roof = new THREE.Color();
    campusBuildings.forEach((b, i) => {
      if (!isGT(b)) {
        if (b.zone === "non_gt" && view !== "brand") paintBuilding(mesh, i, NON_GT_WALL, NON_GT_ROOF);
        else paintBuilding(mesh, i, CITY_WALL, CITY_ROOF);
      } else if (view === "zone") {
        paintBuilding(mesh, i, AREA_WALL[b.zone], AREA_ROOF[b.zone]);
      } else if (view === "heat") {
        const t = Math.pow((counts?.[b.id] ?? 0) / max, 0.6);
        wall.copy(COOL).lerp(HOT, t);
        roof.copy(wall).lerp(HOT, 0.35);
        paintBuilding(mesh, i, wall, roof);
      } else {
        paintBuilding(mesh, i, GT_WALL, GT_ROOF);
      }
    });
    if (hovered != null) paintBuilding(mesh, hovered, PICK_WALL, PICK_ROOF);
    if (selected != null) paintBuilding(mesh, selected, PICK_WALL, PICK_ROOF);
    markColorsDirty(mesh);
    invalidate();
  }, [mesh, view, counts, hovered, selected, invalidate]);

  // Picking: the hit triangle tells us which building it belongs to. Only GT buildings respond.
  const gtAt = (e: ThreeEvent<MouseEvent | PointerEvent>) => {
    if (e.faceIndex == null) return null;
    const i = buildingAtFace(mesh, e.faceIndex);
    return isGT(campusBuildings[i]) ? i : null;
  };
  const handlers = interactive
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
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
          if (i != null && e.delta <= 6) onSelect?.(campusBuildings[i]);
        },
      }
    : {};
  const selectedAnchor = selected != null ? anchor(campusBuildings[selected]) : null;

  // Free GPU memory when the scene goes away
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      roads.dispose();
    },
    [mesh, roads],
  );

  return (
    <group>
      {/* ground disc: fades into the fog at its edge */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[420, 48]} />
        <meshStandardMaterial color="#05233d" roughness={1} />
      </mesh>
      <mesh geometry={roads}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <mesh geometry={mesh.geometry} {...handlers}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {selectedAnchor && (
        <mesh rotation-x={-Math.PI / 2} position={[selectedAnchor.x, 0.12, selectedAnchor.z]}>
          <ringGeometry args={[selectedAnchor.reach + 0.6, selectedAnchor.reach + 1.1, 56]} />
          <meshBasicMaterial color="#e8cf7a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      {hovered != null && hovered !== selected && (
        <BuildingLabel b={campusBuildings[hovered]} count={view === "heat" ? (counts?.[campusBuildings[hovered].id] ?? 0) : undefined} />
      )}
      {selected != null && <BuildingLabel b={campusBuildings[selected]} count={view === "heat" ? (counts?.[campusBuildings[selected].id] ?? 0) : undefined} />}
    </group>
  );
}

export default function RealCampusScene({
  mode,
  view = "brand",
  counts,
  selected = null,
  onSelect,
  panel = "none",
  reducedMotion = false,
}: RealCampusSceneProps) {
  const selectedIndex = selected != null ? (INDEX_BY_ID.get(selected) ?? null) : null;
  const target = useMemo(() => {
    if (selectedIndex == null) return null;
    const a = anchor(campusBuildings[selectedIndex]);
    return { x: a.x, z: a.z };
  }, [selectedIndex]);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 32, near: 1, far: 1200, position: [0, 90, 150] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-label="3D map of the Georgia Tech campus"
      role="img"
    >
      <fog attach="fog" args={[FOG, 200, 560]} />
      <hemisphereLight args={["#a9cdf0", "#001326", 1.15]} />
      <directionalLight position={[-80, 120, 60]} intensity={1.5} color="#ffe9b0" />
      <directionalLight position={[90, 40, -80]} intensity={0.35} color="#5ad1e6" />

      <Campus view={view} counts={counts} interactive={mode !== "hero"} selected={selectedIndex} onSelect={onSelect} />
      {!reducedMotion && <Sparkles count={70} scale={[220, 26, 170]} position={[0, 22, 0]} size={5} speed={0.25} opacity={0.55} color="#d9cc97" />}

      <Rig mode={mode} target={target} panel={panel} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
