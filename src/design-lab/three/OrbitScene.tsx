// Concept B: “Orbit”, a gyroscope of three project orbits around the portrait.
// - The HTML portrait stays the visible image (and the LCP). Here an invisible, depth-only plane
//   cut from the same image's alpha hides orbit segments that pass behind the person.
// - Each orbit's beads move like its project: reservations hop between slots (scheduler), requests
//   pause at gates and occasionally get stopped (SecureMed), attributions swell and change sign (XAI).
// - Pointer drives a damped spring; hover/click select an orbit. No textures are downloaded except
//   the already-cached portrait.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RINGS, COLORS, CENTER, ringPoint, type RingDef } from './orbit-geometry';

type Box = { cx: number; cy: number; s: number };
const TAU = Math.PI * 2;
const WARN = new THREE.Color('#ff5a6a');

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Bead = { a: number; target: number; hold: number; warn: number; size: number; sign: number };

function Ring({ def, size, state, dot, onHover, onSelect }: {
  def: RingDef; size: number; state: 'hot' | 'dim' | 'idle'; dot: THREE.Texture;
  onHover: (s: string | null) => void; onSelect: (s: string) => void;
}) {
  const spin = useRef<THREE.Group>(null);
  const line = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const pts = useRef<THREE.Points>(null);
  const color = useMemo(() => new THREE.Color(COLORS[def.domain]), [def.domain]);
  const R = def.r * size;
  const n = def.domain === 'systems' ? 6 : def.domain === 'security' ? 9 : 13;
  const beads = useMemo<Bead[]>(() => Array.from({ length: n }, (_, i) => {
    const a = def.domain === 'systems' ? (i * TAU) / 8 : (i * TAU) / n;
    return { a, target: a, hold: 0.6 + i * 0.37, warn: 0, size: 1, sign: i % 3 === 0 ? -1 : 1 };
  }), [def.domain, n]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return g;
  }, [n]);
  const gates = [0.4, 2.3, 4.2];
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const k = 1 - Math.pow(0.002, dt);
    if (spin.current) spin.current.rotation.z += def.speed * dt * (state === 'hot' ? 2.2 : 1);
    const op = state === 'hot' ? 1 : state === 'dim' ? 0.16 : 0.55;
    if (line.current) line.current.opacity += (op - line.current.opacity) * k;
    if (glow.current) glow.current.opacity += ((state === 'hot' ? 0.16 : 0.05) - glow.current.opacity) * k;

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    beads.forEach((b, i) => {
      if (def.domain === 'systems') {
        // reservations: hold a slot, then hop to the next one; now and then a lease expires
        b.hold -= dt;
        if (b.hold <= 0) { b.target += TAU / 8; b.hold = 1.4 + ((i * 7919) % 13) / 6; if ((i + Math.floor(t)) % 11 === 0) b.warn = 1; }
        b.a += (b.target - b.a) * (1 - Math.pow(0.02, dt));
      } else if (def.domain === 'security') {
        // requests flow, slow down at three gates; every few seconds one is stopped
        const near = gates.some((g) => Math.abs(((b.a - g) % TAU + TAU) % TAU) < 0.12);
        b.a += dt * (near ? 0.12 : 0.55);
        if (near && b.warn === 0 && Math.floor(t * 0.25 + i) % 9 === 0 && Math.sin(t * 3 + i) > 0.97) b.warn = 1.2;
      } else {
        // attributions: size and sign swell and flip as the sentence changes
        b.a += dt * 0.32;
        const w = Math.sin(t * 0.7 + i * 1.7);
        b.size = 0.6 + Math.abs(w) * 1.4;
        b.sign = w >= 0 ? 1 : -1;
      }
      b.warn = Math.max(0, b.warn - dt * 0.8);
      const [x, y, z] = ringPoint({ rx: 0, rz: 0 }, b.a, R);
      pos.setXYZ(i, x, y, z);
      if (def.domain === 'ai') tmp.copy(b.sign > 0 ? color : WARN).multiplyScalar(0.55 + b.size * 0.3);
      else tmp.copy(color).lerp(WARN, Math.min(1, b.warn));
      const fade = state === 'dim' ? 0.25 : 1;
      col.setXYZ(i, tmp.r * fade, tmp.g * fade, tmp.b * fade);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
  });

  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(def.slug); document.body.style.cursor = 'pointer'; };
  const out = () => { onHover(null); document.body.style.cursor = ''; };

  return (
    <group rotation={[0, 0, def.rz]}>
      <group rotation={[def.rx, 0, 0]}>
        <group ref={spin}>
          <mesh>
            <torusGeometry args={[R, 0.0042 * size, 6, 240]} />
            <meshBasicMaterial ref={line} color={color} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[R, 0.022 * size, 8, 180]} />
            <meshBasicMaterial ref={glow} color={color} transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <points ref={pts} geometry={geo}>
            <pointsMaterial map={dot} vertexColors size={0.07 * size} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </points>
          {def.domain === 'security' && gates.map((g) => (
            <mesh key={g} rotation={[0, 0, g - 0.06]}>
              <torusGeometry args={[R, 0.012 * size, 6, 12, 0.12]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* fat invisible hit area */}
        <mesh onPointerOver={over} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onSelect(def.slug); }}>
          <torusGeometry args={[R, 0.05 * size, 6, 96]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function Gyro({ box, portraitSrc, selected, hovered, onHover, onSelect }: {
  box: Box; portraitSrc: string; selected: string | null; hovered: string | null; onHover: (s: string | null) => void; onSelect: (s: string) => void;
}) {
  const { viewport } = useThree();
  const tex = useLoader(THREE.TextureLoader, portraitSrc);
  const dot = useMemo(dotTexture, []);
  const gyro = useRef<THREE.Group>(null);
  const spring = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e: PointerEvent) => { pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 }; };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const size = box.s * viewport.height;
  const px = (box.cx - 0.5) * viewport.width;
  const py = -(box.cy - 0.5) * viewport.height;
  const cx = px + (CENTER.x - 0.5) * size;
  const cy = py - (CENTER.y - 0.5) * size;

  useFrame((_, dt) => {
    const s = spring.current, d = Math.min(dt, 0.05);
    const tx = pointer.current.y * 0.22, ty = pointer.current.x * 0.38;
    s.vx += ((tx - s.x) * 9 - s.vx * 4.2) * d; s.x += s.vx * d; // damped spring: a little overshoot, then settles
    s.vy += ((ty - s.y) * 9 - s.vy * 4.2) * d; s.y += s.vy * d;
    if (gyro.current) { gyro.current.rotation.x = s.x; gyro.current.rotation.y = s.y; }
  });

  const hot = hovered ?? selected;
  return (
    <>
      {/* depth-only occluder in the exact shape of the person */}
      <mesh position={[px, py, 0]} renderOrder={-1}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={tex} alphaTest={0.5} colorWrite={false} />
      </mesh>
      <group ref={gyro} position={[cx, cy, 0]}>
        {RINGS.map((r) => (
          <Ring key={r.slug} def={r} size={size} dot={dot} state={hot ? (hot === r.slug ? 'hot' : 'dim') : 'idle'} onHover={onHover} onSelect={onSelect} />
        ))}
      </group>
    </>
  );
}

export default function OrbitScene(props: {
  box: Box; portraitSrc: string; selected: string | null; hovered: string | null;
  onHover: (s: string | null) => void; onSelect: (s: string | null) => void; onReady: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="o-canvas" ref={wrap} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 10], fov: 32, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); requestAnimationFrame(() => props.onReady()); }}
        onPointerMissed={() => props.onSelect(null)}
      >
        <Gyro box={props.box} portraitSrc={props.portraitSrc} selected={props.selected} hovered={props.hovered} onHover={props.onHover} onSelect={(s) => props.onSelect(s)} />
      </Canvas>
    </div>
  );
}
