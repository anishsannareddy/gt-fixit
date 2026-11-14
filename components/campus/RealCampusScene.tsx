"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import campusJson from "@/data/campus.json";
import { buildBuildingMesh, buildRoadGeometry, markColorsDirty, paintBuilding, type CampusData } from "@/lib/campus/geometry";
import { FOG, Rig, type CampusMode } from "./CampusScene";

const campus = campusJson as unknown as CampusData;

export type RealCampusSceneProps = {
  /** hero: slow orbit, no interaction. (select / heat arrive in the next phases.) */
  mode: CampusMode;
  reducedMotion?: boolean;
};

// Phase A: every building one neutral navy; roofs a shade lighter so shapes read from above.
const WALL = new THREE.Color("#2a6497");
const ROOF = new THREE.Color("#6fa0c9");

/**
 * The real Georgia Tech campus: OpenStreetMap footprints extruded to their real heights.
 * All ~2,500 buildings are ONE merged mesh and all roads another, so the whole scene is a
 * handful of draw calls — that's what keeps it smooth on a phone.
 */
function Campus() {
  const mesh = useMemo(() => buildBuildingMesh(campus.buildings), []);
  const roads = useMemo(() => buildRoadGeometry(campus.roads), []);

  useEffect(() => {
    for (let i = 0; i < campus.buildings.length; i++) paintBuilding(mesh, i, WALL, ROOF);
    markColorsDirty(mesh);
  }, [mesh]);

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

export default function RealCampusScene({ mode, reducedMotion = false }: RealCampusSceneProps) {
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

      <Campus />
      {!reducedMotion && <Sparkles count={70} scale={[220, 26, 170]} position={[0, 22, 0]} size={5} speed={0.25} opacity={0.55} color="#d9cc97" />}

      <Rig mode={mode} target={null} panel="none" reducedMotion={reducedMotion} />
    </Canvas>
  );
}
