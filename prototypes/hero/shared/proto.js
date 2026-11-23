// Shared prototype runtime: Recruiter Mode, motion preference, fallbacks.
// Query params for testing: ?mode=recruiter  ?motion=reduce  ?fallback=1  ?theme=paper
(function () {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOverride = params.get('motion') || store.get('pexe-motion');
  function reducedMotion() {
    if (motionOverride === 'reduce') return true;
    if (motionOverride === 'full') return false;
    return mq.matches;
  }
  if (reducedMotion()) root.dataset.motion = 'reduce';

  const theme = params.get('theme') || store.get('pexe-theme');
  if (theme === 'paper') root.dataset.theme = 'paper';

  function webglAvailable() {
    if (params.get('fallback') === '1') return false;
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch { return false; }
  }

  const listeners = [];
  function setMode(mode, persist) {
    root.dataset.mode = mode;
    document.querySelectorAll('[data-recruiter-toggle]').forEach((b) =>
      b.setAttribute('aria-pressed', String(mode === 'recruiter')));
    if (persist) store.set('pexe-mode', mode);
    listeners.forEach((fn) => fn(mode));
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderRecruiter() {
    const el = document.getElementById('recruiter');
    if (!el || !window.PORTFOLIO) return;
    const { person, projects } = window.PORTFOLIO;
    el.innerHTML = `
      <p class="status" data-status="verified">Recruiter Mode · single-page summary</p>
      <h1>${esc(person.name)}</h1>
      <p class="lede">${esc(person.summary)}</p>
      <div class="actions">
        <a class="btn primary" href="${esc(person.links.email)}">Email</a>
        <a class="btn" href="${esc(person.links.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
        <a class="btn" href="${esc(person.links.github)}" target="_blank" rel="noopener">GitHub</a>
        <button class="btn" type="button" data-recruiter-toggle aria-pressed="true">Back to immersive view</button>
      </div>
      <h2 class="sr-only">Selected work</h2>
      <ul class="r-list">
        ${projects.map((p) => `
          <li>
            <h3>${p.url ? `<a href="${esc(p.url)}"${p.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(p.title)}</a>` : esc(p.title)}</h3>
            <span class="status" data-status="${esc(p.status)}">${esc(p.statusLabel)}</span>
            <p>${esc(p.summary)}</p>
            <span class="meta">${p.tech.map(esc).join(' · ')}</span>
          </li>`).join('')}
      </ul>`;
    bindToggles(el);
  }

  function bindToggles(scope) {
    scope.querySelectorAll('[data-recruiter-toggle]').forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', () => {
        const next = root.dataset.mode === 'recruiter' ? 'immersive' : 'recruiter';
        setMode(next, true);
        if (next === 'recruiter') document.getElementById('recruiter')?.focus();
        else document.getElementById('main')?.focus();
      });
    });
  }

  function init() {
    renderRecruiter();
    bindToggles(document);
    const initial = params.get('mode') || store.get('pexe-mode') || 'immersive';
    setMode(initial === 'recruiter' ? 'recruiter' : 'immersive', false);
    document.querySelectorAll('[data-ask-ai]').forEach((b) =>
      b.addEventListener('click', () => {
        // Prototype stub: the agent lands in Phase 4. Route to the live terminal.
        location.href = '/#about';
      }));
  }

  window.PROTO = {
    params, store, reducedMotion, webglAvailable, setMode, esc,
    onModeChange: (fn) => listeners.push(fn),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
