// German content for the public pages, keyed to the English records. Same facts, natural German; English
// technical terms are kept where German engineers use them. A unit test fails if a published project,
// status, evidence level, taxonomy category or profile field has no German text here.
import type { EvidenceLevel, Status } from './schema';
import type { SkillCategory } from './constants';

export const STATUS_DE: Record<Status, string> = {
  production: 'Produktiv',
  professional: 'Beruflich',
  'open-source': 'Open Source',
  'in-progress': 'In Arbeit',
  academic: 'Studium',
  research: 'Forschung',
  experiment: 'Laborexperiment',
  planned: 'Geplant · frühe Recherche',
};

export const EVIDENCE_DE: Record<EvidenceLevel, string> = {
  public: 'Öffentliche Quelle',
  documented: 'Öffentliche Beschreibung',
  reported: 'Eigene Angabe',
  pending: 'Fallstudie folgt',
};

export const DOMAIN_DE: Record<string, { label: string; short: string; blurb: string }> = {
  systems: { label: 'Softwaresysteme', short: 'Systeme', blurb: 'Pipelines, Scheduler, Zustandsautomaten und die Tests, die sie ehrlich halten.' },
  ai: { label: 'KI & Machine Learning', short: 'KI / ML', blurb: 'Transformer-Modelle, Erklärbarkeit und Retrieval: KI, die ihre Nachweise zeigen muss.' },
  security: { label: 'Sicherheit', short: 'Sicherheit', blurb: 'Bedrohungsmodelle, Authentifizierung, Verified Boot und Pipelines, die keine Schwachstellen ausliefern.' },
  research: { label: 'Forschung', short: 'Forschung', blurb: 'Akademische Forschung: Erklärbarkeitsstudien und Versuchsplanung.' },
};

export const CATEGORY_DE: Record<SkillCategory, string> = {
  languages: 'Sprachen',
  frontend: 'Frontend',
  backend: 'Backend',
  infrastructure: 'Cloud & Infrastruktur',
  'data-ai': 'Daten & KI/ML',
  agentic: 'Agentic AI & Developer-Tools',
  'testing-security': 'Testing & Cybersecurity',
  systems: 'Systeme & Automatisierung',
};

/** German labels where the English one is not a proper name or a term German engineers use as is. */
export const SKILL_DE: Record<string, string> = {
  testing: 'Automatisiertes Testen',
  'threat-modeling': 'Bedrohungsmodellierung',
  'auth-mfa': 'Sichere Authentifizierung & MFA (TOTP)',
  'secure-boot': 'Secure Boot & Datenträgerintegrität',
  'linux-security': 'Linux-Härtung',
  'containers': 'Container- & Supply-Chain-Sicherheit',
  'fuzzing': 'Fuzzing & Sanitizer',
  'kernel-drivers': 'Linux-Kerneltreiber (C)',
  'scheduling': 'Scheduling & Ressourcenzuteilung',
  'data-pipelines': 'Datenpipelines / ETL',
  'idempotency': 'Idempotenz & Deduplizierung',
  'reliability': 'Zuverlässigkeit (Reliability Engineering)',
  'state-machines': 'Zustandsautomaten',
  'plugin-architecture': 'Plugin-Architektur',
  'automation': 'Prozessautomatisierung',
  'experiment-design': 'Versuchsplanung',
  'xai': 'Erklärbare KI (LIME, SHAP)',
  'accessibility': 'Barrierefreiheit (WCAG)',
  'ai-assisted-se': 'KI-gestützte Softwareentwicklung',
  'llm-agents': 'LLM-Tool-Calling',
  'evals': 'Agenten-Evaluation',
  'rag': 'Retrieval-gestützte Antworten (RAG)',
  'multi-agent': 'Multi-Agenten-Systeme',
  'git': 'Git & GitHub',
  'embedded-linux': 'Embedded Linux (Buildroot, U-Boot)',
  'mtls-pki': 'mTLS & PKI',
  'devsecops': 'DevSecOps',
  'power-bi': 'Power BI',
  'rest-api': 'REST-APIs',
  'alembic': 'Alembic-Migrationen',
};

export const SKILL_NOTE_DE: Record<string, string> = {
  'llm-agents': 'Read-only, schema-validierte Tools: ein Worker, gebaut und mit einem simulierten Modell getestet (nicht deployt), und das AI Systems Lab, das dieselben Verträge im Browser ausführt.',
  rag: 'Das Retrieval ist echt (BM25 und TF-IDF über die Inhalte dieser Website); die Antworten sind extraktiv, ohne Sprachmodell.',
  evals: 'Ein fester Evaluationssatz, der im Browser gegen den Portfolio-Guide und das Tool-Routing läuft.',
  'multi-agent': 'Eine deterministische Simulation von Koordinator, Spezialist, Prüfer und Reviewer im AI Systems Lab. Es laufen keine autonomen Agenten.',
};

