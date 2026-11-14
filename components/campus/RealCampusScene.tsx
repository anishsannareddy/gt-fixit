"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AREA_META } from "@/lib/campus/areas";
import { buildBuildingMesh, buildRoadGeometry, markColorsDirty, paintBuilding } from "@/lib/campus/geometry";
import { campusBuildings, campusRoads, isGT } from "@/lib/campus/zones";
import { FOG, Rig, type CampusMode } from "./CampusScene";

/**
 * How buildings are coloured:
 *   brand: GT buildings navy with gold roofs, city dimmed (landing page)
 *   zone:  GT buildings by maintenance area
 *   heat:  GT buildings by open-request count (cool navy → gold)
 */
export type CampusView = "brand" | "zone" | "heat";

export type RealCampusSceneProps = {
  /** hero: slow orbit, no interaction. (select arrives in the next phase.) */
  mode: CampusMode;
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

const AREA_WALL = Object.fromEntries(Object.entries(AREA_META).map(([k, m]) => [k, new THREE.Color(m.color).multiplyScalar(0.8)]));
const AREA_ROOF = Object.fromEntries(Object.entries(AREA_META).map(([k, m]) => [k, new THREE.Color(m.color).lerp(new THREE.Color("#ffffff"), 0.18)]));

/**
 * The real Georgia Tech campus: OpenStreetMap footprints extruded to their real heights.
 * All ~2,500 buildings are ONE merged mesh and all roads another, so the whole scene is a
 * handful of draw calls — that's what keeps it smooth on a phone. Colour changes just rewrite
 * each building's block of vertex colours.
 */
function Campus({ view, counts }: { view: CampusView; counts?: Record<string, number> }) {
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
    markColorsDirty(mesh);
    invalidate();
  }, [mesh, view, counts, invalidate]);

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
      <mesh geometry={mesh.geometry}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
    </group>
  );
}

export default function RealCampusScene({ mode, view = "brand", counts, reducedMotion = false }: RealCampusSceneProps) {
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

      <Campus view={view} counts={counts} />
      {!reducedMotion && <Sparkles count={70} scale={[220, 26, 170]} position={[0, 22, 0]} size={5} speed={0.25} opacity={0.55} color="#d9cc97" />}

      <Rig mode={mode} target={null} panel="none" reducedMotion={reducedMotion} />
    </Canvas>
  );
}
