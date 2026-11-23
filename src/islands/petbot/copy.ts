// The tiger's own words, with no imports: PetBot (on every page) reads only this module, so the guide
// engine and the content model stay in the lazy chat chunk until someone opens the chat.
// The greeting never mentions the visitor: no name, location, time zone, device or browser details.
export type PetLang = 'en' | 'de';

export const PET = {
  en: {
    greeting: 'Hey there! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?',
    explore: 'Explore projects', ask: 'Ask me something', dismiss: 'Dismiss', farewell: 'See you around! 🐾',
    button: 'Priyanshu’s pet bot: ask about his work', title: 'Priyanshu’s pet bot (/)',
    panelTitle: 'Priyanshu’s pet bot', panelSub: 'Scripted · works offline', clear: 'Clear', close: 'Close chat', log: 'Conversation',
    suggested: 'Suggested questions', more: 'More questions', moreTopics: 'More questions', job: 'Match a job description', tryThese: 'Try one of these',
    you: 'You:', tellMore: 'Tell me more', fullAnswer: 'Full answer', sources: 'Sources', evidenceMap: 'Show the evidence map', onePager: 'Show the one-pager',
    jdLabel: 'Job description', jdPlaceholder: 'Paste the requirements…', cancel: 'Cancel', map: 'Map evidence',
    inputLabel: 'Message Priyanshu’s pet bot', placeholder: 'Message…', send: 'Send', askHint: 'Type a question, or pick one:',
    jobIntro: 'Paste a job description and I’ll map each requirement to his published evidence: strong, partial or no public evidence. It runs entirely in your browser.',
    englishOnly: '',
  },
  de: {
    greeting: 'Hey! 🐯 Ich bin Priyanshus kleiner Bot. Möchtest du seine Projekte entdecken?',
    explore: 'Projekte entdecken', ask: 'Frag mich etwas', dismiss: 'Schließen', farewell: 'Bis bald! 🐾',
    button: 'Priyanshus kleiner Bot: Fragen zu seiner Arbeit', title: 'Priyanshus kleiner Bot (/)',
    panelTitle: 'Priyanshus kleiner Bot', panelSub: 'Geskriptet · funktioniert offline', clear: 'Leeren', close: 'Chat schließen', log: 'Unterhaltung',
    suggested: 'Vorgeschlagene Fragen', more: 'Weitere Fragen', moreTopics: 'Weitere Fragen', job: 'Stellenbeschreibung abgleichen', tryThese: 'Probier eine davon',
    you: 'Du:', tellMore: 'Mehr erfahren', fullAnswer: 'Vollständige Antwort (Englisch)', sources: 'Quellen', evidenceMap: 'Nachweis-Übersicht zeigen', onePager: 'Kurzprofil zeigen',
    jdLabel: 'Stellenbeschreibung', jdPlaceholder: 'Anforderungen einfügen…', cancel: 'Abbrechen', map: 'Abgleichen',
    inputLabel: 'Nachricht an Priyanshus kleinen Bot', placeholder: 'Nachricht…', send: 'Senden', askHint: 'Stell eine Frage oder wähle eine aus:',
    jobIntro: 'Füge eine Stellenbeschreibung ein, und ich ordne jede Anforderung seinen veröffentlichten Nachweisen zu: stark, teilweise oder ohne öffentlichen Nachweis. Alles läuft in deinem Browser.',
    englishOnly: 'Ausführliche Antworten sind auf Englisch.',
  },
} as const;

/** Contextual offers when a visitor opens a project (once per session each). */
export const PROJECT_OFFERS: Record<PetLang, Record<string, { text: string; question: string }>> = {
  en: {
    'finbert-xai': { text: 'Curious how LIME and SHAP disagree? Ask me.', question: 'What AI experience does he have?' },
    securemed: { text: 'Want the security story behind this one?', question: 'What cybersecurity work has he done?' },
    'test-resource-scheduler': { text: 'This one is from his Nokia work. Want the context?', question: 'What does he do at Nokia?' },
    'gmre-log-parser': { text: 'Want the engineering decisions behind his work?', question: 'What makes his engineering work interesting?' },
    'ticket-reporting-pipeline': { text: 'More Nokia work is in the guide. Want the overview?', question: 'What does he do at Nokia?' },
  },
  de: {
    'finbert-xai': { text: 'Neugierig, warum LIME und SHAP sich widersprechen? Frag mich.', question: 'What AI experience does he have?' },
    securemed: { text: 'Möchtest du die Sicherheitsgeschichte dahinter?', question: 'What cybersecurity work has he done?' },
    'test-resource-scheduler': { text: 'Das stammt aus seiner Arbeit bei Nokia. Möchtest du den Kontext?', question: 'What does he do at Nokia?' },
    'gmre-log-parser': { text: 'Möchtest du die Engineering-Entscheidungen dahinter?', question: 'What makes his engineering work interesting?' },
    'ticket-reporting-pipeline': { text: 'Mehr zu seiner Nokia-Arbeit gibt es im Guide. Überblick?', question: 'What does he do at Nokia?' },
  },
};
