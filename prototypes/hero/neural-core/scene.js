// Prototype A — Neural Core scene (vanilla Three.js; R3F port happens in Phase 3).
// Progressive enhancement: if this module or WebGL fails, the static SVG stays.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const P = window.PORTFOLIO;
const PROTO = window.PROTO;
const stage = document.getElementById('stage');
const labelsEl = document.getElementById('labels');
const telemetry = document.getElementById('telemetry');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function cssColor(name) {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffffff');
}

function boot() {
  if (!PROTO.webglAvailable()) { stage.dataset.renderer = 'svg-fallback'; return; }

  const reduced = PROTO.reducedMotion();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch { stage.dataset.renderer = 'svg-fallback'; return; }

  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  stage.prepend(canvas);
  stage.classList.add('webgl');
  stage.dataset.renderer = 'webgl';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9.5);
  const group = new THREE.Group();
  scene.add(group);

  const colorVar = { violet: '--violet', bio: '--bio', orange: '--orange', paper: '--paper' };
  const domains = P.domains.map((d, i) => {
    const dirs = [[1, 1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, 1]];
    const center = new THREE.Vector3(...dirs[i]).normalize().multiplyScalar(2.5);
    return { ...d, index: i, center, color: cssColor(colorVar[d.color]), count: P.projectsIn(d.id).length };
  });
  const paper = cssColor('--paper');

  // ── points: core shell + one cluster per domain ──────────────────
  const pos = [], col = [], dom = [], size = [];
  const CORE = 260;
  for (let i = 0; i < CORE; i++) {
    const y = 1 - (i / (CORE - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    const R = 0.95 + gauss() * 0.03;
    pos.push(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R);
    col.push(paper.r, paper.g, paper.b); dom.push(4); size.push(1.4 + rand() * 1.2);
  }
  const clusterPts = domains.map(() => []);
  domains.forEach((d) => {
    const n = 90 + d.count * 30; // denser where there is more real work
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.36 + 0.06 * d.count).add(d.center);
      clusterPts[d.index].push(p);
      pos.push(p.x, p.y, p.z); col.push(d.color.r, d.color.g, d.color.b);
      dom.push(d.index); size.push(1.6 + rand() * 2.6);
    }
    // one bright node per project
    P.projectsIn(d.id).forEach(() => {
      const p = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.25).add(d.center);
      pos.push(p.x, p.y, p.z); col.push(d.color.r, d.color.g, d.color.b); dom.push(d.index); size.push(7.5);
    });
  });

  const uniforms = {
    uW: { value: new THREE.Vector4(1, 1, 1, 1) },
    uTime: { value: 0 },
    uPR: { value: pixelRatio },
    uBreath: { value: reduced ? 0 : 1 },
  };
  const pointMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aDomain; attribute float aSize;
      uniform vec4 uW; uniform float uTime; uniform float uPR; uniform float uBreath;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 m = vec4(step(abs(aDomain - 0.0), 0.5), step(abs(aDomain - 1.0), 0.5),
                      step(abs(aDomain - 2.0), 0.5), step(abs(aDomain - 3.0), 0.5));
        float w = aDomain > 3.5 ? 1.0 : dot(uW, m);
        vec3 p = position * (1.0 + 0.018 * uBreath * sin(uTime * 1.2 + aSize * 7.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (0.55 + 0.55 * w) * uPR * (7.0 / -mv.z);
        vColor = aColor; vAlpha = clamp(0.18 + 0.7 * w, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * a * vAlpha);
      }`,
  });
  function pointsGeo(p, c, d, s) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('aDomain', new THREE.Float32BufferAttribute(d, 1));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(s, 1));
    return g;
  }
  group.add(new THREE.Points(pointsGeo(pos, col, dom, size), pointMat));

  // core wireframe
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 1)),
    new THREE.LineBasicMaterial({ color: paper, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(wire);

  // ── connections: axons core→cluster + local synapses ─────────────
  const axons = []; // [{domain, a, b}]
  const lineMats = domains.map((d) => {
    const verts = [];
    const pts = clusterPts[d.index];
    for (let k = 0; k < 7; k++) {
      const a = d.center.clone().normalize().multiplyScalar(0.95).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.12));
      const b = pts[Math.floor(rand() * pts.length)];
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      axons.push({ domain: d.index, a, b });
    }
    for (let i = 0; i < pts.length; i++) {
      let links = 0;
      for (let j = i + 1; j < pts.length && links < 2; j++) {
        if (pts[i].distanceToSquared(pts[j]) < 0.09) {
          verts.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z); links++;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const m = new THREE.LineBasicMaterial({ color: d.color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    group.add(new THREE.LineSegments(g, m));
    return m;
  });

  // ── signal pulses travelling along axons ─────────────────────────
  const PULSES = reduced ? 0 : 16;
  const pulseState = [];
  const pp = [], pc = [], pd = [], ps = [];
  for (let i = 0; i < PULSES; i++) {
    const ax = axons[Math.floor(rand() * axons.length)];
    pulseState.push({ ax, t: rand(), speed: 0.25 + rand() * 0.35 });
    const c = domains[ax.domain].color;
    pp.push(0, 0, 0); pc.push(c.r, c.g, c.b); pd.push(ax.domain); ps.push(6);
  }
  const pulseGeo = pointsGeo(pp, pc, pd, ps);
  if (PULSES) group.add(new THREE.Points(pulseGeo, pointMat));

  // ── HTML labels projected from cluster centres ───────────────────
  const labelBtns = domains.map((d) => {
    const b = document.createElement('button');
    b.type = 'button'; b.tabIndex = -1;
    b.className = `c-${d.id}`;
    b.textContent = d.short;
    b.addEventListener('click', () => window.selectDomain(d.id));
    labelsEl.appendChild(b);
    return b;
  });

  // ── state ────────────────────────────────────────────────────────
  let focus = null;
  const targetW = new THREE.Vector4(1, 1, 1, 1);
  const targetQ = new THREE.Quaternion();
  const pointer = new THREE.Vector2(0, 0), pointerSmooth = new THREE.Vector2(0, 0);
  let width = 1, height = 1, running = false, visible = true, last = performance.now();
  let frames = 0, frameAcc = 0, adapted = false, settle = 0;

  window.addEventListener('domain:select', (e) => {
    focus = e.detail.id;
    const idx = domains.findIndex((d) => d.id === focus);
    targetW.set(...domains.map((d) => (idx < 0 ? 1 : d.index === idx ? 1.45 : 0.28)));
    if (idx >= 0) {
      // rotate the selected cluster toward the camera, slightly up-left of centre
      const dir = domains[idx].center.clone().normalize();
      targetQ.setFromUnitVectors(dir, new THREE.Vector3(-0.25, 0.15, 1).normalize());
    }
    labelBtns.forEach((b, i) => { b.classList.toggle('on', i === idx); b.classList.toggle('dim', idx >= 0 && i !== idx); });
    if (reduced) { // snap, render once
      uniforms.uW.value.copy(targetW);
      if (idx >= 0) group.quaternion.copy(targetQ);
      renderFrame(0);
    } else { settle = 2.5; start(); }
  });

  function resize() {
    const r = stage.getBoundingClientRect();
    width = Math.max(1, r.width); height = Math.max(1, r.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 520 ? 11.5 : 9.5;
    camera.updateProjectionMatrix();
    renderFrame(0);
  }
  new ResizeObserver(resize).observe(stage);

  const v = new THREE.Vector3();
  function updateLabels() {
    domains.forEach((d, i) => {
      v.copy(d.center).multiplyScalar(1.32).applyMatrix4(group.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
      labelBtns[i].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      labelBtns[i].style.zIndex = v.z < 0.97 ? 2 : 1;
    });
  }

  function nearestDomain(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    const mx = clientX - r.left, my = clientY - r.top;
    let best = null, bestD = 90 * 90;
    domains.forEach((d) => {
      v.copy(d.center).applyMatrix4(group.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
      const dd = (x - mx) ** 2 + (y - my) ** 2;
      if (dd < bestD) { bestD = dd; best = d; }
    });
    return best;
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    canvas.classList.toggle('pointing', !!nearestDomain(e.clientX, e.clientY));
    if (!reduced) start();
  });
  canvas.addEventListener('pointerleave', () => pointer.set(0, 0));
  canvas.addEventListener('click', (e) => {
    const d = nearestDomain(e.clientX, e.clientY);
    if (d) window.selectDomain(d.id);
  });

  function renderFrame(dt) {
    const t = performance.now() / 1000;
    uniforms.uTime.value = t;
    if (!reduced) {
      uniforms.uW.value.lerp(targetW, 1 - Math.exp(-dt * 6));
      if (focus) group.quaternion.slerp(targetQ, 1 - Math.exp(-dt * 3));
      else group.rotateOnWorldAxis(THREE.Object3D.DEFAULT_UP, dt * 0.09);
      wire.rotation.y += dt * 0.25; wire.rotation.x += dt * 0.11;
      pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 4));
      camera.position.x = pointerSmooth.x * 0.7;
      camera.position.y = pointerSmooth.y * 0.5;
      camera.lookAt(0, 0, 0);
      // pulses
      const arr = pulseGeo.attributes.position.array;
      pulseState.forEach((p, i) => {
        p.t += dt * p.speed;
        if (p.t > 1) { p.t = 0; p.ax = axons[Math.floor(Math.random() * axons.length)]; pulseGeo.attributes.aDomain.array[i] = p.ax.domain; const c = domains[p.ax.domain].color; pulseGeo.attributes.aColor.array.set([c.r, c.g, c.b], i * 3); pulseGeo.attributes.aDomain.needsUpdate = true; pulseGeo.attributes.aColor.needsUpdate = true; }
        v.lerpVectors(p.ax.a, p.ax.b, p.t);
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      });
      pulseGeo.attributes.position.needsUpdate = true;
    }
    lineMats.forEach((m, i) => { m.opacity = 0.06 + 0.16 * uniforms.uW.value.getComponent(i); });
    group.updateMatrixWorld();
    renderer.render(scene, camera);
    updateLabels();
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    renderFrame(dt);
    // adaptive quality: if the first ~90 frames average > 22ms, drop pixel ratio to 1
    if (!adapted && frames < 90) {
      frames++; frameAcc += dt;
      if (frames === 90 && frameAcc / 90 > 0.022 && pixelRatio > 1) {
        pixelRatio = 1; renderer.setPixelRatio(1); uniforms.uPR.value = 1; resize(); adapted = true;
      }
    }
    telemetry.textContent = `renderer webgl · dpr ${pixelRatio.toFixed(2)}${adapted ? ' (adapted)' : ''}`;
    if (reduced) { running = false; return; }
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true; last = performance.now(); requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  // pause offscreen / hidden tab
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  PROTO.onModeChange((mode) => (mode === 'recruiter' ? stop() : (resize(), start())));

  resize();
  if (reduced) { telemetry.textContent = 'renderer webgl · reduced motion (static frame)'; renderFrame(0); }
  else start();
  window.__neural = { get running() { return running; }, get pixelRatio() { return pixelRatio; } };
}

try { boot(); } catch (err) {
  console.warn('[neural-core] falling back to static SVG:', err);
  stage.classList.remove('webgl');
}
