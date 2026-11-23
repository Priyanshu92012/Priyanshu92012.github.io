// Page → pet bot reactions (design lab only). Plain CustomEvents on window.
export type PetEvent = { kind: 'project'; slug: string };
const NAME = 'pexe:pet';

export function emitPet(e: PetEvent): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NAME, { detail: e }));
}
export function onPet(fn: (e: PetEvent) => void): () => void {
  const h = (ev: Event) => fn((ev as CustomEvent<PetEvent>).detail);
  window.addEventListener(NAME, h);
  return () => window.removeEventListener(NAME, h);
}
