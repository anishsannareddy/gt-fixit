"use client";

import { ContactShadows, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AREA_META } from "@/lib/campus/areas";
import { buildBuildingMesh, buildRoadGeometry, buildingAtFace, HEIGHT_EXAGGERATION, markColorsDirty, paintBuilding } from "@/lib/campus/geometry";
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
  /**
   * "full": one soft directional shadow map (laptops).
   * "lite": a single baked contact shadow under the buildings (phones; much cheaper).
   */
  shadows?: "full" | "lite";
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

const INDEX_BY_ID = new Map(campusBuildings.map((b, i) => [b.id, i]));

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
  const mesh = useMemo(() => buildBuildingMesh(campusBuildings), []);
  const roads = useMemo(() => buildRoadGeometry(campusRoads), []);
  // With reduced motion the scene only redraws on request, so ask for a frame after recolouring.
  const invalidate = useThree((three) => three.invalidate);

  useEffect(() => {
    campusBuildings.forEach((b, i) => {
      if (!isGT(b)) {
        if (b.zone === "non_gt" && view !== "brand") paintBuilding(mesh, i, NON_GT_WALL, NON_GT_ROOF);
        else paintBuilding(mesh, i, CITY_WALL, CITY_ROOF);
      } else if (view === "zone") {
        paintBuilding(mesh, i, AREA_WALL[b.zone], AREA_ROOF[b.zone]);
      } else if (view === "heat") {
        const band = heatBand(counts?.[b.id] ?? 0);
        paintBuilding(mesh, i, HEAT_WALL[band], HEAT_ROOF[band]);
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
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <circleGeometry args={[700, 64]} />
        <meshStandardMaterial color="#e3e9ef" roughness={1} />
      </mesh>
      <mesh geometry={roads}>
        <meshBasicMaterial vertexColors />
      </mesh>
      <mesh geometry={mesh.geometry} castShadow receiveShadow {...handlers}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
      {selectedAnchor && (
        <mesh rotation-x={-Math.PI / 2} position={[selectedAnchor.x, 0.12, selectedAnchor.z]}>
          <ringGeometry args={[selectedAnchor.reach + 0.6, selectedAnchor.reach + 1.1, 56]} />
          <meshBasicMaterial color="#003057" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {view === "heat" && <HotSpotPins counts={counts} />}
      {hovered != null && hovered !== selected && (
        <BuildingLabel b={campusBuildings[hovered]} count={view === "heat" ? (counts?.[campusBuildings[hovered].id] ?? 0) : undefined} />
      )}
      {selected != null && <BuildingLabel b={campusBuildings[selected]} count={view === "heat" ? (counts?.[campusBuildings[selected].id] ?? 0) : undefined} />}
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

export default function RealCampusScene({
  mode,
  shadows = "lite",
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
    const a = anchor(campusBuildings[selectedIndex]);
    return { x: a.x, z: a.z };
  }, [selectedIndex]);
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows={shadows === "full" ? "soft" : false}
      camera={{ fov: 32, near: 1, far: 2000, position: [0, 90, 150] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-label="3D map of the Georgia Tech campus"
      role="img"
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 320, 900]} />
      <hemisphereLight args={["#ffffff", "#c9d3dd", 1.6]} />
      <directionalLight
        position={[-120, 170, 90]}
        intensity={1.5}
        color="#fff6e3"
        castShadow={shadows === "full"}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
        shadow-radius={6}
        shadow-camera-left={-190}
        shadow-camera-right={190}
        shadow-camera-top={190}
        shadow-camera-bottom={-190}
        shadow-camera-near={10}
        shadow-camera-far={500}
      />
      <directionalLight position={[110, 60, -90]} intensity={0.35} color="#dbe8f5" />
      {shadows === "lite" && <ContactShadows position={[0, 0.02, 0]} scale={380} resolution={1024} blur={2.2} opacity={0.32} far={40} frames={1} color="#2a3f55" />}

      <Campus view={view} counts={counts} interactive={mode !== "hero"} selected={selectedIndex} onSelect={onSelect} />

      <Rig mode={mode} target={target} panel={panel} reducedMotion={reducedMotion} frame={GT_FRAME} bounds={ALL_BOUNDS} resetKey={resetKey} />
    </Canvas>
  );
}
