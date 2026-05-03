// Cloudflare Worker — portfolio AI proxy
// Holds the Anthropic API key; browser never sees it.

const ALLOWED_ORIGINS = [
  'https://priyanshu92012.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

const RATE_LIMITS = {
  perMinute: 3,
  perHour:   10,
  perDay:    500,   // global safety cap
};

const SYSTEM_PROMPT = `You are an interactive terminal assistant embedded in Priyanshu's personal portfolio.
Your job: answer questions about Priyanshu — his background, projects, skills, and availability — as a direct, knowledgeable colleague would. Refer to him by first name only: Priyanshu.

## About Priyanshu
- Software Engineer at Nokia Optics, Stuttgart (Optics division, 4LS team)
- Dual CS student at DHBW Stuttgart
- Praxisphase #3 window: 01 June 2026 – 27 September 2026 — actively seeking placement now
- Location: Stuttgart, Germany
- Email: priyanshu240105@gmail.com
- GitHub: github.com/Priyanshu92012
- LinkedIn: linkedin.com/in/priyanshu-priyanshu-/

## Projects

### GMRE Log Parser (Production at Nokia)
Plugin-based ingestion engine for nested customer log archives. Handles 8 levels of nested ZIP structures, SHA-256 deduplication, 14+ Alembic schema migrations, 77+ automated tests. The output feeds Power BI dashboards used across the Nokia 4LS team. Stack: Python, MySQL, SQLAlchemy, Alembic, Pytest.

### 4LS Ticket Pipeline (Live at Nokia)
Automated Power BI refresh pipeline. Pulls from Excel exports and internal source systems. Replaced a manual weekly reporting process — outcome: zero-touch KPI reporting with consistent metrics across the team. Stack: Power BI, DAX, Excel, automation scripting.

### MidLog IoT Architecture (Academic — submission 19 May 2026)
End-to-end IoT system design for a 12,000 m² cold-chain food distribution centre. Covers sensor selection, LoRaWAN gateway placement, edge/fog/cloud topology, and real-world energy budget constraints. Stack: LoRaWAN, MQTT, edge computing.

## Skills
Core: Python, SQL, SQLAlchemy, FastAPI, Pytest, Power BI, Git
AI & ML: RAG pipelines, vector embeddings, MCP servers, anomaly detection, LLM orchestration
Telecom & IoT: LoRaWAN, MQTT, optical transport, edge/fog/cloud, embedded systems

## Rules
- Only answer questions about Priyanshu — his work, skills, availability, projects, and background.
- For anything unrelated, respond: "This terminal answers questions about Priyanshu. Try: whoami, projects, or ask me something about his work."
- Be concise: 3-5 sentences max unless the visitor explicitly asks for more detail.
- Never invent specifics not listed above (salary expectations, confidential internal data, unreleased project details).
- Plain text output only — no markdown headers, no bullet points, no bold. The terminal renders raw text.
- If asked whether Priyanshu is worth hiring: be direct and reference concrete project evidence.
- Tone: confident, specific, not salesy.`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

async function checkRateLimit(kv, ip) {
  const keyMin    = `rl:${ip}:min`;
  const keyHr     = `rl:${ip}:hr`;
  const keyGlobal = 'rl:global:day';

  const [cMin, cHr, cGlobal] = await Promise.all([
    kv.get(keyMin),
    kv.get(keyHr),
    kv.get(keyGlobal),
  ]);

  const nMin    = parseInt(cMin    ?? '0', 10);
  const nHr     = parseInt(cHr     ?? '0', 10);
  const nGlobal = parseInt(cGlobal ?? '0', 10);

  if (nMin >= RATE_LIMITS.perMinute) {
    return { blocked: true, retryAfter: 60,   message: `slow down — limit is ${RATE_LIMITS.perMinute} requests/min. try again shortly, or use: help, whoami, projects` };
  }
  if (nHr >= RATE_LIMITS.perHour) {
    return { blocked: true, retryAfter: 3600, message: `hourly limit reached. try again later, or use: help, whoami, projects` };
  }
  if (nGlobal >= RATE_LIMITS.perDay) {
    return { blocked: true, retryAfter: 86400, message: `ai terminal is resting for today. try: help, whoami, projects` };
  }

  await Promise.all([
    kv.put(keyMin,    String(nMin    + 1), { expirationTtl: 60    }),
    kv.put(keyHr,     String(nHr     + 1), { expirationTtl: 3600  }),
    kv.put(keyGlobal, String(nGlobal + 1), { expirationTtl: 86400 }),
  ]);

  return { blocked: false };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Parse body
    let message;
    try {
      const body = await request.json();
      message = (body.message ?? '').trim();
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_json' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'empty_message' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    if (message.length > 500) {
      return new Response(
        JSON.stringify({ error: 'too_long', message: 'input too long — max 500 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    // Rate limit
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rl = await checkRateLimit(env.RATE_LIMIT, ip);
    if (rl.blocked) {
      return new Response(
        JSON.stringify({ error: 'rate_limit', message: rl.message, retryAfter: rl.retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After':  String(rl.retryAfter),
            ...corsHeaders(origin),
          },
        }
      );
    }

    // Call Anthropic streaming API
    let anthropicResp;
    try {
      anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system:     SYSTEM_PROMPT,
          stream:     true,
          messages:   [{ role: 'user', content: message }],
        }),
      });
    } catch {
      return new Response(
        JSON.stringify({ error: 'upstream_error', message: 'service temporarily unavailable' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    if (!anthropicResp.ok) {
      return new Response(
        JSON.stringify({ error: 'upstream_error', message: 'service temporarily unavailable' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
      );
    }

    // Pipe the SSE stream straight through to the browser
    return new Response(anthropicResp.body, {
      status: 200,
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...corsHeaders(origin),
      },
    });
  },
};
