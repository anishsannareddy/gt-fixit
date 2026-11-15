"use client";

import { CameraControls, CameraControlsImpl, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LANDMARKS, type CampusBuilding } from "@/lib/campus/layout";

export type CampusMode = "hero" | "select" | "heat";

export type CampusSceneProps = {
  buildings: CampusBuilding[];
  /** hero: slow orbit, no interaction · select: pick a building · heat: size + glow by open-request count */
  mode: CampusMode;
  /** Selected building name (names are unique). */
  selected?: string | null;
  onSelect?: (building: CampusBuilding) => void;
  /** Open-request count per building name (heat mode). */
  counts?: Record<string, number>;
  /** Where the open panel sits, so the selected building is framed in the visible part of the screen. */
  panel?: "none" | "bottom" | "right";
  reducedMotion?: boolean;
};

// ───────── palette (navy + gold) ─────────
const BODY: Record<CampusBuilding["type"], string> = {
  residence: "#2b6ca3",
  academic: "#1d4e7a",
  dining: "#b3a369",
  athletic: "#2f7fa8",
  other: "#3a7fb5",
};
const ROOF: Record<CampusBuilding["type"], string> = {
  residence: "#8fb4d6",
  academic: "#d9cc97",
  dining: "#efe6bd",
  athletic: "#a9d3ea",
  other: "#d9cc97",
};
const GOLD = new THREE.Color("#e8cf7a");
const COOL = new THREE.Color("#17456e");
export const FOG = "#eef3f8";

/**
 * BLOCK CAMPUS (fallback). 45 hand-placed boxes from lib/campus/layout.ts.
 * The real campus lives in RealCampusScene.tsx; this one is shown if that fails to load.
 */

