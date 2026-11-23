// Spatial Lab: the 3D hero. Lazy chunk; never on the critical path.
// Visual encodings are data: height = public evidence, colour = domain,
// striped cap = in progress, dashed shell = case study pending, traces = shared skills.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { labModules, labTraces, FOOTPRINT, type LabModule } from '../../lib/lab';
import { declutter, type LabelBox } from '../../lib/labels';
import { STATUS_LABEL } from '../../data/index';

export type LabSceneProps = {
  selected: string | null;
  hovered: string | null;
  domain: string | null;
  reduced: boolean;
  compact: boolean;
  onSelect: (slug: string | null) => void;
  onHover: (slug: string | null) => void;
  onReady: () => void;
  onStats?: (s: { dpr: number; fps: number }) => void;
};

const BG = new THREE.Color('#090C12');

// ── floor shader ────────────────────────────────────────────────────
const floorVert = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const floorFrag = /* glsl */`
  varying vec3 vWorld;
  uniform float uTime; uniform float uMotion;
  uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
  uniform vec2 uFocus; uniform float uFocusAmt;
  float grid(vec2 p, float s) {
    vec2 q = p / s;
    vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vWorld.xz;
    float minor = grid(p, 0.5) * 0.10;
    float major = grid(p, 2.5) * 0.28;
    vec3 tintX0 = mix(uC0, uC1, step(0.0, p.x));
    vec3 tintX1 = mix(uC3, uC2, step(0.0, p.x));
    vec3 tint = mix(tintX0, tintX1, step(0.0, p.y));
    float qd = length(p - sign(p) * 2.6);
    float glow = exp(-qd * qd * 0.16) * 0.20;
    float diag = (p.x + p.y) * 0.5;
    float sweep = fract(uTime * 0.045) * 18.0 - 9.0;
    float scan = exp(-pow((diag - sweep) * 1.4, 2.0)) * 0.22 * uMotion;
    float fd = length(p - uFocus);
    float ring = uFocusAmt * (exp(-fd * fd * 1.1) * 0.22 + smoothstep(0.05, 0.0, abs(fd - 1.05 - 0.08 * sin(uTime * 2.4))) * 0.55);
    float cross = (1.0 - smoothstep(0.0, 0.025, abs(p.x))) + (1.0 - smoothstep(0.0, 0.025, abs(p.y)));
    float edge = smoothstep(5.9, 4.4, max(abs(p.x), abs(p.y)));
    vec3 col = vec3(0.045, 0.06, 0.09) + tint * glow + vec3(0.56, 0.63, 0.76) * (minor + major + cross * 0.08) + tint * scan + vec3(0.545, 1.0, 0.69) * ring;
    gl_FragColor = vec4(col, edge * 0.96);
  }`;

