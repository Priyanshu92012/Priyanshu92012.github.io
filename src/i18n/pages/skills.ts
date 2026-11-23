import { dict } from '../dict';
export const SKILLS = dict({
  en: {
    title: 'Skills', description: 'Skills Constellation: {n} skills, each linked to the projects that evidence it, with status and public-evidence level.',
    kicker: 'Skills constellation', h: 'A skill is a claim.', accent: 'Here is the proof.', meta: '{n} skills · {p} projects',
    lede: 'No percentage bars, no self-ratings. Each skill is connected to the projects that use it, and each project says how much of that you can verify.',
    mapH: 'Interactive constellation', techNum: 'SKILLS & TECHNOLOGIES', techH: 'By what they are used for',
    techLede: '{n} technologies in {g} groups, the same records as the constellation. Each names the projects behind it and the kind of work: professional (Nokia), academic (DHBW), own projects, development tools, and exploration that is built as a demonstration rather than claimed as expertise.',
    eiNum: 'EVIDENCE INDEX', eiH: 'Every skill, every source', eiLede: 'The same data as the constellation, as a plain list. Bars show the strongest public evidence for each skill.', strongest: 'Strongest evidence: {e}',
  },
  de: {
    title: 'Skills', description: 'Skill-Konstellation: {n} Skills, jeweils verknüpft mit den Projekten, die sie belegen, mit Status und Umfang öffentlicher Nachweise.',
    kicker: 'Skill-Konstellation', h: 'Ein Skill ist eine Behauptung.', accent: 'Hier ist der Nachweis.', meta: '{n} Skills · {p} Projekte',
    lede: 'Keine Prozentbalken, keine Selbsteinschätzung. Jeder Skill ist mit den Projekten verbunden, die ihn nutzen, und jedes Projekt sagt, wie viel davon du prüfen kannst.',
    mapH: 'Interaktive Konstellation', techNum: 'SKILLS & TECHNOLOGIEN', techH: 'Nach Einsatzzweck',
    techLede: '{n} Technologien in {g} Gruppen, aus denselben Daten wie die Konstellation. Jede nennt die Projekte dahinter und die Art der Arbeit: beruflich (Nokia), akademisch (DHBW), eigene Projekte, Entwicklungstools und Erkundung, die als Demonstration gebaut und nicht als Expertise behauptet wird.',
    eiNum: 'NACHWEISVERZEICHNIS', eiH: 'Jeder Skill, jede Quelle', eiLede: 'Dieselben Daten wie die Konstellation, als einfache Liste. Die Balken zeigen den stärksten öffentlichen Nachweis je Skill.', strongest: 'Stärkster Nachweis: {e}',
  },
});