/** Small deterministic random generator, so trees land in the same place on every render. */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────── ground, roads, lawn, trees ─────────
function Ground({ buildings }: { buildings: CampusBuilding[] }) {
  const trees = useRef<THREE.InstancedMesh>(null);

  const treeSpots = useMemo(() => {
    const rand = prng(7);
    const spots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 900 && spots.length < 170; i++) {
      const x = -98 + rand() * 200;
      const z = -70 + rand() * 142;
      const s = 0.7 + rand() * 0.8;
      const inBuilding = buildings.some((b) => Math.abs(x - b.x) < b.w / 2 + 1.2 && Math.abs(z - b.z) < b.d / 2 + 1.2);
      const onRoad = LANDMARKS.roads.some(([x1, z1, x2, z2]) =>
        x1 === x2 ? Math.abs(x - x1) < 1.4 && z > Math.min(z1, z2) && z < Math.max(z1, z2) : Math.abs(z - z1) < 1.4 && x > Math.min(x1, x2) && x < Math.max(x1, x2),
      );
      const g = LANDMARKS.techGreen;
      const onGreen = Math.abs(x - g.x) < g.w / 2 && Math.abs(z - g.z) < g.d / 2;
      if (!inBuilding && !onRoad && !onGreen) spots.push({ x, z, s });
    }
    return spots;
  }, [buildings]);

  useEffect(() => {
    const mesh = trees.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    treeSpots.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 0.75 * t.s, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [treeSpots]);

  const g = LANDMARKS.techGreen;
  return (
    <group>
      {/* ground disc: fades into the fog at its edge */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[260, 40]} />
        <meshStandardMaterial color="#e3e9ef" roughness={1} />
      </mesh>
      {/* roads */}
      {LANDMARKS.roads.map(([x1, z1, x2, z2], i) => (
        <mesh key={i} position={[(x1 + x2) / 2, 0.02, (z1 + z2) / 2]}>
          <boxGeometry args={[Math.abs(x2 - x1) || 1.6, 0.04, Math.abs(z2 - z1) || 1.6]} />
          <meshStandardMaterial color="#cdd6e0" roughness={1} />
        </mesh>
      ))}
      {/* Tech Green */}
      <mesh position={[g.x, 0.06, g.z]}>
        <boxGeometry args={[g.w, 0.12, g.d]} />
        <meshStandardMaterial color="#b9d3b0" roughness={1} flatShading />
      </mesh>
      {/* low-poly trees (one draw call) */}
      <instancedMesh ref={trees} args={[undefined, undefined, treeSpots.length]}>
        <coneGeometry args={[0.55, 1.5, 5]} />
        <meshStandardMaterial color="#8db58a" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

// ───────── one building ─────────
function Block({
  b,
  interactive,
  selected,
  heat,
  count,
  onSelect,
}: {
  b: CampusBuilding;
  interactive: boolean;
  selected: boolean;
  /** 0–1 in heat mode, null otherwise. */
  heat: number | null;
  count: number;
  onSelect?: (b: CampusBuilding) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Heat mode: busier buildings grow taller. Selection adds a small "pop".
  const targetScale = (heat != null ? 1 + heat * 1.6 : 1) * (selected ? 1.12 : 1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const next = THREE.MathUtils.damp(g.scale.y, targetScale, 6, dt);
    if (Math.abs(next - g.scale.y) > 0.0005) g.scale.y = next;
  });

  const body = useMemo(() => {
    if (heat == null) return new THREE.Color(BODY[b.type]);
    return COOL.clone().lerp(GOLD, Math.pow(heat, 0.7));
  }, [heat, b.type]);
  const glow = selected ? 0.55 : hovered ? 0.3 : heat != null ? heat * 0.7 : 0;

  const handlers = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHovered(false);
          document.body.style.cursor = "";
        },
        // e.delta = how far the pointer moved between press and release; ignore drags
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta <= 6) onSelect?.(b);
        },
      }
    : {};

  const showLabel = interactive && (hovered || selected);
  return (
    <group position={[b.x, 0, b.z]}>
      <group ref={group} {...handlers}>
        <mesh position-y={b.h / 2}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={body} emissive={GOLD} emissiveIntensity={glow} roughness={0.85} flatShading />
        </mesh>
        <mesh position-y={b.h + 0.09}>
          <boxGeometry args={[b.w + 0.25, 0.18, b.d + 0.25]} />
          <meshStandardMaterial color={selected || (heat ?? 0) > 0.5 ? "#f3e3a0" : ROOF[b.type]} roughness={0.7} flatShading />
        </mesh>
      </group>
      {/* soft contact shadow instead of real shadow maps (cheap on phones) */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <planeGeometry args={[b.w + 1.6, b.d + 1.6]} />
        <meshBasicMaterial color="#2a3f55" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
          <ringGeometry args={[Math.max(b.w, b.d) * 0.72, Math.max(b.w, b.d) * 0.72 + 0.35, 48]} />
          <meshBasicMaterial color="#e8cf7a" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      {showLabel && (
        <Html position={[0, b.h * targetScale + 2.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="glass-strong flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-panel">
            {b.name}
            {heat != null && <span className="rounded-full bg-gt-gold px-1.5 font-mono text-[0.65rem] text-navy-950">{count} open</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

// ───────── camera ─────────
/** Camera rig shared by the real campus and this block fallback: overview, slow orbit, fly-to-target. */
export function Rig({
  mode,
  target,
  panel,
  reducedMotion,
}: {
  mode: CampusMode;
  /** Scene-unit position to fly to, or null for the overview. */
  target: { x: number; z: number } | null;
  panel: "none" | "bottom" | "right";
  reducedMotion: boolean;
}) {
  const controls = useRef<CameraControlsImpl>(null);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const userMoved = useRef(false);
  const hadTargetRef = useRef(false);
  const smooth = !reducedMotion;

  // Portrait phones need to stand further back to fit the (wide) campus.
  const overview = useMemo(() => {
    const dist = aspect < 0.8 ? 300 : aspect < 1.3 ? 230 : 175;
    return { x: 0, y: dist * 0.5, z: dist * 0.86 };
  }, [aspect]);

  // Fly to the selected building, or back out to the overview.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const hadTarget = hadTargetRef.current;
    hadTargetRef.current = Boolean(target);
    if (!target) {
      // Closing a building flies back out. Otherwise only set the overview if the user hasn't moved the camera.
      if (hadTarget) c.setLookAt(overview.x, overview.y, overview.z, 0, 0, 2, smooth);
      else if (mode === "hero" || !userMoved.current) c.setLookAt(overview.x, overview.y, overview.z, 0, 0, mode === "hero" ? -4 : 2, false);
      return;
    }
    // Keep the current viewing direction; just move in close.
    const pos = c.getPosition(new THREE.Vector3());
    const look = c.getTarget(new THREE.Vector3());
    const dir = pos.sub(look).setY(0).normalize();
    if (dir.lengthSq() === 0) dir.set(0, 0, 1);
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    const focus = new THREE.Vector3(target.x, 0, target.z);
    // Shift the look-at point so the building sits in the part of the screen the panel doesn't cover.
    if (panel === "bottom") focus.addScaledVector(dir, 11);
    if (panel === "right") focus.addScaledVector(right, 9);
    const reach = panel === "bottom" ? 52 : 42;
    c.setLookAt(focus.x + dir.x * reach, reach * 0.8, focus.z + dir.z * reach, focus.x, 0, focus.z, smooth);
    userMoved.current = true;
  }, [target, panel, overview, mode, smooth]);

  // Slow auto-orbit until the user takes over (always on in hero mode).
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || reducedMotion) return;
    if (mode === "hero" || (!userMoved.current && !target)) c.rotate(dt * (mode === "hero" ? 0.05 : 0.03), 0, false);
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      enabled={mode !== "hero"}
      minPolarAngle={0.25}
      maxPolarAngle={1.25}
      minDistance={28}
      maxDistance={340}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      dollySpeed={0.6}
      truckSpeed={1.2}
      onStart={() => {
        userMoved.current = true;
      }}
    />
  );
}

// ───────── scene ─────────
export default function CampusScene({
  buildings,
  mode,
  selected = null,
  onSelect,
  counts,
  panel = "none",
  reducedMotion = false,
}: CampusSceneProps) {
  const maxCount = useMemo(() => Math.max(1, ...Object.values(counts ?? {})), [counts]);
  const target = useMemo(() => buildings.find((b) => b.name === selected) ?? null, [buildings, selected]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 32, near: 1, far: 900, position: [0, 90, 150] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      // "demand" = only redraw when something changes (used when the visitor asks for reduced motion)
      frameloop={reducedMotion ? "demand" : "always"}
      aria-label="3D map of the Georgia Tech campus"
      role="img"
    >
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 190, 520]} />
      <hemisphereLight args={["#ffffff", "#c9d3dd", 1.6]} />
      <directionalLight position={[-80, 120, 60]} intensity={1.4} color="#fff6e3" />
      <directionalLight position={[90, 40, -80]} intensity={0.35} color="#dbe8f5" />

      <Ground buildings={buildings} />
      {buildings.map((b) => {
        const count = counts?.[b.name] ?? 0;
        return (
          <Block
            key={b.name}
            b={b}
            interactive={mode !== "hero"}
            selected={b.name === selected}
            heat={mode === "heat" ? count / maxCount : null}
            count={count}
            onSelect={onSelect}
          />
        );
      })}

      <Rig mode={mode} target={target} panel={panel} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
