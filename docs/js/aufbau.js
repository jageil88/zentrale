// Der 4-Sekunden-Aufbau: Jedes Diagramm baut sich auf, sobald es zur Hälfte sichtbar wird – jedes Mal neu.
// Antippen überspringt. Leon wollte ihn ausdrücklich, darum läuft er auch, wenn das Gerät „Animationen aus“
// meldet; unter System lässt er sich pro Gerät abschalten (dann sofort das fertige Bild).
export const easeOut = (p) => 1 - (1 - p) ** 3;

const SCHALTER = "zentrale-animation";
export function animationAn() {
  try { return localStorage.getItem(SCHALTER) !== "aus"; } catch { return true; }
}
export function animationSetzen(an) {
  try { if (an) localStorage.removeItem(SCHALTER); else localStorage.setItem(SCHALTER, "aus"); } catch { /* bleibt an */ }
}
const ruhig = () => !animationAn();

export function aufbauen(el, schritt, { dauer = 4000 } = {}) {
  let rahmen = 0;
  let sichtbar = false;
  const fertig = () => {
    cancelAnimationFrame(rahmen);
    rahmen = 0;
    schritt(1);
  };
  const neu = () => {
    cancelAnimationFrame(rahmen);
    if (ruhig()) return fertig();
    let start = null;
    const lauf = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dauer);
      schritt(easeOut(p));
      rahmen = p < 1 ? requestAnimationFrame(lauf) : 0;
    };
    schritt(0);
    rahmen = requestAnimationFrame(lauf);
  };
  el.addEventListener("click", (e) => {
    if (rahmen && !e.target.closest("button, a, summary")) fertig();
  });
  const beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      const halb = e.intersectionRatio >= 0.5;
      if (halb && !sichtbar) neu();
      sichtbar = halb;
    }
  }, { threshold: [0, 0.5] });
  beobachter.observe(el);
  schritt(ruhig() ? 1 : 0);
  return {
    neu: () => (sichtbar ? neu() : schritt(0)),
    laeuft: () => rahmen !== 0,
  };
}
