// Portfolio terminal widget
// Local commands run instantly; unknown input streams through the Cloudflare Worker.

(function () {
  // ─── CONFIG ──────────────────────────────────────────────────────────────
  // Replace with your deployed Worker URL after `wrangler deploy`
  const WORKER_URL = 'https://portfolio-ai.priyanshu240105.workers.dev';

  // The exact system prompt sent to the AI — visible via the `prompt` command.
  const SYSTEM_PROMPT = `You are an interactive terminal assistant embedded in Priyanshu's personal portfolio.
Your job: answer questions about Priyanshu — his background, projects, skills, and availability — as a direct, knowledgeable colleague would. Refer to him by first name only: Priyanshu.

About Priyanshu:
- Software Engineer at Nokia Optics, Stuttgart (Optics division, 4LS team)
- Dual CS student at DHBW Stuttgart
- Praxisphase #3 window: 01 June 2026 – 27 September 2026 — actively seeking placement now
- Location: Stuttgart, Germany
- Email: priyanshu240105@gmail.com
- GitHub: github.com/Priyanshu92012
- LinkedIn: linkedin.com/in/priyanshu-priyanshu-/

Projects:
GMRE Log Parser (Production at Nokia) — Plugin-based ingestion engine for nested customer log archives. 8 levels of nested ZIP structures, SHA-256 dedup, 14+ Alembic migrations, 77+ automated tests. Feeds Power BI dashboards across the Nokia 4LS team. Stack: Python, MySQL, SQLAlchemy, Alembic, Pytest.
4LS Ticket Pipeline (Live at Nokia) — Automated Power BI refresh pipeline pulling from Excel exports and internal source systems. Replaced manual weekly reporting. Outcome: zero-touch KPI reporting. Stack: Power BI, DAX, Excel, automation scripting.
MidLog IoT Architecture (Academic, submission 19 May 2026) — End-to-end IoT design for a 12,000 m² cold-chain food distribution centre. Sensor selection, LoRaWAN gateway placement, edge/fog/cloud topology, energy budget. Stack: LoRaWAN, MQTT, edge computing.

Skills — Core: Python, SQL, SQLAlchemy, FastAPI, Pytest, Power BI, Git | AI & ML: RAG pipelines, vector embeddings, MCP servers, anomaly detection, LLM orchestration | Telecom & IoT: LoRaWAN, MQTT, optical transport, edge/fog/cloud, embedded systems

Rules: Only answer questions about Priyanshu. Be concise (3-5 sentences unless more detail is requested). Plain text only — no markdown headers, no bullets. If asked about hiring, be direct and cite project evidence. Tone: confident, specific, not salesy.`;

  // ─── LOCAL COMMAND RESPONSES ──────────────────────────────────────────────
  const COMMANDS = {
    help: () => [
      { cls: 'out', text: 'available commands:' },
      { cls: 'blank' },
      { cls: 'out', text: '  help       — show this list' },
      { cls: 'out', text: '  whoami     — brief bio' },
      { cls: 'out', text: '  projects   — list all projects (alias: ls)' },
      { cls: 'out', text: '  cat <name> — project detail  (gmre · powerbi · midlog)' },
      { cls: 'out', text: '  stack      — tech stack by category' },
      { cls: 'out', text: '  contact    — email, GitHub, LinkedIn' },
      { cls: 'out', text: '  github     — open GitHub profile' },
      { cls: 'out', text: '  social     — all social links' },
      { cls: 'out', text: '  prompt     — show the AI system prompt' },
      { cls: 'out', text: '  clear      — clear the terminal' },
      { cls: 'blank' },
      { cls: 'muted', text: '  anything else → ask the AI anything about Priyanshu' },
    ],

    whoami: () => [
      { cls: 'out', text: "Software engineer at Nokia Optics (Stuttgart) and dual CS student at DHBW Stuttgart." },
      { cls: 'out', text: "I build data pipelines, AI tooling, and IoT systems — turning noisy operational data into things engineers actually use." },
      { cls: 'out', text: "Seeking Praxisphase #3 placement: June – September 2026." },
    ],

    projects: () => [
      { cls: 'out', text: 'A  GMRE Log Parser       — production log ingestion engine at Nokia (Python · MySQL)' },
      { cls: 'out', text: 'B  4LS Ticket Pipeline   — automated Power BI reporting pipeline (Power BI · DAX)' },
      { cls: 'out', text: 'C  MidLog IoT            — end-to-end IoT architecture for cold-chain (LoRaWAN · MQTT)' },
      { cls: 'blank' },
      { cls: 'muted', text: '  use: cat gmre  ·  cat powerbi  ·  cat midlog' },
    ],

    ls: () => COMMANDS.projects(),

    'cat gmre': () => [
      { cls: 'out', text: 'GMRE Log Parser — Production · Nokia Optics 4LS' },
      { cls: 'blank' },
      { cls: 'out', text: 'Problem: Customer log archives arrive as deeply nested ZIPs with inconsistent structure. Engineers spent hours manually extracting and normalising data before any analysis.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Approach: Plugin-based ingestion engine — each archive format gets a dedicated plugin, orchestrated by a core runner. Handles 8 levels of nesting, SHA-256 dedup prevents re-ingestion, SQLAlchemy ORM with 14+ Alembic migrations keeps the schema versioned.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Results: 77+ automated tests, zero manual extraction steps, feeds Power BI dashboards used daily by the Nokia 4LS team.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Stack: Python · MySQL · SQLAlchemy · Alembic · Pytest' },
    ],

    'cat powerbi': () => [
      { cls: 'out', text: '4LS Ticket Pipeline — Live · Nokia Optics 4LS' },
      { cls: 'blank' },
      { cls: 'out', text: "Problem: The team's KPI reporting was manual — weekly Excel exports, copy-pasting across sheets, inconsistent numbers across stakeholders." },
      { cls: 'blank' },
      { cls: 'out', text: 'Approach: Automated Power BI refresh pipeline pulling from Excel exports and internal source systems. DAX measures enforce consistent metric definitions across all reports.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Results: Zero-touch weekly reporting. Consistent KPIs across the full team. Manual upkeep time dropped to zero.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Stack: Power BI · DAX · Excel · automation scripting' },
    ],

    'cat midlog': () => [
      { cls: 'out', text: 'MidLog IoT Architecture — Academic · submission 19 May 2026' },
      { cls: 'blank' },
      { cls: 'out', text: 'Problem: Design a complete IoT monitoring system for a 12,000 m² cold-chain food distribution centre under real-world cost, energy, and reliability constraints.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Approach: Full-stack architecture — sensor selection, LoRaWAN gateway placement (coverage modelling), MQTT broker, edge/fog/cloud topology, and a constrained energy budget per node.' },
      { cls: 'blank' },
      { cls: 'out', text: 'Stack: LoRaWAN · MQTT · edge/fog/cloud · embedded systems' },
    ],

    stack: () => [
      { cls: 'out', text: 'Core' },
      { cls: 'out', text: '  Python · SQL · SQLAlchemy · FastAPI · Pytest · Power BI · Git' },
      { cls: 'blank' },
      { cls: 'out', text: 'AI & ML' },
      { cls: 'out', text: '  RAG pipelines · Vector embeddings · MCP servers' },
      { cls: 'out', text: '  Anomaly detection · LLM orchestration' },
      { cls: 'blank' },
      { cls: 'out', text: 'Telecom & IoT' },
      { cls: 'out', text: '  LoRaWAN · MQTT · Optical transport · Edge/Fog/Cloud · Embedded' },
    ],

    contact: () => [
      { cls: 'out', text: 'Email    — <a href="mailto:priyanshu240105@gmail.com">priyanshu240105@gmail.com</a>' },
      { cls: 'out', text: 'GitHub   — <a href="https://github.com/Priyanshu92012" target="_blank" rel="noopener">github.com/Priyanshu92012</a>' },
      { cls: 'out', text: 'LinkedIn — <a href="https://www.linkedin.com/in/priyanshu-priyanshu-/" target="_blank" rel="noopener">linkedin.com/in/priyanshu-priyanshu-</a>' },
    ],

    github: () => {
      window.open('https://github.com/Priyanshu92012', '_blank', 'noopener');
      return [{ cls: 'muted', text: 'opening github.com/Priyanshu92012…' }];
    },

    social: () => [
      { cls: 'out', text: 'GitHub   — <a href="https://github.com/Priyanshu92012" target="_blank" rel="noopener">github.com/Priyanshu92012</a>' },
      { cls: 'out', text: 'LinkedIn — <a href="https://www.linkedin.com/in/priyanshu-priyanshu-/" target="_blank" rel="noopener">linkedin.com/in/priyanshu-priyanshu-</a>' },
      { cls: 'out', text: 'Email    — <a href="mailto:priyanshu240105@gmail.com">priyanshu240105@gmail.com</a>' },
    ],

    prompt: () => {
      const lines = SYSTEM_PROMPT.split('\n').map(t => ({ cls: 'muted', text: t }));
      return [
        { cls: 'out', text: '── system prompt ──────────────────────────────' },
        { cls: 'blank' },
        ...lines,
        { cls: 'blank' },
        { cls: 'out', text: '───────────────────────────────────────────────' },
      ];
    },

    clear: () => null, // handled specially
  };

  // Tab-completion candidates
  const TOP_LEVEL = ['help', 'whoami', 'projects', 'ls', 'cat', 'stack', 'contact', 'github', 'social', 'prompt', 'clear'];
  const CAT_ARGS  = ['gmre', 'powerbi', 'midlog'];

  // ─── DOM ─────────────────────────────────────────────────────────────────
  const output = document.getElementById('termOutput');
  const input  = document.getElementById('termInput');

  if (!output || !input) return; // guard: terminal not on this page

  // ─── HISTORY + STATE ──────────────────────────────────────────────────────
  const history = [];
  let histIdx   = -1;
  let aiRunning = false;

  // ─── OUTPUT HELPERS ───────────────────────────────────────────────────────
  function printLines(lines) {
    lines.forEach(({ cls, text }) => {
      const span = document.createElement('span');
      span.className = 'term-line' + (cls ? ' ' + cls : '');
      if (text) span.innerHTML = text; // allows <a> in contact/social
      output.appendChild(span);
    });
    output.scrollTop = output.scrollHeight;
  }

  function printCmd(cmd) {
    const span = document.createElement('span');
    span.className = 'term-line cmd';
    span.textContent = cmd;
    output.appendChild(span);
    output.scrollTop = output.scrollHeight;
  }

  // Returns a live <span> for streaming AI tokens into
  function createAILine() {
    const span = document.createElement('span');
    span.className = 'term-line ai';
    output.appendChild(span);
    return span;
  }

  // ─── BOOT MESSAGE ─────────────────────────────────────────────────────────
  printLines([
    { cls: ‘muted’, text: ‘╔══════════════════════════════════════════╗’ },
    { cls: ‘muted’, text: ‘║  priyanshu@portfolio  ~  v1.0            ║’ },
    { cls: ‘muted’, text: ‘║  Software Engineer · Nokia · Stuttgart   ║’ },
    { cls: ‘muted’, text: ‘╚══════════════════════════════════════════╝’ },
    { cls: ‘blank’ },
    { cls: ‘out’,   text: "type ‘help’ for commands, or ask me anything." },
    { cls: ‘blank’ },
  ]);

  // ─── AI STREAMING ─────────────────────────────────────────────────────────
  async function streamAI(message) {
    if (aiRunning) return;
    aiRunning = true;
    input.disabled = true;

    const aiSpan = createAILine();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(WORKER_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message }),
        signal:  controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        aiSpan.textContent = data.message ?? 'rate limit reached. try again later.';
        output.scrollTop = output.scrollHeight;
        return;
      }

      if (!res.ok) {
        aiSpan.textContent = 'error: service temporarily unavailable — try: help, whoami, projects';
        output.scrollTop = output.scrollHeight;
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const evt   = JSON.parse(payload);
            const token = evt.delta?.text ?? '';
            if (token) {
              aiSpan.textContent += token;
              output.scrollTop = output.scrollHeight;
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        aiSpan.textContent = 'connection timed out — try again';
      } else {
        aiSpan.textContent = 'error: service temporarily unavailable — try: help, whoami, projects';
      }
      output.scrollTop = output.scrollHeight;
    } finally {
      printLines([{ cls: 'blank' }]);
      aiRunning      = false;
      input.disabled = false;
      input.focus();
    }
  }

  // ─── COMMAND DISPATCH ────────────────────────────────────────────────────
  function dispatch(raw) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    printCmd(raw.trim());
    printLines([{ cls: 'blank' }]);

    // clear is special
    if (cmd === 'clear') {
      output.innerHTML = '';
      return;
    }

    const handler = COMMANDS[cmd];
    if (handler) {
      const lines = handler();
      if (lines) printLines(lines);
      printLines([{ cls: 'blank' }]);
    } else {
      // AI fallthrough
      streamAI(raw.trim());
    }
  }

  // ─── INPUT / KEYDOWN ──────────────────────────────────────────────────────
  input.addEventListener('keydown', (e) => {
    // Enter — submit
    if (e.key === 'Enter') {
      e.preventDefault();
      if (aiRunning) return;
      const val = input.value;
      if (val.trim()) {
        history.unshift(val);
        histIdx = -1;
        input.value = '';
      }
      dispatch(val);
      return;
    }

    // Up arrow — previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      histIdx = Math.min(histIdx + 1, history.length - 1);
      input.value = history[histIdx];
      // move caret to end
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
      return;
    }

    // Down arrow — next command
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx <= 0) {
        histIdx = -1;
        input.value = '';
        return;
      }
      histIdx--;
      input.value = history[histIdx];
      return;
    }

    // Tab — completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const val   = input.value.trimStart();
      const lower = val.toLowerCase();

      // `cat ` arg completion
      if (lower.startsWith('cat ')) {
        const partial = lower.slice(4);
        const match   = CAT_ARGS.find(a => a.startsWith(partial));
        if (match) input.value = 'cat ' + match;
        return;
      }

      // Top-level command completion
      const match = TOP_LEVEL.find(c => c.startsWith(lower) && c !== lower);
      if (match) input.value = match;
    }
  });

  // Click anywhere on the terminal window to focus the input
  document.getElementById('termWindow')?.addEventListener('click', () => {
    if (!aiRunning) input.focus();
  });
})();