export type ProjectDe = { summary: string; role: string; problem?: string; demoTitle?: string; demoDisclosure?: string };

export const PROJECT_DE: Record<string, ProjectDe> = {
  'test-resource-scheduler': {
    role: 'Software Engineer: Zuteilungs- und Scheduling-Logik, Reservierungs-Lebenszyklus und Zuverlässigkeitsmechanismen',
    summary: 'Dynamische Zuteilung und Scheduling bei Nokia: Gemeinsam genutzte Testsimulatoren werden bei Bedarf an Automatisierungs-Agenten vergeben, über Reservierungen, explizite Lebenszyklus-Zustände und Zuverlässigkeitsmechanismen.',
    problem: 'Wenn viele automatisierte Agenten um einen begrenzten Pool gemeinsamer Ressourcen konkurrieren, führt Ad-hoc-Zuteilung zu Doppelbuchungen, zu Reservierungen, die nach einem Absturz des Halters liegen bleiben, und zu Anfragen, die stillschweigend ewig warten. Ein Scheduler muss die Zuteilung explizit, beobachtbar und wiederherstellbar machen.',
    demoTitle: 'Labor zur dynamischen Zuteilung',
    demoDisclosure: 'Synthetische Simulation. Ressourcen, Agenten, Zeiten und Fehler werden in deinem Browser aus einem Seed erzeugt. Sie bildet keine Nokia-Systeme oder -Daten nach.',
  },
  'gmre-log-parser': {
    role: 'Entwurf und Umsetzung der Ingestion-Pipeline, der Parser-Plugins, des Datenbankschemas und des Testaufbaus',
    summary: 'Plugin-basierte Ingestion-Engine für verschachtelte Diagnose-Log-Archive. Sie liest Archive als Stream ohne vollständiges Entpacken, erkennt sie per SHA-256 für sichere Wiederholungsläufe und lädt typisierte Datensätze in eine relationale Datenbank für Team-Dashboards.',
    problem: 'Diagnose-Dumps kommen als tief verschachtelte Archive an. Sie von Hand zu entpacken und zu lesen ist langsam, die erneute Verarbeitung desselben Dumps erzeugt Duplikate, und die Daten erreichen die Dashboards nie in einheitlicher Form.',
    demoTitle: 'Simulator für verschachtelte Archive',
    demoDisclosure: 'Synthetischer Archivbaum und Datensätze, erzeugt in deinem Browser. SHA-256-Hashes werden echt mit Web Crypto berechnet; alles andere ist ein Modell der öffentlich beschriebenen Pipeline-Stufen.',
  },
  securemed: {
    role: 'Alleinentwickler: Anforderungen, Bedrohungsmodell, FastAPI-Anwendung, Tests, CI/CD-Pipeline und Kubernetes-Deployment',
    summary: 'Studienprojekt zu Security by Design: eine Terminbuchungs-App für eine Arztpraxis, entwickelt vom Bedrohungsmodell aus, mit TOTP-MFA für Admins, einer DevSecOps-Pipeline, die im Zweifel blockiert, und einem Least-Privilege-Deployment auf lokalem Kubernetes. Keine produktiv eingesetzte Patientensoftware.',
    problem: 'Sicherheit, die erst am Ende ergänzt wird, hinterlässt Lücken zwischen Anforderungen, Code und Deployment. Die Aufgabe war eine kleine, aber vollständige Webanwendung, in der jede Schutzmaßnahme von der Bedrohung über Code und Test bis zum Nachweis nachvollziehbar ist.',
    demoTitle: 'Rundgang durch die Sicherheitsarchitektur',
    demoDisclosure: 'Abstrahierte Referenzarchitektur und eine beispielhafte Pipeline. Der TOTP-Generator und -Prüfer sind echt (RFC 6238, Web Crypto) und verlassen deinen Browser nie. In dieser Demo gibt es keinerlei Patientendaten.',
  },
  'finbert-xai': {
    role: 'Alleinautor: Forschungsfrage, Protokoll, Implementierung, Experimente und Bericht (Kurs Explainable AI)',
    summary: 'Studie zu erklärbarer KI an FinBERT: LIME- und SHAP-Attributionen im Vergleich, auf einer vorab registrierten, geschichteten Stichprobe von Finanzsätzen, mit Löschinterventionen und Seed-Stabilitätsprüfungen in einer getesteten, reproduzierbaren Pipeline.',
    problem: 'Sentiment-Modelle für Finanztexte sind schwer zu vertrauen, wenn niemand sieht, welche Wörter eine Vorhersage bestimmt haben. Erklärungsmethoden widersprechen sich zudem, und dieser Widerspruch wird selten gezeigt.',
    demoTitle: 'Attributionslabor LIME vs. SHAP',
    demoDisclosure: 'Echte LIME- und exakte Shapley-Algorithmen laufen in deinem Browser gegen ein kleines, transparentes Lexikon-Modell, NICHT FinBERT. Die Werte zeigen, wie sich die Methoden verhalten, nicht die Ergebnisse der Studie.',
  },
  opticlab: {
    role: 'Alleinentwickler: Buildroot-Board-Support, signierte Boot-Kette, Linux-Plattformtreiber, C++-Daemon, mTLS-API und Testaufbau',
    summary: 'Sicherheitslabor für Embedded Linux: ein fiktiver Controller für ein optisches Netzwerk-Shelf auf emuliertem ARM64, gebootet über eine signierte U-Boot-Kette in ein dm-verity-Root-Dateisystem, mit C-Kerneltreiber, C++-Controller-Daemon und einer Management-API mit gegenseitigem TLS.',
    problem: 'Ein Embedded-Controller muss nachweisen, was er bootet und wer mit ihm sprechen darf. Das Labor baut diese Kette vollständig auf einem emulierten Board auf: Jede Boot-Stufe prüft die nächste, das Root-Dateisystem wird bei jedem Lesen verifiziert, und die Management-API antwortet nur autorisierten Operatoren.',
    demoTitle: 'Labor für Secure Boot und Controller',
    demoDisclosure: 'Eine Nachbildung des dokumentierten Verhaltens im Browser, erstellt aus den Architekturnotizen und Testnachweisen. Signaturen und Hashes sind echte WebCrypto-Operationen auf synthetischen Images; Boot-Stufen, Treiber, Slots und Zertifikate sind simuliert. Fiktive Hardware, kein Code oder Daten eines Arbeitgebers.',
  },
  'ticket-reporting-pipeline': {
    role: 'Aufbau der Reporting-Pipeline',
    summary: 'Reporting-Automatisierung bei Nokia: eine Power-BI-Pipeline, die Support-Ticket-Daten aus Excel-Exporten und Quellsystemen zusammenführt und eine manuelle wöchentliche Routine durch einheitliche, automatisch aktualisierte KPIs ersetzt.',
  },
  'priyanshu-exe': {
    role: 'Design, Engineering und Content-Modell, entwickelt mit KI-Coding-Assistenten',
    summary: 'Dieses Portfolio als Engineering-Produkt: eine Static-first-Website mit Astro und React-Islands, nachgeladenem 3D, sechs interaktiven Simulatoren auf getesteten Engines, einem Browser-Sicherheitslabor, einem AI Systems Lab und einem Offline-Guide, der aus einem typisierten, validierten Content-Modell antwortet.',
    problem: 'Ein Portfolio muss in Sekunden überzeugen und trotzdem der Prüfung durch Engineers standhalten: schnell, barrierefrei, ehrlich bei den Nachweisen und kostenlos im Betrieb, ohne dass ein Besuch je einen API-Aufruf kostet.',
    demoTitle: 'Labor für Intent-Routing',
    demoDisclosure: 'Führt die echte Guide-Engine dieser Website in deinem Browser auf den freigegebenen Inhalten aus. Nichts wird gesendet, und kein KI-Modell ist beteiligt.',
  },
  'infrastructure-capacity': {
    role: 'Geplant: Problemdefinition und frühe Recherche',
    summary: 'Geplantes Projekt, frühe Recherche: wie gut gemeinsam genutzte Infrastruktur ausgelastet ist, wie viel Kapazität eine Last wirklich braucht und was die Hardware kostet, unter Zuverlässigkeitsvorgaben. Noch ist nichts gebaut.',
    problem: 'Gemeinsam genutzte Hardware wird leicht überdimensioniert und ist schwer zu überblicken: Auslastung, Warteschlangen und Fehlerreserven liegen an verschiedenen Stellen, also wird Kapazität nach Gefühl gekauft. Die Frage ist, wie weit Observability- und Scheduling-Daten diese Entscheidung explizit machen können.',
  },
};

