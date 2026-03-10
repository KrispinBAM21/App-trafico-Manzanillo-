import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SEGURIDAD ────────────────────────────────────────────────────────────────
const sanitize = (str) => {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/`/g, "&#x60;")
    .replace(/=/g, "&#x3D;")
    .slice(0, 500);
};

const rateLimiter = (() => {
  const timestamps = {};
  return {
    check: (key, limitMs = 30000) => {
      const now = Date.now();
      const last = timestamps[key] || 0;
      if (now - last < limitMs) {
        const remaining = Math.ceil((limitMs - (now - last)) / 1000);
        return { allowed: false, remaining };
      }
      timestamps[key] = now;
      return { allowed: true };
    }
  };
})();

const COOKIE_KEY = "cookie_consent";
const getCookieConsent = () => {
  try { return localStorage.getItem(COOKIE_KEY); } catch { return null; }
};
const saveCookieConsent = (val) => {
  try { localStorage.setItem(COOKIE_KEY, val); } catch {}
};

// Inject Google Fonts (DM Sans body)
const dmSansLink = document.createElement('link');
dmSansLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap';
dmSansLink.rel = 'stylesheet';
document.head.appendChild(dmSansLink);

// Inject custom fonts
const customFontStyle = document.createElement('style');
customFontStyle.textContent = [
  `@font-face { font-family: 'Folklore'; src: url('data:font/otf;base64,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/mUAQwBZ/6AAQwBa/6AAQwBb/6AAQwBc/6AARAAm/1UARAAq/1UARAAy/1UARAA0/1UARAA3/pgARAA4/1UARAA5/hoARAA6/hoARAA8/jkARAA//h8ARABD/hoARABG/1UARABK/1UARABS/1UARABU/1UARABX/pgARABY/1UARABZ/hoARABa/hoARABc/jkARQAk/5kARQA5/5kARQA6/5kARQA7/1oARQA8/3oARQA//38ARQBD/5kARQBE/5kARQBZ/5kARQBa/5kARQBb/1oARQBc/3oARgAk/1UARgA5/1UARgA6/1UARgA7/vYARgA8/xYARgA//xsARgBA/3QARgBD/1UARgBE/1UARgBZ/1UARgBa/1UARgBb/vYARgBc/xYARwAk/1UARwA5/1UARwA6/1UARwA7/xYARwA8/xYARwA//xsARwBA/3QARwBD/1UARwBE/1UARwBZ/1UARwBa/1UARwBb/xYARwBc/xYASQAk/0AASQAt/qMASQBC/UgASQBE/0AASQBN/qMASgA3/5QASgA5/5QASgA6/5QASgA8/5QASgA//5kASgBD/5QASgBX/5QASgBZ/5QASgBa/5QASgBc/5QATQAk/1EATQBE/1EATgAm/vYATgAq/vYATgAy/vYATgA0/vYATgBG/vYATgBK/vYATgBS/vYATgBU/vYATwA3/mQATwA5/qMATwA6/qMATwA8/kQATwA//gsATwBD/UgATwBX/mQATwBZ/qMATwBa/qMATwBc/kQAUgAk/1UAUgA5/1UAUgA6/1UAUgA7/xYAUgA8/xYAUgA//xsAUgBA/3QAUgBD/1UAUgBE/1UAUgBZ/1UAUgBa/1UAUgBb/xYAUgBc/xYAUwAk/vwAUwAt/p0AUwA5/3oAUwA6/3oAUwA7/zsAUwA8/1oAUwA//2AAUwBA/7kAUwBC/p0AUwBD/5kAUwBE/vwAUwBN/p0AUwBZ/3oAUwBa/3oAUwBb/zsAUwBc/1oAVAAk/5QAVAA5/1UAVAA6/1UAVAA7/5QAVAA8/xYAVAA//xsAVABA/5QAVABD/1UAVABE/5QAVABZ/1UAVABa/1UAVABb/5QAVABc/xYAVQA5/3oAVQA6/3oAVQA8/1oAVQA//2AAVQBD/5kAVQBZ/3oAVQBa/3oAVQBc/1oAVgAk/3oAVgBE/3oAVwAk/n4AVwAt/n4AVwBC/n4AVwBE/n4AVwBN/n4AWAAk/1UAWABE/1UAWQAk/hoAWQAm/1UAWQAq/1UAWQAt/pgAWQAy/1UAWQA0/1UAWQA2/5QAWQBC/pgAWQBE/hoAWQBG/1UAWQBK/1UAWQBN/pgAWQBS/1UAWQBU/1UAWQBW/5QAWgAk/ggAWgAm/2MAWgAq/2MAWgAt/qUAWgAy/2MAWgA0/2MAWgA2/4IAWgBC/qUAWgBE/ggAWgBG/2MAWgBK/2MAWgBN/qUAWgBS/2MAWgBU/2MAWgBW/4IAWwAm/vYAWwAq/vYAWwAy/vYAWwA0/vYAWwBG/vYAWwBK/vYAWwBS/vYAWwBU/vYAXAAk/jkAXAAm/xYAXAAq/xYAXAAt/lkAXAAy/xYAXAA0/xYAXAA2/1UAXABC/jkAXABE/jkAXABG/xYAXABK/xYAXABN/lkAXABS/xYAXABU/xYAXABW/1UAAAAQAMYAAQAAAAAAAAA0AAAAAQAAAAAAAQAIADsAAQAAAAAAAgAHADQAAQAAAAAAAwAVADsAAQAAAAAABAAIADsAAQAAAAAABQAvAFAAAQAAAAAABgAIADsAAQAAAAAACgA/AH8AAwABBAkAAABoAL4AAwABBAkAAQAQATQAAwABBAkAAgAOASYAAwABBAkAAwAqATQAAwABBAkABAAQATQAAwABBAkABQBeAV4AAwABBAkABgAQATQAAwABBAkACgB+AbxUeXBlZmFjZSCpICh5b3VyIGNvbXBhbnkpLiAyMDEzLiBBbGwgUmlnaHRzIFJlc2VydmVkUmVndWxhckZvbGtsb3JlOlZlcnNpb24gMS4wMFZlcnNpb24gMS4wMCBEZWNlbWJlciAyMSwgMjAxMywgaW5pdGlhbCByZWxlYXNlVGhpcyBmb250IHdhcyBjcmVhdGVkIHVzaW5nIEZvbnRDcmVhdG9yIDcuNSBmcm9tIEhpZ2gtTG9naWMuY29tAFQAeQBwAGUAZgBhAGMAZQAgAKkAIAAoAHkAbwB1AHIAIABjAG8AbQBwAGEAbgB5ACkALgAgADIAMAAxADMALgAgAEEAbABsACAAUgBpAGcAaAB0AHMAIABSAGUAcwBlAHIAdgBlAGQAUgBlAGcAdQBsAGEAcgBGAG8AbABrAGwAbwByAGUAOgBWAGUAcgBzAGkAbwBuACAAMQAuADAAMABWAGUAcgBzAGkAbwBuACAAMQAuADAAMAAgAEQAZQBjAGUAbQBiAGUAcgAgADIAMQAsACAAMgAwADEAMwAsACAAaQBuAGkAdABpAGEAbAAgAHIAZQBsAGUAYQBzAGUAVABoAGkAcwAgAGYAbwBuAHQAIAB3AGEAcwAgAGMAcgBlAGEAdABlAGQAIAB1AHMAaQBuAGcAIABGAG8AbgB0AEMAcgBlAGEAdABvAHIAIAA3AC4ANQAgAGYAcgBvAG0AIABIAGkAZwBoAC0ATABvAGcAaQBjAC4AYwBvAG0AAgAAAAAAAP8nAJYAAAAAAAAAAAAAAAAAAAAAAAAAAADsAAAAAQACAAMABAAFAAYABwAIAAkACgALAAwADQAOAA8AEAARABIAEwAUABUAFgAXABgAGQAaABsAHAAdAB4AHwAgACEAIgAjACQAJQAmACcAKAApACoAKwAsAC0ALgAvADAAMQAyADMANAA1ADYANwA4ADkAOgA7ADwAPQA+AD8AQABBAEIAQwBEAEUARgBHAEgASQBKAEsATABNAE4ATwBQAFEAUgBTAFQAVQBWAFcAWABZAFoAWwBcAF0AXgBfAGAAYQCjAIQAhQC9AJYA6ACGAI4AiwCdAKkApACKANoAgwCTAQIBAwCNAJcAiADDAN4BBACeAKoA9QD0APYAogCtAMkAxwCuAGIAYwCQAGQAywBlAMgAygDPAMwAzQDOAOkAZgDTANAA0QCvAGcA8ACRANYA1ADVAGgA6wDtAIkAagBpAGsAbQBsAG4AoABvAHEAcAByAHMAdQB0AHYAdwDqAHgAegB5AHsAfQB8ALgAoQB/AH4AgACBAOwA7gC6ANcA2ADhAQUA2wDcAN0A4ADZAN8AsgCzALYAtwDEALQAtQDFAIIAwgCHAKsAvgC/ALwA9wEGAQcBCAEJAIwAmACoAJoAmQDvAKUAkgCcAKcAlACVAQoBCwd1bmkwMEIyB3VuaTAwQjMHdW5pMDBCOQd1bmkwMkM5BGxpcmEGcGVzZXRhBEV1cm8HdW5pMjExNgd1bmlGMDAxB3VuaUYwMDIAAAAAAf//AAIAAAABAAAAAAABAAAAAAAAAAAAAAABAAAACgAeACwAAWxhdG4ACAAEAAAAAP//AAEAAAABa2VybgAIAAAAAQAAAAEABAACAAAAAQAIAAEH7gAEAAAALABiALQA5gEcAVIBaAGSAZwBvgHoAh4CYAKWArgCwgLYAuIDIANeA4ADvgPgBDIEWASSBOQFFgVMBYIFmAXCBcwF7gYYBk4GkAbGBugG8gcIBxIHUAeOB7AAFAAm/1UAKv9VADL/VQA0/1UAN/6YADj/VQA5/hoAOv4aADz+OQA//h8AQ/4aAEb/VQBK/1UAUv9VAFT/VQBX/pgAWP9VAFn+GgBa/hoAXP45AAwAJP+ZADn/mQA6/5kAO/9aADz/egA//38AQ/+ZAET/mQBZ/5kAWv+ZAFv/WgBc/3oADQAk/1UAOf9VADr/VQA7/vYAPP8WAD//GwBA/3QAQ/9VAET/VQBZ/1UAWv9VAFv+9gBc/xYADQAk/1UAOf9VADr/VQA7/xYAPP8WAD//GwBA/3QAQ/9VAET/VQBZ/1UAWv9VAFv/FgBc/xYABQAk/0AALf6jAEL9SABE/0AATf6jAAoAN/+UADn/lAA6/5QAPP+UAD//mQBD/5QAV/+UAFn/lABa/5QAXP+UAAIAJP9RAET/UQAIACb+9gAq/vYAMv72ADT+9gBG/vYASv72AFL+9gBU/vYACgA3/mQAOf6jADr+owA8/kQAP/4LAEP9SABX/mQAWf6jAFr+owBc/kQADQAk/1UAOf9VADr/VQA7/xYAPP8WAD//GwBA/3QAQ/9VAET/VQBZ/1UAWv9VAFv/FgBc/xYAEAAk/vwALf6dADn/egA6/3oAO/87ADz/WgA//2AAQP+5AEL+nQBD/5kARP78AE3+nQBZ/3oAWv96AFv/OwBc/1oADQAk/5QAOf9VADr/VQA7/5QAPP8WAD//GwBA/5QAQ/9VAET/lABZ/1UAWv9VAFv/lABc/xYACAA5/3oAOv96ADz/WgA//2AAQ/+ZAFn/egBa/3oAXP9aAAIAJP96AET/egAFACT+fgAt/n4AQv5+AET+fgBN/n4AAgAk/1UARP9VAA8AJP4aACb/VQAq/1UALf6YADL/VQA0/1UANv+UAEL+mABE/hoARv9VAEr/VQBN/pgAUv9VAFT/VQBW/5QADwAk/ggAJv9jACr/YwAt/qUAMv9jADT/YwA2/4IAQv6lAET+CABG/2MASv9jAE3+pQBS/2MAVP9jAFb/ggAIACb+9gAq/vYAMv72ADT+9gBG/vYASv72AFL+9gBU/vYADwAk/jkAJv8WACr/FgAt/lkAMv8WADT/FgA2/1UAQv45AET+OQBG/xYASv8WAE3+WQBS/xYAVP8WAFb/VQAIACb/XAAq/1wAMv9cADT/XABG/1wASv9cAFL/XABU/1wAFAAm/xsAKv8bADL/GwA0/xsAN/5eADj/GwA5/gAAOv4AADz+PwA//UgAQ/2CAEb/GwBK/xsAUv8bAFT/GwBX/l4AWP8bAFn+AABa/gAAXP4/AAkAN/5kADn+owA6/qMAPP5EAD/+CwBX/mQAWf6jAFr+owBc/kQADgAk/oUALf5lADn/oAA6/6AAO/+gADz/oAA//6YAQ/+gAET+hQBN/mUAWf+gAFr/oABb/6AAXP+gABQAJv9VACr/VQAy/1UANP9VADf+mAA4/1UAOf4aADr+GgA8/jkAP/4fAEP+GgBG/1UASv9VAFL/VQBU/1UAV/6YAFj/VQBZ/hoAWv4aAFz+OQAMACT/mQA5/5kAOv+ZADv/WgA8/3oAP/9/AEP/mQBE/5kAWf+ZAFr/mQBb/1oAXP96AA0AJP9VADn/VQA6/1UAO/72ADz/FgA//xsAQP90AEP/VQBE/1UAWf9VAFr/VQBb/vYAXP8WAA0AJP9VADn/VQA6/1UAO/8WADz/FgA//xsAQP90AEP/VQBE/1UAWf9VAFr/VQBb/xYAXP8WAAUAJP9AAC3+owBC/UgARP9AAE3+owAKADf/lAA5/5QAOv+UADz/lAA//5kAQ/+UAFf/lABZ/5QAWv+UAFz/lAACACT/UQBE/1EACAAm/vYAKv72ADL+9gA0/vYARv72AEr+9gBS/vYAVP72AAoAN/5kADn+owA6/qMAPP5EAD/+CwBD/UgAV/5kAFn+owBa/qMAXP5EAA0AJP9VADn/VQA6/1UAO/8WADz/FgA//xsAQP90AEP/VQBE/1UAWf9VAFr/VQBb/xYAXP8WABAAJP78AC3+nQA5/3oAOv96ADv/OwA8/1oAP/9gAED/uQBC/p0AQ/+ZAET+/ABN/p0AWf96AFr/egBb/zsAXP9aAA0AJP+UADn/VQA6/1UAO/+UADz/FgA//xsAQP+UAEP/VQBE/5QAWf9VAFr/VQBb/5QAXP8WAAgAOf96ADr/egA8/1oAP/9gAEP/mQBZ/3oAWv96AFz/WgACACT/egBE/3oABQAk/n4ALf5+AEL+fgBE/n4ATf5+AAIAJP9VAET/VQAPACT+GgAm/1UAKv9VAC3+mAAy/1UANP9VADb/lABC/pgARP4aAEb/VQBK/1UATf6YAFL/VQBU/1UAVv+UAA8AJP4IACb/YwAq/2MALf6lADL/YwA0/2MANv+CAEL+pQBE/ggARv9jAEr/YwBN/qUAUv9jAFT/YwBW/4IACAAm/vYAKv72ADL+9gA0/vYARv72AEr+9gBS/vYAVP72AA8AJP45ACb/FgAq/xYALf5ZADL/FgA0/xYANv9VAEL+OQBE/jkARv8WAEr/FgBN/lkAUv8WAFT/FgBW/1UAAQAsACQAJQAmACcAKQAqAC0ALgAvADIAMwA0ADUANgA3ADgAOQA6ADsAPAA+AD8AQgBDAEQARQBGAEcASQBKAE0ATgBPAFIAUwBUAFUAVgBXAFgAWQBaAFsAXAAAAAEAAAAKAB4ALgABbGF0bgAIAAQAAAAA//8AAQAAAAFmcmFjAAgAAAACAAAAAQACAAYAHAABAAAAAQAIAAIACAABANgAAQABABIABAAAAAEACAABACwAAgAKACAAAgAGAA4AfQADANgAFQB8AAMA2AAXAAEABAB+AAMA2AAXAAEAAgAUABYAAA==') format('opentype'); font-weight: normal; font-style: normal; }`
].join(' ');
document.head.appendChild(customFontStyle);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://wnchrhglwsrzrcrhhukg.supabase.co";
const SUPA_KEY = "sb_publishable_9Uiui8fhiBXeds4OkKbGCQ_NvYEMO5O";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MN    = "'DM Sans', sans-serif";
const TITLE = "'Folklore', serif";

const TERMINALS_NORTE = [
  { id: "contecon", name: "CONTECON", fullName: "Contecon Manzanillo S.A." },
  { id: "hazesa",   name: "HAZESA",   fullName: "Hazesa Terminal Especializada" },
];
const TERMINALS_SUR = [
  { id: "timsa",      name: "TIMSA",      fullName: "Terminal Internacional de Manzanillo S.A." },
  { id: "ssa",        name: "SSA",        fullName: "SSA México Terminal" },
  { id: "ocupa",      name: "OCUPA",      fullName: "Terminal Multipropósito" },
  { id: "multimodal", name: "MULTIMODAL", fullName: "Terminal Multimodal" },
  { id: "friman",     name: "FRIMAN",     fullName: "Frigoríficos de Manzanillo" },
  { id: "lajunta",    name: "LA JUNTA",   fullName: "Terminal TAP – La Junta" },
  { id: "cemex",      name: "CEMEX",      fullName: "CEMEX Terminal Marítima" },
];
const TERMINAL_STATUS_OPTIONS = [
  { id: "libre",            label: "Terminal Libre",   color: "#22c55e", icon: "✓" },
  { id: "llena",            label: "Terminal Llena",   color: "#ef4444", icon: "✗" },
  { id: "retorno_terminal", label: "Retorno Terminal", color: "#f97316", icon: "↩" },
  { id: "retorno_asipona",  label: "Retorno ASIPONA",  color: "#a855f7", icon: "⚓" },
];

const INCIDENT_CATEGORIAS = [
  { id: "incidente", label: "Incidente", icon: "⚠️", color: "#f97316" },
  { id: "accidente", label: "Accidente", icon: "🚨", color: "#ef4444" },
];

const INCIDENT_SUBCATEGORIAS = {
  incidente: [
    { id: "falla_mecanica",     label: "Camión con falla mecánica",      icon: "🔧" },
    { id: "camion_atravesado",  label: "Camión obstruyendo (atravesado)", icon: "🚛" },
    { id: "falta_diesel",       label: "Camión con falta de diesel",      icon: "⛽" },
    { id: "contenedor_ladeado", label: "Camión con contenedor ladeado",   icon: "📦" },
    { id: "plataforma_abandonada", label: "Plataforma abandonada",        icon: "🚚" },
    { id: "carga_abandonada",   label: "Carga abandonada",                icon: "📫" },
    { id: "camion_abandonado",  label: "Camión abandonado",               icon: "🅿️" },
  ],
  accidente: [
    { id: "atropellado",        label: "Atropellado",                     icon: "🚶" },
    { id: "choque",             label: "Choque entre vehículos",          icon: "💥" },
    { id: "volcadura_contenedor", label: "Volcadura de contenedor",       icon: "📦" },
    { id: "herido",             label: "Herido",                          icon: "🏥" },
    { id: "caida_material",     label: "Caída de material",               icon: "⬇️" },
    { id: "camion_volcado",     label: "Camión volcado",                  icon: "🔄" },
    { id: "zona_asalto",        label: "Zona de asalto",                  icon: "🚔" },
    { id: "zona_robo",          label: "Zona de robo",                    icon: "⚡" },
  ],
};

const INCIDENT_TYPES = [
  { id: "incidente", label: "Incidente",      icon: "⚠️", color: "#f97316" },
  { id: "accidente", label: "Accidente",      icon: "🚨", color: "#ef4444" },
  { id: "bloqueo",   label: "Bloqueo / Corte",icon: "🚧", color: "#eab308" },
  { id: "obra",      label: "Obra / Desvío",  icon: "🏗️", color: "#3b82f6" },
];

const VIALIDADES = [
  { id: "jalipa_puerto",    name: "Jalipa → Puerto",              fullName: "Vialidad Jalipa - Puerto" },
  { id: "puerto_jalipa",    name: "Puerto → Jalipa",              fullName: "Vialidad Puerto - Jalipa" },
  { id: "libramiento",      name: "Cihuatlán-Manzanillo",         fullName: "Libramiento Cihuatlán-Manzanillo" },
  { id: "mzllo_colima",     name: "Manzanillo → Colima",          fullName: "Carretera Manzanillo-Colima" },
  { id: "colima_mzllo",     name: "Colima → Manzanillo",          fullName: "Carretera Colima-Manzanillo" },
  { id: "algodones",        name: "Calle Algodones",              fullName: "Calle Algodones" },
];

const VIALIDAD_STATUS_OPTIONS = [
  { id: "libre",    label: "Libre",             color: "#22c55e", icon: "✓" },
  { id: "lento",    label: "Tráfico Lento",     color: "#eab308", icon: "⚠" },
  { id: "saturado", label: "Saturado",           color: "#f97316", icon: "🔶" },
  { id: "detenido", label: "Tráfico Detenido",   color: "#ef4444", icon: "✗" },
];

const ACCESOS_PRINCIPALES = [
  { id: "pezvela",   label: "Acceso Pez Vela",  color: "#a78bfa", zona: "Zona Sur"   },
  { id: "zonanorte", label: "Acceso Zona Norte", color: "#38bdf8", zona: "Zona Norte" },
];
const ACCESO_STATUS_OPTIONS = [
  { id: "libre",    label: "Libre / Fluido", color: "#22c55e", icon: "✓" },
  { id: "lento",    label: "Tráfico Lento",  color: "#eab308", icon: "⚠" },
  { id: "saturado", label: "Saturado",        color: "#ef4444", icon: "✗" },
  { id: "cerrado",  label: "Cerrado / Corte", color: "#6b7280", icon: "⛔" },
];
const RETORNO_OPTIONS = [
  { id: "none",     label: "Sin Retornos",     color: "#22c55e", icon: "✓" },
  { id: "terminal", label: "Retorno Terminal",  color: "#f97316", icon: "↩" },
  { id: "asipona",  label: "Retorno ASIPONA",   color: "#a855f7", icon: "⚓" },
];

const TODAS_TERMINALES = [
  { id: "contecon",   name: "CONTECON",   zona: "Norte" },
  { id: "hazesa",     name: "HAZESA",     zona: "Norte" },
  { id: "timsa",      name: "TIMSA",      zona: "Sur"   },
  { id: "ssa",        name: "SSA",        zona: "Sur"   },
  { id: "ocupa",      name: "OCUPA",      zona: "Sur"   },
  { id: "multimodal", name: "MULTIMODAL", zona: "Sur"   },
  { id: "friman",     name: "FRIMAN",     zona: "Sur"   },
  { id: "lajunta",    name: "LA JUNTA",   zona: "Sur"   },
  { id: "cemex",      name: "CEMEX",      zona: "Sur"   },
];

const PATIOS_REGULADORES = [
  { id: "cima1",     name: "CIMA 1",    fullName: "Patio Regulador CIMA 1"    },
  { id: "cima2",     name: "CIMA 2",    fullName: "Patio Regulador CIMA 2"    },
  { id: "isl",       name: "ISL",       fullName: "Patio Regulador ISL"       },
  { id: "alman",     name: "ALMAN",     fullName: "Patio Regulador ALMAN"     },
  { id: "sia",       name: "SIA",       fullName: "Patio Regulador SIA"       },
  { id: "timsa_p",   name: "TIMSA",     fullName: "Patio Regulador TIMSA"     },
  { id: "almacont",  name: "ALMACONT",  fullName: "Patio Regulador ALMACONT"  },
  { id: "ssa_p",     name: "SSA",       fullName: "Patio Regulador SSA"       },
];

const PATIO_STATUS_OPTIONS = [
  { id: "libre",    label: "Patio Libre",    color: "#22c55e", icon: "✓" },
  { id: "saturado", label: "Saturado",        color: "#ef4444", icon: "✗" },
  { id: "cerrado",  label: "Cerrado",         color: "#6b7280", icon: "⛔" },
  { id: "lleno",    label: "Patio Lleno",     color: "#f97316", icon: "⚠" },
];

const ACCESOS_SEGUNDO = [
  {
    id: "pezvela", label: "Acceso Pez Vela", color: "#a78bfa", zona: "Sur",
    carriles: [
      { id: "pv_c1", label: "Carril 1", tipo: "ingreso", defaultTerminal: "timsa" },
      { id: "pv_c2", label: "Carril 2", tipo: "ingreso", defaultTerminal: "ssa"   },
      { id: "pv_c3", label: "Carril 3", tipo: "ingreso", defaultTerminal: "ocupa" },
      { id: "pv_c4", label: "Carril 4", tipo: "ingreso", defaultTerminal: "multimodal" },
      { id: "pv_c5", label: "Carril 5", tipo: "expo",  flujo: "Exportación" },
      { id: "pv_c6", label: "Carril 6", tipo: "impo",  flujo: "Importación" },
      { id: "pv_c7", label: "Carril 7", tipo: "impo",  flujo: "Importación" },
      { id: "pv_c8", label: "Carril 8", tipo: "expo",  flujo: "Exportación" },
    ],
  },
  {
    id: "puerta15", label: "Puerta 15", color: "#34d399", zona: "Sur",
    carriles: [
      { id: "p15_c1", label: "Carril 1", tipo: "expo", flujo: "Exportación" },
      { id: "p15_c2", label: "Carril 2", tipo: "impo", flujo: "Importación" },
      { id: "p15_c3", label: "Carril 3", tipo: "impo", flujo: "Importación" },
    ],
  },
  {
    id: "zonanorte_acc", label: "Acceso Zona Norte", color: "#38bdf8", zona: "Norte",
    carriles: [
      { id: "zn_c1", label: "Carril 1", tipo: "expo", flujo: "Exportación" },
      { id: "zn_c2", label: "Carril 2", tipo: "expo", flujo: "Exportación" },
      { id: "zn_c3", label: "Carril 3", tipo: "impo", flujo: "Importación" },
    ],
  },
];

const mkSegundoState = () => {
  const state = {};
  ACCESOS_SEGUNDO.forEach(acc => {
    acc.carriles.forEach(c => {
      if (c.tipo === "ingreso") {
        state[c.id] = { abierto: true, terminal: c.defaultTerminal, saturado: false, retornos: false, lastUpdate: Date.now(), updatedBy: "Sistema" };
      } else {
        state[c.id] = { abierto: true, saturado: false, lastUpdate: Date.now(), updatedBy: "Sistema" };
      }
    });
  });
  return state;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const timeAgo = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000)   return "hace un momento";
  if (d < 3600000) return `hace ${Math.floor(d / 60000)}min`;
  return `hace ${Math.floor(d / 3600000)}h`;
};
const uid = () => "u_" + Math.random().toString(36).substr(2, 6);

const mkTerminals = (list) =>
  Object.fromEntries(list.map(t => [t.id, { status: "libre", lastUpdate: Date.now(), updatedBy: "Sistema" }]));

const mkVialidades = () =>
  Object.fromEntries(VIALIDADES.map(v => [v.id, { status: "libre", lastUpdate: Date.now(), updatedBy: "Sistema", pendingVoters: {} }]));

const mkPatios = () =>
  Object.fromEntries(PATIOS_REGULADORES.map(p => [p.id, { status: "libre", lastUpdate: Date.now(), updatedBy: "Sistema", pendingVoters: {} }]));

const mkAccesos = () =>
  Object.fromEntries(ACCESOS_PRINCIPALES.map(a => [a.id, {
    status: "libre", retornos: "none",
    lastUpdate: Date.now(), updatedBy: "Sistema", pendingVoters: {},
  }]));

const SEGUNDO_CARRILES_INGRESO = [
  { id: "c1", label: "Carril 1", defaultTerminal: "ssa"   },
  { id: "c2", label: "Carril 2", defaultTerminal: "timsa" },
  { id: "c3", label: "Carril 3", defaultTerminal: "ocupa" },
];
const SEGUNDO_TRAFICO_OPTS = [
  { id: "libre",    label: "Libre",            color: "#22c55e", icon: "✓" },
  { id: "saturado", label: "Saturado",          color: "#ef4444", icon: "✗" },
  { id: "lento",    label: "Tráfico Lento",     color: "#f59e0b", icon: "🐢" },
  { id: "detenido", label: "Tráfico Detenido",  color: "#dc2626", icon: "🛑" },
];
const SEGUNDO_CONTENEDOR_OPTS = [
  { id: "puertas_cerradas", label: "Puertas Cerradas",        color: "#38bdf8", icon: "📦" },
  { id: "puertas_abiertas", label: "Puertas Abiertas",        color: "#a78bfa", icon: "🔓" },
  { id: "ambos",            label: "Ambos (Abierto/Cerrado)", color: "#f97316", icon: "📦🔓" },
  { id: "no_horario",       label: "No es Horario",           color: "#6b7280", icon: "🕐" },
];

const mkSegundoIngreso = () => ({
  ...Object.fromEntries(SEGUNDO_CARRILES_INGRESO.map(c => [c.id, {
    terminal: c.defaultTerminal, saturado: false, retornos: false,
    expo: "libre", expo_contenedor: null, impo: "libre",
    lastUpdate: Date.now(), updatedBy: "Sistema",
  }])),
  c4: { saturado: false, retornos: false, expo: "libre", expo_contenedor: null, impo: "libre", lastUpdate: Date.now(), updatedBy: "Sistema" },
});

const ACCESOS_CARRILES = [
  {
    id: "pezvela", label: "Acceso Pez Vela", color: "#a78bfa", zona: "Sur",
    carriles: [
      { id: "ac_pv_c5", label: "Carril 5", tipo: "expo" },
      { id: "ac_pv_c6", label: "Carril 6", tipo: "impo" },
      { id: "ac_pv_c7", label: "Carril 7", tipo: "impo" },
      { id: "ac_pv_c8", label: "Carril 8", tipo: "expo" },
    ],
  },
  {
    id: "puerta15", label: "Puerta 15", color: "#34d399", zona: "Sur",
    carriles: [
      { id: "ac_p15_c1", label: "Carril 1", tipo: "expo" },
      { id: "ac_p15_c2", label: "Carril 2", tipo: "impo" },
      { id: "ac_p15_c3", label: "Carril 3", tipo: "impo" },
    ],
  },
  {
    id: "zonanorte", label: "Zona Norte", color: "#38bdf8", zona: "Norte",
    carriles: [
      { id: "ac_zn_c1", label: "Carril 1", tipo: "expo" },
      { id: "ac_zn_c2", label: "Carril 2", tipo: "expo" },
      { id: "ac_zn_c3", label: "Carril 3", tipo: "impo" },
    ],
  },
];
const mkCarrilesState = () => {
  const s = {};
  ACCESOS_CARRILES.forEach(acc => acc.carriles.forEach(c => {
    s[c.id] = { abierto: true, lastUpdate: Date.now(), updatedBy: "Sistema" };
  }));
  return s;
};

// ─── HELPER: publicar noticia ────────────────────────────────────────────────
const publicarNoticia = async ({ tipo, titulo, detalle, icono, color }) => {
  await sb.from("noticias").insert({ tipo, titulo, detalle, icono, color });
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Badge({ color, children, small }) {
  return (
    <span style={{
      background: color + "22", border: `1px solid ${color}55`, color,
      padding: small ? "2px 7px" : "3px 9px",
      borderRadius: "4px", fontSize: small ? "10px" : "11px",
      fontFamily: MN, fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function VoteBar({ count, needed, color = "#38bdf8" }) {
  const pct = Math.min((count / needed) * 100, 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: MN }}>VERIFICACIÓN COMUNITARIA</span>
        <span style={{ fontSize: "9px", color, fontFamily: MN, fontWeight: "700" }}>{count}/{needed}</span>
      </div>
      <div style={{ background: "#1e3a5f", borderRadius: "2px", height: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#22c55e" : color, transition: "width 0.4s", borderRadius: "2px" }} />
      </div>
    </div>
  );
}

function ToastBox({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
      background: "rgba(255,255,255,0.15)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
      border: `1px solid ${toast.color}66`, color: "#fff",
      padding: "10px 22px", borderRadius: "24px", fontFamily: MN, fontSize: "12px", fontWeight: "600",
      boxShadow: `0 4px 24px ${toast.color}44`, zIndex: 999, whiteSpace: "nowrap", pointerEvents: "none",
      borderLeft: `3px solid ${toast.color}`,
    }}>{toast.msg}</div>
  );
}

function VoteCountBadge({ accesoId, status, myId }) {
  const [count, setCount] = React.useState(0);
  const key = `acceso_${accesoId}_${status}`;
  useEffect(() => {
    sb.from("votos").select("id", { count: "exact" }).eq("key", key).then(({ count: c }) => setCount(c || 0));
    const chan = sb.channel(`voto-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votos" }, () => {
        sb.from("votos").select("id", { count: "exact" }).eq("key", key).then(({ count: c }) => setCount(c || 0));
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, [key]);
  if (count === 0) return null;
  return (
    <span style={{ background:"#38bdf8", color:"#0a0f1e", borderRadius:"3px", padding:"0 4px", fontSize:"15px", fontWeight:"700", marginLeft:"3px" }}>{count}</span>
  );
}