function Floor({ focus, reduced }: { focus: LabModule | null; reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uMotion: { value: reduced ? 0 : 1 },
    uC0: { value: new THREE.Color('#7A8CFF') }, uC1: { value: new THREE.Color('#8BFFB0') },
    uC2: { value: new THREE.Color('#FF885E') }, uC3: { value: new THREE.Color('#C9D3E3') },
    uFocus: { value: new THREE.Vector2(0, 0) }, uFocusAmt: { value: 0 },
  }), [reduced]);
  useFrame((_, dt) => {
    const u = uniforms;
    u.uTime.value += reduced ? 0 : dt;
    const target = focus ? 1 : 0;
    u.uFocusAmt.value += (target - u.uFocusAmt.value) * (reduced ? 1 : Math.min(1, dt * 5));
    if (focus) u.uFocus.value.set(focus.x, focus.z);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0}>
      <planeGeometry args={[12, 12, 1, 1]} />
      <shaderMaterial ref={mat} vertexShader={floorVert} fragmentShader={floorFrag} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

// ── module cap shader: glowing border, stripes for in-progress ─────
const capFrag = /* glsl */`
  varying vec2 vUv;
  uniform vec3 uColor; uniform float uIntensity; uniform float uStripes; uniform float uTime;
  void main() {
    vec2 d = min(vUv, 1.0 - vUv);
    float border = 1.0 - smoothstep(0.0, 0.07, min(d.x, d.y));
    float inner = smoothstep(0.32, 0.30, length(vUv - 0.5)) - smoothstep(0.30, 0.28, length(vUv - 0.5));
    float stripes = uStripes * step(0.5, fract((vUv.x + vUv.y) * 7.0 - uTime * 0.4)) * 0.35;
    float a = border * 0.95 + inner * 0.6 + stripes + 0.10;
    gl_FragColor = vec4(uColor * (0.55 + uIntensity), clamp(a * (0.45 + uIntensity * 0.6), 0.0, 1.0));
  }`;
const capVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

let shadowTex: THREE.Texture | null = null;
function getShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

/** Current vertical lift of each module, published by Module and read by the label projector. */
type Lifts = Record<string, number>;

function Module({ m, state, reduced, lifts, onSelect, onHover }: {
  m: LabModule; state: 'idle' | 'hover' | 'selected' | 'dim'; reduced: boolean; lifts: Lifts;
  onSelect: (s: string) => void; onHover: (s: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(m.color), [m.color]);
  const pending = m.project.evidence === 'pending';
  const wip = m.project.status === 'in-progress';
  const edges = useMemo(() => {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(FOOTPRINT, m.h, FOOTPRINT));
    return g;
  }, [m.h]);
  const edgeMat = useMemo(() => (pending
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.9 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })), [pending, color]);
  const edgeObj = useMemo(() => { const l = new THREE.LineSegments(edges, edgeMat); l.computeLineDistances(); return l; }, [edges, edgeMat]);
  const capUniforms = useMemo(() => ({ uColor: { value: color }, uIntensity: { value: 0.2 }, uStripes: { value: wip ? 1 : 0 }, uTime: { value: 0 } }), [color, wip]);

  useFrame((_, dt) => {
    const g = group.current; if (!g) return;
    const lift = state === 'selected' ? 0.38 : state === 'hover' ? 0.14 : 0;
    const k = reduced ? 1 : Math.min(1, dt * 7);
    g.position.y += (lift - g.position.y) * k;
    lifts[m.slug] = g.position.y;
    const targetI = state === 'selected' ? 1.0 : state === 'hover' ? 0.6 : state === 'dim' ? 0.02 : 0.22;
    capUniforms.uIntensity.value += (targetI - capUniforms.uIntensity.value) * k;
    if (!reduced) capUniforms.uTime.value += dt;
    edgeMat.opacity = state === 'dim' ? 0.18 : 0.9;
    if (body.current) {
      body.current.opacity = pending ? 0.05 : state === 'dim' ? 0.35 : 1;
      body.current.emissiveIntensity += ((state === 'selected' ? 0.22 : 0.05) - body.current.emissiveIntensity) * k;
    }
    if (beam.current) {
      const s = beam.current.scale;
      const t = state === 'selected' ? 1 : 0;
      s.y += (t - s.y) * k; beam.current.visible = s.y > 0.02;
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(m.slug); document.body.style.cursor = 'pointer'; };
  const out = () => { onHover(null); document.body.style.cursor = ''; };
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(m.slug); };

  return (
    <group position={[m.x, 0, m.z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <planeGeometry args={[FOOTPRINT * 2.1, FOOTPRINT * 2.1]} />
        <meshBasicMaterial map={getShadowTex()} transparent depthWrite={false} opacity={pending ? 0.3 : 0.9} />
      </mesh>
      <group ref={group}>
        <mesh position-y={m.h / 2} onPointerOver={over} onPointerOut={out} onClick={click}>
          <boxGeometry args={[FOOTPRINT, m.h, FOOTPRINT]} />
          <meshStandardMaterial ref={body} color="#111827" roughness={0.5} metalness={0.35} emissive={color} emissiveIntensity={0.05} transparent />
        </mesh>
        <primitive object={edgeObj} position-y={m.h / 2} />
        {!pending && (
          <mesh rotation-x={-Math.PI / 2} position-y={m.h + 0.004}>
            <planeGeometry args={[FOOTPRINT * 0.98, FOOTPRINT * 0.98]} />
            <shaderMaterial vertexShader={capVert} fragmentShader={capFrag} uniforms={capUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
        <mesh ref={beam} position-y={m.h} scale={[1, 0.001, 1]} visible={false}>
          <cylinderGeometry args={[0.42, 0.55, 3.2, 32, 1, true]} />
          <shaderMaterial
            transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
            uniforms={{ uColor: { value: color } }}
            vertexShader={'varying float vY; void main(){ vY = position.y / 3.2 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 1.6, 0.0), 1.0); }'}
            fragmentShader={'varying float vY; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, (1.0 - vY) * 0.28); }'}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Labels are plain DOM in the scene's own React tree, positioned every rendered frame by projecting
 * each module's top into screen space. (drei <Html> rendered every label in a separate React root;
 * unmounting them when the layout crossed the compact breakpoint threw a removeChild NotFoundError.)
 */
function LabelProjector({ mods, pins, lifts, focus }: { mods: LabModule[]; pins: React.RefObject<Record<string, HTMLDivElement | null>>; lifts: Lifts; focus: string | null }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const boxes: LabelBox[] = [];
    for (const m of mods) {                       // read phase (layout reads before any writes)
      const el = pins.current?.[m.slug];
      if (!el || el.hidden) continue;
      v.set(m.x, m.h + 0.5 + (lifts[m.slug] ?? 0), m.z).project(camera);
      if (v.z >= 1) { el.style.visibility = 'hidden'; continue; }
      boxes.push({ id: m.slug, x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, w: el.offsetWidth, h: el.offsetHeight, priority: m.slug === focus ? 1 : 0, depth: -v.z });
    }
    const ys = declutter(boxes);
    for (const b of boxes) {                      // write phase
      const el = pins.current![b.id]!;
      el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${ys.get(b.id)!.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.visibility = 'visible';
    }
  });
  return null;
}

function Traces({ selected, reduced }: { selected: string | null; reduced: boolean }) {
  const traces = useMemo(() => labTraces(), []);
  const refs = useRef<(THREE.Object3D & { material: { dashOffset: number } } | null)[]>([]);
  useFrame((_, dt) => { if (!reduced) refs.current.forEach((l) => { if (l) l.material.dashOffset -= dt * 0.6; }); });
  return (
    <>
      {traces.map((t, i) => {
        const on = !!selected && (t.a === selected || t.b === selected);
        return (
          <Line
            key={`${t.a}-${t.b}`}
            ref={(el: unknown) => { refs.current[i] = el as never; }}
            points={t.points.map(([x, z]) => [x, 0.02, z] as [number, number, number])}
            color={t.color} lineWidth={on ? 2.2 : 1} dashed dashSize={0.18} gapSize={0.14}
            transparent opacity={selected ? (on ? 1 : 0.12) : 0.38}
          />
        );
      })}
    </>
  );
}

function Dust({ count, reduced }: { count: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), speeds = new Float32Array(count);
    const pal = ['#7A8CFF', '#8BFFB0', '#FF885E', '#E9EEF6'].map((c) => new THREE.Color(c));
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      positions.set([(rnd() - 0.5) * 13, rnd() * 5, (rnd() - 0.5) * 13], i * 3);
      const c = pal[Math.floor(rnd() * pal.length)];
      colors.set([c.r, c.g, c.b], i * 3);
      speeds[i] = 0.05 + rnd() * 0.18;
    }
    return { positions, colors, speeds };
  }, [count]);
  useFrame((_, dt) => {
    if (reduced || !ref.current) return;
    const a = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) + speeds[i] * dt;
      if (y > 5) y = 0;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} vertexColors transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function Rig({ focus, reduced, compact }: { focus: LabModule | null; reduced: boolean; compact: boolean }) {
  const { camera, pointer, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.3, 0));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const aspect = size.width / Math.max(1, size.height);
    const dist = (compact ? 1.12 : 1) * Math.max(1, 1.5 / aspect) * 22.5;
    const base = new THREE.Vector3(1, 0.86, 1).normalize().multiplyScalar(dist * (focus ? 0.88 : 1));
    const px = reduced ? 0 : pointer.x * 0.9, py = reduced ? 0 : pointer.y * 0.5;
    const target = tmp.set(focus ? focus.x * 0.4 : 0, focus ? 0.8 : 0.55, focus ? focus.z * 0.4 : 0);
    const k = reduced ? 1 : Math.min(1, dt * 2.2);
    look.current.lerp(target, k);
    const desired = base.clone().add(look.current).add(new THREE.Vector3(px, py, -px));
    camera.position.lerp(desired, k);
    camera.lookAt(look.current);
    // Desktop: the inspector overlays the stage's bottom-right, so frame the workbench a little left of centre.
    const shift = compact ? 0 : Math.round(Math.min(115, size.width * 0.08));
    const cam = camera as THREE.PerspectiveCamera;
    if ((cam.view?.offsetX ?? 0) !== shift || cam.view?.fullWidth !== size.width || cam.view?.fullHeight !== size.height) {
      if (shift) cam.setViewOffset(size.width, size.height, shift, 0, size.width, size.height); else cam.clearViewOffset();
    }
  });
  return null;
}

