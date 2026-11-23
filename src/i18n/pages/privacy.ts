import { dict } from '../dict';
export const PRIVACY = dict({
  en: {
    title: 'Privacy', description: 'What this portfolio stores, what it sends, and how page views are counted.',
    kicker: 'Privacy', h: 'What happens', accent: 'with your data.', updated: 'Last updated {d}',
    whoH: 'Responsible', whoB: '{name}, {location}. Contact: {email}',
    hostH: 'Hosting', hostB: 'The site is static and served by GitHub Pages (GitHub, Inc.). To deliver pages, GitHub processes technical data such as your IP address; see GitHub’s privacy statement.',
    localH: 'Stored in your browser only', localB: 'No cookies, no accounts, no forms. Your choices (light or dark, language, recruiter mode, whether the tiger has greeted you) are kept in your browser’s local or session storage and are never sent anywhere.',
    statsH: 'Visitor statistics',
    statsOn: 'Page views are counted with GoatCounter. Each page view sends one image request to {origin} with only: the page path, the page title, the referring website (domain only) and your screen width. No cookies and no fingerprinting. Nothing is sent if your browser signals Do Not Track or Global Privacy Control. GoatCounter receives your IP address and browser user agent as part of the request; see GoatCounter’s privacy policy. Purpose: knowing which pages are read. The statistics are totals; individual visitors are not identified.',
    statsOff: 'This site currently does not count visitors and loads nothing from other servers.',
    labsH: 'Labs and the tiger', labsB: 'BREACH MODE, the AI Systems Lab, the simulators and the tiger guide run entirely in your browser. What you type or test there is not sent anywhere.',
    rightsH: 'Your questions', rightsB: 'For anything about your data, email {email}.',
  },
  de: {
    title: 'Datenschutz', description: 'Was dieses Portfolio speichert, was es sendet und wie Seitenaufrufe gezählt werden.',
    kicker: 'Datenschutz', h: 'Was mit deinen', accent: 'Daten passiert.', updated: 'Stand: {d}',
    whoH: 'Verantwortlich', whoB: '{name}, {location}. Kontakt: {email}',
    hostH: 'Hosting', hostB: 'Die Website ist statisch und wird über GitHub Pages (GitHub, Inc.) ausgeliefert. Um Seiten auszuliefern, verarbeitet GitHub technische Daten wie deine IP-Adresse; siehe die Datenschutzerklärung von GitHub.',
    localH: 'Nur in deinem Browser gespeichert', localB: 'Keine Cookies, keine Konten, keine Formulare. Deine Einstellungen (hell oder dunkel, Sprache, Recruiter-Modus, ob der Tiger dich schon begrüßt hat) liegen im lokalen oder Sitzungsspeicher deines Browsers und werden nirgendwohin gesendet.',
    statsH: 'Besucherstatistik',
    statsOn: 'Seitenaufrufe werden mit GoatCounter gezählt. Jeder Seitenaufruf sendet eine Bildanfrage an {origin} mit nur: dem Seitenpfad, dem Seitentitel, der verweisenden Website (nur die Domain) und deiner Bildschirmbreite. Keine Cookies und kein Fingerprinting. Es wird nichts gesendet, wenn dein Browser Do Not Track oder Global Privacy Control signalisiert. GoatCounter erhält mit der Anfrage deine IP-Adresse und den User-Agent deines Browsers; siehe die Datenschutzerklärung von GoatCounter. Zweck: zu wissen, welche Seiten gelesen werden. Die Statistik besteht aus Summen; einzelne Besucher werden nicht identifiziert.',
    statsOff: 'Diese Website zählt derzeit keine Besucher und lädt nichts von anderen Servern.',
    labsH: 'Labore und der Tiger', labsB: 'BREACH MODE, das AI Systems Lab, die Simulatoren und der Tiger-Guide laufen vollständig in deinem Browser. Was du dort eingibst oder testest, wird nirgendwohin gesendet.',
    rightsH: 'Deine Fragen', rightsB: 'Bei Fragen zu deinen Daten schreib an {email}.',
  },
});