function SectionLabel({ text, rightBtn }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", padding:"8px 12px", background:"rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px" }}>
      <span style={{ fontSize:"15px", color:"rgba(255,255,255,0.9)", fontFamily:TITLE, fontWeight:"700", letterSpacing:"0.5px" }}>{text}</span>
      {rightBtn}
    </div>
  );
}

function NormalBtn({ onClick, label = "TODO NORMAL" }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", background: "#22c55e15", border: "1px solid #22c55e44",
      borderRadius: "6px", color: "#22c55e", fontFamily: MN, fontSize: "10px",
      cursor: "pointer", fontWeight: "700", letterSpacing: "0.5px",
    }}>✓ {label}</button>
  );
}

// ─── DONATE BANNER ────────────────────────────────────────────────────────────
function DonateBanner({ active }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const shownRef = useRef(null);

  const hide = () => {
    setExiting(true);
    setTimeout(() => { setVisible(false); setExiting(false); }, 400);
  };

  useEffect(() => {
    // No mostrar en la sección de donativos
    if (active === "donativos") return;
    // Cada vez que cambia de sección, esperar 8s y mostrar
    if (shownRef.current === active) return;
    shownRef.current = active;
    setVisible(false);
    setExiting(false);
    const showTimer = setTimeout(() => setVisible(true), 8000);
    // Auto-ocultar después de 6s de mostrarse
    const hideTimer = setTimeout(() => hide(), 14000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [active]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: `translateX(-50%) translateY(${exiting ? "20px" : "0px"})`,
      opacity: exiting ? 0 : 1,
      transition: "opacity 0.4s ease, transform 0.4s ease",
      width: "calc(100% - 32px)",
      maxWidth: "420px",
      zIndex: 500,
      pointerEvents: "auto",
    }}>
      <div style={{
        background: "rgba(6, 14, 26, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(56,189,248,0.3)",
        borderLeft: "3px solid #38bdf8",
        borderRadius: "14px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.1)",
      }}>
        <div style={{ fontSize: "22px", flexShrink: 0 }}>⚓</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MN, fontWeight: "700", fontSize: "11px", color: "#e2e8f0", marginBottom: "2px" }}>
            ¿Te está siendo útil esta app?
          </div>
          <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.45)", lineHeight: "1.4" }}>
            Cada donativo ayuda a mantenerla viva 🙏
          </div>
        </div>
        <a
          href="https://ko-fi.com/conectmanzanillo"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", flexShrink: 0 }}
          onClick={hide}
        >
          <div style={{
            background: "linear-gradient(135deg,#38bdf8,#818cf8)",
            borderRadius: "8px",
            padding: "7px 13px",
            fontFamily: MN,
            fontSize: "10px",
            fontWeight: "700",
            color: "#0a0f1e",
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
          }}>💙 DONAR</div>
        </a>
        <button
          onClick={hide}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.25)",
            cursor: "pointer",
            fontSize: "16px",
            padding: "0 2px",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function NavBar({ active, set }) {
  const row1 = [
    { id: "inicio",      label: "Inicio",      icon: "🏠"  },
    { id: "trafico",     label: "Tráfico",     icon: "🗺️" },
    { id: "reporte",     label: "Reportar",    icon: "📍"  },
    { id: "terminales",  label: "Terminales",  icon: "⚓"  },
    { id: "patio",       label: "Patios",      icon: "🏭"  },
  ];
  const row2 = [
    { id: "segundo",    label: "2do Acceso", icon: "🚪"  },
    { id: "carriles",   label: "Carriles",   icon: "🚦"  },
    { id: "noticias",   label: "Noticias",   icon: "📰"  },
    { id: "donativos",  label: "Donativos",  icon: "💙"  },
    { id: "tutorial",   label: "Tutorial",   icon: "📖"  },
  ];

  const TabBtn = (t) => (
    <button key={t.id} onClick={() => set(t.id)} style={{
      flex: 1, padding: "9px 4px",
      background: active === t.id ? "rgba(255,255,255,0.15)" : "transparent",
      border: "none",
      borderBottom: active === t.id ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent",
      color: active === t.id ? "#ffffff" : "rgba(255,255,255,0.4)",
      fontSize: "9px", fontFamily: MN, fontWeight: active === t.id ? "600" : "400",
      cursor: "pointer", display: "flex", flexDirection: "column",
      alignItems: "center", gap: "3px", transition: "all 0.2s",
      letterSpacing: "0.5px", whiteSpace: "nowrap", minWidth: "0",
    }}>
      <span style={{ fontSize: "14px" }}>{t.icon}</span>
      {t.label.toUpperCase()}
    </button>
  );

  return (
    <nav style={{
      background: "rgba(255,255,255,0.07)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {row1.map(TabBtn)}
      </div>
      <div style={{ display: "flex" }}>
        {row2.map(TabBtn)}
      </div>
    </nav>
  );
}

// ─── TAB: TRÁFICO ─────────────────────────────────────────────────────────────
function TraficoTab({ myId, incidents, setIncidents }) {
  const [accesos,     setAccesos]     = useState(mkAccesos);
  const [vialidades,  setVialidades]  = useState(mkVialidades);
  const [toast,       setToast]       = useState(null);
  const [changeModal, setChangeModal] = useState(null);
  const [activeSection, setActiveSection] = useState("mapa"); // "mapa" | "accesos" | "vialidades" | "incidentes"

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  // ── Accesos ──
  useEffect(() => {
    sb.from("accesos").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("accesos").upsert(ACCESOS_PRINCIPALES.map(a => ({ id: a.id, status: "libre", retornos: "none", last_update: Date.now(), updated_by: "Sistema" })));
        return;
      }
      const map = {};
      data.forEach(r => { map[r.id] = { status: r.status, retornos: r.retornos || "none", lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
      setAccesos(prev => ({ ...prev, ...map }));
    });
    const chan = sb.channel("accesos-rt2")
      .on("postgres_changes", { event: "*", schema: "public", table: "accesos" }, () => {
        sb.from("accesos").select("*").then(({ data }) => {
          if (!data) return;
          const map = {};
          data.forEach(r => { map[r.id] = { status: r.status, retornos: r.retornos || "none", lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
          setAccesos(prev => ({ ...prev, ...map }));
        });
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  // ── Vialidades ──
  useEffect(() => {
    sb.from("vialidades").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("vialidades").upsert(VIALIDADES.map(v => ({ id: v.id, status: "libre", last_update: Date.now(), updated_by: "Sistema" })));
        return;
      }
      const map = {};
      data.forEach(r => { map[r.id] = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
      setVialidades(prev => ({ ...prev, ...map }));
    });
    const chan = sb.channel("vialidades-rt2")
      .on("postgres_changes", { event: "*", schema: "public", table: "vialidades" }, () => {
        sb.from("vialidades").select("*").then(({ data }) => {
          if (!data) return;
          const map = {};
          data.forEach(r => { map[r.id] = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
          setVialidades(prev => ({ ...prev, ...map }));
        });
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  const voteAcceso = async (id, newStatus) => {
    const rl = rateLimiter.check(`acceso_${myId}_${id}`, 20000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s`, "#f97316");
    const acc = accesos[id];
    if (!acc) return;
    if (acc.status === newStatus) return notify("Ya tiene ese estado", "#f97316");
    if (acc.pendingVoters?.[myId]) {
      setChangeModal({ type: "acceso", id, newStatus, label: ACCESO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label });
      return;
    }
    const voters = { ...(acc.pendingVoters || {}), [myId]: newStatus };
    const counts = {};
    Object.values(voters).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const finalStatus = winner[1] >= 3 ? winner[0] : acc.status;
    await sb.from("accesos").upsert({ id, status: finalStatus, retornos: acc.retornos, last_update: Date.now(), updated_by: `Usuario_${myId.slice(-4)}`, pending_voters: finalStatus !== acc.status ? {} : voters });
    if (finalStatus !== acc.status) {
      notify(`✓ Acceso actualizado: ${ACCESO_STATUS_OPTIONS.find(o => o.id === finalStatus)?.label}`, "#22c55e");
      await publicarNoticia({ tipo: "acceso", icono: "⚓", color: "#38bdf8", titulo: `Acceso actualizado`, detalle: `${ACCESOS_PRINCIPALES.find(a => a.id === id)?.label}: ${ACCESO_STATUS_OPTIONS.find(o => o.id === finalStatus)?.label}` });
    } else {
      notify(`Voto registrado (${winner[1]}/3)`, "#38bdf8");
    }
    setAccesos(prev => ({ ...prev, [id]: { ...prev[id], pendingVoters: voters } }));
  };

  const voteVialidad = async (id, newStatus) => {
    const rl = rateLimiter.check(`vialidad_${myId}_${id}`, 20000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s`, "#f97316");
    const v = vialidades[id];
    if (!v) return;
    const voters = { ...(v.pendingVoters || {}), [myId]: newStatus };
    const counts = {};
    Object.values(voters).forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const finalStatus = winner[1] >= 3 ? winner[0] : v.status;
    await sb.from("vialidades").upsert({ id, status: finalStatus, last_update: Date.now(), updated_by: `Usuario_${myId.slice(-4)}`, pending_voters: finalStatus !== v.status ? {} : voters });
    if (finalStatus !== v.status) {
      notify(`✓ ${VIALIDADES.find(x => x.id === id)?.name}: ${VIALIDAD_STATUS_OPTIONS.find(o => o.id === finalStatus)?.label}`, "#22c55e");
    } else {
      notify(`Voto (${winner[1]}/3)`, "#38bdf8");
    }
    setVialidades(prev => ({ ...prev, [id]: { ...prev[id], pendingVoters: voters } }));
  };

  const activeIncidents = incidents.filter(i => i.visible && !i.resolved);

  const voteConfirm = async (id) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc) return;
    const votes = { ...inc.votes, [myId]: 1 };
    const conf = Object.values(votes).filter(v => v === 1).length;
    const visible = conf >= 15;
    await sb.from("incidents").update({ votes, visible }).eq("id", id);
    notify(visible ? "✅ Verificado" : `✓ ${conf}/15`, "#22c55e");
  };
  const voteResolve = async (id) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc) return;
    const rv = { ...inc.resolveVotes, [myId]: 1 };
    const resolved = Object.keys(rv).length >= 3;
    await sb.from("incidents").update({ resolve_votes: rv, resolved }).eq("id", id);
    notify(resolved ? "✓ Resuelto" : `Voto ${Object.keys(rv).length}/3`, "#38bdf8");
  };

  const sections = [
    { id: "mapa",        label: "Mapa",        icon: "🗺️" },
    { id: "accesos",     label: "Accesos",     icon: "⚓" },
    { id: "vialidades",  label: "Vialidades",  icon: "🛣️" },
    { id: "incidentes",  label: "Incidentes",  icon: "⚠️" },
  ];

  return (
    <div style={{ paddingBottom: "80px" }}>

      {/* ── Sub-tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", position: "sticky", top: 0, zIndex: 50 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            flex: 1, padding: "10px 4px", background: "transparent", border: "none",
            borderBottom: activeSection === s.id ? "2px solid #38bdf8" : "2px solid transparent",
            color: activeSection === s.id ? "#38bdf8" : "rgba(255,255,255,0.4)",
            fontSize: "12px", fontFamily: MN, fontWeight: activeSection === s.id ? "700" : "400",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
          }}>
            <span style={{ fontSize: "16px" }}>{s.icon}</span>
            {s.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          SECCIÓN: MAPA
      ══════════════════════════════════════ */}
      {activeSection === "mapa" && (
        <div style={{ padding: "16px" }}>
          <MapaTrafico incidents={incidents} accesos={accesos} vialidades={vialidades} />
        </div>
      )}

      {/* ══════════════════════════════════════
          SECCIÓN: ACCESOS
      ══════════════════════════════════════ */}
      {activeSection === "accesos" && (
        <div style={{ padding: "16px" }}>
          {ACCESOS_PRINCIPALES.map(acc => {
            const st = accesos[acc.id] || { status: "libre", retornos: "none", lastUpdate: Date.now(), updatedBy: "Sistema" };
            const curOpt = ACCESO_STATUS_OPTIONS.find(o => o.id === st.status) || ACCESO_STATUS_OPTIONS[0];
            return (
              <div key={acc.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${acc.color}33`, borderRadius: "14px", padding: "14px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div>
                    <div style={{ color: acc.color, fontFamily: TITLE, fontSize: "15px", fontWeight: "700" }}>{acc.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontFamily: MN, marginTop: "2px" }}>{acc.zona} · {timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                  </div>
                  <div style={{ background: curOpt.color + "22", border: `1px solid ${curOpt.color}66`, color: curOpt.color, padding: "5px 12px", borderRadius: "8px", fontFamily: MN, fontSize: "13px", fontWeight: "700" }}>{curOpt.icon} {curOpt.label}</div>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontFamily: MN, letterSpacing: "1px", marginBottom: "8px" }}>REPORTAR ESTADO:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {ACCESO_STATUS_OPTIONS.map(o => (
                    <button key={o.id} onClick={() => voteAcceso(acc.id, o.id)} style={{ padding: "9px 8px", background: st.status === o.id ? o.color + "33" : "#0a1628", border: `1px solid ${st.status === o.id ? o.color : "#1e3a5f"}`, borderRadius: "8px", color: st.status === o.id ? o.color : "#64748b", fontFamily: MN, fontSize: "13px", cursor: "pointer", fontWeight: st.status === o.id ? "700" : "400", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{o.icon}</span>{o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════
          SECCIÓN: VIALIDADES
      ══════════════════════════════════════ */}
      {activeSection === "vialidades" && (
        <div style={{ padding: "16px" }}>
          {VIALIDADES.map(v => {
            const st = vialidades[v.id] || { status: "libre", lastUpdate: Date.now(), updatedBy: "Sistema" };
            const curOpt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === st.status) || VIALIDAD_STATUS_OPTIONS[0];
            return (
              <div key={v.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${curOpt.color}44`, borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: MN, fontSize: "14px", fontWeight: "600" }}>{v.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", fontFamily: MN, marginTop: "2px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                  </div>
                  <div style={{ background: curOpt.color + "22", border: `1px solid ${curOpt.color}66`, color: curOpt.color, padding: "4px 10px", borderRadius: "6px", fontFamily: MN, fontSize: "12px", fontWeight: "700" }}>{curOpt.icon} {curOpt.label}</div>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {VIALIDAD_STATUS_OPTIONS.map(o => (
                    <button key={o.id} onClick={() => voteVialidad(v.id, o.id)} style={{ padding: "6px 10px", background: st.status === o.id ? o.color + "33" : "#0a1628", border: `1px solid ${st.status === o.id ? o.color : "#1e3a5f"}`, borderRadius: "6px", color: st.status === o.id ? o.color : "#64748b", fontFamily: MN, fontSize: "12px", cursor: "pointer", fontWeight: st.status === o.id ? "700" : "400" }}>{o.icon} {o.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════
          SECCIÓN: INCIDENTES
      ══════════════════════════════════════ */}
      {activeSection === "incidentes" && (
        <div style={{ padding: "16px" }}>
          {activeIncidents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontFamily: MN, fontSize: "14px" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
              Sin incidentes activos en este momento
            </div>
          ) : activeIncidents.map(inc => {
            const t = INCIDENT_TYPES.find(x => x.id === inc.type) || INCIDENT_TYPES[0];
            const conf = Object.values(inc.votes).filter(v => v === 1).length;
            return (
              <div key={inc.id} style={{ background: "rgba(255,255,255,0.06)", border: `2px solid ${t.color}55`, borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px" }}>
                  <span style={{ fontSize: "22px" }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: t.color, fontFamily: MN, fontSize: "13px", fontWeight: "700" }}>{t.label.toUpperCase()}</div>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: MN, fontSize: "14px", marginTop: "2px" }}>{inc.location}</div>
                    {inc.desc && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "2px" }}>{inc.desc}</div>}
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", fontFamily: MN, marginTop: "4px" }}>{timeAgo(inc.ts)}</div>
                  </div>
                  <Badge color={t.color} small>ACTIVO</Badge>
                </div>
                <VoteBar count={conf} needed={15} color={t.color} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "10px" }}>
                  <button onClick={() => voteConfirm(inc.id)} style={{ padding: "8px", background: "#22c55e15", border: "1px solid #22c55e44", borderRadius: "8px", color: "#22c55e", fontFamily: MN, fontSize: "13px", cursor: "pointer", fontWeight: "700" }}>✅ CONFIRMAR</button>
                  <button onClick={() => voteResolve(inc.id)} style={{ padding: "8px", background: "#6b728015", border: "1px solid #6b728044", borderRadius: "8px", color: "#94a3b8", fontFamily: MN, fontSize: "13px", cursor: "pointer", fontWeight: "700" }}>🏁 RESUELTO</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToastBox toast={toast} />
      {changeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900, padding: "20px" }}>
          <div style={{ background: "#0d1b2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "320px" }}>
            <div style={{ fontFamily: TITLE, fontSize: "16px", color: "#fff", marginBottom: "8px" }}>¿Cambiar estado?</div>
            <div style={{ fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.6)", marginBottom: "18px" }}>Ya votaste antes. ¿Confirmas el cambio a <b style={{ color: "#38bdf8" }}>{changeModal.label}</b>?</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button onClick={() => setChangeModal(null)} style={{ padding: "10px", background: "#1e3a5f", border: "none", borderRadius: "8px", color: "rgba(255,255,255,0.7)", fontFamily: MN, fontSize: "13px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={async () => {
                if (changeModal.type === "acceso") await voteAcceso(changeModal.id, changeModal.newStatus, true);
                setChangeModal(null);
              }} style={{ padding: "10px", background: "#38bdf8", border: "none", borderRadius: "8px", color: "#0a0f1e", fontFamily: MN, fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAPA DE TRÁFICO (Leaflet con KML real) ──────────────────────────────────
function MapaTrafico({ incidents, accesos, vialidades }) {
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const layersRef = useRef({});

  // Datos exactos del KML
  const KML_POINTS = [
    { id:"contecon",   name:"Terminal Contecon",           color:"#f57c00", coords:[19.08418178396766,-104.3020765405659],  category:"terminal" },
    { id:"hazesa",     name:"Terminal Hazesa",             color:"#424242", coords:[19.08389836997078,-104.295058165122],   category:"terminal" },
    { id:"ssa",        name:"Terminal SSA",                color:"#388e3c", coords:[19.07463139813982,-104.2891322457856],  category:"terminal" },
    { id:"zonanorte",  name:"Acceso Zona Norte",           color:"#ffee58", coords:[19.08656881040979,-104.2970097872907],  category:"acceso"   },
    { id:"granelera",  name:"Granelera",                   color:"#00796b", coords:[19.06434906950253,-104.2907952693104],  category:"terminal" },
    { id:"lajunta",    name:"La Junta (TAP)",              color:"#5d4037", coords:[19.06322612268734,-104.2910153355142],  category:"terminal" },
    { id:"timsa",      name:"Terminal TIMSA",              color:"#5c6bc0", coords:[19.06126633877015,-104.2909711781655],  category:"terminal" },
    { id:"multimodal", name:"Terminal MULTIMODAL",         color:"#7b1fa2", coords:[19.05724964895184,-104.2942608658049],  category:"terminal" },
    { id:"friman",     name:"Terminal FRIMAN",             color:"#ef5350", coords:[19.05698919310202,-104.2954019724908],  category:"terminal" },
    { id:"ocupa",      name:"Terminal Multipropósito (OCUPA)", color:"#424242", coords:[19.05651848457071,-104.3003288440099], category:"terminal" },
    { id:"cemex",      name:"Terminal CEMEX",              color:"#4def05", coords:[19.05780874594614,-104.2997456907227],  category:"terminal" },
    { id:"asipona",    name:"Recinto ASIPONA",             color:"#e8ef05", coords:[19.05604853655314,-104.3034885062604],  category:"terminal" },
    { id:"pezvela",    name:"Acceso Pez Vela",             color:"#e806eb", coords:[19.07634709752751,-104.2873039903065],  category:"acceso"   },
    { id:"puerta15",   name:"Acceso Puerta 15",            color:"#eb0671", coords:[19.07789046237833,-104.2884816132865],  category:"acceso"   },
    { id:"patio",      name:"Acceso Patio Regulador",      color:"#06eb7a", coords:[19.10354265164766,-104.2702980795862],  category:"acceso"   },
  ];

  const KML_LINES = [
    {
      id: "segundo",
      name: "Segundo Acceso",
      color: "#fbc02d",  // amarillo del KML
      weight: 5,
      matchKeys: ["segundo acceso", "segundo", "puerta 15"],
      coords: [
        [19.08614814082691,-104.2956970369951],[19.08347774542781,-104.2934796156525],
        [19.0827236676422,-104.292904994139],[19.08246238688557,-104.2926228241943],
        [19.08235657868086,-104.2923587616436],[19.08237352346617,-104.2920468878797],
        [19.08242817883529,-104.2918396029668],[19.08269275556355,-104.2912062646124],
        [19.08297532216781,-104.2904515084542],[19.08345109879119,-104.289834498883],
        [19.08374348189437,-104.2895795704975],[19.08409374690542,-104.2893961664746],
        [19.08487014101002,-104.2885005257946],[19.08697882971024,-104.2861354547527],
        [19.08787477395832,-104.2851896223626],[19.08821823506365,-104.2850888158402],
        [19.08902256461223,-104.2851460213662],[19.08981703564006,-104.2851898570331],
        [19.09075902765731,-104.2849357221294],[19.09169675684177,-104.2846646108177],
        [19.09285712762023,-104.2840763960163],[19.09368944740285,-104.2835617541249],
        [19.09464271497917,-104.2830566261549],[19.09509738004797,-104.2829384920713],
        [19.09609296303484,-104.2831395313914],[19.09669921625866,-104.2833060257997],
        [19.09709887669316,-104.283482936537],[19.09763416146846,-104.2833785764898],
        [19.09844232379128,-104.2831814293819],
      ],
    },
    {
      id: "confinada",
      name: "Vialidad Confinada",
      color: "#1976d2",  // azul del KML
      weight: 5,
      matchKeys: ["confinada", "vialidad confinada"],
      coords: [
        [19.07845002778019,-104.2876418385643],[19.07873613722384,-104.2877910830109],
        [19.07948864058397,-104.2883817565716],[19.0803524036938,-104.2890657811886],
        [19.08120625312455,-104.2897407569772],[19.08269169809075,-104.2909162970023],
        [19.08295126479155,-104.2911718022012],[19.08315504829622,-104.2914131575336],
        [19.08390372645957,-104.2920218544218],[19.08503074467514,-104.2929068820028],
        [19.08559811613144,-104.2933935512683],[19.08597232474433,-104.2936647806544],
        [19.08642308590617,-104.2941350507671],[19.08679862961899,-104.2947303397634],
        [19.08704263945231,-104.2952775551105],
      ],
    },
  ];

  // Incidentes activos: qué elementos iluminar
  const activeIncidents = incidents.filter(i => i.visible && !i.resolved);
  const incGeoMap = {};
  activeIncidents.forEach(inc => {
    const text  = (inc.location || "").toLowerCase();
    const color = inc.type === "accidente" ? "#ef4444" : inc.type === "bloqueo" ? "#eab308" : "#f97316";
    [...KML_LINES, ...KML_POINTS].forEach(geo => {
      if ((geo.matchKeys || [geo.name.toLowerCase()]).some(k => text.includes(k))) {
        if (!incGeoMap[geo.id]) incGeoMap[geo.id] = { color, count: 0 };
        incGeoMap[geo.id].count++;
      }
    });
  });

  // Inicializar mapa
  useEffect(() => {
    const init = () => {
      if (leafRef.current || !mapRef.current || !window.L) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [19.075, -104.290],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
      leafRef.current = map;

      // Líneas KML
      KML_LINES.forEach(line => {
        const poly = L.polyline(line.coords, {
          color: line.color, weight: line.weight, opacity: 0.85,
          lineCap: "round", lineJoin: "round",
        }).addTo(map);
        poly.bindTooltip(`<b>${line.name}</b>`, { sticky: true, className: "cm-tooltip" });
        layersRef.current[line.id] = poly;
      });

      // Puntos KML con colores exactos del KML
      KML_POINTS.forEach(pt => {
        const icon = L.divIcon({
          html: `<div style="
            width:14px; height:14px;
            background:${pt.color};
            border:2.5px solid rgba(255,255,255,0.85);
            border-radius:50%;
            box-shadow:0 0 6px ${pt.color}88;
          "></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker(pt.coords, { icon }).addTo(map);
        marker.bindTooltip(`<b>${pt.name}</b>`, { sticky: true, className: "cm-tooltip" });
        layersRef.current[pt.id] = { marker, pt };
      });

      // CSS tooltips
      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style");
        s.id = "cm-map-style";
        s.textContent = `
          .cm-tooltip { background:rgba(4,12,24,0.95)!important; border:1px solid rgba(56,189,248,0.35)!important; border-radius:6px!important; color:rgba(255,255,255,0.9)!important; font-family:'DM Sans',sans-serif!important; font-size:12px!important; font-weight:600!important; padding:4px 9px!important; box-shadow:0 2px 12px rgba(0,0,0,0.5)!important; white-space:nowrap!important; }
          .cm-tooltip::before { display:none!important; }
          .leaflet-control-zoom a { background:rgba(4,12,24,0.9)!important; color:rgba(255,255,255,0.7)!important; border-color:rgba(255,255,255,0.1)!important; }
          .leaflet-control-zoom a:hover { background:rgba(56,189,248,0.2)!important; }
          .cm-inc-pulse { animation: cmPulse 1.4s ease-in-out infinite; }
          @keyframes cmPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.6} }
        `;
        document.head.appendChild(s);
      }
    };

    if (window.L) { init(); return; }
    // Cargar Leaflet
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = init;
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => { if (window.L) { clearInterval(check); init(); } }, 100);
    }
    return () => { if (leafRef.current) { leafRef.current.remove(); leafRef.current = null; } };
  }, []);

  // Actualizar estilos cuando cambian incidentes
  useEffect(() => {
    if (!leafRef.current || !window.L) return;
    const L = window.L;

    KML_LINES.forEach(line => {
      const layer = layersRef.current[line.id];
      if (!layer) return;
      const hasInc = incGeoMap[line.id];
      layer.setStyle({
        color: hasInc ? hasInc.color : line.color,
        weight: hasInc ? line.weight + 3 : line.weight,
        opacity: hasInc ? 1 : 0.85,
        dashArray: hasInc ? "10,5" : null,
      });
    });

    KML_POINTS.forEach(pt => {
      const entry = layersRef.current[pt.id];
      if (!entry) return;
      const hasInc = incGeoMap[pt.id];
      const size   = hasInc ? 20 : 14;
      const color  = hasInc ? incGeoMap[pt.id].color : pt.color;
      const pulse  = hasInc ? 'cm-inc-pulse' : '';
      const icon = L.divIcon({
        html: `<div class="${pulse}" style="
          width:${size}px; height:${size}px;
          background:${color};
          border:2.5px solid rgba(255,255,255,0.9);
          border-radius:50%;
          box-shadow:0 0 ${hasInc?12:6}px ${color}aa;
        "></div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });
      entry.marker.setIcon(icon);
    });
  }, [JSON.stringify(incGeoMap)]);

  // ── Índice / leyenda ──────────────────────────────────────────────────────
  const LEGEND_ITEMS = [
    // Rutas
    { type: "line", color: "#fbc02d", label: "Segundo Acceso" },
    { type: "line", color: "#1976d2", label: "Vialidad Confinada" },
    // Accesos
    { type: "dot",  color: "#ffee58", label: "Acceso Zona Norte" },
    { type: "dot",  color: "#e806eb", label: "Acceso Pez Vela" },
    { type: "dot",  color: "#eb0671", label: "Acceso Puerta 15" },
    { type: "dot",  color: "#06eb7a", label: "Acceso Patios" },
    // Terminales
    { type: "dot",  color: "#f57c00", label: "Terminal Contecon" },
    { type: "dot",  color: "#424242", label: "Terminal Hazesa / OCUPA" },
    { type: "dot",  color: "#388e3c", label: "Terminal SSA" },
    { type: "dot",  color: "#5d4037", label: "La Junta (TAP)" },
    { type: "dot",  color: "#5c6bc0", label: "Terminal TIMSA" },
    { type: "dot",  color: "#7b1fa2", label: "Terminal MULTIMODAL" },
    { type: "dot",  color: "#ef5350", label: "Terminal FRIMAN" },
    { type: "dot",  color: "#4def05", label: "Terminal CEMEX" },
    { type: "dot",  color: "#e8ef05", label: "Recinto ASIPONA" },
    { type: "dot",  color: "#00796b", label: "Granelera" },
  ];

  return (
    <div>
      {/* Mapa */}
      <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 32px rgba(0,0,0,0.5)", marginBottom: "14px" }}>
        <div style={{ padding: "10px 14px", background: "rgba(4,12,24,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px" }}>🗺️</span>
          <span style={{ fontFamily: TITLE, fontSize: "14px", color: "rgba(255,255,255,0.9)" }}>Mapa del Puerto</span>
          <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>· tráfico en tiempo real</span>
          {activeIncidents.length > 0 && (
            <span style={{ marginLeft: "auto", background: "#ef444418", border: "1px solid #ef444455", borderRadius: "20px", padding: "2px 9px", fontSize: "11px", color: "#ef4444", fontFamily: MN, fontWeight: "700" }}>
              {activeIncidents.length} incidente{activeIncidents.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div ref={mapRef} style={{ width: "100%", height: "320px", background: "#040c18" }} />
      </div>

      {/* Índice */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "14px", padding: "14px" }}>
        <div style={{ fontFamily: TITLE, fontSize: "13px", color: "rgba(255,255,255,0.7)", letterSpacing: "1px", marginBottom: "12px" }}>ÍNDICE DEL MAPA</div>

        {/* Rutas */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: MN, letterSpacing: "1px", marginBottom: "7px" }}>RUTAS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {LEGEND_ITEMS.filter(i => i.type === "line").map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "22px", height: "4px", background: item.color, borderRadius: "2px", flexShrink: 0 }} />
              <span style={{ fontFamily: MN, fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Accesos */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: MN, letterSpacing: "1px", marginBottom: "7px" }}>ACCESOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {LEGEND_ITEMS.filter(i => i.type === "dot" && ["Acceso Zona Norte","Acceso Pez Vela","Acceso Puerta 15","Acceso Patios"].includes(i.label)).map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "12px", height: "12px", background: item.color, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: MN, fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Terminales */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: MN, letterSpacing: "1px", marginBottom: "7px" }}>TERMINALES</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {LEGEND_ITEMS.filter(i => i.type === "dot" && !["Acceso Zona Norte","Acceso Pez Vela","Acceso Puerta 15","Acceso Patios"].includes(i.label)).map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "12px", height: "12px", background: item.color, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: MN, fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: PATIO REGULADOR ─────────────────────────────────────────────────────
// ─── TAB: PATIO REGULADOR ─────────────────────────────────────────────────────
function PatioReguladorTab({ myId }) {
  const [patios,      setPatios]      = useState(mkPatios);
  const [toast,       setToast]       = useState(null);
  const [changeModal, setChangeModal] = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };
  const getOpt = (id) => PATIO_STATUS_OPTIONS.find(o => o.id === id) || PATIO_STATUS_OPTIONS[0];

  useEffect(() => {
    sb.from("patios").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("patios").upsert(PATIOS_REGULADORES.map(p => ({ id: p.id, status: "libre", last_update: Date.now(), updated_by: "Sistema", pending_voters: {} })));
        return;
      }
      const map = {};
      data.forEach(r => {
        map[r.id] = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
      });
      setPatios(prev => ({ ...prev, ...map }));
    });
    const chan = sb.channel("patios-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "patios" }, ({ new: r }) => {
        if (!r) return;
        setPatios(prev => ({ ...prev, [r.id]: { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} } }));
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  const vote = async (patioId, newStatus, forceChange = false) => {
    const rl = rateLimiter.check(`patio_vote_${myId}`, 30000);
    if (!rl.allowed && !forceChange) return notify(`Espera ${rl.remaining}s antes de votar de nuevo`, "#f97316");
    const { data: yaVoto } = await sb.from("votos").select("id").eq("user_id", myId).eq("patio_id", patioId).eq("tipo", "patio");
    if (yaVoto && yaVoto.length > 0 && !forceChange) {
      const label = PATIO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label || newStatus;
      setChangeModal({ type: "patio", id: patioId, newStatus, label });
      return;
    }
    if (yaVoto && yaVoto.length > 0 && forceChange) {
      await sb.from("votos").delete().eq("user_id", myId).eq("patio_id", patioId).eq("tipo", "patio");
    }
    const key = `patio_${patioId}_${newStatus}`;
    await sb.from("votos").insert({ key, user_id: myId, patio_id: patioId, status: newStatus, tipo: "patio" });
    // Persistir voto en localStorage para sobrevivir la limpieza de 15 min
    try { localStorage.setItem(`last_vote_patio_${patioId}_${myId}`, newStatus); } catch {}
    const { data: todosVotos } = await sb.from("votos").select("status").eq("patio_id", patioId).eq("tipo", "patio");
    const conteo = {};
    (todosVotos || []).forEach(v => { conteo[v.status] = (conteo[v.status] || 0) + 1; });
    const ganadora = Object.entries(conteo).sort((a,b) => b[1]-a[1])[0];
    const [statusGanador, votosGanador] = ganadora;
    await sb.from("patios").upsert({ id: patioId, status: statusGanador, pending_voters: conteo, last_update: Date.now(), updated_by: `${votosGanador} votos` });
    const label = PATIO_STATUS_OPTIONS.find(o => o.id === statusGanador)?.label;
    notify(`✅ ${label} lidera con ${votosGanador} voto(s)`, "#22c55e");
    const patioNombre = PATIOS_REGULADORES.find(p => p.id === patioId)?.name || patioId.toUpperCase();
    await publicarNoticia({ tipo: "patio", icono: "🏭", color: "#fb923c", titulo: `Patio ${patioNombre} — ${label}`, detalle: `Actualizado por consenso de ${votosGanador} voto(s)` });
  };

  const resetAll = async () => {
    await sb.from("patios").upsert(PATIOS_REGULADORES.map(p => ({ id: p.id, status: "libre", last_update: Date.now(), updated_by: "Reset", pending_voters: {} })));
    notify("✓ Todos los patios marcados como Libres", "#22c55e");
  };

  const resetOne = async (id) => {
    await sb.from("patios").upsert({ id, status: "libre", last_update: Date.now(), updated_by: "Reset", pending_voters: {} });
    notify("✓ Patio marcado como Libre", "#22c55e");
  };

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"15px", color:"#fb923c", fontFamily:MN, letterSpacing:"2px", marginBottom:"4px" }}>PATIO REGULADOR — PUERTO MANZANILLO</div>
        <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"15px" }}>Estatus en tiempo real de los 8 patios reguladores del puerto.</div>
      </div>
      <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
        {PATIO_STATUS_OPTIONS.map(o => (
          <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"4px", background:o.color+"15", border:`1px solid ${o.color}33`, padding:"3px 8px", borderRadius:"4px" }}>
            <span style={{ color:o.color, fontSize:"14px", fontWeight:"700" }}>{o.icon}</span>
            <span style={{ color:o.color, fontSize:"15px", fontFamily:MN }}>{o.label}</span>
          </div>
        ))}
      </div>
      <SectionLabel text="PATIOS REGULADORES" rightBtn={<NormalBtn onClick={resetAll} label="TODOS LIBRES" />} />
      {PATIOS_REGULADORES.map(patio => {
        const st  = patios[patio.id] || { status:"libre", lastUpdate: Date.now(), updatedBy:"Sistema", pendingVoters:{} };
        const opt = getOpt(st.status);
        const votes = st.pendingVoters || {};
        const totalVotes = Object.values(votes).reduce((a,b)=>a+b,0);
        return (
          <div key={patio.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${opt.color}44`, borderRadius:"12px", padding:"14px", marginBottom:"14px", boxShadow:`0 0 18px ${opt.color}08` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
              <div>
                <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:MN, fontWeight:"700", fontSize:"14px" }}>{patio.name}</div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"15px", marginTop:"2px" }}>{patio.fullName}</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"15px", fontFamily:MN, marginTop:"3px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
                <div style={{ background:opt.color+"22", border:`1px solid ${opt.color}66`, color:opt.color, padding:"5px 10px", borderRadius:"6px", fontFamily:MN, fontSize:"14px", fontWeight:"700", display:"flex", alignItems:"center", gap:"4px" }}>{opt.icon} {opt.label}</div>
                {totalVotes > 0 && <span style={{ fontSize:"15px", color:"rgba(255,255,255,0.4)", fontFamily:MN }}>{totalVotes} voto(s)</span>}
                {st.status !== "libre" && <button onClick={() => resetOne(patio.id)} style={{ padding:"4px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:MN, fontSize:"15px", cursor:"pointer", fontWeight:"700" }}>✓ TODO NORMAL</button>}
              </div>
            </div>
            <div style={{ fontSize:"15px", color:"rgba(255,255,255,0.5)", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>REPORTAR ESTATUS:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {PATIO_STATUS_OPTIONS.map(o => {
                const isAct = st.status === o.id;
                return (
                  <button key={o.id} onClick={() => vote(patio.id, o.id)} style={{ padding:"8px 6px", background: isAct ? o.color+"33" : "#0a1628", border:`1px solid ${isAct ? o.color : "#1e3a5f"}`, borderRadius:"8px", color: isAct ? o.color : "#64748b", fontFamily:MN, fontSize:"15px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px" }}>
                    {o.icon} {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <ToastBox toast={toast} />
      {changeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background:"#0f2037", border:"1px solid #1e3a5f", borderRadius:"14px", padding:"24px", maxWidth:"300px", width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:"28px", marginBottom:"10px" }}>🔄</div>
            <div style={{ color:"#e2e8f0", fontFamily:MN, fontSize:"14px", fontWeight:"700", marginBottom:"8px" }}>¿Cambiar tu voto?</div>
            <div style={{ color:"#94a3b8", fontFamily:MN, fontSize:"15px", marginBottom:"20px" }}>
              ¿Estás seguro que quieres cambiar tu voto a <span style={{ color:"#fb923c", fontWeight:"700" }}>{changeModal.label}</span>?
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setChangeModal(null)} style={{ flex:1, padding:"10px", background:"#1e3a5f", border:"1px solid #2d4a6f", borderRadius:"8px", color:"#94a3b8", fontFamily:MN, fontSize:"15px", cursor:"pointer", fontWeight:"700" }}>Cancelar</button>
              <button onClick={async () => { const m = changeModal; setChangeModal(null); await vote(m.id, m.newStatus, true); }} style={{ flex:1, padding:"10px", background:"#fb923c22", border:"1px solid #fb923c", borderRadius:"8px", color:"#fb923c", fontFamily:MN, fontSize:"15px", cursor:"pointer", fontWeight:"700" }}>Sí, cambiar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: TUTORIAL ────────────────────────────────────────────────────────────
function TutorialTab({ setActive }) {
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen(prev => prev === id ? null : id);

  const sections = [
    { id: "trafico", icon: "🗺️", color: "#38bdf8", title: "TRÁFICO", subtitle: "Mapa en vivo + Accesos + Incidentes", items: [
      { label: "Mapa en vivo", desc: "Muestra visualmente los accesos principales con su estatus actual, además de los pins de incidentes activos reportados por la comunidad." },
      { label: "Accesos Principales", desc: "Cada acceso muestra su estatus en tiempo real. Puedes votar el estado actual: Libre/Fluido, Tráfico Lento, Saturado o Cerrado." },
      { label: "Tipo de Retorno", desc: "Indica si hay retornos activos: Sin Retornos, Retorno Terminal o Retorno ASIPONA." },
      { label: "Incidentes Pendientes", desc: "Reportes que aún no tienen votos suficientes. Puedes confirmar o marcar como falso." },
      { label: "Incidentes Activos", desc: "Reportes verificados por la comunidad. Puedes votar para marcarlos como resueltos." },
    ]},
    { id: "reporte", icon: "📍", color: "#f97316", title: "REPORTAR", subtitle: "Envía un nuevo incidente al mapa", items: [
      { label: "Paso 1 · Categoría", desc: "Elige entre Incidente (problemas mecánicos, camiones varados) o Accidente (choques, heridos, zonas de riesgo)." },
      { label: "Paso 2 · Tipo específico", desc: "Selecciona el tipo exacto de la lista predefinida: falla mecánica, camión atravesado, choque, volcadura, zona de asalto, etc." },
      { label: "Paso 3 · Zona (opcional)", desc: "Indica en qué acceso o zona ocurrió el incidente para mayor contexto." },
      { label: "Paso 4 · Ubicación", desc: "Selecciona una ubicación predefinida del menú desplegable (carreteras, avenidas, calles, sitios de referencia) o escribe manualmente el punto exacto con detalle adicional como km, carril o referencia visual." },
      { label: "Enviar Reporte", desc: "Tu reporte aparece como PENDIENTE y necesita votos de la comunidad para ser visible en el mapa." },
    ]},
    { id: "terminales", icon: "⚓", color: "#a78bfa", title: "TERMINALES", subtitle: "Estatus de las 9 terminales del puerto", items: [
      { label: "Zona Norte", desc: "CONTECON y HAZESA. Cada terminal puede estar: Libre, Llena, Retorno Terminal o Retorno ASIPONA." },
      { label: "Zona Sur", desc: "TIMSA, SSA, OCUPA, MULTIMODAL, FRIMAN, LA JUNTA y CEMEX. Mismos estados que Zona Norte." },
      { label: "Actualizar estatus", desc: "Toca el estatus deseado. El sistema contabiliza los votos de la comunidad y muestra el que tenga más consenso." },
      { label: "Votos cada 15 minutos", desc: "Los votos se limpian automáticamente cada 15 minutos para mantener el estatus actualizado. Tu selección se guarda en tu dispositivo y se re-envía automáticamente — no necesitas volver a votar en cada ciclo." },
      { label: "TODO NORMAL", desc: "Restablece todas las terminales a Libre de una sola vez." },
    ]},
    { id: "segundo", icon: "🛣️", color: "#34d399", title: "2DO ACCESO", subtitle: "Carriles de ingreso con terminal asignada", items: [
      { label: "Accesos disponibles", desc: "Acceso Pez Vela (Zona Sur), Puerta 15 y Acceso Zona Norte." },
      { label: "Carriles de Ingreso", desc: "Cada carril tiene asignada una terminal de destino. Puedes cambiarla, indicar saturación o retornos." },
      { label: "Carril Salida", desc: "Exclusivo de salida. Solo muestra si está saturado o con retornos." },
    ]},
    { id: "carriles", icon: "🚦", color: "#eab308", title: "CARRILES", subtitle: "Carriles de Exportación e Importación", items: [
      { label: "Exportación 📤", desc: "Carriles para camiones que llevan carga al barco. Se marcan como ABIERTO o CERRADO." },
      { label: "Importación 📥", desc: "Carriles para retiro de mercancía del buque. Misma lógica que exportación." },
      { label: "TODO ABIERTO", desc: "Restablece todos los carriles del acceso seleccionado de una sola vez." },
    ]},
    { id: "vialidades", icon: "🛣️", color: "#38bdf8", title: "VIALIDADES", subtitle: "Estado del tráfico en vialidades principales", items: [
      { label: "¿Qué son las Vialidades?", desc: "Son las carreteras y calles principales de acceso a Manzanillo: Jalipa-Puerto, Puerto-Jalipa, Libramiento Cihuatlán-Manzanillo, Carretera Manzanillo-Colima, Carretera Colima-Manzanillo y Calle Algodones." },
      { label: "Estados disponibles", desc: "Libre (verde): tráfico fluido. Tráfico Lento (amarillo): demoras moderadas. Saturado (naranja): alta congestión. Tráfico Detenido (rojo): sin avance." },
      { label: "Cómo votar", desc: "Toca el estado que observas en la vialidad. El sistema muestra el estatus con mayor consenso entre todos los votos." },
      { label: "Renovación cada 15 min", desc: "Los votos se limpian automáticamente para mantener la información actualizada. Tu voto se guarda y se reenvía sin que tengas que votar de nuevo." },
    ]},
    { id: "patio", icon: "🏭", color: "#fb923c", title: "PATIO REGULADOR", subtitle: "Estatus de los 8 patios del puerto", items: [
      { label: "¿Qué es el Patio Regulador?", desc: "Son las áreas de espera y almacenaje externas al puerto donde los camiones aguardan instrucciones antes de ingresar a una terminal. Hay 8 patios: CIMA 1, CIMA 2, ISL, ALMAN, SIA, TIMSA, ALMACONT y SSA." },
      { label: "Estados posibles", desc: "Patio Libre (verde): hay espacio disponible. Saturado (rojo): sin espacio, alta demanda. Cerrado (gris): patio fuera de servicio. Patio Lleno (naranja): capacidad máxima alcanzada." },
      { label: "Cómo votar", desc: "Toca el estado que observas en el patio. El sistema contabiliza todos los votos y muestra el estatus con más consenso." },
      { label: "TODO NORMAL", desc: "El botón 'TODOS LIBRES' restablece todos los patios de una sola vez, útil al inicio del turno." },
    ]},
    { id: "donativos", icon: "💙", color: "#ec4899", title: "DONATIVOS", subtitle: "Apoya el proyecto de la comunidad", items: [
      { label: "¿Para qué sirven?", desc: "Cubren costos de servidor, desarrollo y mejoras continuas para que la app siga funcionando." },
      { label: "Cómo donar", desc: "Realiza una transferencia SPEI al banco MIFEL usando la CLABE que aparece en la sección." },
    ]},
  ];

  return (
    <div style={{ padding:"20px 16px", paddingBottom:"80px" }}>
      <div style={{ textAlign:"center", marginBottom:"24px" }}>
        <div style={{ fontSize:"36px", marginBottom:"10px" }}>📖</div>
        <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"14px", letterSpacing:"2px", color:"rgba(255,255,255,0.95)", marginBottom:"6px" }}>GUÍA DE USO</div>
        <div style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px" }}>PUERTO TRÁFICO · MANZANILLO</div>
        <div style={{ width:"40px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"12px auto 0" }} />
      </div>
      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom:"10px" }}>
          <button onClick={() => toggle(sec.id)} style={{ width:"100%", background: open===sec.id ? sec.color+"22" : "#0d1b2e", border:`1px solid ${open===sec.id ? sec.color+"88" : "#1e3a5f"}`, borderRadius: open===sec.id ? "12px 12px 0 0" : "12px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"10px", cursor:"pointer", transition:"all 0.2s", textAlign:"left" }}>
            <span style={{ fontSize:"20px" }}>{sec.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"15px", color: open===sec.id ? sec.color : "#e2e8f0", letterSpacing:"1px" }}>{sec.title}</div>
              <div style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.4)", marginTop:"2px" }}>{sec.subtitle}</div>
            </div>
            <span style={{ color: open===sec.id ? sec.color : "#334155", fontSize:"14px", transition:"transform 0.2s", transform: open===sec.id ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </button>
          {open === sec.id && (
            <div style={{ background:"#060e1a", border:`1px solid ${sec.color}44`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
              {sec.items.map((item, i) => (
                <div key={i} style={{ marginBottom: i < sec.items.length-1 ? "14px" : "0", paddingBottom: i < sec.items.length-1 ? "14px" : "0", borderBottom: i < sec.items.length-1 ? "1px solid #0d1b2e" : "none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                    <div style={{ width:"5px", height:"5px", background:sec.color, borderRadius:"50%", flexShrink:0 }} />
                    <span style={{ fontFamily:MN, fontWeight:"700", fontSize:"14px", color:sec.color }}>{item.label}</span>
                  </div>
                  <p style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.5)", lineHeight:"1.8", paddingLeft:"11px" }}>{item.desc}</p>
                </div>
              ))}
              <button onClick={() => setActive(sec.id)} style={{ width:"100%", marginTop:"14px", padding:"10px", background:`${sec.color}22`, border:`1px solid ${sec.color}55`, borderRadius:"8px", color:sec.color, fontFamily:MN, fontSize:"15px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px" }}>IR A {sec.title} →</button>
            </div>
          )}
        </div>
      ))}
      <div style={{ textAlign:"center", marginTop:"24px", padding:"14px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ fontSize:"20px", marginBottom:"6px" }}>⚓</div>
        <div style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.3)", lineHeight:"1.8" }}>Puerto Tráfico es una herramienta colaborativa.<br/><span style={{ color:"#38bdf8" }}>Tu información hace la diferencia.</span></div>
      </div>
    </div>
  );
}

// ─── TAB: REDES SOCIALES ──────────────────────────────────────────────────────
function InicioTab() {
  const [showQR, setShowQR] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  // Auto-toggle QR: show for 5 seconds, hide for 3, repeat
  useEffect(() => {
    let showTimer, hideTimer;
    function cycle() {
      setQrVisible(true);
      showTimer = setTimeout(() => {
        setQrVisible(false);
        hideTimer = setTimeout(cycle, 3000);
      }, 5000);
    }
    cycle();
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  const WA_CHANNEL = "https://whatsapp.com/channel/0029VbBN73rId7nJ3RTSsq3s";
  const FB_GROUP   = "https://www.facebook.com/groups/conectmanzanillo/";
  const FB_PAGE    = "https://www.facebook.com/conectmanzanillooficial";
  const IG_PAGE    = "https://www.instagram.com/conectmanzanillo";

  // WhatsApp SVG icon
  const IconWA = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#25D366"/>
      <path d="M22.7 9.3A9.5 9.5 0 0 0 7.1 21.7L6 26l4.4-1.2a9.5 9.5 0 0 0 12.3-14.5zm-6.7 14.6a7.9 7.9 0 0 1-4-1.1l-.3-.2-2.6.7.7-2.5-.2-.3a7.9 7.9 0 1 1 6.4 3.4zm4.3-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.2.2-.4 0-.1 0-.3-.1-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.1 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c.6.3 1.1.4 1.5.3a2.6 2.6 0 0 0 1.7-1.2c.2-.4.2-.8 0-.9z" fill="white"/>
    </svg>
  );

  // Facebook SVG icon
  const IconFB = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#1877F2"/>
      <path d="M21 16h-3v10h-4V16h-2v-4h2v-2.3C14 7.6 15.3 6 18.1 6H21v4h-1.8c-.8 0-1.2.4-1.2 1.2V12H21l-.5 4z" fill="white"/>
    </svg>
  );

  return (
    <div style={{ padding: "20px 16px", paddingBottom: "100px" }}>

      {/* ─── SPEECH ──────────────────────────────────────────────────────────── */}
      <div style={{
        marginBottom: "28px",
        background: "linear-gradient(135deg, rgba(56,189,248,0.07) 0%, rgba(167,139,250,0.07) 100%)",
        border: "1px solid rgba(56,189,248,0.2)",
        borderRadius: "16px",
        padding: "22px 18px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position:"absolute", top:"-30px", right:"-30px", width:"110px", height:"110px", background:"radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"-20px", left:"-20px", width:"90px", height:"90px", background:"radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)", pointerEvents:"none" }} />

        {/* Logo / título app */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"18px" }}>
          <div style={{ width:"46px", height:"46px", background:"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(167,139,250,0.2))", border:"1px solid rgba(56,189,248,0.35)", borderRadius:"12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", flexShrink:0 }}>⚓</div>
          <div>
            <div style={{ fontFamily:TITLE, fontWeight:"900", fontSize:"16px", color:"#ffffff", letterSpacing:"0.5px" }}>Conect Manzanillo</div>
            <div style={{ fontFamily:MN, fontSize:"15px", color:"rgba(56,189,248,0.8)", fontWeight:"600", letterSpacing:"1.5px", marginTop:"3px" }}>COMUNIDAD EN VIVO · PUERTO</div>
          </div>
        </div>

        <p style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.78)", lineHeight:"1.8", margin:"0 0 16px 0" }}>
          Esta aplicación nació para que <span style={{ color:"#38bdf8", fontWeight:"700" }}>operadores, transportistas y cualquier persona en el puerto</span> puedan compartir en tiempo real el estado de las operaciones. La información que ves la genera <span style={{ color:"#a78bfa", fontWeight:"700" }}>la propia comunidad</span> — no un sistema centralizado.
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:"9px", marginBottom:"18px" }}>
          {[
            { icon:"📡", color:"#38bdf8", text:"Reporta lo que ves en ruta: un acceso saturado, un retorno activo, un camión varado. Tu reporte llega al instante a todos los usuarios." },
            { icon:"🗳️", color:"#a78bfa", text:"Cualquier usuario puede votar. Con 15 confirmaciones, un reporte se valida y se vuelve visible como incidente activo en el mapa." },
            { icon:"🏁", color:"#22c55e", text:"Cuando la situación se resuelve, la comunidad lo cierra. Así el mapa siempre refleja la realidad del momento." },
          ].map((item, i) => (
            <div key={i} style={{ display:"flex", gap:"10px", alignItems:"flex-start", background:"rgba(255,255,255,0.04)", border:`1px solid ${item.color}22`, borderRadius:"10px", padding:"10px 12px" }}>
              <span style={{ fontSize:"16px", flexShrink:0, marginTop:"1px" }}>{item.icon}</span>
              <span style={{ fontFamily:MN, fontSize:"14px", color:"rgba(255,255,255,0.7)", lineHeight:"1.6" }}>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:"14px", display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"3px", height:"38px", background:"linear-gradient(to bottom, #38bdf8, #a78bfa)", borderRadius:"2px", flexShrink:0 }} />
          <p style={{ fontFamily:MN, fontSize:"14px", color:"rgba(255,255,255,0.5)", lineHeight:"1.7", margin:0, fontStyle:"italic" }}>
            "La operación del puerto nos afecta a todos. Compartir lo que sabes es ayudar a quien viene detrás. <span style={{ color:"rgba(56,189,248,0.85)", fontStyle:"normal", fontWeight:"600" }}>Juntos hacemos la diferencia.</span>"
          </p>
        </div>
      </div>

      {/* ─── REDES SOCIALES ──────────────────────────────────────────────────── */}
      <div style={{ fontFamily:MN, fontSize:"15px", color:"rgba(255,255,255,0.4)", letterSpacing:"2px", fontWeight:"600", marginBottom:"14px", paddingLeft:"2px" }}>SÍGUENOS · COMUNIDAD</div>

      {/* ── WhatsApp Channel ─────────────────────────────────── */}
      <div style={{ marginBottom: "14px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "16px", overflow: "hidden" }}>
        {/* Badge */}
        <div style={{ background: "rgba(37,211,102,0.15)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(37,211,102,0.15)" }}>
          <div style={{ width: "8px", height: "8px", background: "#25D366", borderRadius: "50%", boxShadow: "0 0 8px #25D366", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: MN, fontSize: "10px", fontWeight: "700", color: "#25D366", letterSpacing: "1.5px" }}>CANAL DE NOTICIAS · WHATSAPP</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <IconWA size={42} />
            <div>
              <div style={{ fontFamily: MN, fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Únete al Canal de Noticias</div>
              <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Recibe las últimas noticias del puerto directamente en WhatsApp</div>
            </div>
          </div>

          {/* QR auto-toggle */}
          <div style={{
            overflow: "hidden",
            maxHeight: qrVisible ? "200px" : "0px",
            transition: "max-height 0.7s ease",
            marginBottom: qrVisible ? "12px" : "0",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px", background: "rgba(255,255,255,0.95)", borderRadius: "12px" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(WA_CHANNEL)}&color=075E54&bgcolor=ffffff`}
                alt="QR Canal WhatsApp"
                style={{ width: "140px", height: "140px", borderRadius: "8px" }}
              />
              <div style={{ fontFamily: MN, fontSize: "9px", color: "#075E54", marginTop: "8px", fontWeight: "700", letterSpacing: "1px" }}>ESCANEA PARA UNIRTE</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <a href={WA_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
              <button style={{
                width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#25D366,#128C7E)",
                border: "none", borderRadius: "12px", color: "#ffffff",
                fontFamily: MN, fontSize: "12px", fontWeight: "700", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: "0 4px 20px rgba(37,211,102,0.4)", letterSpacing: "0.5px",
              }}>
                <IconWA size={18} />
                UNIRME AL CANAL
              </button>
            </a>
            <button
              onClick={() => setQrVisible(v => !v)}
              style={{
                padding: "13px 14px", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.4)",
                borderRadius: "12px", color: "#25D366", cursor: "pointer", fontFamily: MN, fontSize: "18px",
              }}
              title="Ver QR"
            >
              {qrVisible ? "✕" : "⊞"}
            </button>
          </div>
          <div style={{ fontFamily: MN, fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "8px" }}>
            El QR se muestra automáticamente · también puedes escanearlo aquí
          </div>
        </div>
      </div>

      {/* ── Facebook Group ───────────────────────────────────── */}
      <div style={{ marginBottom: "14px", background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.3)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(24,119,242,0.15)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(24,119,242,0.15)" }}>
          <span style={{ fontSize: "14px" }}>👥</span>
          <span style={{ fontFamily: MN, fontSize: "10px", fontWeight: "700", color: "#60a5fa", letterSpacing: "1.5px" }}>GRUPO COMUNITARIO · FACEBOOK</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <IconFB size={42} />
            <div>
              <div style={{ fontFamily: MN, fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Grupo Conect Manzanillo</div>
              <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Comunidad de transportistas, empresas y ciudadanos del puerto</div>
            </div>
          </div>

          <a href={FB_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#1877F2,#0a5dc7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: MN, fontSize: "12px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 20px rgba(24,119,242,0.4)", letterSpacing: "0.5px",
            }}>
              <IconFB size={18} />
              UNIRME AL GRUPO
            </button>
          </a>
        </div>
      </div>

      {/* ── Facebook Page ────────────────────────────────────── */}
      <div style={{ marginBottom: "14px", background: "rgba(24,119,242,0.05)", border: "1px solid rgba(24,119,242,0.25)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(24,119,242,0.12)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(24,119,242,0.12)" }}>
          <span style={{ fontSize: "14px" }}>📣</span>
          <span style={{ fontFamily: MN, fontSize: "10px", fontWeight: "700", color: "#93c5fd", letterSpacing: "1.5px" }}>PÁGINA OFICIAL · FACEBOOK</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <IconFB size={42} />
            <div>
              <div style={{ fontFamily: MN, fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Conect Manzanillo Oficial</div>
              <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Síguenos para noticias, actualizaciones y avisos oficiales del puerto</div>
            </div>
          </div>

          <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#1877F2,#0a5dc7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: MN, fontSize: "12px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 20px rgba(24,119,242,0.35)", letterSpacing: "0.5px",
            }}>
              <IconFB size={18} />
              SEGUIR PÁGINA
            </button>
          </a>
        </div>
      </div>

      {/* ── Instagram ──────────────────────────────────────── */}
      <div style={{ marginBottom: "14px", background: "rgba(225,48,108,0.06)", border: "1px solid rgba(225,48,108,0.28)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(225,48,108,0.13)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(225,48,108,0.13)" }}>
          <span style={{ fontSize: "14px" }}>📸</span>
          <span style={{ fontFamily: MN, fontSize: "10px", fontWeight: "700", color: "#f472b6", letterSpacing: "1.5px" }}>PERFIL OFICIAL · INSTAGRAM</span>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <defs>
                <radialGradient id="ig_grad" cx="30%" cy="107%" r="150%">
                  <stop offset="0%" stopColor="#fdf497"/>
                  <stop offset="10%" stopColor="#fdf497"/>
                  <stop offset="50%" stopColor="#fd5949"/>
                  <stop offset="68%" stopColor="#d6249f"/>
                  <stop offset="100%" stopColor="#285AEB"/>
                </radialGradient>
              </defs>
              <rect width="42" height="42" rx="12" fill="url(#ig_grad)"/>
              <rect x="11" y="11" width="20" height="20" rx="5.5" stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="21" cy="21" r="5" stroke="white" strokeWidth="2" fill="none"/>
              <circle cx="27.5" cy="14.5" r="1.5" fill="white"/>
            </svg>
            <div>
              <div style={{ fontFamily: MN, fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>@conectmanzanillo</div>
              <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Fotos, videos y noticias del puerto en Instagram</div>
            </div>
          </div>
          <a href={IG_PAGE} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px",
              background: "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: MN, fontSize: "12px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 20px rgba(225,48,108,0.4)", letterSpacing: "0.5px",
            }}>
              <svg width="18" height="18" viewBox="0 0 42 42" fill="none">
                <rect x="11" y="11" width="20" height="20" rx="5.5" stroke="white" strokeWidth="2.5" fill="none"/>
                <circle cx="21" cy="21" r="5" stroke="white" strokeWidth="2.5" fill="none"/>
                <circle cx="27.5" cy="14.5" r="1.5" fill="white"/>
              </svg>
              SEGUIR EN INSTAGRAM
            </button>
          </a>
        </div>
      </div>

      {/* Footer info */}
      <div style={{ textAlign: "center", marginTop: "24px", padding: "16px", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: "20px", marginBottom: "8px" }}>⚓</div>
        <div style={{ fontFamily: MN, fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: "1.9" }}>
          Únete a la comunidad de Conect Manzanillo<br/>
          <span style={{ color: "#25D366" }}>WhatsApp</span> · <span style={{ color: "#1877F2" }}>Facebook</span> · <span style={{ color: "#f472b6" }}>Instagram</span> · información en tiempo real
        </div>
      </div>
    </div>
  );
}

// ─── COOKIE BANNER ────────────────────────────────────────────────────────────
// ✅ FIX: Botones con estilos completos y handlers correctos
function CookieBanner({ onAccept, onReject }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(10,15,30,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      borderTop: "1px solid rgba(255,255,255,0.15)", padding: "16px 20px",
    }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
          <span style={{ fontSize: "22px" }}>🍪</span>
          <div>
            <div style={{ fontFamily: TITLE, color: "#fff", fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>Cookies y privacidad</div>
            <div style={{ fontFamily: MN, color: "rgba(255,255,255,0.6)", fontSize: "11px", lineHeight: "1.6" }}>
              Conect Manzanillo usa <strong style={{ color: "rgba(255,255,255,0.85)" }}>cookies esenciales</strong> para recordar tu ID de dispositivo y preferencias de votación. No compartimos datos con terceros ni mostramos publicidad. Tu participación es anónima.
            </div>
          </div>
        </div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: MN, marginBottom: "12px", paddingLeft: "34px" }}>
          Al continuar aceptas nuestra política de privacidad · Datos procesados en servidores de Supabase (UE/EUA)
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onReject}
            style={{
              padding: "10px 18px", background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px",
              color: "rgba(255,255,255,0.7)", fontFamily: MN, fontSize: "12px",
              fontWeight: "600", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            Solo esenciales
          </button>
          <button
            onClick={onAccept}
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #0369a1, #0ea5e9)",
              border: "none", borderRadius: "8px",
              color: "#fff", fontFamily: MN, fontSize: "12px",
              fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
              letterSpacing: "0.5px",
            }}
          >
            ✓ Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── APP (RAÍZ) ───────────────────────────────────────────────────────────────
// ✅ FIX PRINCIPAL: hooks declarados DENTRO del cuerpo de la función, no en los parámetros


function App() {
  const [active,    setActiveRaw]  = useState(() => {
    try { return localStorage.getItem("puerto_active_tab") || "inicio"; } catch { return "inicio"; }
  });
  const setActive = (tab) => {
    try { localStorage.setItem("puerto_active_tab", tab); } catch {}
    setActiveRaw(tab);
  };
  const [consent,   setConsent]   = useState(getCookieConsent); // null, "accepted", o "essential"
  const [incidents, setIncidents] = useState([]);
  const [dbReady,   setDbReady]   = useState(false);
  const [visitas,   setVisitas]   = useState(null);

  // Contador de visitas unicas (una por dispositivo)
  useEffect(() => {
    const TABLA_V = "visitas";
    const registrar = async () => {
      try {
        const uid_local = (() => { try { return localStorage.getItem("puerto_trafico_uid"); } catch { return null; } })();
        if (uid_local) {
          await sb.from(TABLA_V).upsert({ id: uid_local, last_seen: new Date().toISOString() }, { onConflict: "id" });
        }
        const { count } = await sb.from(TABLA_V).select("id", { count: "exact", head: true });
        setVisitas(count || 0);
      } catch { setVisitas(null); }
    };
    registrar();
    const chan = sb.channel("visitas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLA_V }, async () => {
        const { count } = await sb.from(TABLA_V).select("id", { count: "exact", head: true });
        setVisitas(count || 0);
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  // ID permanente por dispositivo
  const [myId] = useState(() => {
    try {
      const stored = localStorage.getItem("puerto_trafico_uid");
      if (stored) return stored;
      const newId = uid();
      localStorage.setItem("puerto_trafico_uid", newId);
      return newId;
    } catch {
      return uid(); // fallback si localStorage no está disponible
    }
  });

  // ✅ FIX: handlers correctamente definidos dentro del componente
  const handleAccept = () => {
    saveCookieConsent("accepted");
    setConsent("accepted");
  };

  const handleReject = () => {
    saveCookieConsent("essential");
    setConsent("essential");
  };

  // Limpiar votos expirados cada minuto y re-insertar votos del usuario para no perder su selección
  useEffect(() => {
    const limpiar = async () => {
      const expiry = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await sb.from("votos").delete().lt("created_at", expiry);
      // Reenviar votos guardados del usuario para que su selección persista
      try {
        const reinserts = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith("last_vote_")) continue;
          const parts = k.replace("last_vote_", "").split("_");
          // formato: last_vote_terminal_{termId}_{myId} o last_vote_patio_{patioId}_{myId}
          const tipo = parts[0];
          const userId = parts[parts.length - 1];
          if (userId !== myId) continue;
          const entityId = parts.slice(1, -1).join("_");
          const status = localStorage.getItem(k);
          if (!status) continue;
          const key = `${tipo}_${entityId}_${status}`;
          const col = tipo === "terminal" ? "terminal_id" : "patio_id";
          reinserts.push(sb.from("votos").insert({ key, user_id: userId, [col]: entityId, status, tipo }).then(() => {}).catch(() => {}));
        }
        await Promise.all(reinserts);
      } catch {}
    };
    limpiar();
    const interval = setInterval(limpiar, 60000);
    return () => clearInterval(interval);
  }, [myId]);

  // Cargar incidentes
  useEffect(() => {
    sb.from("incidents").select("*").order("ts", { ascending: false }).then(({ data }) => {
      if (data) setIncidents(data.map(r => ({
        id: r.id, type: r.type, location: r.location,
        desc: r.description, votes: r.votes || {},
        resolveVotes: r.resolve_votes || {},
        visible: r.visible, resolved: r.resolved, ts: r.ts,
      })));
      setDbReady(true);
    });

    const chan = sb.channel("incidents-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        sb.from("incidents").select("*").order("ts", { ascending: false }).then(({ data }) => {
          if (data) setIncidents(data.map(r => ({
            id: r.id, type: r.type, location: r.location,
            desc: r.description, votes: r.votes || {},
            resolveVotes: r.resolve_votes || {},
            visible: r.visible, resolved: r.resolved, ts: r.ts,
          })));
        });
      }).subscribe();

    return () => sb.removeChannel(chan);
  }, []);

  return (
    <div style={{ minHeight:"100vh", color:"rgba(255,255,255,0.95)", width:"100vw", maxWidth:"100vw", overflowX:"hidden", position:"relative", background:"#060e1a" }}>
      {/* Fondo */}
      <div style={{ position:"fixed", inset:0, zIndex:0, background:"#060e1a", backgroundImage:"radial-gradient(ellipse at 20% 50%, #0a1628 0%, #060e1a 60%, #030810 100%)", backgroundSize:"cover", backgroundPosition:"center top", filter:"brightness(0.28) saturate(1.1)" }} />
      <div style={{ position:"fixed", inset:0, zIndex:1, background:"linear-gradient(180deg,rgba(5,15,40,0.6) 0%,rgba(3,10,25,0.5) 100%)" }} />

      <div style={{ position:"relative", zIndex:2 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
          *{box-sizing:border-box;margin:0;padding:0;}
          ::-webkit-scrollbar{width:4px;}
          ::-webkit-scrollbar-track{background:#060e1a;}
          ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:2px;}
          button:active{transform:scale(0.97);}
          input::placeholder,textarea::placeholder{color:#334155;}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        `}</style>

        {/* Header */}
        <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", gap:"12px" }}>
          <img src="/logo.png" alt="Conect Manzanillo" style={{ width:"48px", height:"48px", objectFit:"contain", flexShrink:0 }} />
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:"700", fontSize:"17px", letterSpacing:"0.5px", color:"#ffffff" }}>Conect Manzanillo</div>
            <div style={{ fontSize:"15px", color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif", letterSpacing:"1px", fontWeight:"300" }}>COMUNIDAD EN VIVO · PUERTO</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"7px", height:"7px", background:"#4ade80", borderRadius:"50%", boxShadow:"0 0 8px #4ade80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:"15px", color:"#4ade80", fontFamily:"'DM Sans',sans-serif", fontWeight:"600" }}>EN VIVO</span>
            </div>
            {visitas !== null && (
              <div style={{ display:"flex", alignItems:"center", gap:"4px", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)", borderRadius:"6px", padding:"2px 7px" }}>
                <span style={{ fontSize:"15px" }}>👁</span>
                <span style={{ fontSize:"15px", color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>{visitas.toLocaleString()}</span>
                <span style={{ fontSize:"15px", color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans',sans-serif" }}>visitas</span>
              </div>
            )}
          </div>
        </div>

        <NavBar active={active} set={setActive} />

        {active === "inicio"      && <InicioTab />}
        {active === "trafico"    && <TraficoTab    myId={myId} incidents={incidents} setIncidents={setIncidents} />}
        {active === "reporte"    && <ReporteTab    myId={myId} incidents={incidents} setIncidents={setIncidents} setActiveTab={setActive} />}
        {active === "terminales" && <TerminalesTab myId={myId} />}
        {active === "patio"      && <PatioReguladorTab myId={myId} />}
        {active === "segundo"    && <SegundoAccesoTab />}
        {active === "carriles"   && <CarrilesTab />}
        {active === "noticias"   && <NoticiasTab />}
        {active === "donativos"  && <DonativosTab />}
        {active === "tutorial"   && <TutorialTab setActive={setActive} />}

        {/* ✅ FIX: Banner solo aparece cuando consent es null (no ha decidido aún) */}
        {consent === null && (
          <CookieBanner onAccept={handleAccept} onReject={handleReject} />
        )}

        <DonateBanner active={active} />
      </div>
    </div>
  );
}

export default App;
