// Seiten der Zentrale: Startseite mit allen Spielständen, dazu die Seiten des TikTok-Spielstands.
import { ansicht } from "../kennzahlen.js";
import { spielstaende } from "./spielstaende.js";
import { heute } from "./heute.js";
import { zahlen } from "./zahlen.js";
import { videos } from "./videos.js";
import { system } from "./system.js";

export const NAV = [
  { ziel: "", text: "Start" },
  { ziel: "tiktok/heute", text: "Heute" },
  { ziel: "tiktok/zahlen", text: "Zahlen" },
  { ziel: "tiktok/videos", text: "Videos" },
  { ziel: "tiktok/system", text: "System" },
];

export const ansichtBauen = ansicht;

export const SEITEN = {
  "": spielstaende,
  "tiktok/heute": heute,
  "tiktok/zahlen": zahlen,
  "tiktok/videos": videos,
  "tiktok/system": system,
};
