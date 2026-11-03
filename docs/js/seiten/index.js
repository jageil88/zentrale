// Seiten der Zentrale. Die TikTok-Seiten kommen aus eigenen Modulen.
export const NAV = [
  { ziel: "", text: "Start" },
  { ziel: "tiktok/heute", text: "Heute" },
  { ziel: "tiktok/zahlen", text: "Zahlen" },
  { ziel: "tiktok/videos", text: "Videos" },
  { ziel: "tiktok/system", text: "System" },
];

export const ansichtBauen = (roh) => roh;

const platzhalter = {
  zeichne(main, k) {
    const anzahl = k.ansicht?.pc?.videos?.length ?? 0;
    main.innerHTML = `<h1>Zentrale</h1><p class="leise">Daten geladen: ${anzahl} Videos.</p>`;
  },
};

export const SEITEN = {
  "": platzhalter,
  "tiktok/heute": platzhalter,
  "tiktok/zahlen": platzhalter,
  "tiktok/videos": platzhalter,
  "tiktok/system": platzhalter,
};
