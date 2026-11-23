// Shared public content model for the Phase 1 hero prototypes.
// Shape follows master plan §7 (trimmed). Only facts already public on the live
// site, or named in the master plan with an honest status, appear here.
// No metrics: those wait for CONTENT_APPROVAL.md (plan §6).
window.PORTFOLIO = {
  person: {
    name: 'Priyanshu',
    headline: 'Software engineer building reliable systems and evidence-first AI.',
    summary:
      'Software engineer at Nokia in Stuttgart and dual CS student at DHBW. I build data pipelines, AI tooling and systems that turn messy operational data into something engineers can trust.',
    location: 'Stuttgart, Germany',
    links: {
      email: 'mailto:priyanshu240105@gmail.com',
      github: 'https://github.com/Priyanshu92012',
      linkedin: 'https://www.linkedin.com/in/priyanshu-priyanshu-/',
    },
  },

  // Plan §4: orb clusters map to Software Systems, AI, Security, Research.
  domains: [
    { id: 'systems',  label: 'Software Systems', short: 'Systems',  color: 'violet' },
    { id: 'ai',       label: 'Applied AI',       short: 'AI',       color: 'bio' },
    { id: 'security', label: 'Security',         short: 'Security', color: 'orange' },
    { id: 'research', label: 'Research',         short: 'Research', color: 'paper' },
  ],

  // status vocabulary: 'verified' | 'in-progress' | 'research' | 'pending'
  // 'pending' = named in the plan, case study awaiting content approval.
  projects: [
    {
      slug: 'gmre', title: 'GMRE Log Parser', domains: ['systems'],
      status: 'verified', statusLabel: 'Production',
      category: 'professional',
      summary: 'Plugin-based ingestion engine for nested diagnostic log archives, with deduplication and a migration-managed schema feeding team dashboards.',
      tech: ['Python', 'MySQL', 'SQLAlchemy', 'Alembic'],
    },
    {
      slug: 'basyx', title: 'BaSyx AASX Importer', domains: ['systems', 'research'],
      status: 'verified', statusLabel: 'Open source',
      category: 'open-source',
      summary: 'Import wizard for the Eclipse BaSyx web UI: extracts ConceptDescriptions from .aasx archives and resolves conflicts against the target repository.',
      tech: ['Vue 3', 'TypeScript', 'Eclipse BaSyx'],
      url: 'https://github.com/DHBW-TINF24F/Team1-basyx-aas-web-ui',
    },
    {
      slug: 'ticket-pipeline', title: 'Support Ticket Reporting', domains: ['systems'],
      status: 'verified', statusLabel: 'Live',
      category: 'professional',
      summary: 'Automated reporting refresh pipeline replacing manual weekly upkeep with consistent KPIs.',
      tech: ['Power BI', 'DAX', 'Automation'],
    },
    {
      slug: 'incident-copilot', title: 'AI Incident Copilot', domains: ['ai'],
      status: 'in-progress', statusLabel: 'In progress',
      category: 'experiment',
      summary: 'Agentic incident assistant that ingests docs, logs and tickets, calls tools through MCP and drafts root cause and next actions.',
      tech: ['Python', 'FastAPI', 'RAG', 'MCP', 'Evals'],
    },
    {
      slug: 'finbert-xai', title: 'FinBERT XAI', domains: ['ai', 'research'],
      status: 'pending', statusLabel: 'Case study pending',
      category: 'academic',
      summary: 'Academic explainability work comparing LIME and SHAP attributions on a financial sentiment model.',
      tech: ['Python', 'FinBERT', 'LIME', 'SHAP'],
    },
    {
      slug: 'securemed', title: 'SecureMed', domains: ['security'],
      status: 'pending', statusLabel: 'Case study pending',
      category: 'academic',
      summary: 'Course project (not deployed patient software): threat model, MFA flow and a secure CI/CD pipeline with test gates.',
      tech: ['Threat modeling', 'MFA', 'CI/CD'],
    },
    {
      slug: 'midlog', title: 'MidLog IoT Architecture', domains: ['research'],
      status: 'research', statusLabel: 'Academic',
      category: 'academic',
      summary: 'End-to-end IoT design for a cold-chain distribution centre: sensor selection, LoRaWAN gateway placement and edge/fog/cloud topology.',
      tech: ['LoRaWAN', 'MQTT', 'Edge / Fog / Cloud'],
    },
  ],
};

window.PORTFOLIO.projectsIn = function (domainId) {
  return window.PORTFOLIO.projects.filter((p) => p.domains.includes(domainId));
};