/** German profile text (same facts as src/data/profile.ts). */
export const PROFILE_DE = {
  title: 'Software Engineer | Cybersecurity · KI & Machine Learning',
  headline: 'Ich entwickle intelligente, sichere Systeme.',
  positioning: 'Software Engineering · Cybersecurity · KI & Machine Learning',
  focusAreas: ['Intelligente Systeme', 'Agentic AI', 'Systemautomatisierung', 'Sichere Softwareentwicklung', 'Backend & Infrastruktur', 'Engineering-Zuverlässigkeit'],
  lede: 'Software Engineer und dualer Informatikstudent an der DHBW Stuttgart mit Fokus auf Cybersecurity, KI und Machine Learning. Bei Nokia arbeitet er an Engineering-Automatisierung, Diagnose-Tooling, Ressourcen-Orchestrierung und datengetriebenen Softwaresystemen.',
  intro: [
    'Ich bin Software Engineer und dualer Informatikstudent an der DHBW Stuttgart, mit Fokus auf Cybersecurity, KI und Machine Learning.',
    'Bei Nokia arbeite ich an Engineering-Automatisierung, Diagnose-Tooling, Ressourcen-Orchestrierung und datengetriebenen Systemen: Ich teile gemeinsam genutzte Testsimulatoren zu, verarbeite verschachtelte Diagnose-Logs und automatisiere KPI-Reporting.',
    'Darüber hinaus baue ich sichere und intelligente Systeme selbst: eine bedrohungsmodellierte Web-App mit MFA und abgesicherter CI/CD, einen Embedded-Linux-Controller mit Verified Boot und Erklärbarkeitsstudien an einem Transformer-NLP-Modell.',
  ],
  summary: [
    'Software Engineer bei Nokia: Engineering-Automatisierung, Ressourcen-Scheduling, Diagnose-Tooling und Datenpipelines.',
    'Dualer Informatikstudent an der DHBW Stuttgart mit technischem Schwerpunkt auf Cybersecurity und KI/ML.',
    'Praxis in sicherem Anwendungsdesign, DevSecOps, Embedded-Linux-Sicherheit, Erklärbarkeit von NLP-Modellen und KI-gestützter Softwareentwicklung.',
  ],
  tags: ['Software Engineering', 'Cybersecurity', 'KI & Machine Learning'],
  signature: 'Builder aus Überzeugung, Hustler nach Stundenplan: Engineering bei Nokia und ein Informatikstudium, in abwechselnden Phasen.',
  location: 'Stuttgart, Deutschland',
  languages: { Hindi: { name: 'Hindi', level: 'Muttersprache', note: null as string | null }, German: { name: 'Deutsch', level: 'Verhandlungssicher', note: 'im Studium und im Beruf' as string | null }, English: { name: 'Englisch', level: 'Fließend (C1)', note: null as string | null } } as Record<string, { name: string; level: string; note: string | null }>,
  experience: {
    unit: 'Tooling für den Support-Engineering-Bereich',
    title: 'Software Engineer (duales Studium)',
    summary: 'Daten-Tooling für das Support Engineering: Ingestion verschachtelter Log-Archive, automatisiertes Reporting sowie Scheduling und Zuverlässigkeit.',
    highlights: [
      'Dynamische Zuteilungs- und Scheduling-Logik entwickelt, die gemeinsam genutzte Testsimulatoren an Automatisierungs-Agenten vergibt, mit expliziten Reservierungszuständen und Zuverlässigkeitsmechanismen.',
      'GMRE entworfen und gebaut: eine Plugin-basierte Engine, die verschachtelte Diagnose-Log-Archive als Stream liest, Duplikate per SHA-256 überspringt und typisierte Datensätze für Team-Dashboards lädt.',
      'Das wöchentliche KPI-Reporting des Support-Teams mit einer Power-BI-Pipeline aus Excel-Exporten und Quellsystemen automatisiert.',
    ],
  },
  education: {
    program: 'Duales Studium Informatik',
    focus: 'Technischer Schwerpunkt: Cybersecurity und KI/ML',
    summary: 'Abwechselnde Theorie- und Praxisphasen bei Nokia. Studienarbeiten unter anderem zu erklärbarer KI, Security Engineering und IoT-Architektur.',
    coursework: { 'Security by Design': 'Security by Design', 'Explainable AI': 'Explainable AI' } as Record<string, string>,
  },
  principles: {
    'Proof beats claims': { title: 'Nachweise statt Behauptungen', body: 'Jedes Projekt auf dieser Website zeigt seinen Status und wie viel öffentlicher Nachweis dahintersteht. Fehlende Nachweise werden benannt, nicht versteckt.' },
    'Make state explicit': { title: 'Zustände explizit machen', body: 'Ingestion-Ledger, Reservierungs-Lebenszyklen, Auth-Flows: Systeme sind vertrauenswürdiger, wenn jeder Zustand und jeder Übergang benannt und getestet werden kann.' },
    'Fail safe, re-run safe': { title: 'Sicher scheitern, sicher wiederholen', body: 'Idempotenz, Fingerprints, Leases und Schutzmechanismen, damit ein Absturz oder ein erneuter Lauf nie Daten beschädigt.' },
  } as Record<string, { title: string; body: string }>,
};
