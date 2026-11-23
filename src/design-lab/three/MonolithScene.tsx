// Concept A: “The Monolith”. A computational sculpture: 34 graphite plates in one instanced draw
// call, twisted about the vertical axis, lit only by procedural light panels (no HDR download),
// with a single lime signal line travelling through it. Pointer turns it; scrolling opens the stack.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { PLATES, PLATE, TWIST, SCAN_AT, CAMERA_Z, plateAngle } from './monolith-geometry';

const LIME = new THREE.Color('#c8ff3d');

function Stack({ pointer }: { pointer: RefObject<{ x: number; y: number }> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const s = useRef({ rx: 0, ry: 0, open: 0 });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent damping
    const scroll = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
    s.current.ry += (pointer.current.x * 0.55 - s.current.ry) * k;
    s.current.rx += (pointer.current.y * 0.12 - s.current.rx) * k;
    s.current.open += (scroll - s.current.open) * k;
    const phase = 0.2 * Math.sin(t * 0.18);
    const twist = TWIST + 0.35 * Math.sin(t * 0.11) + s.current.open * 0.9;
    const pitch = PLATE.pitch * (1 + s.current.open * 0.85);
    const total = (PLATES - 1) * pitch;
    for (let i = 0; i < PLATES; i++) {
      dummy.position.set(0, i * pitch - total / 2, 0);
      dummy.rotation.set(0, plateAngle(i, twist, phase), 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    }
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (group.current) {
      group.current.rotation.y = s.current.ry + t * 0.04;
      group.current.rotation.x = s.current.rx;
    }
    if (scan.current) {
      const u = SCAN_AT + 0.3 * Math.sin(t * 0.35) * Math.sin(t * 0.13);
      const f = Math.min(PLATES - 1.001, Math.max(0, u * (PLATES - 1)));
      scan.current.position.y = f * pitch - total / 2 + pitch / 2;
      scan.current.rotation.y = plateAngle(f, twist, phase);
    }
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, PLATES]}>
        <boxGeometry args={[PLATE.w, PLATE.h, PLATE.d]} />
        <meshPhysicalMaterial color="#3a3c42" metalness={0.92} roughness={0.24} clearcoat={0.8} clearcoatRoughness={0.2} envMapIntensity={1.6} />
      </instancedMesh>
      <group ref={scan}>
        <mesh>
          <boxGeometry args={[PLATE.w + 0.06, 0.012, PLATE.d + 0.06]} />
          <meshBasicMaterial color={LIME} toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[PLATE.w + 0.22, 0.09, PLATE.d + 0.22]} />
          <meshBasicMaterial color={LIME} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
        <pointLight color={LIME} intensity={1.2} distance={2.2} decay={2} />
      </group>
    </group>
  );
}

export default function MonolithScene({ onReady }: { onReady: () => void }) {
  const pointer = useRef({ x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const move = (e: PointerEvent) => { pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 }; };
    window.addEventListener('pointermove', move, { passive: true });
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (wrap.current) io.observe(wrap.current);
    return () => { window.removeEventListener('pointermove', move); io.disconnect(); };
  }, []);

  return (
    <div className="mono-canvas" ref={wrap} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, CAMERA_Z], fov: 30, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; requestAnimationFrame(() => onReady()); }}
      >
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={5} position={[-4, 2.5, 3]} scale={[3, 7, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={2.4} position={[4.5, -1, 2]} scale={[2, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.2} position={[0, 1, 6]} scale={[8, 2, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.8} color="#c8ff3d" position={[0, -5, -2]} scale={[6, 1, 1]} target={[0, 0, 0]} />
          <Lightformer form="ring" intensity={1.6} position={[0, 6, 0]} scale={4} target={[0, 0, 0]} />
        </Environment>
        <ambientLight intensity={0.12} />
        <directionalLight position={[-3, 4, 5]} intensity={0.6} />
        <Stack pointer={pointer} />
      </Canvas>
    </div>
  );
}
