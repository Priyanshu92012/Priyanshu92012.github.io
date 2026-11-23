// Public profile. Only facts already published on the v1 site or stated by the owner
// in the master plan. Dates/titles marked in CONTENT_APPROVAL.md need owner sign-off.
export const profile = {
  name: 'Priyanshu',
  brand: 'PRIYANSHU.EXE',
  role: 'Software Engineer',
  /** Recruiter header line. */
  title: 'Software Engineer | Cybersecurity · AI & Machine Learning',
  /** Homepage headline; the hero breaks it after the comma. */
  headline: 'Building intelligent, secure systems.',
  /** The professional identity, used consistently (hero, résumé, SEO). */
  positioning: 'Software Engineering · Cybersecurity · AI & Machine Learning',
  /** Supporting focus areas (quieter than the three pillars). */
  focusAreas: ['Intelligent systems', 'Agentic AI', 'Systems automation', 'Secure software engineering', 'Backend & infrastructure', 'Engineering reliability'],
  /** Third person: the guide, the chat and search read this. */
  lede:
    'Software engineer and dual Computer Science student at DHBW Stuttgart, focused on cybersecurity, AI and machine learning. At Nokia he works on engineering automation, diagnostic tooling, resource orchestration and data-driven software systems.',
  /** First person, homepage introduction (60–90 words, one idea per paragraph). */
  intro: [
    'I’m a software engineer and dual Computer Science student at DHBW Stuttgart, focused on cybersecurity, AI and machine learning.',
    'At Nokia, I work on engineering automation, diagnostic tooling, resource orchestration and data-driven systems: allocating shared test simulators, ingesting nested diagnostic logs and automating KPI reporting.',
    'Beyond that, I build secure and intelligent systems hands-on: a threat-modelled web app with MFA and gated CI/CD, a verified-boot embedded Linux controller, and explainability studies of a transformer NLP model.',
  ],
  /** Recruiter summary: two or three short lines. */
  summary: [
    'Software engineer at Nokia, building engineering automation, resource scheduling, diagnostic tooling and data pipelines.',
    'Dual Computer Science student at DHBW Stuttgart with a technical focus on cybersecurity and AI/ML.',
    'Hands-on with secure application design, DevSecOps, embedded Linux security, NLP explainability and AI-assisted engineering.',
  ],
  tags: ['Software engineering', 'Cybersecurity', 'AI & machine learning'],
  /** Personality line: “builder” up front, the hustle shown rather than claimed. */
  signature: 'Builder by nature, hustler by schedule: engineering at Nokia and a Computer Science degree, in alternating phases.',
  location: 'Stuttgart, Germany',
  /** Human languages, as stated by the owner (2026-11-21). */
  languages: [
    { name: 'Hindi', level: 'Native' as string | null, note: null as string | null },
    { name: 'German', level: 'Full professional proficiency' as string | null, note: 'used in university studies and professional work' as string | null },
    { name: 'English', level: 'Fluent (C1)' as string | null, note: null as string | null },
  ],
  experience: [
    {
      org: 'Nokia',
      unit: 'Support-engineering tooling',
      title: 'Software Engineer (dual study)',
      location: 'Stuttgart',
      /** e.g. '10/2024 – present'. null until the owner confirms the dates. */
      period: null as string | null,
      summary:
        'Production data tooling for support engineering: nested-archive log ingestion, automated reporting, and scheduling and reliability work.',
      /** Résumé bullets, each restating an approved project record. */
      highlights: [
        'Built dynamic allocation and scheduling logic that assigns shared test simulators to automation agents, with explicit reservation states and reliability safeguards.',
        'Designed and built GMRE, a plugin-based engine that stream-reads nested diagnostic log archives, skips duplicates by SHA-256 and loads typed records for team dashboards.',
        'Automated the support team’s weekly KPI reporting with a Power BI pipeline fed from Excel exports and source systems.',
      ],
      tech: ['python', 'sql', 'sqlalchemy', 'pytest', 'data-pipelines', 'scheduling', 'power-bi'],
      projects: ['test-resource-scheduler', 'gmre-log-parser', 'ticket-reporting-pipeline'],
    },
  ],
  education: [
    {
      org: 'DHBW Stuttgart',
      program: 'Computer Science, dual study',
      /** German programme name, shown with the English one. */
      programDe: 'Duales Studium Informatik',
      /** Technical focus, not an official specialisation. */
      focus: 'Technical focus: cybersecurity and AI/ML',
      period: null as string | null,
      summary: 'Alternating academic and practical phases with Nokia. Academic work includes explainable AI, security engineering and IoT architecture.',
      /** Course projects shown on the résumé (approved records). */
      coursework: [
        { course: 'Security by Design', project: 'securemed' },
        { course: 'Explainable AI', project: 'finbert-xai' },
      ],
      projects: ['finbert-xai', 'securemed', 'midlog-iot', 'basyx-aasx-importer'],
    },
  ],
  links: {
    email: 'mailto:priyanshu240105@gmail.com',
    emailLabel: 'priyanshu240105@gmail.com',
    github: 'https://github.com/Priyanshu92012',
    githubLabel: 'github.com/Priyanshu92012',
    linkedin: 'https://www.linkedin.com/in/priyanshu-priyanshu-/',
    linkedinLabel: 'linkedin.com/in/priyanshu-priyanshu-',
    repo: 'https://github.com/Priyanshu92012/Priyanshu92012.github.io',
  },
  principles: [
    { title: 'Proof beats claims', body: 'Every project on this site shows its status and how much public evidence backs it. Missing evidence is labelled, not hidden.' },
    { title: 'Make state explicit', body: 'Ingestion ledgers, reservation lifecycles, auth flows: systems are easier to trust when every state and transition can be named and tested.' },
    { title: 'Fail safe, re-run safe', body: 'Idempotency, fingerprints, leases and guardrails, so a crash or a re-run never corrupts data.' },
  ],
  /** Set to a site path once an owner-approved PDF exists in /public. */
  resumePdf: null as string | null,
} as const;

export type Profile = typeof profile;