/** Demand-mode (reduced motion): render a fresh static frame whenever the state changes. */
function Pauser({ active, signature }: { active: boolean; signature: string }) {
  const { invalidate } = useThree();
  useEffect(() => { if (active) { invalidate(); requestAnimationFrame(() => invalidate()); } }, [active, signature, invalidate]);
  return null;
}

export default function LabScene(props: LabSceneProps) {
  const { selected, hovered, domain, reduced, compact, onSelect, onHover, onReady, onStats } = props;
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75));
  const mods = useMemo(() => labModules(), []);
  const pins = useRef<Record<string, HTMLDivElement | null>>({});
  const lifts = useMemo<Lifts>(() => ({}), []);
  const focus = mods.find((m) => m.slug === selected) ?? null;

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);

  const stateOf = (m: LabModule): 'idle' | 'hover' | 'selected' | 'dim' => {
    if (m.slug === selected) return 'selected';
    if (m.slug === hovered) return 'hover';
    if (domain && !m.project.domains.includes(domain as never)) return 'dim';
    if (selected) return 'dim';
    return 'idle';
  };

  return (
    <div ref={host} className="lab-canvas">
      <Canvas
        dpr={dpr}
        frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
        camera={{ position: [11, 9.5, 11], fov: 24, near: 0.1, far: 120 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.setClearColor(BG, 0); requestAnimationFrame(() => onReady()); }}
        onPointerMissed={() => onSelect(null)}
        aria-hidden="true"
      >
        <PerformanceMonitor
          onChange={({ fps }) => onStats?.({ dpr, fps: Math.round(fps) })}
          onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
        />
        <Pauser active={reduced} signature={`${selected}|${hovered}|${domain}`} />
        <fog attach="fog" args={['#090C12', 16, 36]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 12, 5]} intensity={1.2} color="#E9EEF6" />
        <directionalLight position={[-8, 4, -6]} intensity={0.6} color="#7A8CFF" />
        <pointLight position={[3, 2.5, -3]} color="#8BFFB0" intensity={6} distance={8} />
        <pointLight position={[3, 2.5, 3]} color="#FF885E" intensity={5} distance={7} />
        <Floor focus={focus} reduced={reduced} />
        <Traces selected={selected} reduced={reduced} />
        {mods.map((m) => (
          <Module key={m.slug} m={m} state={stateOf(m)} reduced={reduced} lifts={lifts} onSelect={(s) => onSelect(s === selected ? null : s)} onHover={onHover} />
        ))}
        <Dust count={compact ? 160 : 420} reduced={reduced} />
        <Rig focus={focus} reduced={reduced} compact={compact} />
        <LabelProjector mods={mods} pins={pins} lifts={lifts} focus={selected ?? hovered} />
      </Canvas>
      <div className="lab-labels" aria-hidden="true">
        {mods.map((m) => {
          const st = stateOf(m);
          const show = !compact || m.slug === selected || m.slug === hovered;
          return (
            <div key={m.slug} className="lab-pin" ref={(el) => { pins.current[m.slug] = el; }} style={{ visibility: 'hidden' }} hidden={!show}>
              <div className={`lab-label ${st}`} style={{ ['--c' as string]: m.color }}>
                <span>{String(m.project.index).padStart(2, '0')}</span> {m.project.shortTitle}
                {st === 'selected' && <em>{STATUS_LABEL[m.project.status]}</em>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
