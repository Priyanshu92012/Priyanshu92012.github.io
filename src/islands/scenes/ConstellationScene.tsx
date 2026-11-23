// 3D Skills Constellation (lazy chunk). Same layout as the 2D map, lifted into depth.
// Nodes: domains (rings), projects (bright cores), skills (small stars). Edges are one
// LineSegments draw call with per-vertex colour; the focused neighbourhood lights up.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { constellationLayout, neighbourhood, VIEW, type CNode } from '../../lib/constellation';

type Props = {
  selected: string | null; hovered: string | null; domain: string | null; reduced: boolean;
  onSelect: (id: string | null) => void; onHover: (id: string | null) => void; onReady: () => void;
};

const S = 1 / 95;
const toWorld = (n: CNode): [number, number, number] => [(n.x - VIEW.w / 2) * S, -(n.y - VIEW.h / 2) * S, n.z * 2.4];

function Edges({ focus, domain }: { focus: string | null; domain: string | null }) {
  const L = constellationLayout();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(L.edges.length * 6);
    L.edges.forEach((e, i) => {
      pos.set(toWorld(L.byId.get(e.source)!), i * 6);
      pos.set(toWorld(L.byId.get(e.target)!), i * 6 + 3);
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(L.edges.length * 6), 3));
    return g;
  }, [L]);
  useEffect(() => {
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    const dimC = new THREE.Color('#1b2333');
    const baseC = new THREE.Color('#3A4660');
    L.edges.forEach((e, i) => {
      const lit = !!focus && (e.source === focus || e.target === focus);
      const a = L.byId.get(e.source)!, b = L.byId.get(e.target)!;
      const inD = !domain || a.domain === domain || b.domain === domain;
      if (lit) c.set((L.byId.get(focus!) ?? a).color); else c.copy(focus || !inD ? dimC : baseC);
      col.setXYZ(i * 2, c.r, c.g, c.b); col.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [geo, focus, domain, L]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  );
}

function Node({ n, state, onSelect, onHover, reduced }: { n: CNode; state: 'sel' | 'hood' | 'dim' | 'idle'; onSelect: (id: string) => void; onHover: (id: string | null) => void; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const base = nodeSize(n);
  const color = useMemo(() => new THREE.Color(n.color), [n.color]);
  const seed = useMemo(() => (n.x * 13 + n.y * 7) % 6.28, [n]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = state === 'sel' ? 1.7 : state === 'hood' ? 1.25 : 1;
    const pulse = reduced ? 1 : 1 + Math.sin(clock.elapsedTime * 1.6 + seed) * 0.06;
    ref.current.scale.lerp(new THREE.Vector3(k * pulse, k * pulse, k * pulse), reduced ? 1 : 0.18);
  });
  const opacity = state === 'dim' ? 0.18 : 1;
  return (
    <group position={toWorld(n)}>
      <mesh ref={ref}
        onClick={(e) => { e.stopPropagation(); onSelect(n.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(n.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}>
        {n.kind === 'domain' ? <torusGeometry args={[base, 0.035, 12, 48]} /> : <sphereGeometry args={[base, 20, 20]} />}
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {n.kind !== 'skill' && state !== 'dim' && (
        <mesh scale={2.6}>
          <sphereGeometry args={[base, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={state === 'sel' ? 0.16 : 0.07} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

const showLabelFor = (n: CNode, state: 'sel' | 'hood' | 'dim' | 'idle') => n.kind === 'domain' || state === 'sel' || state === 'hood' || (n.kind === 'project' && state === 'idle');
const nodeSize = (n: CNode) => (n.kind === 'domain' ? 0.2 : n.kind === 'project' ? 0.07 + n.weight * 0.022 : 0.045 + Math.min(n.weight, 5) * 0.012);

/** DOM labels in this component's own React tree, projected every rendered frame (no per-label React roots). */
function LabelProjector({ pins }: { pins: React.RefObject<Record<string, HTMLDivElement | null>> }) {
  const L = constellationLayout();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const n of L.nodes) {
      const el = pins.current?.[n.id];
      if (!el || el.hidden) continue;
      const [x, y, z] = toWorld(n);
      v.set(x, y + nodeSize(n) + 0.16, z).project(camera);
      el.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.visibility = v.z < 1 ? 'visible' : 'hidden';
    }
  });
  return null;
}

function Stars({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 700, p = new Float32Array(n * 3);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { const r = 9 + rnd() * 14, t = rnd() * Math.PI * 2, f = Math.acos(2 * rnd() - 1); p.set([r * Math.sin(f) * Math.cos(t), r * Math.sin(f) * Math.sin(t), r * Math.cos(f)], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dt) => { if (ref.current && !reduced) ref.current.rotation.y += dt * 0.01; });
  return <points ref={ref} geometry={geo}><pointsMaterial size={0.035} color="#8C97AA" transparent opacity={0.55} sizeAttenuation /></points>;
}

/** Ease the orbit target towards the selected node. */
function Focus({ target, controls, reduced }: { target: [number, number, number] | null; reduced: boolean; controls: React.RefObject<{ target: THREE.Vector3; update: () => void } | null> }) {
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    goal.set(...(target ?? [0, 0, 0]));
    c.target.lerp(goal, reduced ? 1 : 0.06);
    c.update();
  });
  return null;
}

function Invalidate({ sig }: { sig: string }) {
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [sig, invalidate]);
  return null;
}

export default function ConstellationScene({ selected, hovered, domain, reduced, onSelect, onHover, onReady }: Props) {
  const L = useMemo(() => constellationLayout(), []);
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const pins = useRef<Record<string, HTMLDivElement | null>>({});
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 1.75));
  const focus = hovered ?? selected;
  const hood = neighbourhood(focus);
  const sel = selected ? L.byId.get(selected) : null;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);

  const stateOf = (n: CNode) => {
    if (focus === n.id) return 'sel' as const;
    if (hood) return hood.has(n.id) ? ('hood' as const) : ('dim' as const);
    if (domain && n.domain !== domain) return 'dim' as const;
    return 'idle' as const;
  };

  return (
    <div ref={host} className="cst-canvas">
      <Canvas
        dpr={dpr}
        frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 11.5], fov: 42, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => { gl.setClearColor(new THREE.Color('#090C12'), 0); requestAnimationFrame(() => onReady()); }}
        onPointerMissed={() => onSelect(null)}
        aria-hidden="true"
      >
        <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.5))} />
        {reduced && <Invalidate sig={`${selected}|${hovered}|${domain}`} />}
        <fog attach="fog" args={['#090C12', 12, 26]} />
        <Stars reduced={reduced} />
        <Edges focus={focus} domain={domain} />
        {L.nodes.map((n) => <Node key={n.id} n={n} state={stateOf(n)} onSelect={onSelect} onHover={onHover} reduced={reduced} />)}
        <OrbitControls ref={controls as never} makeDefault enablePan={false} enableZoom={false} enableDamping={!reduced}
          autoRotate={!reduced && !selected} autoRotateSpeed={0.35} />
        <Focus target={sel ? toWorld(sel) : null} controls={controls} reduced={reduced} />
        <LabelProjector pins={pins} />
      </Canvas>
      <div className="lab-labels" aria-hidden="true">
        {L.nodes.map((n) => {
          const st = stateOf(n);
          return (
            <div key={n.id} className="lab-pin" ref={(el) => { pins.current[n.id] = el; }} style={{ visibility: 'hidden' }} hidden={!showLabelFor(n, st)}>
              <span className={`lab-label${st === 'sel' ? ' selected' : ''}${st === 'dim' ? ' dim' : ''}`} style={{ ['--c' as string]: n.color }}>
                {n.kind === 'domain' ? <span>{n.label.toUpperCase()}</span> : n.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="cst-hint mono muted">Drag to orbit · click a star to inspect it</p>
    </div>
  );
}
