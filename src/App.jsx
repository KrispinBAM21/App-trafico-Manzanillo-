import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// --- SEGURIDAD ---
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

const COOKIE_KEY   = "cookie_consent";
// SHA-256 de "manzanillo2025" — nunca se guarda la contraseña en texto plano
const ADMIN_HASH = "9e636b8a72a24549a73f14da8314253272794e90aa8c9b962fdba885116ac8ae";
const verifyAdminPass = async (input) => {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === ADMIN_HASH;
};
const ADMIN_KEY    = "cm_admin_session";
const getCookieConsent = () => {
  try { return localStorage.getItem(COOKIE_KEY); } catch { return null; }
};
const saveCookieConsent = (val) => {
  try { localStorage.setItem(COOKIE_KEY, val); } catch {}
};

// --- FIX: Aplicar fondo INMEDIATAMENTE antes del primer render de React ---
// Evita el flash blanco/gris que aparece unos frames antes de que React monte
(function applyDefaultBackground() {
  const bg = "linear-gradient(135deg, #0a1628 0%, #1a2942 100%)";
  document.documentElement.style.cssText += "background:" + bg + ";margin:0;padding:0;";
  document.body.style.cssText += "background:" + bg + ";margin:0;padding:0;";
})();

// Inject Google Fonts - ahora incluye más opciones para personalización
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=Roboto:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Open+Sans:wght@300;400;700&family=Lato:wght@300;400;700&family=Poppins:wght@300;400;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// --- SUPABASE ---
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://wnchrhglwsrzrcrhhukg.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY2hyaGdsd3NyenJjcmhodWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyMzI0NzksImV4cCI6MjA1MjgwODQ3OX0.4EUDMOIKFUOa7pQZU8KBp_bC8xt--u10iQO5Ru4pC5Y";
const sb = createClient(SUPA_URL, SUPA_KEY);

// --- CONSTANTS ---
// ❌ DEPRECATED - Usar getFont(theme, "secondary") en su lugar
// const MN    = "'DM Sans', sans-serif";

// Parseo robusto de fechas: acepta ms numérico, string numérico o ISO string
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  if (!isNaN(n) && n > 1e12) return n;   // string "1741826400000"
  return new Date(v).getTime();           // ISO string "2026-03-12T..."
};
// ❌ DEPRECATED - Usar getFont(theme, "title") en su lugar
// const TITLE = "'Playfair Display', serif";

const TABS = [
  { key: "inicio",      label: "Inicio",      icon: "🏠" },
  { key: "trafico",     label: "Tráfico",     icon: "🚗" },
  { key: "reporte",     label: "Reportar",    icon: "📢" },
  { key: "terminales",  label: "Terminales",  icon: "🏭" },
  { key: "patio",       label: "Patios",      icon: "📦" },
  { key: "segundo",     label: "2° Acceso",   icon: "🛣️" },
  { key: "carriles",    label: "Carriles",    icon: "🚦" },
  { key: "noticias",    label: "Noticias",    icon: "📰" },
  { key: "donativos",   label: "Donativos",   icon: "💝" },
  { key: "tutorial",    label: "Tutorial",    icon: "🎓" }
];

// ---
// CONFIGURACIÓN DE TEMA POR DEFECTO
// ---
const DEFAULT_THEME = {
  // Fondo
  backgroundType: "gradient", // "color" | "gradient" | "image"
  backgroundColor: "#0a1628",
  backgroundGradient: "linear-gradient(135deg, #0a1628 0%, #1a2942 100%)",
  backgroundImage: "",
  backgroundImageOverlayOpacity: 0.65, // ✨ NUEVO: Opacidad de la capa oscura sobre imagen de fondo (0-1)
  
  // Tipografía
  primaryFont: "'Playfair Display', serif",
  secondaryFont: "'DM Sans', sans-serif",
  baseFontSize: 14,
  titleFontSize: 17,
  
  // ✨ Colores de texto
  textColors: {
    primary: "#ffffff",        // Color principal del texto
    secondary: "#e2e8f0",      // Color de texto secundario
    muted: "#94a3b8",          // Color de texto atenuado/hints
    accent: "#38bdf8"          // Color de acentos/links
  },
  
  // ✨ NUEVO: Configuración de ventanas de contenido
  contentBox: {
    enabled: true,
    background: "rgba(255, 255, 255, 0.05)",
    backdropBlur: 12,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gradientOverlay: {
      enabled: true,
      gradient: "linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)"
    },
    shadow: {
      enabled: true,
      color: "rgba(0, 0, 0, 0.3)",
      blur: 20,
      offsetX: 0,
      offsetY: 4
    }
  },
  
  // Iconos de tabs
  tabIcons: {
    inicio: { type: "emoji", value: "🏠", size: 20 },
    trafico: { type: "emoji", value: "🚗", size: 20 },
    reporte: { type: "emoji", value: "📢", size: 20 },
    terminales: { type: "emoji", value: "🏭", size: 20 },
    patio: { type: "emoji", value: "📦", size: 20 },
    segundo: { type: "emoji", value: "🛣️", size: 20 },
    carriles: { type: "emoji", value: "🚦", size: 20 },
    noticias: { type: "emoji", value: "📰", size: 20 },
    donativos: { type: "emoji", value: "💝", size: 20 },
    tutorial: { type: "emoji", value: "🎓", size: 20 }
  },
  
  // Otros iconos
  otherIcons: {
    live: { type: "emoji", value: "👁", size: 14 },
    admin: { type: "emoji", value: "🔑", size: 11 },
    session: { type: "emoji", value: "👤", size: 11 },
    logout: { type: "emoji", value: "🚪", size: 14 }
  }
};

// ✨✨✨ CONTEXTO DE TEMA PARA COMPARTIR GLOBALMENTE ✨✨✨
// ✅ FIX CRÍTICO: Inicializar con DEFAULT_THEME en lugar de undefined
const ThemeContext = React.createContext(DEFAULT_THEME);


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
  { id: "granelera",  name: "GRANELERA",  fullName: "Granelera" },
  { id: "asipona",    name: "ASIPONA",    fullName: "Recinto ASIPONA" },
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
  { id: "antonio_suarez",   name: "Antonio Suárez",               fullName: "Calle Antonio Suárez" },
  { id: "av_trabajo",       name: "Av. del Trabajo",              fullName: "Avenida del Trabajo" },
];

const VIALIDAD_STATUS_OPTIONS = [
  { id: "libre",    label: "Libre",             color: "#22c55e", icon: "✓" },
  { id: "lento",    label: "Tráfico Lento",     color: "#eab308", icon: "⚠" },
  { id: "saturado", label: "Saturado",           color: "#f97316", icon: "🔶" },
  { id: "detenido", label: "Tráfico Detenido",   color: "#ef4444", icon: "✗" },
];

const ACCESOS_PRINCIPALES = [
  { id: "pezvela",   label: "Acceso Pez Vela",  color: "#a78bfa", zona: "Zona Sur"   },
  { id: "puerta15",  label: "Acceso Puerta 15", color: "#34d399", zona: "Zona Sur"   },
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
  { id: "general",    name: "GENERAL",    zona: "Todas" }, // ✨ NUEVO - Opción General
  { id: "contecon",   name: "CONTECON",   zona: "Norte" },
  { id: "hazesa",     name: "HAZESA",     zona: "Norte" },
  { id: "timsa",      name: "TIMSA",      zona: "Sur"   },
  { id: "ssa",        name: "SSA",        zona: "Sur"   },
  { id: "ocupa",      name: "OCUPA",      zona: "Sur"   },
  { id: "multimodal", name: "MULTIMODAL", zona: "Sur"   },
  { id: "friman",     name: "FRIMAN",     zona: "Sur"   },
  { id: "lajunta",    name: "LA JUNTA",   zona: "Sur"   },
  { id: "cemex",      name: "CEMEX",      zona: "Sur"   },
  { id: "granelera",  name: "GRANELERA",  zona: "Sur"   },
  { id: "asipona",    name: "ASIPONA",    zona: "Sur"   },
];

const PATIOS_REGULADORES = [
  { id: "cima1",     name: "CIMA 1",    fullName: "Patio Regulador CIMA 1"    },
  { id: "cima2",     name: "CIMA 2",    fullName: "Patio Regulador CIMA 2"    },
  { id: "isl",       name: "ISL",       fullName: "Patio Regulador ISL"       },
  { id: "alman",     name: "ALMAN",     fullName: "Patio Regulador ALMAN"     },
  { id: "sia",       name: "SIA",       fullName: "Patio Regulador SIA"       },
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
      { id: "pv_c1", label: "Carril 1", tipo: "ingreso", defaultTerminal: "general" }, // ✨ CAMBIADO A GENERAL
      { id: "pv_c2", label: "Carril 2", tipo: "ingreso", defaultTerminal: "general" }, // ✨ CAMBIADO A GENERAL  
      { id: "pv_c3", label: "Carril 3", tipo: "ingreso", defaultTerminal: "general" }, // ✨ CAMBIADO A GENERAL
      { id: "pv_c4", label: "Carril 4", tipo: "ingreso", defaultTerminal: "general" }, // ✨ CAMBIADO A GENERAL
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

// --- HELPERS ---
const timeAgo = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000)   return "hace un momento";
  if (d < 3600000) return `hace ${Math.floor(d / 60000)}min`;
  return `hace ${Math.floor(d / 3600000)}h`;
};
const uid = () => "u_" + Math.random().toString(36).substr(2, 6);

// ✨ NUEVO: Helper para generar estilos de ContentBox basado en theme
const getContentBoxStyle = (theme) => {
  // ✅ FIX: Validación robusta - si no hay theme o contentBox, usar valores por defecto
  if (!theme || !theme.contentBox || !theme.contentBox.enabled) {
    return {
      background: "rgba(255, 255, 255, 0.03)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: "12px",
      padding: "16px"
    };
  }
  
  const box = theme.contentBox;
  let background = box.background || "rgba(255, 255, 255, 0.03)";
  
  if (box.gradientOverlay && box.gradientOverlay.enabled) {
    background = `${box.gradientOverlay.gradient}, ${box.background}`;
  }
  
  let boxShadow = "none";
  if (box.shadow && box.shadow.enabled) {
    boxShadow = `${box.shadow.offsetX || 0}px ${box.shadow.offsetY || 0}px ${box.shadow.blur || 0}px ${box.shadow.color || "rgba(0,0,0,0.3)"}`;
  }
  
  return {
    background,
    backdropFilter: box.backdropBlur ? `blur(${box.backdropBlur}px)` : "none",
    WebkitBackdropFilter: box.backdropBlur ? `blur(${box.backdropBlur}px)` : "none",
    border: `${box.borderWidth || 1}px solid ${box.borderColor || "rgba(255, 255, 255, 0.1)"}`,
    borderRadius: `${box.borderRadius || 12}px`,
    padding: `${box.padding || 16}px`,
    boxShadow
  };
};

// ✨ Helper para obtener fuentes dinámicas del theme
// ✅ FIX: Validación robusta con fallbacks seguros
const getFont = (theme, type) => {
  if (!theme) return "'DM Sans', sans-serif"; // fallback si theme es undefined/null
  if (type === "title") return theme.primaryFont || "'Playfair Display', serif";
  return theme.secondaryFont || "'DM Sans', sans-serif";
};

// ✅ FIX: Validación robusta con fallbacks seguros
const getFontSize = (theme, type) => {
  if (!theme) return "14px"; // fallback si theme es undefined/null
  if (type === "title") return `${theme.titleFontSize || 17}px`;
  return `${theme.baseFontSize || 14}px`;
};

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

// --- CONFINADA ---
const CONFINADA_CARRILES = [
  { id: "cf_c1", label: "Carril 1", defaultTerminal: "general",    transferencia: false }, // ✨ CAMBIADO A GENERAL
  { id: "cf_c2", label: "Carril 2", defaultTerminal: "general",    transferencia: false }, // ✨ CAMBIADO A GENERAL
  { id: "cf_c3", label: "Carril 3", defaultTerminal: "general",    transferencia: false }, // ✨ CAMBIADO A GENERAL
];

const mkConfinadaState = () => ({
  ...Object.fromEntries(CONFINADA_CARRILES.map(c => [c.id, {
    terminal: c.defaultTerminal,
    saturado: false,
    retornos: false,
    transferencia: false,
    expo: "libre",
    expo_contenedor: null,
    impo: "libre",
    lastUpdate: Date.now(),
    updatedBy: "Sistema",
  }])),
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

// --- ADMIN MODE ---
function useAdminMode() {
  const theme = React.useContext(ThemeContext);
  const [isAdmin, setIsAdmin] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_KEY) === "1"; }
    catch { return false; }
  });

  const [showModal, setShowModal] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const tapTimer = useRef(null);

  // Countdown timer for lockout display
  useEffect(() => {
    if (lockoutUntil <= 0) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutRemaining(0);
        setLockoutUntil(0);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleLogoTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 3000);
  };

  useEffect(() => {
    if (tapCount >= 5) {
      setTapCount(0);
      setPass("");
      setErr(false);
      setShowAdminPass(false);
      setShowModal(true);
    }
  }, [tapCount]);

  const tryLogin = async () => {
    if (Date.now() < lockoutUntil) return;
    const ok = await verifyAdminPass(pass);
    if (ok) {
      try { sessionStorage.setItem(ADMIN_KEY, "1"); } catch {}
      setIsAdmin(true);
      setShowModal(false);
      setFailedAttempts(0);
      setPass("");
    } else {
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);
      setErr(true);
      if (newFails >= 5) {
        const delays = [30000, 60000, 300000];
        const delayIdx = Math.min(Math.floor((newFails - 5) / 3), delays.length - 1);
        const lockMs = delays[delayIdx];
        setLockoutUntil(Date.now() + lockMs);
        setLockoutRemaining(Math.ceil(lockMs / 1000));
        setFailedAttempts(0);
      }
    }
  };

  const logout = () => {
    try { sessionStorage.removeItem(ADMIN_KEY); } catch {}
    setIsAdmin(false);
  };

  const isLocked = Date.now() < lockoutUntil;

  const EyeIcon = ({ crossed }) => crossed ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const Modal = showModal ? (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"20px" }}>
      <div style={{ background:"#0d1b2e", border:"1px solid rgba(56,189,248,0.3)", borderRadius:"16px", padding:"24px", width:"100%", maxWidth:"300px" }}>
        <div style={{ fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", marginBottom:"6px" }}>🔐 Modo Admin</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.4)", marginBottom:"18px" }}>Ingresa la contraseña para activar el modo administrador.</div>
        {isLocked ? (
          <div style={{ textAlign:"center", padding:"16px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", marginBottom:"12px" }}>
            <div style={{ fontSize:"28px", marginBottom:"6px" }}>🔒</div>
            <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"#ef4444", fontWeight:"700" }}>Demasiados intentos fallidos</div>
            <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)", marginTop:"4px" }}>
              Bloqueado por <span style={{ color:"#f97316", fontWeight:"700" }}>{lockoutRemaining}s</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ position:"relative", marginBottom:"8px" }}>
              <input
                type={showAdminPass ? "text" : "password"}
                value={pass}
                onChange={e => { setPass(e.target.value); setErr(false); }}
                onKeyDown={e => e.key === "Enter" && tryLogin()}
                placeholder="Contraseña"
                autoFocus
                style={{ width:"100%", padding:"11px 44px 11px 14px", background:"rgba(255,255,255,0.07)", border:`1px solid ${err ? "#ef4444" : "rgba(255,255,255,0.15)"}`, borderRadius:"10px", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"14px", boxSizing:"border-box", outline:"none" }}
              />
              <span
                onClick={() => setShowAdminPass(v => !v)}
                style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:"rgba(255,255,255,0.45)", display:"flex", alignItems:"center" }}
              >
                <EyeIcon crossed={showAdminPass} />
              </span>
            </div>
            {err && (
              <div style={{ color:"#ef4444", fontFamily:getFont(theme, "secondary"), fontSize:"12px", marginBottom:"8px" }}>
                Contraseña incorrecta{failedAttempts >= 3 ? ` (${failedAttempts}/5 intentos)` : ""}
              </div>
            )}
          </>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          <button onClick={() => { setShowModal(false); setPass(""); setErr(false); }} style={{ padding:"11px", background:"rgba(255,255,255,0.07)", border:"none", borderRadius:"10px", color:"rgba(255,255,255,0.6)", fontFamily:getFont(theme, "secondary"), fontSize:"13px", cursor:"pointer" }}>Cancelar</button>
          <button onClick={tryLogin} disabled={isLocked} style={{ padding:"11px", background: isLocked ? "#334155" : "#38bdf8", border:"none", borderRadius:"10px", color: isLocked ? "rgba(255,255,255,0.3)" : "#0a0f1e", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"700", cursor: isLocked ? "not-allowed" : "pointer" }}>Entrar</button>
        </div>
      </div>
    </div>
  ) : null;

  const openModal = () => {
    setPass("");
    setErr(false);
    setShowAdminPass(false);
    setShowModal(true);
  };

  return { isAdmin, handleLogoTap, openModal, logout, Modal };
}

// --- HELPER: publicar noticia ---
const publicarNoticia = async ({ tipo, titulo, detalle, icono, color }) => {
  await sb.from("noticias").insert({ tipo, titulo, detalle, icono, color });
};

// --- SHARED UI ---
function Badge({ color, children, small }) {
  const theme = React.useContext(ThemeContext);
  return (
    <span style={{
      background: color + "22", border: `1px solid ${color}55`, color,
      padding: small ? "2px 7px" : "3px 9px",
      borderRadius: "4px", fontSize: small ? "10px" : "11px",
      fontFamily: getFont(theme, "secondary"), fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function VoteBar({ count, needed, color = "#38bdf8" }) {
  const theme = React.useContext(ThemeContext);
  const pct = Math.min((count / needed) * 100, 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: getFont(theme, "secondary") }}>VERIFICACIÓN COMUNITARIA</span>
        <span style={{ fontSize: "9px", color, fontFamily: getFont(theme, "secondary"), fontWeight: "700" }}>{count}/{needed}</span>
      </div>
      <div style={{ background: "#1e3a5f", borderRadius: "2px", height: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#22c55e" : color, transition: "width 0.4s", borderRadius: "2px" }} />
      </div>
    </div>
  );
}

function ToastBox({ toast }) {
  const theme = React.useContext(ThemeContext);
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
      background: "rgba(255,255,255,0.15)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
      border: `1px solid ${toast.color}66`, color: "#fff",
      padding: "10px 22px", borderRadius: "24px", fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "600",
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
    <span style={{ background:"#38bdf8", color:"#0a0f1e", borderRadius:"3px", padding:"0 4px", fontSize:"9px", fontWeight:"700", marginLeft:"3px" }}>{count}</span>
  );
}

function SectionLabel({ text, rightBtn }) {
  const theme = React.useContext(ThemeContext);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", padding:"8px 12px", background:"rgba(255,255,255,0.07)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px" }}>
      <span style={{ fontSize:"12px", color:"rgba(255,255,255,0.9)", fontFamily:getFont(theme, "title"), fontWeight:"700", letterSpacing:"0.5px" }}>{text}</span>
      {rightBtn}
    </div>
  );
}

function NormalBtn({ onClick, label = "TODO NORMAL" }) {
  const theme = React.useContext(ThemeContext);
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", background: "#22c55e15", border: "1px solid #22c55e44",
      borderRadius: "6px", color: "#22c55e", fontFamily: getFont(theme, "secondary"), fontSize: "10px",
      cursor: "pointer", fontWeight: "700", letterSpacing: "0.5px",
    }}>✓ {label}</button>
  );
}

// --- DONATE BANNER ---
function DonateBanner({ active }) {
  const theme = React.useContext(ThemeContext);
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
          <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "11px", color: "#e2e8f0", marginBottom: "2px" }}>
            ¿Te está siendo útil esta app?
          </div>
          <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.45)", lineHeight: "1.4" }}>
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
            fontFamily: getFont(theme, "secondary"),
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


// --- ANUNCIOS BANNER ---
// --- RESPONSIVE HOOK ---
function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

function AnunciosBanner({ isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const vw = useWindowWidth();
  const isMobile = vw < 480;
  const isTablet = vw >= 480 && vw < 768;
  const [anuncios, setAnuncios] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: null, titulo:"", empresa:"", texto:"", enlace:"", whatsapp:"", imagen_url:"", inicio:"", fin:"", activo:true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const intervalRef = useRef(null);

  const cargar = async () => {
    const ahora = new Date().toISOString();
    const { data } = await sb.from("anuncios")
      .select("*")
      .eq("activo", true)
      .lte("fecha_inicio", ahora)
      .gte("fecha_fin", ahora)
      .order("orden", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setAnuncios(data);
  };

  useEffect(() => {
    cargar();
    // Suscripción realtime
    const chan = sb.channel("anuncios-rt")
      .on("postgres_changes", { event:"*", schema:"public", table:"anuncios" }, cargar)
      .subscribe();
    // Limpieza automática de anuncios expirados cada minuto
    const limpia = setInterval(async () => {
      const ahora = new Date().toISOString();
      await sb.from("anuncios").delete().lt("fecha_fin", ahora);
      cargar();
    }, 60000);
    return () => { sb.removeChannel(chan); clearInterval(limpia); };
  }, []);

  // Auto-slide cada 10 minutos
  useEffect(() => {
    if (anuncios.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(v => (v + 1) % anuncios.length);
    }, 600000);
    return () => clearInterval(intervalRef.current);
  }, [anuncios.length]);

  const handleGuardar = async () => {
    const tieneImagen = !!form.imagen_url.trim();
    const tieneTexto  = !!form.texto.trim();
    if (!form.titulo.trim() || !form.empresa.trim() || !form.inicio || !form.fin) {
      setMsg({ type:"err", text:"Completa título, empresa, fecha inicio y fecha fin." }); return;
    }
    if (!tieneImagen && !tieneTexto) {
      setMsg({ type:"err", text:"Debes agregar al menos imagen o texto al anuncio." }); return;
    }
    if (new Date(form.fin) <= new Date(form.inicio)) {
      setMsg({ type:"err", text:"La fecha de fin debe ser posterior a la de inicio." }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const fechaInicio = new Date(form.inicio);
      const fechaFin    = new Date(form.fin);
      if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
        setMsg({ type:"err", text:"Las fechas ingresadas no son válidas." });
        setSaving(false); return;
      }

      const payload = {
        titulo: form.titulo.trim(),
        empresa: form.empresa.trim(),
        texto: form.texto.trim(),
        enlace: form.enlace.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        imagen_url: form.imagen_url.trim() || null,
        fecha_inicio: fechaInicio.toISOString(),
        fecha_fin:    fechaFin.toISOString(),
        activo: form.activo,
      };

      let error;
      if (form.id) {
        // Modo edición: actualizar anuncio existente
        const result = await sb.from("anuncios").update(payload).eq("id", form.id);
        error = result.error;
      } else {
        // Modo creación: insertar nuevo anuncio
        const result = await sb.from("anuncios").insert(payload);
        error = result.error;
      }

      if (error) { setMsg({ type:"err", text:"Error al guardar: " + error.message }); }
      else {
        setMsg({ type:"ok", text: form.id ? "Anuncio actualizado correctamente." : "Anuncio publicado correctamente." });
        setForm({ id: null, titulo:"", empresa:"", texto:"", enlace:"", whatsapp:"", imagen_url:"", inicio:"", fin:"", activo:true });
        setTimeout(() => { setShowForm(false); setMsg(null); }, 1500);
        cargar();
      }
    } catch (ex) {
      setMsg({ type:"err", text:"Error inesperado: " + (ex?.message || ex) });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id, activo) => {
    await sb.from("anuncios").update({ activo: !activo }).eq("id", id);
    cargar();
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Eliminar este anuncio?")) return;
    await sb.from("anuncios").delete().eq("id", id);
    cargar();
  };

  const handleEditar = async (id) => {
    const { data } = await sb.from("anuncios").select("*").eq("id", id).single();
    if (data) {
      // Convertir las fechas ISO a formato datetime-local
      const fechaInicio = new Date(data.fecha_inicio);
      const fechaFin = new Date(data.fecha_fin);
      
      const formatoLocal = (fecha) => {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        const hours = String(fecha.getHours()).padStart(2, '0');
        const minutes = String(fecha.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setForm({
        id: data.id,
        titulo: data.titulo || "",
        empresa: data.empresa || "",
        texto: data.texto || "",
        enlace: data.enlace || "",
        whatsapp: data.whatsapp || "",
        imagen_url: data.imagen_url || "",
        inicio: formatoLocal(fechaInicio),
        fin: formatoLocal(fechaFin),
        activo: data.activo ?? true,
        _imgPreview: data.imagen_url || null,
      });
      setShowForm(true);
    }
  };

  const inp = { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"10px 12px", color:"rgba(255,255,255,0.9)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", boxSizing:"border-box", outline:"none", marginBottom:"10px" };

  // Panel admin de gestión
  if (isAdmin && showForm) return (
    <div style={{ margin:"0 0 0 0", background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:"0", padding:"16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", color:"#fbbf24", letterSpacing:"1px" }}>
          {form.id ? "✏️ EDITAR ANUNCIO" : "📢 NUEVO ANUNCIO"}
        </span>
        <button onClick={() => { setShowForm(false); setForm({ id: null, titulo:"", empresa:"", texto:"", enlace:"", whatsapp:"", imagen_url:"", inicio:"", fin:"", activo:true }); }} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:"16px" }}>✕</button>
      </div>
      {msg && <div style={{ padding:"8px 12px", borderRadius:"8px", marginBottom:"10px", fontSize:"11px", fontFamily:getFont(theme, "secondary"), background: msg.type==="ok"?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)", border:`1px solid ${msg.type==="ok"?"#22c55e55":"#ef444455"}`, color: msg.type==="ok"?"#22c55e":"#ef4444" }}>{msg.text}</div>}
      <input style={inp} placeholder="Título del anuncio *" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} />
      <input style={inp} placeholder="Empresa / Organización *" value={form.empresa} onChange={e=>setForm(f=>({...f,empresa:e.target.value}))} />
      <textarea style={{...inp, minHeight:"80px", resize:"vertical"}} placeholder="Texto del anuncio (obligatorio si no hay imagen — se mostrará como ticker deslizante)" value={form.texto} onChange={e=>setForm(f=>({...f,texto:e.target.value}))} />
      <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px", marginBottom:"6px" }}>BOTONES DE CONTACTO (OPCIONALES)</div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:"8px", marginBottom:"10px" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", fontSize:"14px", pointerEvents:"none" }}>📱</span>
          <input style={{...inp, paddingLeft:"32px", marginBottom:0}} placeholder="WhatsApp (ej: 3141234567)" value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value.replace(/\D/g,"")}))} />
        </div>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", fontSize:"14px", pointerEvents:"none" }}>🌐</span>
          <input style={{...inp, paddingLeft:"32px", marginBottom:0}} placeholder="Sitio web (https://...)" value={form.enlace} onChange={e=>setForm(f=>({...f,enlace:e.target.value}))} />
        </div>
      </div>
      {/* -- Imagen: subir archivo O pegar URL -- */}
      <div style={{ marginBottom:"10px" }}>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px", marginBottom:"6px" }}>IMAGEN (OPCIONAL)</div>
        {/* Tabs: Subir / URL */}
        <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}>
          {["subir","url"].map(opt => (
            <button key={opt} onClick={()=>setForm(f=>({...f,_imgTab:opt, imagen_url:"", _imgFile:null}))}
              style={{ padding:"5px 14px", borderRadius:"7px", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", border:"none",
                background: (form._imgTab||"subir")===opt ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)",
                color: (form._imgTab||"subir")===opt ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
              {opt==="subir" ? "📁 Subir archivo" : "🔗 Pegar URL"}
            </button>
          ))}
        </div>
        {(form._imgTab||"subir")==="subir" ? (
          <div>
            <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px", border:"2px dashed rgba(251,191,36,0.3)", borderRadius:"10px", padding:"16px", cursor:"pointer", background:"rgba(251,191,36,0.04)", minHeight:"80px" }}>
              <input type="file" accept="image/*" style={{ display:"none" }} onChange={async(e)=>{
                const file = e.target.files[0];
                if (!file) return;
                setForm(f=>({...f,_imgFile:file,_imgUploading:true,_imgPreview:URL.createObjectURL(file)}));
                const ext = file.name.split(".").pop();
                const nombre = `anuncio_${Date.now()}.${ext}`;
                const { data, error } = await sb.storage.from("anuncios-imagenes").upload(nombre, file, { upsert:true });
                if (error) { setMsg({type:"err",text:"Error al subir imagen: "+error.message}); setForm(f=>({...f,_imgUploading:false})); return; }
                const { data: urlData } = sb.storage.from("anuncios-imagenes").getPublicUrl(data.path);
                setForm(f=>({...f, imagen_url: urlData.publicUrl, _imgUploading:false}));
              }} />
              {form._imgPreview ? (
                <img src={form._imgPreview} alt="preview" style={{ width:"100%", maxHeight:"120px", objectFit:"cover", borderRadius:"8px" }} />
              ) : (
                <>
                  <span style={{ fontSize:"28px" }}>🖼️</span>
                  <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", textAlign:"center" }}>Toca para seleccionar imagen<br/>JPG, PNG, WEBP</span>
                </>
              )}
              {form._imgUploading && <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#fbbf24" }}>Subiendo...</span>}
              {form.imagen_url && !form._imgUploading && <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"#22c55e" }}>✅ Imagen subida</span>}
            </label>
          </div>
        ) : (
          <input style={inp} placeholder="https://... URL de imagen" value={form.imagen_url} onChange={e=>setForm(f=>({...f,imagen_url:e.target.value}))} />
        )}
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", marginTop:"5px" }}>📐 Recomendado: <strong style={{color:"#fbbf24"}}>800 × 200 px</strong> (ratio 4:1) · móvil se adapta automáticamente</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:"8px", marginBottom:"10px" }}>
        <div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", marginBottom:"4px" }}>FECHA Y HORA INICIO *</div>
          <input type="datetime-local" style={{...inp, marginBottom:0}} value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value}))} />
        </div>
        <div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", marginBottom:"4px" }}>FECHA Y HORA FIN *</div>
          <input type="datetime-local" style={{...inp, marginBottom:0}} value={form.fin} onChange={e=>setForm(f=>({...f,fin:e.target.value}))} />
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
        <div onClick={()=>setForm(f=>({...f,activo:!f.activo}))} style={{ width:"16px", height:"16px", borderRadius:"4px", border:`2px solid ${form.activo?"#22c55e":"rgba(255,255,255,0.2)"}`, background:form.activo?"#22c55e":"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
          {form.activo && <span style={{ color:"#0a1628", fontSize:"10px", fontWeight:"900" }}>✓</span>}
        </div>
        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.6)" }}>Publicar inmediatamente (activo)</span>
      </div>
      <button onClick={handleGuardar} disabled={saving} style={{ width:"100%", padding:"12px", background:"linear-gradient(135deg,#fbbf24,#f59e0b)", border:"none", borderRadius:"10px", color:"#0a0f1e", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", cursor:"pointer", letterSpacing:"0.5px", opacity:saving?0.7:1 }}>
        {saving ? (form.id ? "Actualizando..." : "Publicando...") : (form.id ? "💾 GUARDAR CAMBIOS" : "📢 PUBLICAR ANUNCIO")}
      </button>

      {/* Lista de anuncios existentes para admin */}
      <AdminAnunciosList onToggle={handleToggle} onDelete={handleEliminar} onEdit={handleEditar} onRefresh={cargar} />
    </div>
  );

  // Botón admin para abrir panel (siempre visible si admin)
  const BtnAdmin = isAdmin ? (
    <div style={{ display:"flex", justifyContent:"flex-end", padding:"6px 12px 0", background:"rgba(251,191,36,0.04)", borderTop:"1px solid rgba(251,191,36,0.15)" }}>
      <button onClick={() => setShowForm(true)} style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:"8px", padding:"5px 12px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", letterSpacing:"0.5px" }}>
        ＋ GESTIONAR ANUNCIOS
      </button>
    </div>
  ) : null;

  // Sin anuncios activos
  if (anuncios.length === 0) {
    if (!isAdmin) return null;
    return (
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        {BtnAdmin}
      </div>
    );
  }

  const a = anuncios[current];

  return (
    <div style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,22,50,0.6)", position:"relative", overflow:"hidden" }}>
      {/* Slide animado */}
      <div key={current} style={{ animation:"slideInFromRight 0.5s ease", padding:"0" }}>
        {a.imagen_url && (
          <img src={a.imagen_url} alt={a.titulo} style={{ width:"100%", height:"auto", maxHeight: isMobile ? "120px" : "160px", objectFit:"contain", objectPosition:"center", display:"block", background:"#0a1628" }} onError={e=>e.target.style.display="none"} />
        )}
        <div style={{ padding: isMobile ? "10px 12px 8px" : "14px 20px 10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"6px" }}>
            <div>
              <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"#fbbf24", fontWeight:"700", letterSpacing:"1.5px", background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:"4px", padding:"2px 7px", marginRight:"8px" }}>📢 ANUNCIO</span>
              <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.35)" }}>{a.empresa}</span>
            </div>
            {anuncios.length > 1 && (
              <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)" }}>{current+1}/{anuncios.length}</span>
            )}
          </div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize: isMobile ? "12px" : "14px", fontWeight:"700", color:"#ffffff", marginBottom:"6px" }}>{a.titulo}</div>
          {a.texto && (
            a.imagen_url ? (
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize: isMobile?"10px":"11px", color:"rgba(255,255,255,0.7)", lineHeight:"1.6", marginBottom: a.enlace?"10px":"0" }}>
                {a.texto}
              </div>
            ) : (
              <div style={{ overflow:"hidden", whiteSpace:"nowrap", marginBottom: a.enlace?"10px":"4px", borderTop:"1px solid rgba(251,191,36,0.12)", borderBottom:"1px solid rgba(251,191,36,0.12)", padding:"12px 0", background:"rgba(251,191,36,0.04)" }}>
                <span style={{
                  display:"inline-block",
                  fontFamily:getFont(theme, "secondary"),
                  fontSize: isMobile?"16px":"20px",
                  fontWeight:"700",
                  color:"rgba(255,255,255,0.95)",
                  animation:"marqueeScroll 45s linear infinite",
                  paddingLeft:"100%",
                  willChange:"transform",
                }}>
                  {a.texto}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{a.texto}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{a.texto}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{a.texto}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{a.texto}
                </span>
              </div>
            )
          )}
          {(a.enlace || a.whatsapp) && (
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"10px" }}>
              {a.whatsapp && (
                <a
                  href={`https://wa.me/${a.whatsapp.replace(/\D/g,"")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#22c55e", fontWeight:"700", textDecoration:"none", background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.35)", borderRadius:"8px", padding:"7px 14px" }}
                >
                  <span style={{ fontSize:"14px" }}>📱</span> WhatsApp
                </a>
              )}
              {a.enlace && (
                <a
                  href={a.enlace.startsWith("http") ? a.enlace : `https://${a.enlace}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#38bdf8", fontWeight:"700", textDecoration:"none", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)", borderRadius:"8px", padding:"7px 14px" }}
                >
                  <span style={{ fontSize:"14px" }}>🌐</span> Ver sitio
                </a>
              )}
            </div>
          )}
        </div>
        {/* Navegación: flechas + dots */}
        {anuncios.length > 1 && (
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:"12px", paddingBottom:"12px" }}>
            <button
              onClick={() => { setCurrent(v => (v - 1 + anuncios.length) % anuncios.length); clearInterval(intervalRef.current); }}
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:"50%", width:"32px", height:"32px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#ffffff", fontSize:"16px", fontWeight:"700", flexShrink:0, transition:"background 0.2s", lineHeight:1 }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(251,191,36,0.3)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
            >‹</button>
            <div style={{ display:"flex", gap:"5px", alignItems:"center" }}>
              {anuncios.map((_,i) => (
                <div key={i} onClick={() => { setCurrent(i); clearInterval(intervalRef.current); }} style={{ width: i===current?"18px":"6px", height:"6px", borderRadius:"3px", background: i===current?"#fbbf24":"rgba(255,255,255,0.2)", cursor:"pointer", transition:"all 0.3s" }} />
              ))}
            </div>
            <button
              onClick={() => { setCurrent(v => (v + 1) % anuncios.length); clearInterval(intervalRef.current); }}
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:"50%", width:"32px", height:"32px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#ffffff", fontSize:"16px", fontWeight:"700", flexShrink:0, transition:"background 0.2s", lineHeight:1 }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(251,191,36,0.3)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
            >›</button>
          </div>
        )}
      </div>
      {BtnAdmin}
      <style>{`@keyframes slideInFromRight{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes marqueeScroll{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}`}</style>
    </div>
  );
}

function AdminAnunciosList({ onToggle, onDelete, onEdit, onRefresh }) {
  const theme = React.useContext(ThemeContext);
  const [lista, setLista] = useState([]);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    sb.from("anuncios")
      .select("*")
      .order("orden", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setLista(data); });
  }, []);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...lista];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    // Actualizar orden en base de datos (mayor número = mayor prioridad)
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      orden: reordered.length - idx
    }));

    for (const update of updates) {
      await sb.from("anuncios").update({ orden: update.orden }).eq("id", update.id);
    }

    setLista(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (onRefresh) setTimeout(onRefresh, 300);
  };

  const handleSetPrincipal = async (id) => {
    // Establecer el anuncio con el orden más alto
    const maxOrden = Math.max(...lista.map(a => a.orden || 0), 0);
    await sb.from("anuncios").update({ orden: maxOrden + 100 }).eq("id", id);
    
    // Recargar lista
    const { data } = await sb.from("anuncios")
      .select("*")
      .order("orden", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) setLista(data);
    if (onRefresh) setTimeout(onRefresh, 300);
  };

  if (lista.length === 0) return null;

  return (
    <div style={{ marginTop:"16px", borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", letterSpacing:"1.5px" }}>
          ANUNCIOS EXISTENTES ({lista.length})
        </div>
        <button
          onClick={() => setIsReordering(!isReordering)}
          style={{
            background: isReordering ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${isReordering ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.15)"}`,
            borderRadius:"6px",
            padding:"4px 10px",
            color: isReordering ? "#fbbf24" : "rgba(255,255,255,0.6)",
            fontFamily:getFont(theme, "secondary"),
            fontSize:"9px",
            cursor:"pointer",
            fontWeight:"700",
            letterSpacing:"0.5px"
          }}
        >
          {isReordering ? "✓ GUARDAR ORDEN" : "↕ REORDENAR"}
        </button>
      </div>

      {lista.map((a, idx) => (
        <div
          key={a.id}
          draggable={isReordering}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          style={{
            background: dragOverIndex === idx && isReordering ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${dragOverIndex === idx && isReordering ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
            borderRadius:"8px",
            padding:"10px 12px",
            marginBottom:"8px",
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
            gap:"8px",
            cursor: isReordering ? "move" : "default",
            opacity: draggedIndex === idx ? 0.5 : 1,
            transition:"all 0.2s"
          }}
        >
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"4px" }}>
              {isReordering && (
                <span style={{ fontSize:"14px", color:"rgba(255,255,255,0.3)", cursor:"move" }}>⋮⋮</span>
              )}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#fff", fontWeight:"700", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {a.titulo}
              </div>
              {idx === 0 && !isReordering && (
                <span style={{
                  background:"rgba(251,191,36,0.15)",
                  border:"1px solid rgba(251,191,36,0.35)",
                  borderRadius:"4px",
                  padding:"1px 5px",
                  fontSize:"8px",
                  color:"#fbbf24",
                  fontFamily:getFont(theme, "secondary"),
                  fontWeight:"700",
                  letterSpacing:"0.5px"
                }}>
                  ★ PRINCIPAL
                </span>
              )}
            </div>
            <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.35)" }}>
              {a.empresa} · fin: {new Date(a.fecha_fin).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"})}
            </div>
          </div>

          {!isReordering && (
            <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
              {idx !== 0 && (
                <button
                  onClick={() => handleSetPrincipal(a.id)}
                  title="Establecer como principal"
                  style={{
                    background:"rgba(251,191,36,0.12)",
                    border:"1px solid rgba(251,191,36,0.3)",
                    borderRadius:"6px",
                    padding:"5px 9px",
                    color:"#fbbf24",
                    fontFamily:getFont(theme, "secondary"),
                    fontSize:"10px",
                    cursor:"pointer",
                    fontWeight:"700"
                  }}
                >
                  ★
                </button>
              )}
              <button
                onClick={() => onEdit(a.id)}
                title="Editar anuncio"
                style={{
                  background:"rgba(56,189,248,0.12)",
                  border:"1px solid rgba(56,189,248,0.3)",
                  borderRadius:"6px",
                  padding:"5px 9px",
                  color:"#38bdf8",
                  fontFamily:getFont(theme, "secondary"),
                  fontSize:"10px",
                  cursor:"pointer",
                  fontWeight:"700"
                }}
              >
                ✏️
              </button>
              <button
                onClick={() => {
                  onToggle(a.id, a.activo);
                  setTimeout(() => {
                    sb.from("anuncios")
                      .select("*")
                      .order("orden", { ascending: false })
                      .order("created_at", { ascending: false })
                      .then(({ data }) => { if (data) setLista(data); });
                  }, 300);
                }}
                style={{
                  background: a.activo ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${a.activo ? "#22c55e55" : "rgba(255,255,255,0.15)"}`,
                  borderRadius:"6px",
                  padding:"5px 9px",
                  color: a.activo ? "#22c55e" : "rgba(255,255,255,0.4)",
                  fontFamily:getFont(theme, "secondary"),
                  fontSize:"10px",
                  cursor:"pointer",
                  fontWeight:"700"
                }}
              >
                {a.activo ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => {
                  onDelete(a.id);
                  setLista(l => l.filter(x => x.id !== a.id));
                }}
                style={{
                  background:"rgba(239,68,68,0.1)",
                  border:"1px solid rgba(239,68,68,0.25)",
                  borderRadius:"6px",
                  padding:"5px 9px",
                  color:"#ef4444",
                  fontFamily:getFont(theme, "secondary"),
                  fontSize:"10px",
                  cursor:"pointer"
                }}
              >
                🗑
              </button>
            </div>
          )}
        </div>
      ))}

      {isReordering && (
        <div style={{
          marginTop:"8px",
          padding:"8px 12px",
          background:"rgba(251,191,36,0.08)",
          border:"1px solid rgba(251,191,36,0.2)",
          borderRadius:"8px",
          fontFamily:getFont(theme, "secondary"),
          fontSize:"9px",
          color:"rgba(255,255,255,0.5)",
          textAlign:"center"
        }}>
          💡 Arrastra los anuncios para cambiar su orden. El primero será el principal.
        </div>
      )}
    </div>
  );
}

// ---
// 🔧 HOOK: CARGAR Y SUSCRIBIRSE AL TEMA GLOBAL EN SUPABASE (TIEMPO REAL)
// Permite que TODOS los usuarios vean los cambios de tema instantáneamente
// ---
function useGlobalTheme(isAdmin) {
  // ✅ FIX CRÍTICO: Inicializar con DEFAULT_THEME en lugar de null
  const [supabaseTheme, setSupabaseTheme] = React.useState(DEFAULT_THEME);
  const [loadingTheme, setLoadingTheme] = React.useState(true);
  const [previewMode, setPreviewMode] = React.useState(false);

  // Cargar tema desde Supabase al montar
  React.useEffect(() => {
    async function loadTheme() {
      try {
        // Si es admin, verificar si hay preview local
        if (isAdmin) {
          const localPreview = localStorage.getItem("admin_theme_preview");
          if (localPreview) {
            try {
              const parsed = JSON.parse(localPreview);
              setSupabaseTheme({ ...DEFAULT_THEME, ...parsed });
              setPreviewMode(true);
              setLoadingTheme(false);
              console.log("🎨 Admin: Tema preview cargado desde localStorage");
              return;
            } catch (e) {
              console.error("Error parseando preview local:", e);
            }
          }
        }

        // Cargar tema global desde Supabase
        const { data, error } = await sb
          .from("global_theme")
          .select("*")
          .eq("id", 1)
          .single();

        if (data && !error) {
          setSupabaseTheme({ ...DEFAULT_THEME, ...data.config });
        }
      } catch (err) {
        console.warn("Supabase theme not available, using local theme:", err?.message);
      } finally {
        setLoadingTheme(false);
      }
    }
    loadTheme();
  }, [isAdmin]);

  // 🔴 SUSCRIPCIÓN EN TIEMPO REAL — Detecta cambios y actualiza para TODOS
  // (Admin en preview NO escucha cambios globales)
  React.useEffect(() => {
    if (previewMode && isAdmin) return; // Admin en preview no escucha cambios

    const channel = sb
      .channel("global-theme-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "global_theme",
          filter: "id=eq.1"
        },
        (payload) => {
          console.log("🎨 Tema global actualizado en tiempo real:", payload.new);
          setSupabaseTheme({ ...DEFAULT_THEME, ...payload.new.config });
          
          // Si el admin estaba en preview, salir del modo preview
          if (isAdmin && previewMode) {
            localStorage.removeItem("admin_theme_preview");
            setPreviewMode(false);
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [previewMode, isAdmin]);

  // 🎨 GUARDAR PREVIEW LOCAL (solo admin)
  const savePreview = (newTheme) => {
    if (!isAdmin) return false;
    
    try {
      localStorage.setItem("admin_theme_preview", JSON.stringify(newTheme));
      setSupabaseTheme({ ...DEFAULT_THEME, ...newTheme });
      setPreviewMode(true);
      console.log("✅ Preview guardado localmente para admin");
      return true;
    } catch (err) {
      console.error("Error guardando preview:", err);
      return false;
    }
  };

  // 🌍 APLICAR A TODOS (guardar en Supabase)
  const applyToAll = async (newTheme) => {
    if (!isAdmin) return { success: false };

    try {
      const { data, error } = await sb
        .from("global_theme")
        .upsert({
          id: 1,
          config: newTheme,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error("Error aplicando tema global:", error);
        return { success: false, error };
      }

      // Limpiar preview local
      localStorage.removeItem("admin_theme_preview");
      setPreviewMode(false);
      
      console.log("✅ Tema aplicado GLOBALMENTE a todos los usuarios");
      return { success: true, data };
    } catch (err) {
      console.error("Excepción aplicando tema:", err);
      return { success: false, error: err };
    }
  };

  // ❌ CANCELAR PREVIEW y volver al tema global
  const cancelPreview = async () => {
    if (!isAdmin) return;
    
    localStorage.removeItem("admin_theme_preview");
    setPreviewMode(false);

    // Recargar tema global
    try {
      const { data, error } = await sb
        .from("global_theme")
        .select("*")
        .eq("id", 1)
        .single();
      
      if (data && !error) {
        setSupabaseTheme({ ...DEFAULT_THEME, ...data.config });
      } else {
        setSupabaseTheme(DEFAULT_THEME);
      }
      console.log("✅ Preview cancelado, tema global restaurado");
    } catch (err) {
      console.error("Error cancelando preview:", err);
      setSupabaseTheme(DEFAULT_THEME);
    }
  };

  return { 
    supabaseTheme, 
    loadingTheme,
    previewMode,      // Indica si admin está en modo preview
    savePreview,      // Guardar preview local (solo admin)
    applyToAll,       // Aplicar a todos los usuarios (solo admin)
    cancelPreview     // Cancelar preview (solo admin)
  };
}

// ---
// 🔧 FUNCIÓN: GUARDAR TEMA EN SUPABASE (SOLO ADMIN)
// Sincroniza el tema para todos los usuarios en tiempo real
// ---
async function saveThemeToDatabase(newTheme) {
  try {
    const { data, error } = await sb
      .from("global_theme")
      .upsert({
        id: 1,
        config: newTheme,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error guardando tema en Supabase:", error);
      return { success: false, error };
    }

    console.log("✅ Tema guardado en Supabase exitosamente:", data);
    return { success: true, data };
  } catch (err) {
    console.error("Error guardando tema:", err);
    return { success: false, error: err };
  }
}


// --- NAVBAR ---
// ---
// PANEL DE CONFIGURACIÓN DE TEMA
// ---
function ThemeConfigPanel({ theme, previewMode, onPreview, onApplyToAll, onCancel, onClose }) {
  const [config, setConfig] = useState(theme);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("background");
  
  const fileInputRefs = useRef({});
  const initialRender = useRef(true);
  
  // ✅ PREVIEW EN TIEMPO REAL — Aplicar cambios localmente mientras se configura
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    
    // Guardar preview local automáticamente
    if (onPreview) {
      onPreview(config);
    }
  }, [config, onPreview]);
  
  const handleBackgroundImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setConfig(prev => ({
        ...prev,
        backgroundImage: event.target.result,
        backgroundType: "image"
      }));
    };
    reader.readAsDataURL(file);
  };
  
  const handleIconImageUpload = async (iconKey, category, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setConfig(prev => {
        if (category === "tabs") {
          return {
            ...prev,
            tabIcons: {
              ...prev.tabIcons,
              [iconKey]: { type: "image", value: event.target.result, size: prev.tabIcons[iconKey].size }
            }
          };
        } else {
          return {
            ...prev,
            otherIcons: {
              ...prev.otherIcons,
              [iconKey]: { type: "image", value: event.target.result, size: prev.otherIcons[iconKey].size }
            }
          };
        }
      });
    };
    reader.readAsDataURL(file);
  };
  
  // 🌍 APLICAR A TODOS — Guardar en Supabase para todos los usuarios
  const handleApplyToAll = async () => {
    if (!confirm("¿Aplicar este tema a TODOS los usuarios?\n\nTodos verán estos cambios en tiempo real.")) {
      return;
    }
    
    setSaving(true);
    const success = await onApplyToAll(config);
    setSaving(false);
    
    if (success) {
      alert("✅ Tema aplicado exitosamente a todos los usuarios");
      onClose();
    } else {
      alert("❌ Error al aplicar el tema. Revisa la consola.");
    }
  };
  
  const handleCancel = () => {
    if (previewMode && confirm("¿Cancelar los cambios y volver al tema global?")) {
      onCancel();
      onClose();
    } else {
      onClose();
    }
  };
  
  const handleReset = () => {
    if (confirm("¿Restaurar tema por defecto? Se perderán todos los cambios.")) {
      setConfig(DEFAULT_THEME);
    }
  };
  
  const sections = [
    { key: "background", label: "Fondo", icon: "🎨" },
    { key: "typography", label: "Tipografía", icon: "📝" },
    { key: "contentBox", label: "Ventanas", icon: "🪟" },
    { key: "tabIcons", label: "Iconos Tabs", icon: "🏷️" },
    { key: "otherIcons", label: "Otros Iconos", icon: "✨" }
  ];
  
  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.92)", zIndex:999999, overflow:"auto", padding:"20px" }}>
      <div style={{ maxWidth:"900px", margin:"0 auto", background:"#0d1f3c", borderRadius:"16px", overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.9)" }}>
        {/* Header */}
        <div style={{ padding:"20px 24px", background:"linear-gradient(135deg, #1e3a5f 0%, #0d1f3c 100%)", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <h2 style={{ margin:0, fontFamily:getFont(theme, "title"), fontSize:"24px", color:"#fff", fontWeight:"700" }}>
                🎨 Configuración de Tema
              </h2>
              <p style={{ margin:"4px 0 0", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.5)" }}>
                {previewMode ? "⚡ Modo Preview — Solo tú ves estos cambios" : "Personaliza la apariencia de la aplicación"}
              </p>
            </div>
            <button
              onClick={handleCancel}
              style={{ width:"36px", height:"36px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontSize:"20px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{ display:"flex", gap:"8px", padding:"16px 24px", background:"rgba(0,0,0,0.2)", borderBottom:"1px solid rgba(255,255,255,0.08)", overflowX:"auto" }}>
          {sections.map(sec => (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              style={{
                padding:"10px 16px",
                borderRadius:"8px",
                border: activeSection === sec.key ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
                background: activeSection === sec.key ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                color: activeSection === sec.key ? "#38bdf8" : "rgba(255,255,255,0.6)",
                fontFamily:getFont(theme, "secondary"),
                fontSize:"13px",
                fontWeight:"600",
                cursor:"pointer",
                whiteSpace:"nowrap",
                display:"flex",
                alignItems:"center",
                gap:"6px",
                transition:"all 0.2s"
              }}
            >
              <span>{sec.icon}</span>
              {sec.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div style={{ padding:"24px", minHeight:"400px" }}>
          {/* BACKGROUND SECTION */}
          {activeSection === "background" && (
            <div>
              <h3 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", fontWeight:"600" }}>
                Configuración de Fondo
              </h3>
              
              <div style={{ display:"flex", gap:"12px", marginBottom:"20px" }}>
                {["color", "gradient", "image"].map(type => (
                  <button
                    key={type}
                    onClick={() => setConfig(prev => ({ ...prev, backgroundType: type }))}
                    style={{
                      flex:1,
                      padding:"12px",
                      borderRadius:"8px",
                      border: config.backgroundType === type ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                      background: config.backgroundType === type ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                      color: config.backgroundType === type ? "#38bdf8" : "rgba(255,255,255,0.6)",
                      fontFamily:getFont(theme, "secondary"),
                      fontSize:"13px",
                      fontWeight:"600",
                      cursor:"pointer",
                      textTransform:"capitalize"
                    }}
                  >
                    {type === "color" ? "🎨 Color Sólido" : type === "gradient" ? "🌈 Degradado" : "🖼️ Imagen"}
                  </button>
                ))}
              </div>
              
              {config.backgroundType === "color" && (
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Color de Fondo
                  </label>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      style={{ width:"60px", height:"60px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", cursor:"pointer" }}
                    />
                    <input
                      type="text"
                      value={config.backgroundColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      placeholder="#0a1628"
                      style={{ flex:1, padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"13px" }}
                    />
                  </div>
                </div>
              )}
              
              {config.backgroundType === "gradient" && (
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Paletas Predefinidas
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"16px" }}>
                    {[
                      { label:"Puerto Noche",   gradient:"linear-gradient(135deg, #0a1628 0%, #1a2942 100%)" },
                      { label:"Océano Profundo",gradient:"linear-gradient(135deg, #0c1445 0%, #0d3b6e 100%)" },
                      { label:"Medianoche",     gradient:"linear-gradient(135deg, #0f0c29 0%, #302b63 100%)" },
                      { label:"Mar Oscuro",     gradient:"linear-gradient(180deg, #000428 0%, #004e92 100%)" },
                      { label:"Carbón",         gradient:"linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
                      { label:"Noche Tropical", gradient:"linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
                      { label:"Puerto Azul",    gradient:"linear-gradient(135deg, #051937 0%, #004d7a 50%, #008793 100%)" },
                      { label:"Marino Índigo",  gradient:"linear-gradient(135deg, #141e30 0%, #243b55 100%)" },
                      { label:"Zafiro",         gradient:"linear-gradient(135deg, #0d1b2e 0%, #1b3a6b 100%)" },
                    ].map(p => {
                      const isActive = config.backgroundGradient === p.gradient;
                      return (
                        <button
                          key={p.label}
                          onClick={() => setConfig(prev => ({ ...prev, backgroundGradient: p.gradient }))}
                          style={{
                            borderRadius:"8px",
                            border: isActive ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                            overflow:"hidden",
                            cursor:"pointer",
                            padding:0,
                            transition:"all 0.2s"
                          }}
                        >
                          <div style={{ width:"100%", height:"40px", background:p.gradient }} />
                          <div style={{ padding:"4px 6px", background:"rgba(0,0,0,0.5)", fontFamily:"'DM Sans',sans-serif", fontSize:"9px", color: isActive ? "#38bdf8" : "rgba(255,255,255,0.6)", fontWeight: isActive ? "700" : "400", textAlign:"center" }}>{p.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Código CSS Personalizado
                  </label>
                  <input
                    type="text"
                    value={config.backgroundGradient}
                    onChange={(e) => setConfig(prev => ({ ...prev, backgroundGradient: e.target.value }))}
                    placeholder="linear-gradient(135deg, #0a1628 0%, #1a2942 100%)"
                    style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"monospace", fontSize:"12px" }}
                  />
                  <div style={{ marginTop:"12px", padding:"12px", borderRadius:"8px", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.3)" }}>
                    <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.6)", marginBottom:"6px" }}>Vista previa:</div>
                    <div style={{ width:"100%", height:"60px", borderRadius:"6px", background: config.backgroundGradient }} />
                  </div>
                </div>
              )}
              
              {config.backgroundType === "image" && (
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Imagen de Fondo
                  </label>
                  <input
                    ref={el => fileInputRefs.current["background"] = el}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    style={{ display:"none" }}
                  />
                  <button
                    onClick={() => fileInputRefs.current["background"]?.click()}
                    style={{ width:"100%", padding:"16px", borderRadius:"8px", border:"2px dashed rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.03)", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"600", cursor:"pointer" }}
                  >
                    📁 Seleccionar Imagen
                  </button>
                  {config.backgroundImage && (
                    <div style={{ marginTop:"12px", padding:"12px", borderRadius:"8px", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.3)" }}>
                      <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.6)", marginBottom:"6px" }}>Vista previa:</div>
                      <div style={{ 
                        width:"100%", 
                        height:"120px", 
                        borderRadius:"6px", 
                        backgroundImage: `url(${config.backgroundImage})`, 
                        backgroundSize:"cover", 
                        backgroundPosition:"center",
                        position:"relative"
                      }}>
                        {/* Preview del overlay */}
                        <div style={{
                          position:"absolute",
                          top:0,
                          left:0,
                          width:"100%",
                          height:"100%",
                          background:`rgba(0, 0, 0, ${config.backgroundImageOverlayOpacity || 0.65})`,
                          borderRadius:"6px",
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center"
                        }}>
                          <span style={{ color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"11px" }}>
                            Overlay {Math.round((config.backgroundImageOverlayOpacity || 0.65) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ✨ Control de opacidad del overlay */}
                  {config.backgroundImage && (
                    <div style={{ marginTop:"16px" }}>
                      <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                        Opacidad de Capa Oscura: {Math.round((config.backgroundImageOverlayOpacity || 0.65) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={config.backgroundImageOverlayOpacity || 0.65}
                        onChange={(e) => setConfig(prev => ({ ...prev, backgroundImageOverlayOpacity: parseFloat(e.target.value) }))}
                        style={{ 
                          width:"100%", 
                          height:"6px",
                          borderRadius:"3px",
                          background:"linear-gradient(to right, #38bdf8 0%, #38bdf8 " + ((config.backgroundImageOverlayOpacity || 0.65) * 100) + "%, rgba(255,255,255,0.1) " + ((config.backgroundImageOverlayOpacity || 0.65) * 100) + "%, rgba(255,255,255,0.1) 100%)",
                          outline:"none",
                          cursor:"pointer",
                          WebkitAppearance:"none",
                          appearance:"none"
                        }}
                      />
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px" }}>
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)" }}>Más claro</span>
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)" }}>Más oscuro</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* TYPOGRAPHY SECTION */}
          {activeSection === "typography" && (
            <div>
              <h3 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", fontWeight:"600" }}>
                Configuración de Tipografía
              </h3>
              
              <div style={{ display:"grid", gap:"20px" }}>
                {/* -- Fuente Principal (Títulos) -- */}
                <div>
                  <label style={{ display:"block", marginBottom:"10px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Fuente Principal (Títulos)
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px" }}>
                    {[
                      { label:"Playfair Display", value:"'Playfair Display', serif", sample:"Aa" },
                      { label:"Montserrat",        value:"'Montserrat', sans-serif",  sample:"Aa" },
                      { label:"Roboto",            value:"'Roboto', sans-serif",      sample:"Aa" },
                      { label:"Poppins",           value:"'Poppins', sans-serif",     sample:"Aa" },
                      { label:"Lato",              value:"'Lato', sans-serif",        sample:"Aa" },
                      { label:"Open Sans",         value:"'Open Sans', sans-serif",   sample:"Aa" },
                    ].map(f => {
                      const isActive = config.primaryFont === f.value;
                      return (
                        <button
                          key={f.value}
                          onClick={() => setConfig(prev => ({ ...prev, primaryFont: f.value }))}
                          style={{
                            padding:"12px 10px",
                            borderRadius:"8px",
                            border: isActive ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.12)",
                            background: isActive ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                            cursor:"pointer",
                            display:"flex",
                            flexDirection:"column",
                            alignItems:"center",
                            gap:"4px",
                            transition:"all 0.2s"
                          }}
                        >
                          <span style={{ fontFamily:f.value, fontSize:"22px", color: isActive ? "#38bdf8" : "rgba(255,255,255,0.85)", fontWeight:"700", lineHeight:1 }}>{f.sample}</span>
                          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"10px", color: isActive ? "#38bdf8" : "rgba(255,255,255,0.45)", fontWeight: isActive ? "700" : "400" }}>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Preview en vivo */}
                  <div style={{ padding:"14px 16px", borderRadius:"8px", background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:"10px" }}>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>PREVIEW</div>
                    <div style={{ fontFamily:config.primaryFont, fontSize:"20px", color:"#fff", fontWeight:"700", marginBottom:"4px" }}>Conect Manzanillo</div>
                    <div style={{ fontFamily:config.primaryFont, fontSize:"14px", color:"rgba(255,255,255,0.6)" }}>Terminal Zona Norte · Puerto</div>
                  </div>
                  <div style={{ marginTop:"8px" }}>
                    <input
                      ref={el => fileInputRefs.current["primaryFont"] = el}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const fontName = file.name.split('.')[0];
                          const fontData = event.target.result;
                          // Inyectar la fuente en el documento
                          const styleEl = document.createElement("style");
                          styleEl.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
                          document.head.appendChild(styleEl);
                          setConfig(prev => ({
                            ...prev,
                            customPrimaryFont: `'${fontName}', serif`,
                            customPrimaryFontData: fontData,
                            primaryFont: `'${fontName}', serif`
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                      style={{ display:"none" }}
                    />
                    <button
                      onClick={() => fileInputRefs.current["primaryFont"]?.click()}
                      style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(139,92,246,0.3)", background:"rgba(139,92,246,0.1)", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"600", cursor:"pointer" }}
                    >
                      📁 Subir Fuente Personalizada (.ttf, .otf, .woff)
                    </button>
                  </div>
                </div>
                
                {/* -- Fuente Secundaria (Texto) -- */}
                <div>
                  <label style={{ display:"block", marginBottom:"10px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Fuente Secundaria (Texto General)
                  </label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px" }}>
                    {[
                      { label:"DM Sans",    value:"'DM Sans', sans-serif",    sample:"Aa" },
                      { label:"Open Sans",  value:"'Open Sans', sans-serif",  sample:"Aa" },
                      { label:"Roboto",     value:"'Roboto', sans-serif",     sample:"Aa" },
                      { label:"Poppins",    value:"'Poppins', sans-serif",    sample:"Aa" },
                      { label:"Lato",       value:"'Lato', sans-serif",       sample:"Aa" },
                      { label:"Montserrat", value:"'Montserrat', sans-serif", sample:"Aa" },
                    ].map(f => {
                      const isActive = config.secondaryFont === f.value;
                      return (
                        <button
                          key={f.value}
                          onClick={() => setConfig(prev => ({ ...prev, secondaryFont: f.value }))}
                          style={{
                            padding:"12px 10px",
                            borderRadius:"8px",
                            border: isActive ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.12)",
                            background: isActive ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
                            cursor:"pointer",
                            display:"flex",
                            flexDirection:"column",
                            alignItems:"center",
                            gap:"4px",
                            transition:"all 0.2s"
                          }}
                        >
                          <span style={{ fontFamily:f.value, fontSize:"22px", color: isActive ? "#a78bfa" : "rgba(255,255,255,0.85)", fontWeight:"400", lineHeight:1 }}>{f.sample}</span>
                          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"10px", color: isActive ? "#a78bfa" : "rgba(255,255,255,0.45)", fontWeight: isActive ? "700" : "400" }}>{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Preview en vivo */}
                  <div style={{ padding:"14px 16px", borderRadius:"8px", background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:"10px" }}>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>PREVIEW</div>
                    <div style={{ fontFamily:config.secondaryFont, fontSize:"13px", color:"rgba(255,255,255,0.9)", marginBottom:"4px", fontWeight:"600" }}>Estado del tráfico en tiempo real</div>
                    <div style={{ fontFamily:config.secondaryFont, fontSize:"11px", color:"rgba(255,255,255,0.5)", lineHeight:"1.5" }}>Terminales · Patios · Carriles · Vialidades · Reportes</div>
                  </div>
                  <div style={{ marginTop:"8px" }}>
                    <input
                      ref={el => fileInputRefs.current["secondaryFont"] = el}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const fontName = file.name.split('.')[0];
                          const fontData = event.target.result;
                          const styleEl = document.createElement("style");
                          styleEl.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
                          document.head.appendChild(styleEl);
                          setConfig(prev => ({
                            ...prev,
                            customSecondaryFont: `'${fontName}', sans-serif`,
                            customSecondaryFontData: fontData,
                            secondaryFont: `'${fontName}', sans-serif`
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                      style={{ display:"none" }}
                    />
                    <button
                      onClick={() => fileInputRefs.current["secondaryFont"]?.click()}
                      style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(139,92,246,0.3)", background:"rgba(139,92,246,0.1)", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"600", cursor:"pointer" }}
                    >
                      📁 Subir Fuente Personalizada (.ttf, .otf, .woff)
                    </button>
                  </div>
                </div>
                
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Tamaño Base de Fuente: {config.baseFontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={config.baseFontSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, baseFontSize: parseInt(e.target.value) }))}
                    style={{ 
                      width:"100%", 
                      height:"6px",
                      borderRadius:"3px",
                      background:"linear-gradient(to right, #38bdf8 0%, #38bdf8 " + ((config.baseFontSize - 12) / 6 * 100) + "%, rgba(255,255,255,0.1) " + ((config.baseFontSize - 12) / 6 * 100) + "%, rgba(255,255,255,0.1) 100%)",
                      outline:"none",
                      cursor:"pointer",
                      WebkitAppearance:"none",
                      appearance:"none"
                    }}
                  />
                  <style>{`
                    input[type="range"]::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #38bdf8;
                      cursor: pointer;
                      border: 2px solid #0a1628;
                      box-shadow: 0 2px 8px rgba(56,189,248,0.5);
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #38bdf8;
                      cursor: pointer;
                      border: 2px solid #0a1628;
                      box-shadow: 0 2px 8px rgba(56,189,248,0.5);
                    }
                  `}</style>
                </div>
                
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Tamaño de Título: {config.titleFontSize}px
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="24"
                    step="1"
                    value={config.titleFontSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, titleFontSize: parseInt(e.target.value) }))}
                    style={{ 
                      width:"100%", 
                      height:"6px",
                      borderRadius:"3px",
                      background:"linear-gradient(to right, #a78bfa 0%, #a78bfa " + ((config.titleFontSize - 15) / 9 * 100) + "%, rgba(255,255,255,0.1) " + ((config.titleFontSize - 15) / 9 * 100) + "%, rgba(255,255,255,0.1) 100%)",
                      outline:"none",
                      cursor:"pointer",
                      WebkitAppearance:"none",
                      appearance:"none"
                    }}
                  />
                  <style>{`
                    input[type="range"]::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #a78bfa;
                      cursor: pointer;
                      border: 2px solid #0a1628;
                      box-shadow: 0 2px 8px rgba(167,139,250,0.5);
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: #a78bfa;
                      cursor: pointer;
                      border: 2px solid #0a1628;
                      box-shadow: 0 2px 8px rgba(167,139,250,0.5);
                    }
                  `}</style>
                </div>
                
                {/* ✨ NUEVO: Controles de Color de Texto */}
                <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", paddingTop:"20px", marginTop:"8px" }}>
                  <h4 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "secondary"), fontSize:"15px", color:"#fff", fontWeight:"600" }}>
                    🎨 Colores de Texto
                  </h4>
                  
                  <div style={{ display:"grid", gap:"16px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Texto Principal
                        </label>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <input
                            type="color"
                            value={config.textColors?.primary || "#ffffff"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, primary: e.target.value }
                            }))}
                            style={{ width:"48px", height:"48px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", cursor:"pointer" }}
                          />
                          <input
                            type="text"
                            value={config.textColors?.primary || "#ffffff"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, primary: e.target.value }
                            }))}
                            placeholder="#ffffff"
                            style={{ flex:1, padding:"10px 12px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"12px" }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Texto Secundario
                        </label>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <input
                            type="color"
                            value={config.textColors?.secondary || "#e2e8f0"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, secondary: e.target.value }
                            }))}
                            style={{ width:"48px", height:"48px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", cursor:"pointer" }}
                          />
                          <input
                            type="text"
                            value={config.textColors?.secondary || "#e2e8f0"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, secondary: e.target.value }
                            }))}
                            placeholder="#e2e8f0"
                            style={{ flex:1, padding:"10px 12px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"12px" }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Texto Atenuado
                        </label>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <input
                            type="color"
                            value={config.textColors?.muted || "#94a3b8"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, muted: e.target.value }
                            }))}
                            style={{ width:"48px", height:"48px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", cursor:"pointer" }}
                          />
                          <input
                            type="text"
                            value={config.textColors?.muted || "#94a3b8"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, muted: e.target.value }
                            }))}
                            placeholder="#94a3b8"
                            style={{ flex:1, padding:"10px 12px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"12px" }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Acentos/Links
                        </label>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <input
                            type="color"
                            value={config.textColors?.accent || "#38bdf8"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, accent: e.target.value }
                            }))}
                            style={{ width:"48px", height:"48px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"transparent", cursor:"pointer" }}
                          />
                          <input
                            type="text"
                            value={config.textColors?.accent || "#38bdf8"}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              textColors: { ...prev.textColors, accent: e.target.value }
                            }))}
                            placeholder="#38bdf8"
                            style={{ flex:1, padding:"10px 12px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"12px" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* CONTENT BOX SECTION */}
          {activeSection === "contentBox" && (
            <div>
              <h3 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", fontWeight:"600" }}>
                Ventanas de Contenido
              </h3>
              
              <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
                {/* Habilitar/Deshabilitar */}
                <div>
                  <label style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer" }}>
                    <input
                      type="checkbox"
                      checked={config.contentBox?.enabled ?? true}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        contentBox: { ...prev.contentBox, enabled: e.target.checked }
                      }))}
                      style={{ width:"18px", height:"18px", cursor:"pointer" }}
                    />
                    <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"#fff", fontWeight:"600" }}>
                      Habilitar ventanas con efecto glassmorphism
                    </span>
                  </label>
                  <p style={{ margin:"8px 0 0 28px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)" }}>
                    Si está deshabilitado, usará el estilo simple sin efectos
                  </p>
                </div>
                
                {config.contentBox?.enabled && (
                  <>
                    {/* Background Color */}
                    <div>
                      <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                        Color de Fondo Base
                      </label>
                      <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                        <div 
                          style={{ 
                            width:"48px", 
                            height:"48px", 
                            borderRadius:"8px", 
                            border:"1px solid rgba(255,255,255,0.2)", 
                            background: config.contentBox?.background || "rgba(255, 255, 255, 0.05)",
                            cursor:"pointer",
                            position:"relative",
                            overflow:"hidden"
                          }}
                          title="Vista previa del color"
                        >
                          <div style={{ 
                            position:"absolute", 
                            top:0, 
                            left:0, 
                            width:"100%", 
                            height:"100%", 
                            background:"url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"4\" height=\"4\" fill=\"%23333\"/><rect x=\"4\" y=\"4\" width=\"4\" height=\"4\" fill=\"%23333\"/></svg>')",
                            backgroundSize:"8px 8px",
                            zIndex:-1
                          }} />
                        </div>
                        <input
                          type="text"
                          value={config.contentBox?.background || "rgba(255, 255, 255, 0.05)"}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: { ...prev.contentBox, background: e.target.value }
                          }))}
                          placeholder="rgba(255, 255, 255, 0.05)"
                          style={{ flex:1, padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"12px" }}
                        />
                      </div>
                      <p style={{ margin:"6px 0 0", fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)" }}>
                        Soporta: hex (#rrggbb), rgb(r,g,b), rgba(r,g,b,a)
                      </p>
                    </div>
                    
                    {/* Backdrop Blur */}
                    <div>
                      <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                        Desenfoque (Blur): {config.contentBox?.backdropBlur || 12}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={config.contentBox?.backdropBlur || 12}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          contentBox: { ...prev.contentBox, backdropBlur: parseInt(e.target.value) }
                        }))}
                        style={{ width:"100%", height:"6px", borderRadius:"3px", cursor:"pointer" }}
                      />
                    </div>
                    
                    {/* Border */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Color de Borde
                        </label>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <div 
                            style={{ 
                              width:"36px", 
                              height:"36px", 
                              borderRadius:"6px", 
                              border:"1px solid rgba(255,255,255,0.2)", 
                              background: config.contentBox?.borderColor || "rgba(255, 255, 255, 0.1)",
                              cursor:"pointer",
                              position:"relative",
                              overflow:"hidden",
                              flexShrink:0
                            }}
                            title="Vista previa del borde"
                          >
                            <div style={{ 
                              position:"absolute", 
                              top:0, 
                              left:0, 
                              width:"100%", 
                              height:"100%", 
                              background:"url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"4\" height=\"4\" fill=\"%23333\"/><rect x=\"4\" y=\"4\" width=\"4\" height=\"4\" fill=\"%23333\"/></svg>')",
                              backgroundSize:"8px 8px",
                              zIndex:-1
                            }} />
                          </div>
                          <input
                            type="text"
                            value={config.contentBox?.borderColor || "rgba(255, 255, 255, 0.1)"}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              contentBox: { ...prev.contentBox, borderColor: e.target.value }
                            }))}
                            placeholder="rgba(255,255,255,0.1)"
                            style={{ flex:1, padding:"8px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:"'Space Mono', monospace", fontSize:"11px" }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Grosor: {config.contentBox?.borderWidth || 1}px
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="1"
                          value={config.contentBox?.borderWidth || 1}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: { ...prev.contentBox, borderWidth: parseInt(e.target.value) }
                          }))}
                          style={{ width:"100%", height:"6px", borderRadius:"3px", cursor:"pointer" }}
                        />
                      </div>
                    </div>
                    
                    {/* Border Radius & Padding */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Redondeo: {config.contentBox?.borderRadius || 12}px
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          step="1"
                          value={config.contentBox?.borderRadius || 12}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: { ...prev.contentBox, borderRadius: parseInt(e.target.value) }
                          }))}
                          style={{ width:"100%", height:"6px", borderRadius:"3px", cursor:"pointer" }}
                        />
                      </div>
                      <div>
                        <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                          Padding: {config.contentBox?.padding || 16}px
                        </label>
                        <input
                          type="range"
                          min="8"
                          max="32"
                          step="2"
                          value={config.contentBox?.padding || 16}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: { ...prev.contentBox, padding: parseInt(e.target.value) }
                          }))}
                          style={{ width:"100%", height:"6px", borderRadius:"3px", cursor:"pointer" }}
                        />
                      </div>
                    </div>
                    
                    {/* Gradient Overlay */}
                    <div>
                      <label style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", cursor:"pointer" }}>
                        <input
                          type="checkbox"
                          checked={config.contentBox?.gradientOverlay?.enabled ?? true}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: {
                              ...prev.contentBox,
                              gradientOverlay: { ...prev.contentBox?.gradientOverlay, enabled: e.target.checked }
                            }
                          }))}
                          style={{ width:"18px", height:"18px", cursor:"pointer" }}
                        />
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"#fff", fontWeight:"600" }}>
                          Degradado Superpuesto
                        </span>
                      </label>
                      
                      {config.contentBox?.gradientOverlay?.enabled && (
                        <input
                          type="text"
                          value={config.contentBox?.gradientOverlay?.gradient || ""}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: {
                              ...prev.contentBox,
                              gradientOverlay: { ...prev.contentBox?.gradientOverlay, gradient: e.target.value }
                            }
                          }))}
                          placeholder="linear-gradient(...)"
                          style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}
                        />
                      )}
                    </div>
                    
                    {/* Shadow */}
                    <div>
                      <label style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", cursor:"pointer" }}>
                        <input
                          type="checkbox"
                          checked={config.contentBox?.shadow?.enabled ?? true}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            contentBox: {
                              ...prev.contentBox,
                              shadow: { ...prev.contentBox?.shadow, enabled: e.target.checked }
                            }
                          }))}
                          style={{ width:"18px", height:"18px", cursor:"pointer" }}
                        />
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"#fff", fontWeight:"600" }}>
                          Sombra
                        </span>
                      </label>
                      
                      {config.contentBox?.shadow?.enabled && (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                          <div>
                            <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)" }}>
                              Color
                            </label>
                            <input
                              type="text"
                              value={config.contentBox?.shadow?.color || "rgba(0, 0, 0, 0.3)"}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                contentBox: {
                                  ...prev.contentBox,
                                  shadow: { ...prev.contentBox?.shadow, color: e.target.value }
                                }
                              }))}
                              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}
                            />
                          </div>
                          <div>
                            <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)" }}>
                              Blur: {config.contentBox?.shadow?.blur || 20}px
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="50"
                              step="2"
                              value={config.contentBox?.shadow?.blur || 20}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                contentBox: {
                                  ...prev.contentBox,
                                  shadow: { ...prev.contentBox?.shadow, blur: parseInt(e.target.value) }
                                }
                              }))}
                              style={{ width:"100%", height:"6px", borderRadius:"3px", cursor:"pointer" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Preview */}
                    <div>
                      <label style={{ display:"block", marginBottom:"12px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                        Vista Previa
                      </label>
                      <div style={{
                        ...getContentBoxStyle(config),
                        minHeight:"100px",
                        display:"flex",
                        alignItems:"center",
                        justifyContent:"center"
                      }}>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:config.primaryFont, fontSize:"18px", color:"#fff", marginBottom:"8px" }}>
                            Título de Ejemplo
                          </div>
                          <div style={{ fontFamily:config.secondaryFont, fontSize:`${config.baseFontSize}px`, color:"rgba(255,255,255,0.7)" }}>
                            Este es un texto de ejemplo dentro de una ventana de contenido. Así se verán las cajas de información en la app.
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* TAB ICONS SECTION */}
          {activeSection === "tabIcons" && (
            <div>
              <h3 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", fontWeight:"600" }}>
                Iconos de Pestañas
              </h3>
              
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"16px" }}>
                {TABS.map(tab => {
                  const icon = config.tabIcons[tab.key];
                  return (
                    <div key={tab.key} style={{ padding:"16px", borderRadius:"8px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
                        {icon.type === "emoji" ? (
                          <span style={{ fontSize:`${icon.size}px` }}>{icon.value}</span>
                        ) : (
                          <img src={icon.value} alt={tab.label} style={{ width:`${icon.size}px`, height:`${icon.size}px`, objectFit:"contain" }} />
                        )}
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"#fff", fontWeight:"600" }}>{tab.label}</span>
                      </div>
                      
                      <div style={{ marginBottom:"8px" }}>
                        <input
                          type="text"
                          value={icon.type === "emoji" ? icon.value : ""}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            tabIcons: {
                              ...prev.tabIcons,
                              [tab.key]: { ...prev.tabIcons[tab.key], type: "emoji", value: e.target.value }
                            }
                          }))}
                          placeholder="Emoji"
                          style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}
                        />
                      </div>
                      
                      <input
                        ref={el => fileInputRefs.current[`tab_${tab.key}`] = el}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIconImageUpload(tab.key, "tabs", e)}
                        style={{ display:"none" }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[`tab_${tab.key}`]?.click()}
                        style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"600", cursor:"pointer" }}
                      >
                        📁 Subir Imagen
                      </button>
                      
                      <div style={{ marginTop:"8px" }}>
                        <label style={{ display:"block", marginBottom:"4px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)" }}>
                          Tamaño: {icon.size}px
                        </label>
                        <input
                          type="range"
                          min="16"
                          max="32"
                          value={icon.size}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            tabIcons: {
                              ...prev.tabIcons,
                              [tab.key]: { ...prev.tabIcons[tab.key], size: parseInt(e.target.value) }
                            }
                          }))}
                          style={{ width:"100%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* OTHER ICONS SECTION */}
          {activeSection === "otherIcons" && (
            <div>
              <h3 style={{ margin:"0 0 16px", fontFamily:getFont(theme, "title"), fontSize:"18px", color:"#fff", fontWeight:"600" }}>
                Otros Iconos de la Interfaz
              </h3>
              
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"16px" }}>
                {Object.entries(config.otherIcons).map(([key, icon]) => {
                  const labels = {
                    live: "👁 Visitas",
                    admin: "🔑 Admin",
                    session: "👤 Sesión",
                    logout: "🚪 Cerrar Sesión"
                  };
                  
                  return (
                    <div key={key} style={{ padding:"16px", borderRadius:"8px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
                        {icon.type === "emoji" ? (
                          <span style={{ fontSize:`${icon.size}px` }}>{icon.value}</span>
                        ) : (
                          <img src={icon.value} alt={key} style={{ width:`${icon.size}px`, height:`${icon.size}px`, objectFit:"contain" }} />
                        )}
                        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"#fff", fontWeight:"600" }}>{labels[key]}</span>
                      </div>
                      
                      <div style={{ marginBottom:"8px" }}>
                        <input
                          type="text"
                          value={icon.type === "emoji" ? icon.value : ""}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            otherIcons: {
                              ...prev.otherIcons,
                              [key]: { ...prev.otherIcons[key], type: "emoji", value: e.target.value }
                            }
                          }))}
                          placeholder="Emoji"
                          style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}
                        />
                      </div>
                      
                      <input
                        ref={el => fileInputRefs.current[`other_${key}`] = el}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIconImageUpload(key, "other", e)}
                        style={{ display:"none" }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[`other_${key}`]?.click()}
                        style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"600", cursor:"pointer" }}
                      >
                        📁 Subir Imagen
                      </button>
                      
                      <div style={{ marginTop:"8px" }}>
                        <label style={{ display:"block", marginBottom:"4px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)" }}>
                          Tamaño: {icon.size}px
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="24"
                          value={icon.size}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            otherIcons: {
                              ...prev.otherIcons,
                              [key]: { ...prev.otherIcons[key], size: parseInt(e.target.value) }
                            }
                          }))}
                          style={{ width:"100%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ padding:"16px 24px", background:"rgba(0,0,0,0.3)", borderTop:"1px solid rgba(255,255,255,0.08)", display:"flex", gap:"12px", justifyContent:"space-between" }}>
          <button
            onClick={handleReset}
            style={{ padding:"12px 20px", borderRadius:"8px", border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.15)", color:"#ef4444", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"600", cursor:"pointer" }}
          >
            🔄 Restaurar
          </button>
          
          <div style={{ display:"flex", gap:"12px" }}>
            {previewMode && (
              <button
                onClick={handleCancel}
                style={{ padding:"12px 20px", borderRadius:"8px", border:"1px solid rgba(251,191,36,0.4)", background:"rgba(251,191,36,0.15)", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"600", cursor:"pointer" }}
              >
                ❌ Cancelar Preview
              </button>
            )}
            <button
              onClick={handleApplyToAll}
              disabled={saving}
              style={{ 
                padding:"12px 24px", 
                borderRadius:"8px", 
                border:"1px solid rgba(34,197,94,0.5)", 
                background: saving ? "rgba(100,100,100,0.2)" : "rgba(34,197,94,0.2)", 
                color: saving ? "#999" : "#22c55e", 
                fontFamily:getFont(theme, "secondary"), 
                fontSize:"14px", 
                fontWeight:"700", 
                cursor: saving ? "not-allowed" : "pointer",
                display:"flex",
                alignItems:"center",
                gap:"8px"
              }}
            >
              {saving ? "⏳ Aplicando..." : "🌍 Aplicar a Todos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavBar({ active, set }) {
  const theme = React.useContext(ThemeContext);
  const row1 = [
    { id: "inicio",      label: "Inicio",      icon: "🏠"  },
    { id: "trafico",     label: "Tráfico",     icon: "🗺️" },
    { id: "reporte",     label: "Reportar",    icon: "📍"  },
    { id: "terminales",  label: "Terminales",  icon: "⚓"  },
    { id: "patio",       label: "Patios",      icon: "🏭"  },
  ];
  const row2 = [
    { id: "segundo",    label: "Confinados", icon: "🚪"  },
    { id: "carriles",   label: "Carriles",   icon: "🚦"  },
    { id: "noticias",   label: "Noticias",   icon: "📰"  },
    { id: "donativos",  label: "Donativos",  icon: "💙"  },
    { id: "tutorial",   label: "Más Info",   icon: "📖"  },
  ];

  const TabBtn = (t) => {
    const [isHovered, setIsHovered] = useState(false);
    const isActive = active === t.id;
    
    return (
      <button 
        key={t.id} 
        onClick={() => set(t.id)} 
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => {
          // Evitar el comportamiento de hover en móviles
          e.preventDefault();
          set(t.id);
        }}
        style={{
          flex: 1, 
          padding: "9px 4px",
          background: isActive ? "rgba(255,255,255,0.15)" : (isHovered ? "rgba(255,255,255,0.05)" : "transparent"),
          border: "none",
          borderBottom: isActive ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent",
          color: isActive ? "#ffffff" : (isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)"),
          fontSize: "9px", 
          fontFamily: getFont(theme, "secondary"), 
          fontWeight: isActive ? "600" : "400",
          cursor: "pointer", 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          gap: "3px", 
          transition: "all 0.2s",
          letterSpacing: "0.5px", 
          whiteSpace: "nowrap", 
          minWidth: "0",
          WebkitTapHighlightColor: "transparent",
          MozTapHighlightColor: "transparent",
          outline: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation"
        }}
        onFocus={(e) => { e.currentTarget.style.outline = "none"; }}
        onMouseEnter={() => {
          if (!isActive) setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
        <span style={{ fontSize: "14px" }}>{t.icon}</span>
        {t.label.toUpperCase()}
      </button>
    );
  };

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

// --- CONVOY SCENE ---
function ConvoyScene({ accentColor }) {
  const c = accentColor || "#38bdf8";

  // Usamos un id unico por instancia para no colisionar keyframes entre tarjetas
  const uid = accentColor ? accentColor.replace('#','') : 'def';

  const sceneRef     = useRef(null);
  const truckRef     = useRef(null);
  const cableRef     = useRef(null);
  const boxRef       = useRef(null);
  const xRef         = useRef(-220);
  const stateRef     = useRef('driving'); // driving | stopping | lifting | exit
  const rafRef       = useRef(null);

  useEffect(() => {
    let paused = false;

    function step() {
      if (paused) return;
      const scene  = sceneRef.current;
      const truck  = truckRef.current;
      const cable  = cableRef.current;
      const box    = boxRef.current;
      if (!scene || !truck || !cable || !box) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const W      = scene.offsetWidth || 360;
      const GRUA_X = W * 0.5 - 105; // punto donde el trailer queda bajo la grua

      if (stateRef.current === 'driving') {
        xRef.current += 2;
        truck.style.left = xRef.current + 'px';
        if (xRef.current >= GRUA_X) {
          stateRef.current = 'stopping';
          // Bajar cable
          cable.style.transition = 'height 1.2s ease-in-out';
          cable.style.height = '50px';
          setTimeout(() => {
            // Quitar contenedor del trailer
            box.style.transition = 'opacity 0.3s';
            box.style.opacity    = '0';
            cable.style.transition = 'height 1.1s ease-in-out';
            cable.style.height   = '12px';
            setTimeout(() => {
              stateRef.current = 'exit';
            }, 1200);
          }, 1300);
        }
      } else if (stateRef.current === 'exit') {
        xRef.current += 2;
        truck.style.left = xRef.current + 'px';
        if (xRef.current > W + 20) {
          // Reset
          xRef.current = -220;
          truck.style.left = '-220px';
          cable.style.transition = 'none';
          cable.style.height = '12px';
          box.style.transition   = 'none';
          box.style.opacity      = '1';
          stateRef.current = 'driving';
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      paused = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={sceneRef} style={{ position:"relative", width:"100%", height:"90px", overflow:"hidden", borderRadius:"8px", marginBottom:"10px", pointerEvents:"none" }}>

      {/* Fondo ciudad portuaria */}
      <svg width="100%" height="90" viewBox="0 0 800 90" preserveAspectRatio="xMidYMid slice"
           style={{position:"absolute",top:0,left:0}}>
        <defs>
          <linearGradient id={`csbg${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#060e1a"/>
            <stop offset="67%" stopColor="#0d1f3c"/>
            <stop offset="67%" stopColor="#37474f"/>
            <stop offset="100%" stopColor="#263238"/>
          </linearGradient>
        </defs>
        <rect width="800" height="90" fill={`url(#csbg${uid})`}/>
        {/* Montañas */}
        <polygon points="0,52 80,26 160,46 240,20 330,42 420,16 510,38 600,14 690,34 770,18 800,28 800,62 0,62" fill="#0a1828" opacity="0.85"/>
        {/* Edificios izquierda */}
        <rect x="10" y="34" width="12" height="28" fill="#0e2238"/><rect x="10" y="32" width="12" height="4" fill="#142d4c"/>
        <rect x="28" y="26" width="9"  height="36" fill="#0f2540"/><rect x="28" y="24" width="9"  height="4" fill="#1a3a5c"/>
        <rect x="44" y="38" width="14" height="24" fill="#0d1f3a"/>
        <rect x="64" y="22" width="7"  height="40" fill="#0e2238"/><rect x="64" y="20" width="7"  height="4" fill="#1a3a5c"/>
        <rect x="78" y="30" width="11" height="32" fill="#0f2540"/>
        {/* Edificios derecha */}
        <rect x="660" y="24" width="10" height="38" fill="#0e2238"/><rect x="660" y="22" width="10" height="4" fill="#1a3a5c"/>
        <rect x="678" y="16" width="14" height="46" fill="#0d1e38"/><rect x="678" y="14" width="14" height="4" fill="#142d4c"/>
        <rect x="700" y="28" width="9"  height="34" fill="#0f2540"/><rect x="700" y="26" width="9"  height="4" fill="#142d4c"/>
        <rect x="716" y="20" width="12" height="42" fill="#0e2238"/><rect x="716" y="18" width="12" height="4" fill="#1a3a5c"/>
        <rect x="736" y="32" width="8"  height="30" fill="#0d1f3a"/>
        <rect x="752" y="22" width="11" height="40" fill="#0f2540"/><rect x="752" y="20" width="11" height="4" fill="#142d4c"/>
        <rect x="770" y="18" width="9"  height="44" fill="#0e2036"/><rect x="770" y="16" width="9"  height="4" fill="#1a3a5c"/>
        {/* Ventanas */}
        <rect x="12"  y="36" width="3" height="2" fill={c} fillOpacity="0.2"/>
        <rect x="66"  y="24" width="3" height="2" fill={c} fillOpacity="0.16"/>
        <rect x="662" y="26" width="3" height="2" fill={c} fillOpacity="0.18"/>
        <rect x="680" y="18" width="3" height="2" fill={c} fillOpacity="0.14"/>
        <rect x="718" y="22" width="3" height="2" fill={c} fillOpacity="0.20"/>
        <rect x="754" y="24" width="3" height="2" fill={c} fillOpacity="0.16"/>
        {/* Mar */}
        <rect x="0" y="62" width="800" height="28" fill="#071526"/>
        <line x1="0" y1="62" x2="800" y2="62" stroke={c} strokeOpacity="0.14" strokeWidth="1"/>
        <path d="M0,65 Q100,63 200,65 Q300,67 400,65 Q500,63 600,65 Q700,67 800,65" stroke={c} strokeOpacity="0.07" strokeWidth="0.8" fill="none"/>
        {/* Asfalto */}
        <rect x="0" y="58" width="800" height="6" fill="#111827"/>
        {[0,50,100,150,200,250,300,350,400,450,500,550,600,650,700,750].map((x,i) => (
          <rect key={i} x={x} y="60" width="28" height="1" fill="rgba(255,255,255,0.07)"/>
        ))}
      </svg>

      {/* Monumento Pez Vela — fijo izquierda */}
      <div style={{ position:"absolute", bottom:"17px", left:"10px", width:"40px", zIndex:3, opacity:0.85 }}>
        <svg viewBox="0 0 1000 800" width="40" height="32">
          <g fill="#2C8FEA" stroke="#2575C2" strokeWidth="2">
            <path d="M400,320 C350,280 200,240 180,240 L220,100 C240,110 380,180 400,320 Z"/>
            <path d="M400,320 C410,180 520,110 540,100 L580,240 C560,240 450,280 400,320 Z"/>
            <path d="M780,260 C820,280 620,320 620,320 A150,150 0 1,0 620,620 L700,700 L800,700 L720,650 A210,210 0 1,1 620,280 C620,280 820,320 780,260 Z"/>
            <path d="M780,260 L850,285 L770,310 Z"/>
            <path d="M700,700 L840,700 L760,650 Z"/>
          </g>
        </svg>
      </div>

      {/* Grúa portuaria — fija al 50% */}
      <div style={{ position:"absolute", bottom:"17px", left:"50%", transform:"translateX(-50%)", zIndex:10, width:"72px" }}>
        <svg viewBox="0 0 100 76" width="72" height="55" style={{display:"block"}}>
          {/* Torre */}
          <rect x="42" y="0"  width="12" height="76" fill="#fbc02d"/>
          {/* Pluma */}
          <rect x="4"  y="0"  width="82" height="9"  fill="#fbc02d"/>
          {/* Tirantes */}
          <line x1="48" y1="0" x2="12" y2="9" stroke="#f9a825" strokeWidth="2.5"/>
          <line x1="48" y1="0" x2="84" y2="9" stroke="#f9a825" strokeWidth="2.5"/>
          {/* Contrapeso */}
          <rect x="4"  y="1"  width="14" height="12" fill="#e65100"/>
          {/* Ruedas */}
          <circle cx="36" cy="76" r="4" fill="#1e293b"/>
          <circle cx="60" cy="76" r="4" fill="#1e293b"/>
        </svg>
        {/* Cable animado con ref */}
        <div ref={cableRef} style={{
          position:"absolute", top:"9px", left:"34px",
          width:"4px", height:"12px",
          background:"#2d2d2d", borderRadius:"0 0 2px 2px"
        }}>
          {/* Spreader */}
          <div style={{ position:"absolute", bottom:0, left:"-13px", width:"30px", height:"5px", background:"#1e293b", borderRadius:"1px" }}/>
        </div>
      </div>

      {/* Tráiler animado */}
      <div ref={truckRef} style={{ position:"absolute", bottom:"17px", left:"-220px", zIndex:5 }}>
        <svg viewBox="0 0 210 48" width="210" height="48" style={{display:"block", overflow:"visible"}}>
          {/* Chasis */}
          <rect x="0" y="38" width="210" height="5" rx="1" fill="#1e293b"/>
          {/* Cabina — derecha = frente de marcha (va izq→der... espera, va der→izq, cabina a la izquierda) */}
          <path d="M138,10 h38 a16,16 0 0 1 16,16 v18 h-54 z" fill="#1e3a5f" stroke={c} strokeOpacity="0.5" strokeWidth="0.8"/>
          <rect x="142" y="13" width="18" height="11" rx="2" fill={c} fillOpacity="0.28"/>
          <rect x="162" y="13" width="10" height="11" rx="1" fill={c} fillOpacity="0.14"/>
          <rect x="190" y="16" width="4" height="5"  rx="1" fill="#fef08a" fillOpacity="0.95"/>
          <rect x="0"   y="30" width="4" height="6"  rx="1" fill="#ef4444" fillOpacity="0.8"/>
          {/* Ruedas */}
          <circle cx="20"  cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="20"  cy="45" r="2.4" fill="#1e293b"/>
          <circle cx="38"  cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="38"  cy="45" r="2.4" fill="#1e293b"/>
          <circle cx="90"  cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="90"  cy="45" r="2.4" fill="#1e293b"/>
          <circle cx="108" cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="108" cy="45" r="2.4" fill="#1e293b"/>
          <circle cx="155" cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="155" cy="45" r="2.4" fill="#1e293b"/>
          <circle cx="188" cy="45" r="6" fill="#0f172a" stroke="#64748b" strokeWidth="1.2"/><circle cx="188" cy="45" r="2.4" fill="#1e293b"/>
        </svg>
        {/* Contenedor — separado del SVG para poder animarlo con ref */}
        <div ref={boxRef} style={{
          position:"absolute", bottom:"13px", left:"0px",
          width:"136px", height:"28px",
          background: c, opacity:1,
          borderRadius:"2px",
          border:"1px solid rgba(255,255,255,0.15)"
        }}>
          <div style={{position:"absolute",left:"45px", top:0,bottom:0,width:"1px",background:"rgba(255,255,255,0.18)"}}/>
          <div style={{position:"absolute",left:"90px", top:0,bottom:0,width:"1px",background:"rgba(255,255,255,0.18)"}}/>
          <div style={{position:"absolute",right:0,    top:0,bottom:0,width:"6px",background:"rgba(0,0,0,0.2)",borderRadius:"0 2px 2px 0"}}/>
        </div>
      </div>
    </div>
  );
}

// --- SKELETON CARD ---
function SkeletonCard({ n = 3 }) {
  const theme = React.useContext(ThemeContext);
  return (
    <div style={{ padding:"16px" }}>
      <style>{`@keyframes sk_pulse{0%,100%{opacity:.35}50%{opacity:.8}}`}</style>
      {Array.from({length:n}).map((_,i) => (
        <div key={i} style={{ height:"76px", background:"rgba(255,255,255,0.06)", borderRadius:"12px", marginBottom:"12px", animation:"sk_pulse 1.5s ease-in-out infinite", animationDelay: i*0.15+"s" }}/>
      ))}
    </div>
  );
}


function TraficoTab({ myId, incidents, setIncidents, isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [accesos,     setAccesos]     = useState(null);   // null = loading
  const [vialidades,  setVialidades]  = useState(null);  // null = loading
  const [toast,       setToast]       = useState(null);
  const [activeSection, setActiveSection] = useState(() => {
    try { return sessionStorage.getItem("trafico_section") || "mapa"; } catch { return "mapa"; }
  });
  const setActiveSectionPersist = (s) => {
    try { sessionStorage.setItem("trafico_section", s); } catch {}
    setActiveSection(s);
  };

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  // -- Accesos --
  useEffect(() => {
    sb.from("accesos").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("accesos").upsert(ACCESOS_PRINCIPALES.map(a => ({ id: a.id, status: "libre", retornos: "none", last_update: Date.now(), updated_by: "Sistema" })));
        setAccesos(mkAccesos());
        return;
      }
      const map = {};
      data.forEach(r => { map[r.id] = { status: r.status, retornos: r.retornos || "none", lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
      setAccesos({ ...mkAccesos(), ...map });
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

  // -- Vialidades --
  useEffect(() => {
    sb.from("vialidades").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("vialidades").upsert(VIALIDADES.map(v => ({ id: v.id, status: "libre", last_update: Date.now(), updated_by: "Sistema" })));
        setVialidades(mkVialidades());
        return;
      }
      const map = {};
      data.forEach(r => { map[r.id] = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} }; });
      setVialidades({ ...mkVialidades(), ...map });
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
    const acc = accesos?.[id];
    if (!acc) return;
    if (acc.status === newStatus) return notify("Ya tiene ese estado", "#f97316");
    if (isAdmin) {
      setAccesos(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus, lastUpdate: Date.now(), updatedBy: "⚡ Admin" } }));
      await sb.from("accesos").upsert({ id, status: newStatus, retornos: acc.retornos, last_update: Date.now(), updated_by: "⚡ Admin", pending_voters: {} });
      notify(`⚡ ${ACCESO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label}`, "#38bdf8");
      await publicarNoticia({ tipo: "acceso", icono: "⚓", color: "#38bdf8", titulo: "Acceso actualizado (Admin)", detalle: `${ACCESOS_PRINCIPALES.find(a => a.id === id)?.label}: ${ACCESO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label}` });
      return;
    }
    const rl = rateLimiter.check(`acceso_${myId}_${id}`, 20000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s`, "#f97316");
    const label = ACCESO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label;
    const accLabel = ACCESOS_PRINCIPALES.find(a => a.id === id)?.label;
    // Optimistic update — refleja el cambio al instante
    setAccesos(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus, lastUpdate: Date.now(), updatedBy: `Usuario_${myId.slice(-4)}` } }));
    await sb.from("accesos").upsert({ id, status: newStatus, retornos: acc.retornos, last_update: Date.now(), updated_by: `Usuario_${myId.slice(-4)}`, pending_voters: {} });
    notify(`✓ Acceso actualizado: ${label}`, "#22c55e");
    await publicarNoticia({ tipo: "acceso", icono: "⚓", color: "#38bdf8", titulo: `Acceso actualizado`, detalle: `${accLabel}: ${label}` });
  };

  const voteVialidad = async (id, newStatus) => {
    const v = vialidades?.[id];
    if (!v) return;
    if (v.status === newStatus) return notify("Ya tiene ese estado", "#f97316");
    if (isAdmin) {
      setVialidades(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus, lastUpdate: Date.now(), updatedBy: "⚡ Admin" } }));
      await sb.from("vialidades").upsert({ id, status: newStatus, last_update: Date.now(), updated_by: "⚡ Admin", pending_voters: {} });
      notify(`⚡ ${VIALIDADES.find(x => x.id === id)?.name}: ${VIALIDAD_STATUS_OPTIONS.find(o => o.id === newStatus)?.label}`, "#38bdf8");
      return;
    }
    const rl = rateLimiter.check(`vialidad_${myId}_${id}`, 20000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s`, "#f97316");
    const vName = VIALIDADES.find(x => x.id === id)?.name;
    const label = VIALIDAD_STATUS_OPTIONS.find(o => o.id === newStatus)?.label;
    // Optimistic update
    setVialidades(prev => ({ ...prev, [id]: { ...prev[id], status: newStatus, lastUpdate: Date.now(), updatedBy: `Usuario_${myId.slice(-4)}` } }));
    await sb.from("vialidades").upsert({ id, status: newStatus, last_update: Date.now(), updated_by: `Usuario_${myId.slice(-4)}`, pending_voters: {} });
    notify(`✓ ${vName}: ${label}`, "#22c55e");
    await publicarNoticia({ tipo: "vialidad", icono: "🛣️", color: "#38bdf8", titulo: `Vialidad actualizada`, detalle: `${vName}: ${label}` });
  };

  const activeIncidents = incidents.filter(i => i.visible && !i.resolved);

  // Helper para renderizar tarjeta de incidente/accidente
  const renderIncidentCard = (inc) => {
    const t = INCIDENT_TYPES.find(x => x.id === inc.type) || INCIDENT_TYPES[0];
    const conf = Object.values(inc.votes).filter(v => v === 1).length;
    return (
      <div key={inc.id} style={{ background: "rgba(255,255,255,0.06)", border: `2px solid ${t.color}55`, borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px" }}>
          <span style={{ fontSize: "22px" }}>{t.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: t.color, fontFamily: getFont(theme, "secondary"), fontSize: "13px", fontWeight: "700" }}>{t.label.toUpperCase()}</div>
            <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "14px", marginTop: "2px" }}>{inc.location}</div>
            {inc.desc && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "2px" }}>{inc.desc}</div>}
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", fontFamily: getFont(theme, "secondary"), marginTop: "4px" }}>{timeAgo(inc.ts)}</div>
          </div>
          <Badge color={t.color} small>ACTIVO</Badge>
        </div>
        <VoteBar count={conf} needed={15} color={t.color} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "10px" }}>
          <button onClick={() => voteConfirm(inc.id)} style={{ padding: "8px", background: "#22c55e15", border: "1px solid #22c55e44", borderRadius: "8px", color: "#22c55e", fontFamily: getFont(theme, "secondary"), fontSize: "13px", cursor: "pointer", fontWeight: "700" }}>✅ CONFIRMAR</button>
          <button onClick={() => voteResolve(inc.id)} style={{ padding: "8px", background: "#6b728015", border: "1px solid #6b728044", borderRadius: "8px", color: "#94a3b8", fontFamily: getFont(theme, "secondary"), fontSize: "13px", cursor: "pointer", fontWeight: "700" }}>🏁 RESUELTO</button>
        </div>
      </div>
    );
  };

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
    { id: "accidentes",  label: "Accidentes",  icon: "🚨" },
  ];

  return (
    <div style={{ paddingBottom: "80px" }}>

      {/* -- Sub-tabs -- */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", position: "sticky", top: 0, zIndex: 50 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSectionPersist(s.id)} style={{
            flex: 1, padding: "10px 4px", background: "transparent", border: "none",
            borderBottom: activeSection === s.id ? "2px solid #38bdf8" : "2px solid transparent",
            color: activeSection === s.id ? "#38bdf8" : "rgba(255,255,255,0.4)",
            fontSize: "12px", fontFamily: getFont(theme, "secondary"), fontWeight: activeSection === s.id ? "700" : "400",
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
          }}>
            <span style={{ fontSize: "16px" }}>{s.icon}</span>
            {s.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ---
          SECCIÓN: MAPA
      --- */}
      {activeSection === "mapa" && (
        <div style={{ padding: "16px" }}>
          <MapaTrafico incidents={incidents} accesos={accesos} vialidades={vialidades} />
        </div>
      )}

      {/* ---
          SECCIÓN: ACCESOS
      --- */}
      {activeSection === "accesos" && (
        <div style={{ padding: "16px" }}>
          <style>{`@media(min-width:640px){.acc-btn-grid{grid-template-columns:repeat(4,1fr)!important;}}`}</style>
          <MapaAccesos accesos={accesos} />
          <TypewriterTicker items={!accesos ? [] : ACCESOS_PRINCIPALES.map(acc => {
            const st = accesos[acc.id] || { status: "libre" };
            const opt = ACCESO_STATUS_OPTIONS.find(o => o.id === st.status) || ACCESO_STATUS_OPTIONS[0];
            return { text: `${acc.label} — ${opt.label.toUpperCase()}`, color: opt.color };
          })} />
          {!accesos ? <SkeletonCard n={3}/> : ACCESOS_PRINCIPALES.map(acc => {
            const st = accesos[acc.id] || { status: "libre", retornos: "none", lastUpdate: Date.now(), updatedBy: "Sistema" };
            const curOpt = ACCESO_STATUS_OPTIONS.find(o => o.id === st.status) || ACCESO_STATUS_OPTIONS[0];
            return (
              <div key={acc.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${acc.color}33`, borderRadius: "14px", padding: "14px", marginBottom: "12px", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div>
                    <div style={{ color: acc.color, fontFamily: getFont(theme, "title"), fontSize: "15px", fontWeight: "700" }}>{acc.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontFamily: getFont(theme, "secondary"), marginTop: "2px" }}>{acc.zona} · {timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                  </div>
                  <div style={{ background: curOpt.color + "22", border: `1px solid ${curOpt.color}66`, color: curOpt.color, padding: "5px 12px", borderRadius: "8px", fontFamily: getFont(theme, "secondary"), fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>{curOpt.icon} {curOpt.label}</div>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", marginBottom: "8px" }}>REPORTAR ESTADO:</div>
                <div className="acc-btn-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {ACCESO_STATUS_OPTIONS.map(o => (
                    <button key={o.id} onClick={() => voteAcceso(acc.id, o.id)} style={{ padding: "11px 8px", background: st.status === o.id ? o.color + "33" : "#0a1628", border: `1px solid ${st.status === o.id ? o.color : "#1e3a5f"}`, borderRadius: "8px", color: st.status === o.id ? o.color : "#64748b", fontFamily: getFont(theme, "secondary"), fontSize: "13px", cursor: "pointer", fontWeight: st.status === o.id ? "700" : "400", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", transition: "all 0.15s" }}>
                      <span style={{ fontSize: "15px" }}>{o.icon}</span>{o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---
          SECCIÓN: VIALIDADES
      --- */}
      {activeSection === "vialidades" && (
        <div style={{ padding: "16px" }}>
          <style>{`@media(min-width:640px){.vial-btn-grid{grid-template-columns:repeat(4,1fr)!important;}}`}</style>
          <MapaVialidades vialidades={vialidades} />
          <TypewriterTicker items={!vialidades ? [] : VIALIDADES.map(v => {
            const st = vialidades[v.id] || { status: "libre" };
            const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === st.status) || VIALIDAD_STATUS_OPTIONS[0];
            return { text: `${v.name} — ${opt.label.toUpperCase()}`, color: opt.color };
          })} />
          {!vialidades ? <SkeletonCard n={3}/> : VIALIDADES.map(v => {
            const st = vialidades[v.id] || { status: "libre", lastUpdate: Date.now(), updatedBy: "Sistema" };
            const curOpt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === st.status) || VIALIDAD_STATUS_OPTIONS[0];
            return (
              <div key={v.id} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${curOpt.color}44`, borderRadius: "12px", padding: "12px", marginBottom: "10px", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "14px", fontWeight: "600" }}>{v.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", fontFamily: getFont(theme, "secondary"), marginTop: "2px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                  </div>
                  <div style={{ background: curOpt.color + "22", border: `1px solid ${curOpt.color}66`, color: curOpt.color, padding: "4px 10px", borderRadius: "6px", fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>{curOpt.icon} {curOpt.label}</div>
                </div>
                <div className="vial-btn-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                  {VIALIDAD_STATUS_OPTIONS.map(o => (
                    <button key={o.id} onClick={() => voteVialidad(v.id, o.id)} style={{ padding: "10px 8px", background: st.status === o.id ? o.color + "33" : "#0a1628", border: `1px solid ${st.status === o.id ? o.color : "#1e3a5f"}`, borderRadius: "7px", color: st.status === o.id ? o.color : "#64748b", fontFamily: getFont(theme, "secondary"), fontSize: "12px", cursor: "pointer", fontWeight: st.status === o.id ? "700" : "400", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}>
                      <span style={{ fontSize: "14px" }}>{o.icon}</span>{o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---
          SECCIÓN: INCIDENTES
      --- */}
      {/* ---
          SECCIÓN: INCIDENTES
      --- */}
      {activeSection === "incidentes" && (
        <div style={{ padding: "16px" }}>
          {/* Mapa solo con incidentes */}
          <MapaEventos incidents={activeIncidents.filter(i => i.type === "incidente")} />
          <div style={{ marginTop: "16px" }}>
            {activeIncidents.filter(i => i.type === "incidente").length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.25)", fontFamily: getFont(theme, "secondary"), fontSize: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
                Sin incidentes activos en este momento
              </div>
            ) : activeIncidents.filter(i => i.type === "incidente").map(inc => renderIncidentCard(inc))}
          </div>
        </div>
      )}

      {/* ---
          SECCIÓN: ACCIDENTES
      --- */}
      {activeSection === "accidentes" && (
        <div style={{ padding: "16px" }}>
          {/* Mapa solo con accidentes */}
          <MapaEventos incidents={activeIncidents.filter(i => i.type === "accidente")} />
          <div style={{ marginTop: "16px" }}>
            {activeIncidents.filter(i => i.type === "accidente").length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.25)", fontFamily: getFont(theme, "secondary"), fontSize: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>✅</div>
                Sin accidentes activos en este momento
              </div>
            ) : activeIncidents.filter(i => i.type === "accidente").map(inc => renderIncidentCard(inc))}
          </div>
        </div>
      )}

      <ToastBox toast={toast} />

    </div>
  );
}

// --- MAPA DE ACCESOS (Polígonos Leaflet — Pez Vela, Puerta 15, Zona Norte) ---
const ACCESO_POLYGONS = [
  {
    id: "pezvela",
    name: "Acceso Pez Vela",
    color: "#a78bfa",
    coords: [
      [19.07727442823635,-104.2875800770409],[19.07629253261736,-104.2877292283769],
      [19.07615088491381,-104.2868412884972],[19.0764817502675,-104.2867799120668],
      [19.07649521015128,-104.2868511856857],[19.07714965512969,-104.2867251059351],
      [19.07727442823635,-104.2875800770409],
    ],
  },
  {
    id: "puerta15",
    name: "Acceso Puerta 15",
    color: "#34d399",
    coords: [
      [19.07789914021028,-104.2886263532717],[19.07777484878713,-104.288514650122],
      [19.07789227497389,-104.2883455186732],[19.07802134149496,-104.2884734204219],
      [19.07789914021028,-104.2886263532717],
    ],
  },
  {
    id: "zonanorte",
    name: "Acceso Zona Norte",
    color: "#38bdf8",
    coords: [
      [19.08674185086953,-104.2968903999984],[19.08704712309154,-104.2969844176178],
      [19.08672247073757,-104.2983679102416],[19.08644827095395,-104.2982655501238],
      [19.08674185086953,-104.2968903999984],
    ],
  },
];

function MapaAccesos({ accesos }) {
  const theme     = React.useContext(ThemeContext);
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const polyRefs  = useRef({});
  const tileRef   = useRef(null);
  const labelRef  = useRef(null);
  const [tileMode, setTileMode] = useState("dark");

  const TILE_OPTIONS = [
    { id: "dark",      label: "Noche",    icon: "🌙", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",                                                   subdomains: "abcd", labels: null },
    { id: "streets",   label: "Calles",   icon: "🗺️", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                                                              subdomains: "abc",  labels: null },
    { id: "satellite", label: "Satélite", icon: "🛰️", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",                   subdomains: "",     labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" },
    { id: "light",     label: "Claro",    icon: "☀️", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",                                                  subdomains: "abcd", labels: null },
  ];

  const getColor = (id) => {
    if (!accesos || !accesos[id]) return ACCESO_POLYGONS.find(p => p.id === id)?.color || "#22c55e";
    const opt = ACCESO_STATUS_OPTIONS.find(o => o.id === accesos[id].status);
    return opt ? opt.color : ACCESO_POLYGONS.find(p => p.id === id)?.color || "#22c55e";
  };

  useEffect(() => {
    const init = () => {
      if (leafRef.current || !mapRef.current || !window.L) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [19.081, -104.292],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      tileRef.current = L.tileLayer(TILE_OPTIONS[0].url, { maxZoom: 19, subdomains: TILE_OPTIONS[0].subdomains }).addTo(map);
      leafRef.current = map;

      ACCESO_POLYGONS.forEach(poly => {
        const color = getColor(poly.id);
        const layer = L.polygon(poly.coords, {
          color, weight: 3, opacity: 1, fillColor: color, fillOpacity: 0.45,
        }).addTo(map);
        const opt = ACCESO_STATUS_OPTIONS.find(o => o.id === accesos?.[poly.id]?.status) || ACCESO_STATUS_OPTIONS[0];
        layer.bindTooltip(
          `<b>${poly.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`,
          { sticky: true, className: "cm-tooltip", direction: "center" }
        );
        polyRefs.current[poly.id] = layer;
      });

      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style"); s.id = "cm-map-style";
        s.textContent = `.cm-tooltip{background:rgba(4,12,24,0.95)!important;border:1px solid rgba(56,189,248,0.35)!important;border-radius:6px!important;color:rgba(255,255,255,0.9)!important;font-family:'DM Sans',sans-serif!important;font-size:12px!important;font-weight:600!important;padding:4px 9px!important;box-shadow:0 2px 12px rgba(0,0,0,0.5)!important;white-space:nowrap!important;}.cm-tooltip::before{display:none!important;}.leaflet-control-zoom a{background:rgba(4,12,24,0.9)!important;color:rgba(255,255,255,0.7)!important;border-color:rgba(255,255,255,0.1)!important;}.leaflet-control-zoom a:hover{background:rgba(56,189,248,0.2)!important;}`;
        document.head.appendChild(s);
      }

    };

    if (window.L) { init(); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link"); link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="leaflet"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = init; document.head.appendChild(script);
    } else {
      const check = setInterval(() => { if (window.L) { clearInterval(check); init(); } }, 100);
    }
    return () => { if (leafRef.current) { leafRef.current.remove(); leafRef.current = null; polyRefs.current = {}; } };
  }, []);

  // Cambiar tile
  useEffect(() => {
    if (!leafRef.current || !tileRef.current || !window.L) return;
    const L = window.L;
    const t = TILE_OPTIONS.find(t => t.id === tileMode);
    if (!t) return;
    tileRef.current.setUrl(t.url);
    tileRef.current.options.subdomains = t.subdomains || "abc";
    if (labelRef.current) { leafRef.current.removeLayer(labelRef.current); labelRef.current = null; }
    if (t.labels) labelRef.current = L.tileLayer(t.labels, { maxZoom: 19, pane: "overlayPane" }).addTo(leafRef.current);
  }, [tileMode]);

  // Actualizar colores cuando cambia accesos
  useEffect(() => {
    if (!leafRef.current || !accesos) return;
    ACCESO_POLYGONS.forEach(poly => {
      const layer = polyRefs.current[poly.id];
      if (!layer) return;
      const color = getColor(poly.id);
      layer.setStyle({ color, fillColor: color, fillOpacity: 0.45, weight: 3, opacity: 1 });
      const opt = ACCESO_STATUS_OPTIONS.find(o => o.id === accesos?.[poly.id]?.status) || ACCESO_STATUS_OPTIONS[0];
      layer.bindTooltip(
        `<b>${poly.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`,
        { sticky: true, className: "cm-tooltip", direction: "center" }
      );
    });
  }, [JSON.stringify(accesos)]);

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ borderRadius:"14px 14px 0 0", overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)", borderBottom:"none" }}>
        <div style={{ padding:"10px 14px", background:"rgba(4,12,24,0.95)", display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
          <span style={{ fontSize:"13px" }}>🗺️</span>
          <span style={{ fontFamily:getFont(theme,"title"), fontSize:"14px", color:"rgba(255,255,255,0.9)" }}>Mapa de Accesos</span>
          <span style={{ fontFamily:getFont(theme,"secondary"), fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>· estado en tiempo real</span>
          <div style={{ marginLeft:"auto", display:"flex", gap:"4px", flexWrap:"wrap" }}>
            {TILE_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTileMode(t.id)} style={{
                padding:"3px 8px", borderRadius:"6px", border:"none", cursor:"pointer",
                background: tileMode===t.id ? "#38bdf8" : "rgba(255,255,255,0.08)",
                color: tileMode===t.id ? "#0a0f1e" : "rgba(255,255,255,0.5)",
                fontFamily:getFont(theme,"secondary"), fontSize:"11px", fontWeight: tileMode===t.id ? "700" : "400",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ border:"1px solid rgba(255,255,255,0.1)", borderTop:"none", borderRadius:"0 0 14px 14px", overflow:"hidden", boxShadow:"0 4px 32px rgba(0,0,0,0.5)" }}>
        <div ref={mapRef} style={{ width:"100%", height:"300px", background:"#040c18" }} />
      </div>
      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginTop:"8px", padding:"8px 12px", background:"rgba(255,255,255,0.04)", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.08)" }}>
        {ACCESO_STATUS_OPTIONS.map(o => (
          <span key={o.id} style={{ display:"flex", alignItems:"center", gap:"5px", fontFamily:getFont(theme,"secondary"), fontSize:"11px", color:"#e2e8f0" }}>
            <span style={{ width:"14px", height:"14px", borderRadius:"3px", background:o.color+"55", border:`2px solid ${o.color}`, display:"inline-block", boxShadow:`0 0 6px ${o.color}70` }} />
            {o.icon} {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- MAPA DE VIALIDADES (Leaflet — sección Tráfico > Vialidades) ---
function MapaVialidades({ vialidades }) {
  const theme = React.useContext(ThemeContext);
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const layersRef = useRef({});
  const tileRef   = useRef(null);
  const labelRef  = useRef(null);
  const [tileMode, setTileMode] = useState("dark");

  // Rutas extraídas del KML (solo las vialidades votables)
  const VIAL_LINES = [
    {
      id: "jalipa_puerto",
      name: "Jalipa → Puerto",
      weight: 7,
      coords: [
        [19.0784475939701,-104.2870646514312],[19.07978906323311,-104.2859805863696],
        [19.08200682268578,-104.2845777271611],[19.08310055029634,-104.2837587822707],
        [19.08598466199735,-104.281676375662],[19.0884984010515,-104.2799251205925],
        [19.09060087644081,-104.2784138436524],[19.09283447000849,-104.2766822449047],
        [19.09623158161623,-104.2742192725376],[19.09825929348696,-104.2728701193078],
        [19.1002813406189,-104.2714096449672],[19.10636260878762,-104.2671088606022],
      ],
    },
    {
      id: "puerto_jalipa",
      name: "Puerto → Jalipa",
      weight: 7,
      coords: [
        [19.10620158984666,-104.2669703199962],[19.10315310269971,-104.2692144154645],
        [19.09796761098305,-104.272941096177],[19.09504274656729,-104.274944709486],
        [19.09264140909514,-104.2766809402058],[19.08809625688808,-104.2799566541513],
        [19.08483992945358,-104.2822163712893],[19.08085053345084,-104.2851332224212],
        [19.0797046494737,-104.2859202174179],[19.07887745343695,-104.286142720049],
        [19.0776861498863,-104.28650575281],
      ],
    },
    {
      id: "libramiento",
      name: "Cihuatlán–Manzanillo",
      weight: 7,
      coords: [
        [19.09426886580907,-104.275893188039],[19.09717476920536,-104.2782234757976],
        [19.09787484730029,-104.2795237753191],[19.09855656321739,-104.2822022597094],
        [19.09897027846576,-104.2840776241292],[19.09884619877892,-104.2855238490435],
      ],
    },
    {
      id: "mzllo_colima",
      name: "Manzanillo → Colima",
      weight: 7,
      coords: [
        [19.07513237214499,-104.2847467000724],[19.07387080844731,-104.282476735095],
        [19.07270304793202,-104.2804010684781],[19.07200223558479,-104.2791014884412],
        [19.07160549162992,-104.278454764291],[19.07099626326914,-104.2762233320208],
      ],
    },
    {
      id: "colima_mzllo",
      name: "Colima → Manzanillo",
      weight: 7,
      coords: [
        [19.07115254996702,-104.2762001284719],[19.07144897704953,-104.2774832253349],
        [19.0716652443332,-104.2783467743601],[19.07263908079699,-104.2800186694388],
        [19.0741621236607,-104.2828124229572],[19.0750515019934,-104.2843004152151],
      ],
    },
    {
      id: "algodones",
      name: "Calle Algodones",
      weight: 7,
      coords: [
        [19.09051167248701,-104.2787068361492],[19.09269669726169,-104.2819435088931],
        [19.09374142813102,-104.2834496954496],[19.09660945127452,-104.2877128809602],
      ],
    },
    {
      id: "antonio_suarez",
      name: "Antonio Suárez",
      weight: 7,
      coords: [
        [19.08621155065439,-104.2956155458168],[19.08591359885211,-104.2948151552219],
        [19.08351233172974,-104.2928127939532],[19.07808926571032,-104.2884105001789],
      ],
    },
    {
      id: "av_trabajo",
      name: "Av. del Trabajo",
      weight: 7,
      coords: [
        [19.07420139717458,-104.2826615811781],[19.07697086498353,-104.2819707930699],
        [19.08080436211426,-104.2810388376526],[19.08924016049061,-104.2789227969467],
      ],
    },
  ];

  const TILE_OPTIONS = [
    { id: "dark",      label: "Noche",    icon: "🌙", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",                                                                           subdomains: "abcd", labels: null },
    { id: "streets",   label: "Calles",   icon: "🗺️", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                                                                                       subdomains: "abc",  labels: null },
    { id: "satellite", label: "Satélite", icon: "🛰️", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",                                            subdomains: "",     labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" },
    { id: "light",     label: "Claro",    icon: "☀️", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",                                                                           subdomains: "abcd", labels: null },
  ];

  const getVialColor = (id) => {
    if (!vialidades || !vialidades[id]) return "#22c55e";
    const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === vialidades[id].status);
    return opt ? opt.color : "#22c55e";
  };

  // Inicializar mapa Leaflet
  useEffect(() => {
    const init = () => {
      if (leafRef.current || !mapRef.current || !window.L) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [19.085, -104.284],
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      tileRef.current = L.tileLayer(TILE_OPTIONS[0].url, { maxZoom: 19, subdomains: TILE_OPTIONS[0].subdomains || "abc" }).addTo(map);
      leafRef.current = map;

      VIAL_LINES.forEach(line => {
        const color = getVialColor(line.id);
        const shadow = L.polyline(line.coords, { color: "#000", weight: line.weight + 5, opacity: 0.18, lineCap: "round", lineJoin: "round" }).addTo(map);
        const poly = L.polyline(line.coords, {
          color, weight: line.weight, opacity: 0.92,
          lineCap: "round", lineJoin: "round",
        }).addTo(map);
        const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === vialidades?.[line.id]?.status) || VIALIDAD_STATUS_OPTIONS[0];
        poly.bindTooltip(`<b>${line.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`, { sticky: true, className: "cm-tooltip", direction: "center" });
        layersRef.current[line.id] = { poly, shadow };
      });

      // CSS tooltips (reusar si ya existe)
      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style");
        s.id = "cm-map-style";
        s.textContent = `
          .cm-tooltip { background:rgba(4,12,24,0.95)!important; border:1px solid rgba(56,189,248,0.35)!important; border-radius:6px!important; color:rgba(255,255,255,0.9)!important; font-family:'DM Sans',sans-serif!important; font-size:12px!important; font-weight:600!important; padding:4px 9px!important; box-shadow:0 2px 12px rgba(0,0,0,0.5)!important; white-space:nowrap!important; }
          .cm-tooltip::before { display:none!important; }
          .leaflet-control-zoom a { background:rgba(4,12,24,0.9)!important; color:rgba(255,255,255,0.7)!important; border-color:rgba(255,255,255,0.1)!important; }
          .leaflet-control-zoom a:hover { background:rgba(56,189,248,0.2)!important; }
        `;
        document.head.appendChild(s);
      }
    };

    if (window.L) { init(); return; }
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

  // Cambiar tile
  useEffect(() => {
    if (!leafRef.current || !tileRef.current || !window.L) return;
    const L = window.L;
    const t = TILE_OPTIONS.find(t => t.id === tileMode);
    if (!t) return;
    tileRef.current.setUrl(t.url);
    tileRef.current.options.subdomains = t.subdomains || "abc";
    if (labelRef.current) { leafRef.current.removeLayer(labelRef.current); labelRef.current = null; }
    if (t.labels) {
      labelRef.current = L.tileLayer(t.labels, { maxZoom: 19, pane: "overlayPane" }).addTo(leafRef.current);
    }
  }, [tileMode]);

  // Actualizar colores cuando cambia vialidades
  useEffect(() => {
    if (!leafRef.current || !window.L || !vialidades) return;
    VIAL_LINES.forEach(line => {
      const entry = layersRef.current[line.id];
      if (!entry) return;
      const color = getVialColor(line.id);
      entry.poly.setStyle({ color, weight: line.weight, opacity: 0.92 });
      const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === vialidades?.[line.id]?.status) || VIALIDAD_STATUS_OPTIONS[0];
      entry.poly.bindTooltip(`<b>${line.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`, { sticky: true, className: "cm-tooltip", direction: "center" });
    });
  }, [JSON.stringify(vialidades)]);

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div style={{ borderRadius: "14px 14px 0 0", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}>
        <div style={{ padding: "10px 14px", background: "rgba(4,12,24,0.95)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px" }}>🗺️</span>
          <span style={{ fontFamily: getFont(theme, "title"), fontSize: "14px", color: "rgba(255,255,255,0.9)" }}>Mapa de Vialidades</span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>· estado en tiempo real</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
            {TILE_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTileMode(t.id)} style={{
                padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: tileMode === t.id ? "#38bdf8" : "rgba(255,255,255,0.08)",
                color: tileMode === t.id ? "#0a0f1e" : "rgba(255,255,255,0.5)",
                fontFamily: getFont(theme, "secondary"), fontSize: "11px", fontWeight: tileMode === t.id ? "700" : "400",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>
      </div>
      {/* Mapa */}
      <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.5)" }}>
        <div ref={mapRef} style={{ width: "100%", height: "300px", background: "#040c18" }} />
      </div>
      {/* Leyenda compacta */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
        {VIALIDAD_STATUS_OPTIONS.map(o => (
          <span key={o.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "#e2e8f0" }}>
            <span style={{ width: "22px", height: "4px", borderRadius: "3px", background: o.color, display: "inline-block", boxShadow: `0 0 6px ${o.color}70` }} />
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- MAPA DE TRÁFICO (Leaflet con KML real) ---
const MAP_TILES = [
  { id: "dark",      label: "Noche",    icon: "🌙",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    labels: null },
  { id: "satellite", label: "Satélite", icon: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" },
  { id: "light",     label: "Claro",    icon: "☀️",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    labels: null },
];

function MapaTrafico({ incidents, accesos, vialidades, compact = false, previewCoords = null, previewType = "incidente" }) {
  const theme = React.useContext(ThemeContext);
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const layersRef = useRef({});
  const tileRef      = useRef(null);
  const labelLayerRef = useRef(null);
  const incMarkersRef = useRef({});
  const previewMarkerRef = useRef(null);
  const previewCoordsRef = useRef(null);   // stores latest coords even before map is ready
  const previewTypeRef   = useRef("incidente");
  const [tileMode, setTileMode] = useState("dark");

  // Sync preview props to refs immediately (synchronous, before any effects run)
  previewCoordsRef.current = previewCoords;
  previewTypeRef.current   = previewType;

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
      color: "#fbc02d",
      weight: 5,
      matchKeys: ["segundo acceso", "segundo", "puerta 15"],
      vialidadId: null, // no es vialidad votable, es la ruta del 2do acceso
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
      color: "#1976d2",
      weight: 5,
      matchKeys: ["confinada", "vialidad confinada"],
      vialidadId: null,
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
    // -- Vialidades del KML (coloreadas por estado reportado) ---
    {
      id: "jalipa_puerto",
      name: "Jalipa → Puerto",
      color: "#22c55e", // default: libre
      weight: 6,
      matchKeys: ["jalipa", "jalipa puerto"],
      vialidadId: "jalipa_puerto",
      coords: [
        [19.0784475939701,-104.2870646514312],[19.07978906323311,-104.2859805863696],
        [19.08200682268578,-104.2845777271611],[19.08310055029634,-104.2837587822707],
        [19.08598466199735,-104.281676375662],[19.0884984010515,-104.2799251205925],
        [19.09060087644081,-104.2784138436524],[19.09283447000849,-104.2766822449047],
        [19.09623158161623,-104.2742192725376],[19.09825929348696,-104.2728701193078],
        [19.1002813406189,-104.2714096449672],[19.10636260878762,-104.2671088606022],
      ],
    },
    {
      id: "puerto_jalipa",
      name: "Puerto → Jalipa",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["puerto jalipa"],
      vialidadId: "puerto_jalipa",
      coords: [
        [19.10620158984666,-104.2669703199962],[19.10315310269971,-104.2692144154645],
        [19.09796761098305,-104.272941096177],[19.09504274656729,-104.274944709486],
        [19.09264140909514,-104.2766809402058],[19.08809625688808,-104.2799566541513],
        [19.08483992945358,-104.2822163712893],[19.08085053345084,-104.2851332224212],
        [19.0797046494737,-104.2859202174179],[19.07887745343695,-104.286142720049],
        [19.0776861498863,-104.28650575281],
      ],
    },
    {
      id: "mzllo_colima",
      name: "Manzanillo → Colima",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["manzanillo colima", "mzllo colima"],
      vialidadId: "mzllo_colima",
      coords: [
        [19.07513237214499,-104.2847467000724],[19.07387080844731,-104.282476735095],
        [19.07270304793202,-104.2804010684781],[19.07200223558479,-104.2791014884412],
        [19.07160549162992,-104.278454764291],[19.07099626326914,-104.2762233320208],
      ],
    },
    {
      id: "colima_mzllo",
      name: "Colima → Manzanillo",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["colima manzanillo", "colima mzllo"],
      vialidadId: "colima_mzllo",
      coords: [
        [19.07115254996702,-104.2762001284719],[19.07144897704953,-104.2774832253349],
        [19.0716652443332,-104.2783467743601],[19.07263908079699,-104.2800186694388],
        [19.0741621236607,-104.2828124229572],[19.0750515019934,-104.2843004152151],
      ],
    },
    {
      id: "algodones",
      name: "Calle Algodones",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["algodones"],
      vialidadId: "algodones",
      coords: [
        [19.09051167248701,-104.2787068361492],[19.09269669726169,-104.2819435088931],
        [19.09374142813102,-104.2834496954496],[19.09660945127452,-104.2877128809602],
      ],
    },
    {
      id: "libramiento",
      name: "Cihuatlán–Manzanillo",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["libramiento", "cihuatlan", "cihuatlán"],
      vialidadId: "libramiento",
      coords: [
        [19.09426886580907,-104.275893188039],[19.09717476920536,-104.2782234757976],
        [19.09787484730029,-104.2795237753191],[19.09855656321739,-104.2822022597094],
        [19.09897027846576,-104.2840776241292],[19.09884619877892,-104.2855238490435],
      ],
    },
    {
      id: "antonio_suarez",
      name: "Antonio Suárez",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["antonio suarez", "antonio suárez"],
      vialidadId: "antonio_suarez",
      coords: [
        [19.08621155065439,-104.2956155458168],[19.08591359885211,-104.2948151552219],
        [19.08351233172974,-104.2928127939532],[19.07808926571032,-104.2884105001789],
      ],
    },
    {
      id: "av_trabajo",
      name: "Av. del Trabajo",
      color: "#22c55e",
      weight: 6,
      matchKeys: ["trabajo", "av trabajo", "av. del trabajo"],
      vialidadId: "av_trabajo",
      coords: [
        [19.07420139717458,-104.2826615811781],[19.07697086498353,-104.2819707930699],
        [19.08080436211426,-104.2810388376526],[19.08924016049061,-104.2789227969467],
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
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      tileRef.current = L.tileLayer(MAP_TILES[0].url, { maxZoom: 19 }).addTo(map);
      leafRef.current = map;

      // Líneas KML
      KML_LINES.forEach(line => {
        const poly = L.polyline(line.coords, {
          color: line.color, weight: line.weight, opacity: 0.85,
          lineCap: "round", lineJoin: "round",
        }).addTo(map);
        poly.bindTooltip(`<b>${line.name}</b>`, { sticky: true, className: "cm-tooltip", direction: "center" });
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
        marker.bindTooltip(`<b>${pt.name}</b>`, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "cm-tooltip-permanent",
        }).openTooltip();
        layersRef.current[pt.id] = { marker, pt };
      });

      // CSS tooltips
      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style");
        s.id = "cm-map-style";
        s.textContent = `
          .cm-tooltip { background:rgba(4,12,24,0.95)!important; border:1px solid rgba(56,189,248,0.35)!important; border-radius:6px!important; color:rgba(255,255,255,0.9)!important; font-family:'DM Sans',sans-serif!important; font-size:12px!important; font-weight:600!important; padding:4px 9px!important; box-shadow:0 2px 12px rgba(0,0,0,0.5)!important; white-space:nowrap!important; }
          .cm-tooltip-permanent { background:rgba(4,12,24,0.88)!important; border:1px solid rgba(56,189,248,0.4)!important; border-radius:5px!important; color:rgba(255,255,255,0.92)!important; font-family:'DM Sans',sans-serif!important; font-size:10px!important; font-weight:700!important; padding:2px 7px!important; box-shadow:0 2px 8px rgba(0,0,0,0.6)!important; white-space:nowrap!important; pointer-events:none!important; }
          .cm-tooltip-permanent::before { display:none!important; }
          .cm-tooltip::before { display:none!important; }
          .leaflet-control-zoom a { background:rgba(4,12,24,0.9)!important; color:rgba(255,255,255,0.7)!important; border-color:rgba(255,255,255,0.1)!important; }
          .leaflet-control-zoom a:hover { background:rgba(56,189,248,0.2)!important; }
          .cm-inc-pulse { animation: cmPulse 1.4s ease-in-out infinite; }
          @keyframes cmPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.6} }
          .cm-popup .leaflet-popup-content-wrapper { background:rgba(4,12,24,0.97)!important; border:1px solid rgba(56,189,248,0.3)!important; border-radius:10px!important; box-shadow:0 4px 24px rgba(0,0,0,0.6)!important; color:#fff!important; }
          .cm-popup .leaflet-popup-tip { background:rgba(4,12,24,0.97)!important; }
          .cm-popup .leaflet-popup-close-button { color:rgba(255,255,255,0.5)!important; }
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

  // Cambiar capa de tiles cuando cambia el modo
  useEffect(() => {
    if (!leafRef.current || !tileRef.current || !window.L) return;
    const L = window.L;
    const t = MAP_TILES.find(t => t.id === tileMode);
    if (!t) return;
    // Swap base tile
    tileRef.current.setUrl(t.url);
    // Handle label overlay for satellite
    if (labelLayerRef.current) {
      leafRef.current.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }
    if (t.labels) {
      labelLayerRef.current = L.tileLayer(t.labels, { maxZoom: 19, pane: "overlayPane" }).addTo(leafRef.current);
    }
  }, [tileMode]);

  // Actualizar colores de vialidades cuando cambia su estado
  useEffect(() => {
    if (!leafRef.current || !window.L || !vialidades) return;
    KML_LINES.forEach(line => {
      if (!line.vialidadId) return;
      const layer = layersRef.current[line.id];
      if (!layer) return;
      const st = vialidades[line.vialidadId];
      const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === st?.status) || VIALIDAD_STATUS_OPTIONS[0];
      // Solo cambiar si no hay incidente activo sobreescribiendo
      if (!incGeoMap[line.id]) {
        layer.setStyle({ color: opt.color, weight: 6, opacity: 0.9, dashArray: null });
      }
      // Actualizar el tooltip para mostrar el estado
      layer.bindTooltip(`<b>${line.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`, { sticky: true, className: "cm-tooltip", direction: "center" });
    });
  }, [JSON.stringify(vialidades)]);

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
      // Re-bind permanent tooltip after icon change
      entry.marker.bindTooltip(`<b>${entry.pt.name}</b>`, {
        permanent: true, direction: "top", offset: [0, -10], className: "cm-tooltip-permanent",
      }).openTooltip();
    });
  }, [JSON.stringify(incGeoMap)]);

  // -- Pins de incidentes con coordenadas GPS ---
  useEffect(() => {
    if (!leafRef.current || !window.L) return;
    const L = window.L;
    const map = leafRef.current;
    Object.values(incMarkersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
    incMarkersRef.current = {};
    const PIN_CFG = {
      incidente: { color: "#f97316", emoji: "⚠️", label: "Incidente" },
      accidente: { color: "#ef4444", emoji: "🚨", label: "Accidente" },
      bloqueo:   { color: "#eab308", emoji: "🚧", label: "Bloqueo" },
      obra:      { color: "#3b82f6", emoji: "🏗️", label: "Obra" },
    };
    const visibles = incidents.filter(i => i.visible && !i.resolved && i.coords && i.coords.lat && i.coords.lng);
    visibles.forEach(inc => {
      const cfg = PIN_CFG[inc.type] || PIN_CFG.incidente;
      const icon = L.divIcon({
        html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div class="cm-inc-pulse" style="width:32px;height:32px;background:${cfg.color};border:3px solid rgba(255,255,255,0.95);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 14px ${cfg.color}cc,0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);font-size:14px;line-height:1;">${cfg.emoji}</span>
          </div>
          <div style="margin-top:4px;background:rgba(4,12,24,0.92);border:1px solid ${cfg.color}88;border-radius:4px;padding:2px 5px;font-family:DM Sans,sans-serif;font-size:9px;font-weight:700;color:${cfg.color};white-space:nowrap;pointer-events:none;">${inc.location ? inc.location.slice(0,28) + (inc.location.length > 28 ? "…" : "") : cfg.label}</div>
        </div>`,
        className: "", iconSize: [80, 60], iconAnchor: [16, 32],
      });
      const marker = L.marker([inc.coords.lat, inc.coords.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(`<div style="font-family:DM Sans,sans-serif;min-width:180px;"><div style="font-size:14px;font-weight:700;color:${cfg.color};margin-bottom:4px;">${cfg.emoji} ${cfg.label}</div><div style="font-size:12px;color:#fff;margin-bottom:2px;">${inc.location || ""}</div>${inc.description ? `<div style="font-size:11px;color:rgba(255,255,255,0.6);">${inc.description}</div>` : ""}</div>`, { className: "cm-popup" });
      incMarkersRef.current[inc.id] = marker;
    });
  }, [JSON.stringify(incidents.filter(i => i.visible && !i.resolved).map(i => ({ id: i.id, coords: i.coords, type: i.type })))]);

  // -- Helper: colocar/actualizar pin de preview en el mapa ---
  const applyPreviewPin = (coords, type) => {
    if (!leafRef.current || !window.L) return;
    const L = window.L;
    const map = leafRef.current;
    // Borrar pin anterior
    if (previewMarkerRef.current) {
      try { map.removeLayer(previewMarkerRef.current); } catch {}
      previewMarkerRef.current = null;
    }
    if (!coords) return;
    const PIN_CFG = {
      incidente: { color: "#f97316", emoji: "⚠️" },
      accidente: { color: "#ef4444", emoji: "🚨" },
      bloqueo:   { color: "#eab308", emoji: "🚧" },
      obra:      { color: "#3b82f6", emoji: "🏗️" },
    };
    const cfg = PIN_CFG[type] || PIN_CFG.incidente;
    const icon = L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div class="cm-inc-pulse" style="width:34px;height:34px;background:${cfg.color};border:3.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 16px ${cfg.color}bb,0 2px 8px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">
          <span style="transform:rotate(45deg);font-size:15px;line-height:1;">${cfg.emoji}</span>
        </div>
        <div style="margin-top:4px;background:rgba(4,12,24,0.92);border:1.5px solid ${cfg.color};border-radius:5px;padding:3px 7px;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:0.5px;">📍 Aquí</div>
      </div>`,
      className: "", iconSize: [70, 55], iconAnchor: [17, 34],
    });
    previewMarkerRef.current = L.marker(coords, { icon, zIndexOffset: 3000 }).addTo(map);
    map.setView(coords, 16, { animate: true, duration: 0.5 });
  };

  // -- Pin de preview: sincronizar ref y aplicar al mapa ---
  useEffect(() => {
    previewCoordsRef.current = previewCoords;
    previewTypeRef.current   = previewType;
    // Si el mapa ya está listo, aplicar inmediatamente
    if (leafRef.current) {
      applyPreviewPin(previewCoords, previewType);
    }
    // Si el mapa aún no está listo, el init lo aplicará cuando cargue
  }, [JSON.stringify(previewCoords), previewType]); // eslint-disable-line

  // -- Índice / leyenda ---
  const getVialColor = (vialidadId) => {
    if (!vialidades || !vialidades[vialidadId]) return "#22c55e";
    const opt = VIALIDAD_STATUS_OPTIONS.find(o => o.id === vialidades[vialidadId].status);
    return opt ? opt.color : "#22c55e";
  };

  const LEGEND_ITEMS = [
    // Rutas fijas
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
          <span style={{ fontFamily: getFont(theme, "title"), fontSize: "14px", color: "rgba(255,255,255,0.9)" }}>Mapa del Puerto</span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>· tráfico en tiempo real</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" }}>
            {MAP_TILES.map(t => (
              <button key={t.id} onClick={() => setTileMode(t.id)} style={{
                padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: tileMode === t.id ? "#38bdf8" : "rgba(255,255,255,0.08)",
                color: tileMode === t.id ? "#0a0f1e" : "rgba(255,255,255,0.5)",
                fontFamily: getFont(theme, "secondary"), fontSize: "11px", fontWeight: tileMode === t.id ? "700" : "400",
              }}>{t.icon} {t.label}</button>
            ))}
            {activeIncidents.length > 0 && (
              <span style={{ background: "#ef444418", border: "1px solid #ef444455", borderRadius: "20px", padding: "2px 9px", fontSize: "11px", color: "#ef4444", fontFamily: getFont(theme, "secondary"), fontWeight: "700", marginLeft: "4px" }}>
                {activeIncidents.length} incidente{activeIncidents.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div ref={mapRef} style={{ width: "100%", height: compact ? "220px" : "320px", background: "#040c18" }} />
      </div>

      {/* Índice */}
      {!compact && <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "14px", padding: "14px" }}>
        <div style={{ fontFamily: getFont(theme, "title"), fontSize: "13px", color: "rgba(255,255,255,0.7)", letterSpacing: "1px", marginBottom: "12px" }}>ÍNDICE DEL MAPA</div>

        {/* Rutas */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", marginBottom: "7px" }}>RUTAS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {LEGEND_ITEMS.filter(i => i.type === "line").map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "22px", height: "4px", background: item.color, borderRadius: "2px", flexShrink: 0 }} />
              <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Accesos */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", marginBottom: "7px" }}>ACCESOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {LEGEND_ITEMS.filter(i => i.type === "dot" && ["Acceso Zona Norte","Acceso Pez Vela","Acceso Puerta 15","Acceso Patios"].includes(i.label)).map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "12px", height: "12px", background: item.color, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Terminales */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", marginBottom: "7px" }}>TERMINALES</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
          {LEGEND_ITEMS.filter(i => { const accesoNames = ["Acceso Zona Norte","Acceso Pez Vela","Acceso Puerta 15","Acceso Patios"]; return i.type === "dot" && !accesoNames.includes(i.label); }).map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "12px", height: "12px", background: item.color, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Vialidades — colores dinámicos según estado */}
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", marginBottom: "7px" }}>VIALIDADES</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
          {[
            { id: "jalipa_puerto", name: "Jalipa → Puerto" },
            { id: "puerto_jalipa", name: "Puerto → Jalipa" },
            { id: "mzllo_colima",  name: "Manzanillo → Colima" },
            { id: "colima_mzllo",  name: "Colima → Manzanillo" },
            { id: "algodones",     name: "Calle Algodones" },
            { id: "libramiento",   name: "Cihuatlán–Manzanillo" },
          ].map(v => {
            const color = getVialColor(v.id);
            const opt   = vialidades?.[v.id] ? VIALIDAD_STATUS_OPTIONS.find(o => o.id === vialidades[v.id].status) : VIALIDAD_STATUS_OPTIONS[0];
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: `${color}10`, border: `1px solid ${color}40`, borderRadius: "8px", padding: "7px 10px" }}>
                <div style={{ width: "22px", height: "4px", background: color, borderRadius: "2px", flexShrink: 0, boxShadow: `0 0 6px ${color}80` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "rgba(255,255,255,0.8)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                  <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color, fontWeight: 700 }}>{opt?.icon} {opt?.label || "Libre"}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Leyenda de colores de estado */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
          {VIALIDAD_STATUS_OPTIONS.map(o => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "16px", height: "3px", background: o.color, borderRadius: "2px" }} />
              <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.55)" }}>{o.label}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}



// --- UBICACIONES PREDEFINIDAS PARA REPORTES ---
const UBICACIONES_REPORTE = [
  {
    grupo: "Vialidades de acceso al puerto",
    icon: "🛣️",
    opciones: [
      "Jalipa → Puerto",
      "Puerto → Jalipa",
      "Libramiento Cihuatlán-Manzanillo",
      "Libramiento El Naranjo",
      "Carretera Manzanillo → Colima",
      "Carretera Colima → Manzanillo",
      "Carretera libre Manzanillo-El Colomo",
      "Autopista Colima-Manzanillo",
      "Vialidad Acceso Norte (Fondeport)",
      "VAC-3 (Vialidad Acceso Contenedores 3)",
      "Carretera Pez Vela – Jalipa",
      "Tramo Francisco Villa – Jalipa",
    ]
  },
  {
    grupo: "Calles aledañas al puerto",
    icon: "🚛",
    opciones: [
      "Calle Algodones",
      "Av. del Trabajo",
      "Calle Correos de México",
      "Calle José Mesina",
      "Calle Nutria",
      "Calle Tapeixtles",
      "Calle Antonio Suárez",
      "Calle Hidalgo",
      "Calle Leandro Valle",
      "Calle Norte 1",
      "Calle Norte 2",
      "Calle Sur",
      "Calle Fondeport",
      "Calle La Tolva",
    ]
  },
  {
    grupo: "Avenidas y bulevares",
    icon: "🏙️",
    opciones: [
      "Blvd. Miguel de la Madrid",
      "Av. Teniente Azueta",
      "Av. Manzanillo",
      "Av. Elías Zamora Verduzco",
      "Av. Las Rosas",
    ]
  },
  {
    grupo: "Accesos al recinto portuario",
    icon: "⚓",
    opciones: [
      "Acceso Pez Vela",
      "Acceso Puerta 15",
      "Acceso Zona Norte (Segundo Acceso)",
      "Garita ASIPONA / Aduana Zona Norte",
      "Garita ASIPONA / Aduana Zona Sur",
      "Cruce ferroviario Tapeixtles",
      "Crucero Las Brisas",
      "Glorieta / Crucero Tapeixtles",
      "Glorieta San Pedrito",
    ]
  },
  {
    grupo: "Zonas industriales y patios",
    icon: "📦",
    opciones: [
      "Zona Industrial Fondeport",
      "Parque Industrial Fondeport",
      "Patio CIMA 1",
      "Patio CIMA 2",
      "Patio ISL",
      "Patio ALMAN",
      "Patio SIA",
      "Patio ALMACONT",
      "Patio SSA",
      "Área Correos de México",
    ]
  },
  {
    grupo: "Terminales",
    icon: "🏭",
    opciones: [
      "Terminal CONTECON",
      "Terminal HAZESA",
      "Terminal TIMSA",
      "Terminal SSA MARINE",
      "Terminal OCUPA (Multipropósito)",
      "Terminal MULTIMODAL",
      "Terminal FRIMAN",
      "Terminal LA JUNTA (TAP)",
      "Terminal CEMEX",
      "Terminal GRANELERA",
    ]
  },
  {
    grupo: "Colonias y zonas urbanas afectadas",
    icon: "📍",
    opciones: [
      "Colonia Tapeixtles",
      "Colonia Fondeport",
      "Colonia San Pedrito",
      "Colonia Las Brisas",
      "Colonia Francisco Villa",
      "Colonia Barrio Nuevo",
      "Colonia La Petrolera",
      "Col. Valle de las Garzas",
      "Centro de Manzanillo",
      "Zona Santiago / Salagua",
    ]
  },
];

// --- HELPER: Extraer coordenadas de un link de Google Maps ---
// Soporta: maps.app.goo.gl (short), maps.google.com/@lat,lng, ?q=lat,lng
// --- HELPER: Extraer coordenadas de texto o link de Google Maps ---
// Acepta:
//  1. Coordenadas directas: "19.092788, -104.276555"  o  "19.092788,-104.276555"
//  2. URL de Google Maps con @lat,lng o ?q=lat,lng
//  3. Short link maps.app.goo.gl (intenta resolver, con fallback a pedir coords)
function parseCoordsFromText(text) {
  if (!text) return null;
  // Formato: "lat, lng" o "lat,lng"
  const plain = text.trim().match(/^(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})$/);
  if (plain) {
    const lat = parseFloat(plain[1]), lng = parseFloat(plain[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
  }
  // URL con @lat,lng
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];
  // URL con ?q=lat,lng
  const qMatch = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return [parseFloat(qMatch[1]), parseFloat(qMatch[2])];
  // URL con ll=lat,lng
  const llMatch = text.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return [parseFloat(llMatch[1]), parseFloat(llMatch[2])];
  // !3d{lat}!4d{lng} (formato interno de Google)
  const d3Match = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d3Match) return [parseFloat(d3Match[1]), parseFloat(d3Match[2])];
  return null;
}

async function extractCoordsFromGMapsLink(url) {
  try {
    const res = await fetch(
      "https://wnchrhglwsrzrcrhhukg.supabase.co/functions/v1/resolve-maps",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY2hyaGdsd3NyenJjcmhodWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyMzI0NzksImV4cCI6MjA1MjgwODQ3OX0.4EUDMOIKFUOa7pQZU8KBp_bC8xt--u10iQO5Ru4pC5Y",
        },
        body: JSON.stringify({ url }),
      }
    );
    const data = await res.json();
    if (data.lat && data.lng) return [data.lat, data.lng];
    return null;
  } catch {
    return null;
  }
}

function isGMapsUrl(str) {
  return /maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps/i.test(str);
}

// Acepta también coordenadas directas pegadas
function isValidInput(str) {
  if (!str) return false;
  if (isGMapsUrl(str)) return true;
  // Coordenadas directas: "19.092788, -104.276555"
  return /^-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}$/.test(str.trim());
}


// --- MAPA DE EVENTOS (solo incidentes/accidentes con GPS, sin terminales ni vialidades) --
function MapaEventos({ incidents }) {
  const mapRef  = useRef(null);
  const leafRef = useRef(null);
  const markersRef = useRef({});
  const tileRef = useRef(null);
  const [tileMode, setTileMode] = useState("dark");

  const PIN_CFG = {
    incidente: { color: "#f97316", emoji: "⚠️", label: "Incidente" },
    accidente: { color: "#ef4444", emoji: "🚨", label: "Accidente" },
    bloqueo:   { color: "#eab308", emoji: "🚧", label: "Bloqueo"   },
    obra:      { color: "#3b82f6", emoji: "🏗️", label: "Obra"      },
  };

  // Centro por defecto: Manzanillo
  const DEFAULT_CENTER = [19.075, -104.295];
  const DEFAULT_ZOOM   = 13;

  useEffect(() => {
    const init = () => {
      if (leafRef.current || !mapRef.current || !window.L) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: false,
      });
      tileRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);
      leafRef.current = map;

      // Asegurar CSS base de popups/tooltips
      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style");
        s.id = "cm-map-style";
        s.textContent = `
          .cm-tooltip{background:rgba(4,12,24,0.95)!important;border:1px solid rgba(56,189,248,0.35)!important;border-radius:6px!important;color:rgba(255,255,255,0.9)!important;font-family:'DM Sans',sans-serif!important;font-size:12px!important;font-weight:600!important;padding:4px 9px!important;box-shadow:0 2px 12px rgba(0,0,0,0.5)!important;white-space:nowrap!important;}
          .cm-tooltip::before{display:none!important;}
          .cm-inc-pulse{animation:cmPulse 1.4s ease-in-out infinite;}
          @keyframes cmPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.6}}
          .cm-popup .leaflet-popup-content-wrapper{background:rgba(4,12,24,0.97)!important;border:1px solid rgba(56,189,248,0.3)!important;border-radius:10px!important;box-shadow:0 4px 24px rgba(0,0,0,0.6)!important;color:#fff!important;}
          .cm-popup .leaflet-popup-tip{background:rgba(4,12,24,0.97)!important;}
          .cm-popup .leaflet-popup-close-button{color:rgba(255,255,255,0.5)!important;}
          .leaflet-control-zoom a{background:rgba(4,12,24,0.9)!important;color:rgba(255,255,255,0.7)!important;border-color:rgba(255,255,255,0.1)!important;}
          .leaflet-control-zoom a:hover{background:rgba(56,189,248,0.2)!important;}
        `;
        document.head.appendChild(s);
      }
    };

    if (window.L) { init(); return; }
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link"); link.rel = "stylesheet";
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

  // Cambiar modo de tile
  useEffect(() => {
    if (!leafRef.current || !tileRef.current) return;
    const urls = {
      dark:      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      streets:   "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    };
    tileRef.current.setUrl(urls[tileMode] || urls.dark);
  }, [tileMode]);

  // Actualizar pins cuando cambian incidentes
  useEffect(() => {
    if (!leafRef.current || !window.L) return;
    const L = window.L;
    const map = leafRef.current;

    // Limpiar markers anteriores
    Object.values(markersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
    markersRef.current = {};

    const visibles = incidents.filter(i => i.visible && !i.resolved && i.coords?.lat && i.coords?.lng);
    visibles.forEach(inc => {
      const cfg = PIN_CFG[inc.type] || PIN_CFG.incidente;
      const icon = L.divIcon({
        html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div class="cm-inc-pulse" style="width:34px;height:34px;background:${cfg.color};border:3px solid rgba(255,255,255,0.95);border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 14px ${cfg.color}cc,0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);font-size:15px;line-height:1;">${cfg.emoji}</span>
          </div>
          <div style="margin-top:4px;background:rgba(4,12,24,0.92);border:1px solid ${cfg.color}88;border-radius:4px;padding:2px 5px;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;color:${cfg.color};white-space:nowrap;pointer-events:none;">${inc.location ? inc.location.slice(0,28)+(inc.location.length>28?"…":"") : cfg.label}</div>
        </div>`,
        className: "", iconSize: [80, 60], iconAnchor: [17, 34],
      });
      const marker = L.marker([inc.coords.lat, inc.coords.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:'DM Sans',sans-serif;min-width:190px;padding:4px;">
          <div style="font-size:15px;font-weight:700;color:${cfg.color};margin-bottom:6px;">${cfg.emoji} ${cfg.label}</div>
          <div style="font-size:12px;color:#fff;margin-bottom:4px;line-height:1.4;">${inc.location || ""}</div>
          ${inc.description ? `<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:4px;">${inc.description}</div>` : ""}
          <div style="font-size:10px;color:rgba(255,255,255,0.4);">📍 ${inc.coords.lat.toFixed(5)}, ${inc.coords.lng.toFixed(5)}</div>
        </div>`,
        { className: "cm-popup" }
      );
      markersRef.current[inc.id] = marker;
    });

    // Si hay incidentes, ajustar vista para mostrarlos todos
    if (visibles.length > 0) {
      try {
        const bounds = L.latLngBounds(visibles.map(i => [i.coords.lat, i.coords.lng]));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 16, animate: true });
      } catch {}
    }
  }, [JSON.stringify(incidents.filter(i => i.visible && !i.resolved).map(i => ({ id: i.id, coords: i.coords, type: i.type, location: i.location })))]);

  const visiblesCount = incidents.filter(i => i.visible && !i.resolved && i.coords?.lat).length;

  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", position: "relative" }}>
      {/* Selector de mapa */}
      <div style={{ position: "absolute", top: "10px", right: "10px", zIndex: 800, display: "flex", gap: "4px" }}>
        {[
          { id: "dark",      label: "🌑" },
          { id: "streets",   label: "🗺️" },
          { id: "satellite", label: "🛰️" },
        ].map(t => (
          <button key={t.id} onClick={() => setTileMode(t.id)}
            style={{ padding: "4px 8px", background: tileMode === t.id ? "rgba(56,189,248,0.9)" : "rgba(4,12,24,0.85)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", color: "#fff", fontSize: "12px", cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Badge contador */}
      {visiblesCount === 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(4,12,24,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "12px 18px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📭</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: "12px" }}>Sin eventos activos con ubicación GPS</div>
          </div>
        </div>
      )}

      <div ref={mapRef} style={{ width: "100%", height: "340px", background: "#0a1628" }} />
    </div>
  );
}

function ReporteTab({ myId, incidents, setIncidents, setActiveTab, isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [reporteView, setReporteView] = useState("reportar"); // "reportar" | "eventos"
  const [categoria, setCategoria] = useState("incidente");
  const [subcat,    setSubcat]    = useState("");
  const [acceso,    setAcceso]    = useState("");
  const [location,  setLocation]  = useState("");
  const [gmapsLink, setGmapsLink] = useState("");
  const [coords,    setCoords]    = useState(null);   // [lat, lng] | null
  const [coordsLoading, setCoordsLoading] = useState(false);
  const [coordsError,   setCoordsError]   = useState("");
  const [showUbic,  setShowUbic]  = useState(false);
  const [grupoOpen, setGrupoOpen] = useState(null);
  const [toast,          setToast]          = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const subcats   = INCIDENT_SUBCATEGORIAS[categoria] || [];
  const catObj    = INCIDENT_CATEGORIAS.find(c => c.id === categoria) || INCIDENT_CATEGORIAS[0];
  const subcatObj = subcats.find(s => s.id === subcat);

  // Procesar link de Google Maps o coordenadas directas
  const handleGmapsInput = async (val) => {
    setGmapsLink(val);
    setCoords(null);
    setCoordsError("");
    if (!val.trim()) return;

    // Intentar parsear directamente primero (rápido, sin red)
    const directCoords = parseCoordsFromText(val.trim());
    if (directCoords) {
      setCoords(directCoords);
      return;
    }

    if (!isValidInput(val.trim())) {
      setCoordsError("Pega un enlace de Google Maps o las coordenadas directas (ej: 19.0927, -104.2765)");
      return;
    }

    setCoordsLoading(true);
    try {
      const c = await extractCoordsFromGMapsLink(val.trim());
      if (c) {
        setCoords(c);
        setCoordsError("");
      } else {
        setCoordsError("No se pudieron leer las coordenadas del enlace. Copia las coordenadas directamente de Google Maps (ej: 19.0927, -104.2765) y pégalas aquí.");
      }
    } catch {
      setCoordsError("Error al procesar el enlace. Intenta copiar y pegar las coordenadas directamente.");
    } finally {
      setCoordsLoading(false);
    }
  };

  // -- Auto-expiración: elimina reportes pendientes con más de 1 hora sin alcanzar 3 confirmaciones
  useEffect(() => {
    const check = setInterval(() => {
      const ahora = Date.now();
      incidents
        .filter(i => !i.visible && !i.resolved)
        .forEach(async inc => {
          const conf = Object.values(inc.votes || {}).filter(v => v === 1).length;
          const edad = ahora - (inc.ts || 0);
          if (edad >= 3600000 && conf < 3) {
            await sb.from("incidents").delete().eq("id", inc.id);
          }
        });
    }, 30000);
    return () => clearInterval(check);
  }, [incidents]);

  const submit = async () => {
    if (!subcat)          return notify("Selecciona el tipo específico", "#ef4444");
    if (!location.trim()) return notify("Selecciona o escribe la ubicación", "#ef4444");
    if (!coords)          return notify("Pega un enlace de Google Maps válido con coordenadas", "#ef4444");
    const rl = rateLimiter.check(`report_${myId}`, 120000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s para reportar de nuevo`, "#f97316");
    const labelFull = `${subcatObj?.icon || ""} ${subcatObj?.label || subcat}`;
    const safeLoc   = sanitize(acceso ? `${acceso} — ${location}` : location);
    const safeDesc  = sanitize(labelFull);
    if (!safeLoc.trim()) return notify("Ubicación inválida", "#ef4444");
    const newIncident = {
      type: categoria, location: safeLoc, description: safeDesc,
      votes: {}, resolve_votes: {}, false_votes: {},
      visible: true, resolved: false, ts: Date.now(),
      coords: coords ? { lat: coords[0], lng: coords[1] } : null,
    };
    const { data: insertedRows, error: insertError } = await sb
      .from("incidents")
      .insert(newIncident)
      .select();
    if (insertError) {
      return notify("❌ Error al enviar el reporte: " + insertError.message, "#ef4444");
    }
    if (insertedRows && insertedRows[0]) {
      const r = insertedRows[0];
      setIncidents(prev => [{
        id: r.id, type: r.type, location: r.location,
        desc: r.description, votes: r.votes || {},
        resolveVotes: r.resolve_votes || {},
        visible: r.visible, resolved: r.resolved, ts: r.ts,
        coords: r.coords || null,
      }, ...prev]);
    }
    setSubcat(""); setLocation(""); setAcceso(""); setGmapsLink(""); setCoords(null);
    notify("📍 Reporte enviado — aparece en Eventos", "#22c55e");
    setTimeout(() => setActiveTab("trafico"), 1200);
  };

  const incType    = (id) => INCIDENT_TYPES.find(t => t.id === id) || INCIDENT_TYPES[0];
  const pendingAll = incidents.filter(i => !i.visible && !i.resolved);

  const tiempoRestante = (ts) => {
    const resta = 3600000 - (Date.now() - ts);
    if (resta <= 0) return "expirando...";
    const min = Math.floor(resta / 60000);
    return `${min}min restantes`;
  };

  return (
    <div style={{ padding:"16px", paddingBottom:"80px" }}>

      {/* -- Navegación sub-tabs: Reportar / Eventos -- */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px", background:"rgba(255,255,255,0.04)", borderRadius:"12px", padding:"4px" }}>
        {[
          { id:"reportar", label:"Reportar",  icon:"📢", color:"#0ea5e9" },
          { id:"eventos",  label:"Eventos",   icon:"🗺️", color:"#f97316" },
        ].map(tab => {
          const active = reporteView === tab.id;
          const evCount = tab.id === "eventos" ? incidents.filter(i => i.visible && !i.resolved).length : 0;
          return (
            <button key={tab.id} onClick={() => setReporteView(tab.id)}
              style={{ flex:1, padding:"11px 8px", border:`1.5px solid ${active ? tab.color : "rgba(255,255,255,0.1)"}`, background: active ? tab.color+"22" : "transparent", borderRadius:"9px", color: active ? tab.color : "rgba(255,255,255,0.45)", fontFamily:getFont(theme,"secondary"), fontSize:"12px", fontWeight: active ? "700" : "500", cursor:"pointer", letterSpacing:"0.5px", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
              <span style={{ fontSize:"16px" }}>{tab.icon}</span>
              {tab.label}
              {tab.id === "eventos" && evCount > 0 && (
                <span style={{ background: active ? tab.color : "rgba(249,115,22,0.3)", color: active ? "#0a1628" : "#f97316", borderRadius:"10px", padding:"1px 7px", fontSize:"9px", fontWeight:"700", minWidth:"18px", textAlign:"center" }}>{evCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* -- VISTA: REPORTAR --- */}
      {reporteView === "reportar" && (<>

      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a2540)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"14px", padding:"16px", marginBottom:"20px", textAlign:"center" }}>
        <div style={{ fontSize:"32px", marginBottom:"8px" }}>📍</div>
        <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", letterSpacing:"1px" }}>REPORTAR INCIDENTE</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px", marginTop:"4px" }}>Necesita 3 confirmaciones · expira en 1h si no se verifica</div>
      </div>

      {/* Mapa de referencia con pin del reporte actual */}
      <div style={{ marginBottom:"16px" }}>
        <MapaTrafico incidents={incidents} accesos={{}} vialidades={{}} compact previewCoords={coords} previewType={categoria} />
      </div>

      {/* Paso 1: Categoría */}
      <div style={{ marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>PASO 1 · CATEGORÍA</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          {INCIDENT_CATEGORIAS.map(cat => (
            <button key={cat.id} onClick={() => { setCategoria(cat.id); setSubcat(""); }}
              style={{ padding:"14px 8px", border:`1px solid ${categoria===cat.id ? cat.color : "#1e3a5f"}`, background: categoria===cat.id ? cat.color+"22" : "#0d1b2e", borderRadius:"10px", color: categoria===cat.id ? cat.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"13px", cursor:"pointer", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", fontWeight: categoria===cat.id ? "700" : "400" }}>
              <span style={{ fontSize:"26px" }}>{cat.icon}</span>{cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Paso 2: Subcategoría */}
      <div style={{ marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>PASO 2 · TIPO ESPECÍFICO</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
          {subcats.map(s => (
            <button key={s.id} onClick={() => setSubcat(s.id)}
              style={{ padding:"11px 14px", border:`1px solid ${subcat===s.id ? catObj.color : "#1e3a5f"}`, background: subcat===s.id ? catObj.color+"22" : "#0a1628", borderRadius:"10px", color: subcat===s.id ? catObj.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", gap:"10px", fontWeight: subcat===s.id ? "700" : "400", textAlign:"left" }}>
              <span style={{ fontSize:"18px", flexShrink:0 }}>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Paso 3: Zona */}
      <div style={{ marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>PASO 3 · ZONA / ACCESO (opcional)</div>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {["", "Acceso Pez Vela", "Acceso Zona Norte", "Blvd. Miguel de la Madrid", "Segundo Acceso"].map(a => (
            <button key={a} onClick={() => setAcceso(a)}
              style={{ padding:"6px 10px", background: acceso===a ? "#0369a122" : "#0a1628", border:`1px solid ${acceso===a ? "#0ea5e9" : "#1e3a5f"}`, borderRadius:"6px", color: acceso===a ? "#38bdf8" : "#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", transition:"all 0.15s" }}>
              {a === "" ? "Sin zona" : a}
            </button>
          ))}
        </div>
      </div>

      {/* Paso 4: Ubicación */}
      <div style={{ marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"6px" }}>PASO 4 · UBICACIÓN *</div>

        {/* Selector predefinido */}
        <button onClick={() => setShowUbic(p => !p)}
          style={{
            width:"100%", padding:"11px 14px",
            background: showUbic ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.05)",
            backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
            border:`1px solid ${showUbic ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
            borderRadius: showUbic ? "10px 10px 0 0" : "10px",
            color: "rgba(255,255,255,0.85)",
            fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            marginBottom:"0", boxSizing:"border-box", transition:"all 0.2s"
          }}>
          <span>{location ? `📍 ${location}` : "📍 Seleccionar ubicación predefinida"}</span>
          <span style={{ fontSize:"10px", color:"#38bdf8", transform: showUbic ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▼</span>
        </button>

        {showUbic && (
          <div style={{ background:"#060e1a", border:"1px solid #38bdf855", borderTop:"none", borderRadius:"0 0 10px 10px", maxHeight:"320px", overflowY:"auto", marginBottom:"8px" }}>
            {UBICACIONES_REPORTE.map(grupo => (
              <div key={grupo.grupo}>
                <button onClick={() => setGrupoOpen(p => p === grupo.grupo ? null : grupo.grupo)}
                  style={{ width:"100%", padding:"10px 14px", background: grupoOpen===grupo.grupo ? "#1e3a5f" : "transparent", border:"none", borderBottom:"1px solid #1e3a5f22", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", textAlign:"left" }}>
                  <span>{grupo.icon}</span>
                  <span style={{ flex:1 }}>{grupo.grupo}</span>
                  <span style={{ fontSize:"9px", opacity:0.6 }}>{grupoOpen===grupo.grupo ? "▲" : "▼"}</span>
                </button>
                {grupoOpen === grupo.grupo && grupo.opciones.map(op => (
                  <button key={op} onClick={() => { setLocation(op); setShowUbic(false); setGrupoOpen(null); }}
                    style={{ width:"100%", padding:"9px 14px 9px 34px", background: location===op ? "#38bdf822" : "transparent", border:"none", borderBottom:"1px solid #0d1b2e", color: location===op ? "#38bdf8" : "rgba(255,255,255,0.65)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"6px" }}>
                    {location===op && <span style={{ color:"#38bdf8", fontSize:"10px" }}>✓</span>}
                    {op}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paso 5: Link de Google Maps (obligatorio) */}
      <div style={{ marginBottom:"18px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"6px" }}>
          PASO 5 · ENLACE DE GOOGLE MAPS *
        </div>
        <div style={{ background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:"10px", padding:"10px 12px", marginBottom:"8px", display:"flex", alignItems:"flex-start", gap:"8px" }}>
          <span style={{ fontSize:"16px", flexShrink:0 }}>ℹ️</span>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
            <b style={{ color:"rgba(255,255,255,0.85)" }}>Opción A (recomendada):</b> En Google Maps mantén presionado el lugar → aparecen las coordenadas abajo → cópialas y pégalas aquí.<br/>
            <span style={{ color:"#22c55e" }}>Ej: 19.092788, -104.276555</span><br/>
            <b style={{ color:"rgba(255,255,255,0.85)" }}>Opción B:</b> Pega el enlace compartido de Google Maps.<br/>
            <span style={{ color:"#38bdf8" }}>Ej: https://maps.app.goo.gl/...</span>
          </div>
        </div>

        <div style={{ position:"relative" }}>
          <input
            value={gmapsLink}
            onChange={e => handleGmapsInput(e.target.value)}
            placeholder="19.092788, -104.276555  —ó—  https://maps.app.goo.gl/..."
            style={{
              width:"100%", padding:"11px 40px 11px 14px",
              background: coords ? "rgba(34,197,94,0.08)" : coordsError ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.08)",
              backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)",
              border:`1px solid ${coords ? "#22c55e66" : coordsError ? "#ef444466" : "rgba(255,255,255,0.15)"}`,
              borderRadius:"10px",
              color:"rgba(255,255,255,0.95)",
              fontFamily:getFont(theme, "secondary"), fontSize:"12px",
              boxSizing:"border-box", outline:"none",
            }}
          />
          <span style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", fontSize:"16px", pointerEvents:"none" }}>
            {coordsLoading ? "⏳" : coords ? "✅" : coordsError ? "❌" : "🔗"}
          </span>
        </div>

        {/* Feedback */}
        {coordsLoading && (
          <div style={{ marginTop:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#38bdf8" }}>
            ⏳ Obteniendo coordenadas...
          </div>
        )}
        {coords && !coordsLoading && (
          <div style={{ marginTop:"6px", display:"flex", alignItems:"center", gap:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#22c55e" }}>
            ✅ Coordenadas obtenidas: {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
            <span style={{ color:"rgba(255,255,255,0.4)" }}>— pin visible en el mapa ↑</span>
          </div>
        )}
        {coordsError && !coordsLoading && (
          <div style={{ marginTop:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#f97316", lineHeight:1.5 }}>
            ❌ {coordsError}
            <div style={{ marginTop:"5px", color:"rgba(255,255,255,0.5)", fontSize:"10px" }}>
              💡 Tip rápido: en Google Maps mantén presionado el punto → copia los números que aparecen abajo (ej: 19.0927, -104.2765) y pégalos aquí.
            </div>
          </div>
        )}
      </div>

      {/* Vista previa */}
      {subcat && location && (
        <div style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${catObj.color}44`, borderRadius:"10px", padding:"12px", marginBottom:"16px" }}>
          <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"6px" }}>VISTA PREVIA</div>
          <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
            <span style={{ fontSize:"20px" }}>{subcatObj?.icon}</span>
            <div>
              <div style={{ color:catObj.color, fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", marginBottom:"2px" }}>{catObj.label.toUpperCase()} · {subcatObj?.label}</div>
              <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}>{acceso ? `${acceso} — ${location}` : location}</div>
              {coords && <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"3px" }}>📍 Pin en mapa: {coords[0].toFixed(4)}, {coords[1].toFixed(4)}</div>}
            </div>
          </div>
        </div>
      )}

      <button onClick={submit}
        style={{ width:"100%", padding:"14px", background: (subcat && location && coords) ? "linear-gradient(135deg,#0369a1,#0ea5e9)" : "rgba(255,255,255,0.08)", border:"none", borderRadius:"12px", color: (subcat && location && coords) ? "#fff" : "rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", cursor: (subcat && location && coords) ? "pointer" : "not-allowed", letterSpacing:"1px", marginBottom:"20px", transition:"all 0.2s" }}>
        ENVIAR REPORTE →
      </button>

      {/* -- REPORTES PENDIENTES DE VERIFICACIÓN -- */}
      {pendingAll.length > 0 && (
        <>
          <SectionLabel text={`PENDIENTES DE VERIFICACIÓN (${pendingAll.length})`} />
          {pendingAll.map(inc => {
            const t         = incType(inc.type);
            const votes     = inc.votes        || {};
            const falseV    = inc.false_votes   || {};
            const resolveV  = inc.resolve_votes || {};
            const myVote    = votes[myId];
            const myFalse   = falseV[myId];
            const myResolve = resolveV[myId];
            const conf      = Object.values(votes).filter(v => v === 1).length;
            const falsos    = Object.values(falseV).length;
            const resueltos = Object.values(resolveV).length;
            const borderC   = falsos >= conf && falsos >= 2 ? "#ef4444" : conf >= 2 ? "#22c55e" : "#f97316";

            return (
              <div key={inc.id}
                style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`2px solid ${borderC}`, borderRadius:"12px", padding:"12px", marginBottom:"10px", transition:"border-color 0.3s" }}>

                {/* Header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                  <div style={{ display:"flex", gap:"8px", flex:1 }}>
                    <span style={{ fontSize:"20px" }}>{t.icon}</span>
                    <div>
                      <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", fontWeight:"700" }}>{inc.location}</div>
                      {inc.description && <div style={{ color:"rgba(255,255,255,0.6)", fontSize:"11px", marginTop:"2px" }}>{inc.description}</div>}
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"3px" }}>
                        {timeAgo(inc.ts)} · ⏱ {tiempoRestante(inc.ts)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
                    <Badge color={borderC} small>PENDIENTE</Badge>
                    {isAdmin && confirmDelete !== inc.id && (
                      <button onClick={() => setConfirmDelete(inc.id)}
                        style={{ padding:"3px 8px", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:"6px", color:"#ef4444", fontFamily:getFont(theme, "secondary"), fontSize:"9px", cursor:"pointer", fontWeight:"700", letterSpacing:"0.5px" }}>
                        🗑 BORRAR
                      </button>
                    )}
                    {isAdmin && confirmDelete === inc.id && (
                      <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
                        <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary") }}>¿Seguro?</span>
                        <button onClick={async () => {
                          const { error } = await sb.from("incidents").delete().eq("id", inc.id);
                          if (error) { notify("Error al eliminar: " + error.message, "#ef4444"); return; }
                          setIncidents(prev => prev.filter(i => i.id !== inc.id));
                          setConfirmDelete(null);
                          notify("🗑 Reporte eliminado", "#f97316");
                        }}
                          style={{ padding:"3px 8px", background:"#ef4444", border:"none", borderRadius:"6px", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"9px", cursor:"pointer", fontWeight:"700" }}>
                          SÍ
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ padding:"3px 8px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:"6px", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"9px", cursor:"pointer", fontWeight:"700" }}>
                          NO
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de verificación (3 votos) */}
                <VoteBar count={conf} needed={3} color="#22c55e" />

                {/* Botones con contadores */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", marginTop:"10px" }}>

                  {/* CONFIRMAR */}
                  <button onClick={async () => {
                    if (myVote === 1) return notify("Ya confirmaste este reporte", "#38bdf8");
                    const newVotes = { ...votes, [myId]: 1 };
                    const newConf  = Object.values(newVotes).filter(v => v === 1).length;
                    const visible  = newConf >= 3;
                    await sb.from("incidents").update({ votes: newVotes, visible }).eq("id", inc.id);
                    if (visible) notify("✅ ¡Reporte verificado y publicado!", "#22c55e");
                    else         notify(`✓ Confirmado (${newConf}/3)`, "#22c55e");
                  }}
                    style={{ padding:"9px 4px", background: myVote===1?"#22c55e33":"#16a34a15", border:`1px solid ${myVote===1?"#22c55e":"#16a34a44"}`, borderRadius:"8px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>✅</span>
                    <span>CONFIRMO</span>
                    <span style={{ fontSize:"11px", background:"rgba(34,197,94,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{conf}</span>
                  </button>

                  {/* FALSO — 3 votos eliminan el reporte */}
                  <button onClick={async () => {
                    if (myFalse) return notify("Ya lo marcaste como falso", "#38bdf8");
                    const newFalse = { ...falseV, [myId]: 1 };
                    const count    = Object.values(newFalse).length;
                    if (count >= 3) {
                      await sb.from("incidents").delete().eq("id", inc.id);
                      notify("❌ Reporte eliminado — 3 votos falsos", "#ef4444");
                    } else {
                      await sb.from("incidents").update({ false_votes: newFalse }).eq("id", inc.id);
                      notify(`✗ Marcado como falso (${count}/3)`, "#ef4444");
                    }
                  }}
                    style={{ padding:"9px 4px", background: myFalse?"#ef444433":"#ef444415", border:`1px solid ${myFalse?"#ef4444":"#ef444444"}`, borderRadius:"8px", color:"#ef4444", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>❌</span>
                    <span>FALSO</span>
                    <span style={{ fontSize:"11px", background:"rgba(239,68,68,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{falsos}</span>
                  </button>

                  {/* RESUELTO — 3 votos cierran el incidente */}
                  <button onClick={async () => {
                    if (myResolve) return notify("Ya votaste como resuelto", "#38bdf8");
                    const newResolve = { ...resolveV, [myId]: 1 };
                    const count      = Object.values(newResolve).length;
                    if (count >= 3) {
                      await sb.from("incidents").update({ resolve_votes: newResolve, resolved: true }).eq("id", inc.id);
                      notify("🏁 Incidente cerrado como resuelto", "#6b7280");
                    } else {
                      await sb.from("incidents").update({ resolve_votes: newResolve }).eq("id", inc.id);
                      notify(`🏁 Voto resuelto (${count}/3)`, "#6b7280");
                    }
                  }}
                    style={{ padding:"9px 4px", background: myResolve?"#6b728033":"#6b728015", border:`1px solid ${myResolve?"#6b7280":"#6b728044"}`, borderRadius:"8px", color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>🏁</span>
                    <span>RESUELTO</span>
                    <span style={{ fontSize:"11px", background:"rgba(107,114,128,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{resueltos}</span>
                  </button>
                </div>

                {/* Indicador de mi voto */}
                {(myVote || myFalse || myResolve) && (
                  <div style={{ fontSize:"9px", fontFamily:getFont(theme, "secondary"), marginTop:"6px", textAlign:"center",
                    color: myVote===1 ? "#22c55e" : myFalse ? "#ef4444" : "#94a3b8" }}>
                    {myVote===1  ? "✓ Confirmaste este reporte"
                    : myFalse   ? "✗ Lo marcaste como falso"
                    :             "🏁 Votaste como resuelto"}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      <ToastBox toast={toast} />
      </>)}

      {/* -- VISTA: EVENTOS --- */}
      {reporteView === "eventos" && (
        <div>
          {/* Mapa de eventos */}
          <div style={{ marginBottom:"16px" }}>
            <MapaEventos incidents={incidents} />
          </div>

          {/* Lista de incidentes y accidentes verificados */}
          {(() => {
            const visibles = incidents.filter(i => i.visible && !i.resolved);
            const PIN_CFG_EV = {
              incidente: { color:"#f97316", emoji:"⚠️", label:"Incidente" },
              accidente: { color:"#ef4444", emoji:"🚨", label:"Accidente" },
              bloqueo:   { color:"#eab308", emoji:"🚧", label:"Bloqueo"  },
              obra:      { color:"#3b82f6", emoji:"🏗️", label:"Obra"     },
            };
            if (visibles.length === 0) {
              return (
                <div style={{ textAlign:"center", padding:"32px 16px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px" }}>
                  <div style={{ fontSize:"36px", marginBottom:"10px" }}>✅</div>
                  <div style={{ color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme,"secondary"), fontSize:"13px", fontWeight:"600" }}>Sin eventos activos</div>
                  <div style={{ color:"rgba(255,255,255,0.35)", fontFamily:getFont(theme,"secondary"), fontSize:"11px", marginTop:"6px" }}>No hay incidentes ni accidentes reportados en este momento</div>
                </div>
              );
            }
            return (
              <>
                <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme,"secondary"), letterSpacing:"1px", marginBottom:"10px" }}>
                  EVENTOS ACTIVOS ({visibles.length})
                </div>
                {visibles.map(inc => {
                  const cfg       = PIN_CFG_EV[inc.type] || PIN_CFG_EV.incidente;
                  const votes     = inc.votes        || {};
                  const falseV    = inc.false_votes   || {};
                  const resolveV  = inc.resolve_votes || {};
                  const myVote    = votes[myId];
                  const myFalse   = falseV[myId];
                  const myResolve = resolveV[myId];
                  const conf      = Object.values(votes).filter(v => v === 1).length;
                  const falsos    = Object.values(falseV).length;
                  const resueltos = Object.values(resolveV).length;
                  const borderC   = falsos >= conf && falsos >= 2 ? "#ef4444" : conf >= 2 ? "#22c55e" : cfg.color;
                  return (
                    <div key={inc.id} style={{ background:"rgba(255,255,255,0.06)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1.5px solid ${borderC}55`, borderRadius:"12px", padding:"12px", marginBottom:"10px", transition:"border-color 0.3s" }}>
                      {/* Cabecera */}
                      <div style={{ display:"flex", gap:"10px", alignItems:"flex-start", marginBottom:"10px" }}>
                        <div style={{ width:"40px", height:"40px", background:cfg.color+"22", border:`1.5px solid ${cfg.color}66`, borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
                          {cfg.emoji}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px", flexWrap:"wrap" }}>
                            <span style={{ background:cfg.color+"22", color:cfg.color, borderRadius:"5px", padding:"1px 7px", fontSize:"9px", fontWeight:"700", letterSpacing:"0.5px" }}>{cfg.label.toUpperCase()}</span>
                            {inc.coords?.lat && <span style={{ color:"rgba(255,255,255,0.4)", fontSize:"9px" }}>📍 GPS</span>}
                          </div>
                          <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme,"secondary"), fontSize:"12px", fontWeight:"600", lineHeight:1.3 }}>{inc.location}</div>
                          {inc.desc && <div style={{ color:"rgba(255,255,255,0.55)", fontSize:"11px", marginTop:"3px" }}>{inc.desc}</div>}
                          <div style={{ color:"rgba(255,255,255,0.35)", fontSize:"10px", fontFamily:getFont(theme,"secondary"), marginTop:"5px" }}>{timeAgo(inc.ts)}</div>
                        </div>
                        {isAdmin && (
                          <button onClick={async () => {
                            const { error } = await sb.from("incidents").delete().eq("id", inc.id);
                            if (error) { notify("Error: " + error.message, "#ef4444"); return; }
                            setIncidents(prev => prev.filter(i => i.id !== inc.id));
                            notify("🗑 Evento eliminado", "#f97316");
                          }}
                            style={{ padding:"4px 8px", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:"6px", color:"#ef4444", fontFamily:getFont(theme,"secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", flexShrink:0 }}>
                            🗑
                          </button>
                        )}
                      </div>

                      {/* Barra de votos de confirmación */}
                      <VoteBar count={conf} needed={3} color="#22c55e" />

                      {/* Botones de votación */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", marginTop:"10px" }}>

                        {/* CONFIRMAR */}
                        <button onClick={async () => {
                          if (myVote === 1) return notify("Ya confirmaste este evento", "#38bdf8");
                          const newVotes = { ...votes, [myId]: 1 };
                          const newConf  = Object.values(newVotes).filter(v => v === 1).length;
                          await sb.from("incidents").update({ votes: newVotes }).eq("id", inc.id);
                          setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, votes: newVotes } : i));
                          notify(`✓ Confirmado (${newConf}/3)`, "#22c55e");
                        }}
                          style={{ padding:"9px 4px", background: myVote===1?"#22c55e33":"#16a34a15", border:`1px solid ${myVote===1?"#22c55e":"#16a34a44"}`, borderRadius:"8px", color:"#22c55e", fontFamily:getFont(theme,"secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                          <span style={{ fontSize:"16px" }}>✅</span>
                          <span>CONFIRMO</span>
                          <span style={{ fontSize:"11px", background:"rgba(34,197,94,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{conf}</span>
                        </button>

                        {/* FALSO — 3 votos eliminan el evento */}
                        <button onClick={async () => {
                          if (myFalse) return notify("Ya lo marcaste como falso", "#38bdf8");
                          const newFalse = { ...falseV, [myId]: 1 };
                          const count    = Object.values(newFalse).length;
                          if (count >= 3) {
                            await sb.from("incidents").delete().eq("id", inc.id);
                            setIncidents(prev => prev.filter(i => i.id !== inc.id));
                            notify("❌ Evento eliminado — 3 votos falsos", "#ef4444");
                          } else {
                            await sb.from("incidents").update({ false_votes: newFalse }).eq("id", inc.id);
                            setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, false_votes: newFalse } : i));
                            notify(`✗ Marcado como falso (${count}/3)`, "#ef4444");
                          }
                        }}
                          style={{ padding:"9px 4px", background: myFalse?"#ef444433":"#ef444415", border:`1px solid ${myFalse?"#ef4444":"#ef444444"}`, borderRadius:"8px", color:"#ef4444", fontFamily:getFont(theme,"secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                          <span style={{ fontSize:"16px" }}>❌</span>
                          <span>FALSO</span>
                          <span style={{ fontSize:"11px", background:"rgba(239,68,68,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{falsos}</span>
                        </button>

                        {/* RESUELTO — 3 votos cierran el evento */}
                        <button onClick={async () => {
                          if (myResolve) return notify("Ya votaste como resuelto", "#38bdf8");
                          const newResolve = { ...resolveV, [myId]: 1 };
                          const count      = Object.values(newResolve).length;
                          if (count >= 3) {
                            await sb.from("incidents").update({ resolve_votes: newResolve, resolved: true }).eq("id", inc.id);
                            setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, resolve_votes: newResolve, resolved: true } : i));
                            notify("🏁 Evento cerrado como resuelto", "#6b7280");
                          } else {
                            await sb.from("incidents").update({ resolve_votes: newResolve }).eq("id", inc.id);
                            setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, resolve_votes: newResolve } : i));
                            notify(`🏁 Voto resuelto (${count}/3)`, "#6b7280");
                          }
                        }}
                          style={{ padding:"9px 4px", background: myResolve?"#6b728033":"#6b728015", border:`1px solid ${myResolve?"#6b7280":"#6b728044"}`, borderRadius:"8px", color:"#94a3b8", fontFamily:getFont(theme,"secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                          <span style={{ fontSize:"16px" }}>🏁</span>
                          <span>RESUELTO</span>
                          <span style={{ fontSize:"11px", background:"rgba(107,114,128,0.2)", borderRadius:"4px", padding:"1px 6px", minWidth:"18px", textAlign:"center" }}>{resueltos}</span>
                        </button>
                      </div>

                      {/* Indicador de mi voto */}
                      {(myVote || myFalse || myResolve) && (
                        <div style={{ fontSize:"9px", fontFamily:getFont(theme,"secondary"), marginTop:"6px", textAlign:"center",
                          color: myVote===1 ? "#22c55e" : myFalse ? "#ef4444" : "#94a3b8" }}>
                          {myVote===1  ? "✓ Confirmaste este evento"
                          : myFalse   ? "✗ Lo marcaste como falso"
                          :             "🏁 Votaste como resuelto"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
          <ToastBox toast={toast} />
        </div>
      )}

    </div>
  );
}

// --- MAPA DE TERMINALES (Polígonos Leaflet — Zona Norte y Sur) ---
const TERM_POLYGONS = {
  norte: [
    {
      id: "contecon",
      name: "Terminal CONTECON",
      coords: [
        [19.07259343532231,-104.3001577299536],[19.07035526789256,-104.2984716919632],
        [19.0715341281856,-104.2969527347803],[19.07216655660368,-104.2969872334632],
        [19.07217647680472,-104.2965532134932],[19.07252348978535,-104.2964980200868],
        [19.07253958196979,-104.2961397217739],[19.08241600416959,-104.2985699233267],
        [19.08251423814663,-104.2982629594914],[19.08434297041979,-104.2991464486752],
        [19.0856482329018,-104.3014009847926],[19.08560142045884,-104.3027802249611],
        [19.08459728741261,-104.3034837818302],[19.08348416314914,-104.3037779611769],
        [19.08119551061989,-104.3031894630627],[19.07624387569157,-104.3013300320585],
        [19.0736832884229,-104.3004618636652],[19.07259343532231,-104.3001577299536],
      ],
    },
    {
      id: "hazesa",
      name: "Terminal HAZESA",
      coords: [
        [19.08087297783128,-104.2955252513315],[19.07909647966719,-104.2947746965392],
        [19.07922356655249,-104.2945401313519],[19.0797447843262,-104.2938218072611],
        [19.08097243379871,-104.2948126723753],[19.0816578883964,-104.2938855999497],
        [19.08190132086511,-104.2937794989158],[19.0824023621304,-104.2941665413803],
        [19.08301520020058,-104.2932979079222],[19.08491848107109,-104.2949034692849],
        [19.08485815894894,-104.295015046867],[19.08465584985267,-104.2948715072131],
        [19.08443288025033,-104.2948882878617],[19.08430557799981,-104.2949890442737],
        [19.08421769090845,-104.2951385472211],[19.08415578452841,-104.2953726437304],
        [19.08429369406628,-104.2956241264926],[19.08433642111384,-104.2958426964074],
        [19.08405054409992,-104.2970402138667],[19.08400111934708,-104.2972545867877],
        [19.08349044617464,-104.2971237553297],[19.08333237361442,-104.297881169229],
        [19.08301481455872,-104.2977296849959],[19.08343259437139,-104.2965555970505],
        [19.08087297783128,-104.2955252513315],
      ],
    },
  ],
  sur: [
    // Nota: Solo terminales votables (TERMINALS_SUR). ASIPONA y GRANELERA excluidos.
    {
      id: "timsa",
      name: "Terminal TIMSA",
      coords: [
        [19.05804268353717,-104.2940583237333],[19.05709833621557,-104.2936952304654],
        [19.05735173148216,-104.2926720548844],[19.05754750073681,-104.2922233620006],
        [19.05805643909389,-104.2916375548249],[19.05871161156576,-104.2912426525859],
        [19.0588872142691,-104.2910487864586],[19.05948161925259,-104.29095032432],
        [19.06150696129355,-104.2905773801025],[19.06171177241057,-104.292283632046],
        [19.05856177636457,-104.2925763987665],[19.05837539658991,-104.2927806249156],
        [19.05804268353717,-104.2940583237333],
      ],
    },
    {
      id: "ssa",
      name: "Terminal SSA MARINE",
      coords: [
        [19.0646977400203,-104.2922061515036],[19.0646357975454,-104.2915678108654],
        [19.06513417096276,-104.290420578519],[19.0658454930346,-104.2897055437055],
        [19.06614967666973,-104.2895652744067],[19.06761220238709,-104.2892762266203],
        [19.06841839844327,-104.2891863799502],[19.06930191507501,-104.2890470713492],
        [19.06927595855804,-104.2888339616764],[19.07124104555771,-104.288521046546],
        [19.0730506826051,-104.2881910696242],[19.07498415322076,-104.2879562168251],
        [19.07501681526491,-104.2882506334688],[19.07535754173578,-104.2881681536336],
        [19.07641767011053,-104.2879717090527],[19.07678168309192,-104.2879518186103],
        [19.07703627728095,-104.2880238279835],[19.07738433613553,-104.2883195345198],
        [19.07752933920258,-104.2884648275602],[19.07754098075692,-104.2886124982734],
        [19.07727686574874,-104.2889627963783],[19.07706644591396,-104.2891840483577],
        [19.07680104894372,-104.289235556245],[19.07665602971498,-104.2894047131787],
        [19.07676504037099,-104.2900603486475],[19.0646977400203,-104.2922061515036],
      ],
    },
    {
      id: "ocupa",
      name: "Terminal Multipropósito (OCUPA)",
      coords: [
        [19.05989996607472,-104.3008986613557],[19.05975293929198,-104.3012223754536],
        [19.05941459192042,-104.3011039505642],[19.05886736913771,-104.3013473627874],
        [19.05870323453135,-104.3011878333852],[19.05574274834413,-104.3027532172049],
        [19.05567524445685,-104.3028407787419],[19.05560328437275,-104.3027279994677],
        [19.05563724456303,-104.3024957457179],[19.05564429389753,-104.3020339084677],
        [19.05570273925106,-104.3010814043656],[19.05576885143374,-104.2996348212271],
        [19.05583429012136,-104.2995201136561],[19.05596961999662,-104.2994643518991],
        [19.05661311547551,-104.2997930482844],[19.05788640774683,-104.3004339367377],
        [19.05801863524582,-104.300370532563],[19.05831116652419,-104.299612138612],
        [19.06011175328339,-104.300476420493],[19.06017845074481,-104.3005243107278],
        [19.06005697331839,-104.3007820149846],[19.05994731924822,-104.3007585668205],
        [19.05989996607472,-104.3008986613557],
      ],
    },
    {
      id: "ocupa",
      name: "Terminal Multipropósito (OCUPA) — Sector 2",
      coords: [
        [19.0558591975237,-104.2992903262289],[19.0557847872635,-104.2989068379601],
        [19.05609866320785,-104.2985647931401],[19.05642236792869,-104.2985682690798],
        [19.05678586620324,-104.298773528031],[19.05643184769795,-104.2995451250102],
        [19.0558591975237,-104.2992903262289],
      ],
    },
    {
      id: "friman",
      name: "Terminal FRIMAN",
      coords: [
        [19.0569472326289,-104.2947288656582],[19.05761932789732,-104.2949610853841],
        [19.05752906310905,-104.2953283771701],[19.05721635560518,-104.2964426492044],
        [19.05670633403471,-104.2982947234177],[19.05655430974296,-104.2984883056355],
        [19.05635625719471,-104.2983769751084],[19.05616793064814,-104.2981625100036],
        [19.05606951343465,-104.2978269311122],[19.05636641298848,-104.2964946159845],
        [19.05652142083681,-104.2959258432888],[19.0566727559921,-104.2954740490033],
        [19.05680194999001,-104.2947797829167],[19.0569472326289,-104.2947288656582],
      ],
    },
    {
      id: "lajunta",
      name: "Terminal LA JUNTA (TAP)",
      coords: [
        [19.06388640182398,-104.2915710917714],[19.06179982510325,-104.2920048012427],
        [19.06159085502389,-104.2906351882321],[19.0617389020674,-104.2905223574031],
        [19.06483481073561,-104.2900795825545],[19.06487326624962,-104.2903089697335],
        [19.06374377195202,-104.2906601180799],[19.06388640182398,-104.2915710917714],
      ],
    },
    {
      id: "multimodal",
      name: "Terminal MULTIMODAL",
      coords: [
        [19.05793245011511,-104.2940442104837],[19.05767481634728,-104.2949011423269],
        [19.05686212239299,-104.294583094978],[19.05701723506709,-104.293887016796],
        [19.0571117352032,-104.2938749917222],[19.05717284136455,-104.2937533843375],
        [19.05793245011511,-104.2940442104837],
      ],
    },
    {
      id: "granelera",
      name: "GRANELERA",
      coords: [
        [19.06486037446202,-104.2903684513182],[19.06496671717024,-104.2904348442651],
        [19.0647794482524,-104.290745178185],[19.06449910212673,-104.2914785428933],
        [19.0639088902813,-104.2915843083561],[19.06375559419703,-104.2906852786647],
        [19.06453151466771,-104.2904300788427],[19.06486037446202,-104.2903684513182],
      ],
    },
    {
      id: "asipona",
      name: "Recinto ASIPONA",
      coords: [
        [19.05579138657265,-104.3044729641315],[19.05562104563183,-104.3040738404413],
        [19.05550525559543,-104.3035571920986],[19.05551748737205,-104.3031931324449],
        [19.0556062850702,-104.3030234873377],[19.05578766418563,-104.3031308667712],
        [19.05610732085112,-104.3029620324507],[19.05671079113172,-104.3038915424634],
        [19.05579138657265,-104.3044729641315],
      ],
    },
  ],
};

function MapaTerminales({ zona, stMap }) {
  const theme = React.useContext(ThemeContext);
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const polyRefs  = useRef({});
  const tileRef   = useRef(null);
  const labelRef  = useRef(null);
  const zonaRef   = useRef(zona); // ✅ FIX: ref para acceder a zona actual en callbacks
  const stMapRef  = useRef(stMap);
  const [tileMode, setTileMode] = useState("dark");

  const TILE_OPTIONS = [
    { id: "dark",      label: "Noche",    icon: "🌙", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",                                                              subdomains: "abcd", labels: null },
    { id: "streets",   label: "Calles",   icon: "🗺️", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                                                                         subdomains: "abc",  labels: null },
    { id: "satellite", label: "Satélite", icon: "🛰️", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",                              subdomains: "",     labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" },
    { id: "light",     label: "Claro",    icon: "☀️", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",                                                             subdomains: "abcd", labels: null },
  ];

  const getPolyColor = (id, sm) => {
    const s = sm || stMapRef.current;
    if (!s || !s[id]) return "#22c55e";
    const opt = TERMINAL_STATUS_OPTIONS.find(o => o.id === s[id].status);
    return opt ? opt.color : "#22c55e";
  };

  // ✅ FIX: Helper para cargar polígonos de una zona en el mapa existente
  const loadZonePolygons = (z, sm) => {
    if (!leafRef.current || !window.L) return;
    const L = window.L;
    const map = leafRef.current;

    // Limpiar polígonos anteriores
    Object.values(polyRefs.current).forEach(layer => { try { map.removeLayer(layer); } catch {} });
    polyRefs.current = {};

    // Centro y zoom según zona
    const center = z === "norte" ? [19.0785, -104.2983] : [19.0615, -104.2960];
    map.setView(center, 14, { animate: true, duration: 0.5 });

    // Añadir polígonos de la nueva zona
    const polys = TERM_POLYGONS[z] || [];
    polys.forEach(poly => {
      const color = getPolyColor(poly.id, sm);
      const layer = L.polygon(poly.coords, {
        color,
        weight: 2.5,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.35,
      }).addTo(map);
      const opt = TERMINAL_STATUS_OPTIONS.find(o => o.id === sm?.[poly.id]?.status) || TERMINAL_STATUS_OPTIONS[0];
      layer.bindTooltip(
        `<b>${poly.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`,
        { sticky: true, className: "cm-tooltip", direction: "center" }
      );
      polyRefs.current[poly.id] = layer;
    });
  };

  // ✅ FIX PRINCIPAL: Init solo una vez con []
  useEffect(() => {
    const init = () => {
      if (leafRef.current || !mapRef.current || !window.L) return;
      const L = window.L;
      const z = zonaRef.current;
      const center = z === "norte" ? [19.0785, -104.2983] : [19.0615, -104.2960];

      const map = L.map(mapRef.current, {
        center,
        zoom: 14,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      tileRef.current = L.tileLayer(TILE_OPTIONS[0].url, { maxZoom: 19, subdomains: TILE_OPTIONS[0].subdomains }).addTo(map);
      leafRef.current = map;

      // Cargar polígonos de la zona inicial
      loadZonePolygons(z, stMapRef.current);

      if (!document.getElementById("cm-map-style")) {
        const s = document.createElement("style");
        s.id = "cm-map-style";
        s.textContent = `
          .cm-tooltip { background:rgba(4,12,24,0.95)!important; border:1px solid rgba(56,189,248,0.35)!important; border-radius:6px!important; color:rgba(255,255,255,0.9)!important; font-family:'DM Sans',sans-serif!important; font-size:12px!important; font-weight:600!important; padding:4px 9px!important; box-shadow:0 2px 12px rgba(0,0,0,0.5)!important; white-space:nowrap!important; }
          .cm-tooltip::before { display:none!important; }
          .leaflet-control-zoom a { background:rgba(4,12,24,0.9)!important; color:rgba(255,255,255,0.7)!important; border-color:rgba(255,255,255,0.1)!important; }
          .leaflet-control-zoom a:hover { background:rgba(56,189,248,0.2)!important; }
        `;
        document.head.appendChild(s);
      }
    };

    if (window.L) { init(); }
    else {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link"); link.rel = "stylesheet";
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
    }
    return () => { if (leafRef.current) { leafRef.current.remove(); leafRef.current = null; polyRefs.current = {}; } };
  }, []); // ✅ Solo [] — el mapa se crea una sola vez

  // ✅ FIX: Effect separado que reacciona al cambio de zona SIN recrear el mapa
  useEffect(() => {
    zonaRef.current = zona;
    stMapRef.current = stMap;
    if (leafRef.current && window.L) {
      loadZonePolygons(zona, stMap);
    }
  }, [zona]); // eslint-disable-line

  // Cambiar tile
  useEffect(() => {
    if (!leafRef.current || !tileRef.current || !window.L) return;
    const L = window.L;
    const t = TILE_OPTIONS.find(t => t.id === tileMode);
    if (!t) return;
    tileRef.current.setUrl(t.url);
    tileRef.current.options.subdomains = t.subdomains || "abc";
    if (labelRef.current) { leafRef.current.removeLayer(labelRef.current); labelRef.current = null; }
    if (t.labels) {
      labelRef.current = L.tileLayer(t.labels, { maxZoom: 19, pane: "overlayPane" }).addTo(leafRef.current);
    }
  }, [tileMode]);

  // ✅ FIX: Effect para actualizar colores cuando cambia stMap (sin recrear nada)
  useEffect(() => {
    stMapRef.current = stMap;
    if (!leafRef.current || !stMap) return;
    const polys = TERM_POLYGONS[zonaRef.current] || [];
    polys.forEach(poly => {
      const layer = polyRefs.current[poly.id];
      if (!layer) return;
      const color = getPolyColor(poly.id, stMap);
      layer.setStyle({ color, fillColor: color, fillOpacity: 0.35, weight: 2.5, opacity: 1 });
      const opt = TERMINAL_STATUS_OPTIONS.find(o => o.id === stMap?.[poly.id]?.status) || TERMINAL_STATUS_OPTIONS[0];
      layer.bindTooltip(
        `<b>${poly.name}</b><br><span style="color:${opt.color}">${opt.icon} ${opt.label}</span>`,
        { sticky: true, className: "cm-tooltip", direction: "center" }
      );
    });
  }, [JSON.stringify(stMap)]);

  const zonaColor = zona === "norte" ? "#38bdf8" : "#a78bfa";

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div style={{ borderRadius: "14px 14px 0 0", overflow: "hidden", border: `1px solid ${zonaColor}33`, borderBottom: "none" }}>
        <div style={{ padding: "10px 14px", background: "rgba(4,12,24,0.95)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px" }}>🗺️</span>
          <span style={{ fontFamily: getFont(theme, "title"), fontSize: "14px", color: "rgba(255,255,255,0.9)" }}>
            Mapa Terminales <span style={{ color: zonaColor }}>Zona {zona === "norte" ? "Norte" : "Sur"}</span>
          </span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>· estado en tiempo real</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {TILE_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTileMode(t.id)} style={{
                padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer",
                background: tileMode === t.id ? zonaColor : "rgba(255,255,255,0.08)",
                color: tileMode === t.id ? "#0a0f1e" : "rgba(255,255,255,0.5)",
                fontFamily: getFont(theme, "secondary"), fontSize: "11px", fontWeight: tileMode === t.id ? "700" : "400",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>
      </div>
      {/* Mapa */}
      <div style={{ border: `1px solid ${zonaColor}33`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden", boxShadow: "0 4px 32px rgba(0,0,0,0.5)" }}>
        <div ref={mapRef} style={{ width: "100%", height: "300px", background: "#040c18" }} />
      </div>
      {/* Leyenda */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
        {TERMINAL_STATUS_OPTIONS.map(o => (
          <span key={o.id} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "#e2e8f0" }}>
            <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: o.color + "55", border: `2px solid ${o.color}`, display: "inline-block", boxShadow: `0 0 6px ${o.color}70` }} />
            {o.icon} {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- TAB: TERMINALES ---
// --- TICKER MÁQUINA DE ESCRIBIR ---
function TypewriterTicker({ items }) {
  const [idx,     setIdx]     = useState(0);
  const [display, setDisplay] = useState("");
  const [phase,   setPhase]   = useState("typing"); // typing | pause | erasing
  const timerRef = useRef(null);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const item = items[idx % items.length];
    const full = item.text || "";

    const tick = () => {
      if (phase === "typing") {
        setDisplay(prev => {
          const next = full.slice(0, prev.length + 1);
          if (next === full) {
            clearInterval(timerRef.current);
            timerRef.current = setTimeout(() => setPhase("erasing"), 1800);
          }
          return next;
        });
      } else if (phase === "erasing") {
        setDisplay(prev => {
          const next = prev.slice(0, -1);
          if (next === "") {
            clearInterval(timerRef.current);
            timerRef.current = setTimeout(() => {
              setIdx(i => (i + 1) % items.length);
              setPhase("typing");
            }, 400);
          }
          return next;
        });
      }
    };

    if (phase === "typing" || phase === "erasing") {
      timerRef.current = setInterval(tick, phase === "typing" ? 55 : 30);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, idx, items]);

  if (!items || items.length === 0) return null;
  const item = items[idx % items.length];

  return (
    <div style={{
      background: "rgba(4,12,24,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(56,189,248,0.2)",
      borderLeft: `3px solid ${item.color || "#38bdf8"}`,
      borderRadius: "10px",
      padding: "10px 14px",
      marginBottom: "14px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minHeight: "42px",
    }}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>📡</span>
      <span style={{
        fontFamily: "'DM Sans', monospace",
        fontSize: "13px",
        fontWeight: "700",
        color: item.color || "#38bdf8",
        letterSpacing: "0.5px",
        minWidth: "0",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}>
        {display}<span style={{ opacity: 0.7, animation: "blink 1s step-end infinite" }}>|</span>
      </span>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function TerminalesTab({ myId }) {
  const theme = React.useContext(ThemeContext);
  const [zona,   setZona]   = useState(() => {
    try { return sessionStorage.getItem("term_zona") || "norte"; } catch { return "norte"; }
  });
  const setZonaPersist = (z) => {
    try { sessionStorage.setItem("term_zona", z); } catch {}
    setZona(z);
  };
  const [stN,         setStN]         = useState(null);  // null = loading
  const [stS,         setStS]         = useState(null);  // null = loading
  const [toast,       setToast]       = useState(null);
  const [changeModal, setChangeModal] = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };
  const terminals = zona === "norte" ? TERMINALS_NORTE : TERMINALS_SUR;
  const stMap     = zona === "norte" ? (stN || {}) : (stS || {});
  const setSt     = zona === "norte" ? setStN : setStS;

  // Ticker items — todas las terminales con su estado
  const tickerItems = (!stN || !stS) ? [] : [...TERMINALS_NORTE, ...TERMINALS_SUR].map(t => {
    const st = (TERMINALS_NORTE.find(x => x.id === t.id) ? stN : stS)[t.id];
    const opt = TERMINAL_STATUS_OPTIONS.find(o => o.id === st?.status) || TERMINAL_STATUS_OPTIONS[0];
    return { text: `${t.name} — ${opt.label.toUpperCase()}`, color: opt.color };
  });

  useEffect(() => {
    const allTerms = [...TERMINALS_NORTE, ...TERMINALS_SUR];
    sb.from("terminals").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("terminals").upsert(allTerms.map(t => ({ id: t.id, status: "libre", last_update: Date.now(), updated_by: "Sistema" })));
        setStN(mkTerminals(TERMINALS_NORTE));
        setStS(mkTerminals(TERMINALS_SUR));
        return;
      }
      const mapN = {}; const mapS = {};
      data.forEach(r => {
        const entry = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
        if (TERMINALS_NORTE.find(t => t.id === r.id)) mapN[r.id] = entry;
        else mapS[r.id] = entry;
      });
      setStN({ ...mkTerminals(TERMINALS_NORTE), ...mapN });
      setStS({ ...mkTerminals(TERMINALS_SUR),   ...mapS });
    });
    const chan = sb.channel("terminals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "terminals" }, ({ new: r }) => {
        if (!r) return;
        const entry = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
        if (TERMINALS_NORTE.find(t => t.id === r.id)) setStN(prev => ({ ...prev, [r.id]: entry }));
        else setStS(prev => ({ ...prev, [r.id]: entry }));
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  const vote = async (termId, newStatus, forceChange = false) => {
    const rl = rateLimiter.check(`terminal_vote_${myId}`, 30000);
    if (!rl.allowed && !forceChange) return notify(`Espera ${rl.remaining}s antes de votar de nuevo`, "#f97316");
    const { data: yaVoto } = await sb.from("votos").select("id").eq("user_id", myId).eq("terminal_id", termId).eq("tipo", "terminal");
    if (yaVoto && yaVoto.length > 0 && !forceChange) {
      const label = TERMINAL_STATUS_OPTIONS.find(o => o.id === newStatus)?.label || newStatus;
      setChangeModal({ type: "terminal", id: termId, newStatus, label });
      return;
    }
    if (yaVoto && yaVoto.length > 0 && forceChange) {
      await sb.from("votos").delete().eq("user_id", myId).eq("terminal_id", termId).eq("tipo", "terminal");
    }
    const key = `terminal_${termId}_${newStatus}`;
    await sb.from("votos").insert({ key, user_id: myId, terminal_id: termId, status: newStatus, tipo: "terminal" });
    // Guardar voto del usuario en localStorage para sobrevivir la limpieza de 15 min
    try { localStorage.setItem(`last_vote_terminal_${termId}_${myId}`, newStatus); } catch {}
    const { data: todosVotos } = await sb.from("votos").select("status").eq("terminal_id", termId).eq("tipo", "terminal");
    const conteo = {};
    (todosVotos || []).forEach(v => { conteo[v.status] = (conteo[v.status] || 0) + 1; });
    const ganadora = Object.entries(conteo).sort((a,b) => b[1]-a[1])[0];
    const [statusGanador, votosGanador] = ganadora;
    // Optimistic update
    const setSt2 = zona === "norte" ? setStN : setStS;
    setSt2(prev => ({ ...(prev || {}), [termId]: { ...(prev?.[termId] || {}), status: statusGanador, lastUpdate: Date.now(), updatedBy: `${votosGanador} votos` } }));
    await sb.from("terminals").upsert({ id: termId, status: statusGanador, pending_voters: conteo, last_update: Date.now(), updated_by: `${votosGanador} votos` });
    const label = TERMINAL_STATUS_OPTIONS.find(o => o.id === statusGanador)?.label;
    notify(`✅ ${label} lidera con ${votosGanador} voto(s)`, "#22c55e");
    const termNombre = TODAS_TERMINALES.find(t => t.id === termId)?.name || termId.toUpperCase();
    await publicarNoticia({ tipo: "terminal", icono: "⚓", color: "#38bdf8", titulo: `Terminal ${termNombre} — ${label}`, detalle: `Actualizado por consenso de ${votosGanador} voto(s)` });
  };

  const resetAll = async () => {
    const allTerms = [...TERMINALS_NORTE, ...TERMINALS_SUR];
    await sb.from("terminals").upsert(allTerms.map(t => ({ id: t.id, status: "libre", last_update: Date.now(), updated_by: "Reset" })));
    notify("✓ Todas las terminales marcadas como Libres", "#22c55e");
  };

  const resetOne = async (id) => {
    await sb.from("terminals").upsert({ id, status: "libre", last_update: Date.now(), updated_by: "Reset" });
    notify("✓ Terminal marcada como Libre", "#22c55e");
  };

  const getOpt = (id) => TERMINAL_STATUS_OPTIONS.find(o=>o.id===id) || TERMINAL_STATUS_OPTIONS[0];

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>
      <TypewriterTicker items={tickerItems} />
      <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:"10px", padding:"4px", marginBottom:"14px", border:"1px solid rgba(255,255,255,0.15)" }}>
        {["norte","sur"].map(z => (
          <button key={z} onClick={() => setZonaPersist(z)} style={{ flex:1, padding:"10px", background: zona===z ? "linear-gradient(135deg,#0369a1,#0ea5e9)" : "transparent", border:"none", borderRadius:"8px", color: zona===z ? "#fff" : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"12px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s", letterSpacing:"1px" }}>ZONA {z.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
        {TERMINAL_STATUS_OPTIONS.map(o => (
          <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"4px", background:o.color+"15", border:`1px solid ${o.color}33`, padding:"3px 8px", borderRadius:"4px" }}>
            <span style={{ color:o.color, fontSize:"11px", fontWeight:"700" }}>{o.icon}</span>
            <span style={{ color:o.color, fontSize:"10px", fontFamily:getFont(theme, "secondary") }}>{o.label}</span>
          </div>
        ))}
      </div>
      <SectionLabel text={`TERMINALES ZONA ${zona.toUpperCase()}`} rightBtn={<NormalBtn onClick={resetAll} label="TODAS LIBRES" />} />
      <MapaTerminales zona={zona} stMap={stMap} />
      {(!stN || !stS) ? <SkeletonCard n={4}/> : terminals.map(terminal => {
        const st  = stMap[terminal.id] || { status:"libre", lastUpdate: Date.now(), updatedBy:"..." };
        const opt = getOpt(st.status);
        return (
          <div key={terminal.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${opt.color}44`, borderRadius:"12px", padding:"14px", marginBottom:"14px", boxShadow:`0 0 18px ${opt.color}08` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
              <div>
                <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px" }}>{terminal.name}</div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"2px" }}>{terminal.fullName}</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"3px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
                <div style={{ background:opt.color+"22", border:`1px solid ${opt.color}66`, color:opt.color, padding:"5px 10px", borderRadius:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", gap:"4px" }}>{opt.icon} {opt.label}</div>
                {st.status !== "libre" && <button onClick={() => resetOne(terminal.id)} style={{ padding:"4px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ TODO NORMAL</button>}
              </div>
            </div>
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px" }}>REPORTAR ESTATUS: <span style={{ color:"#475569", fontSize:"9px", letterSpacing:"0px", fontWeight:"normal" }}>(doble click para cambiar)</span></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {TERMINAL_STATUS_OPTIONS.map(o => {
                const isAct = st.status === o.id;
                return (
                  <button key={o.id} onDoubleClick={() => vote(terminal.id, o.id)} onClick={() => vote(terminal.id, o.id)} style={{ padding:"8px 6px", background: isAct ? o.color+"33" : "#0a1628", border:`1px solid ${isAct ? o.color : "#1e3a5f"}`, borderRadius:"8px", color: isAct ? o.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px" }}>
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
            <div style={{ color:"#e2e8f0", fontFamily:getFont(theme, "secondary"), fontSize:"14px", fontWeight:"700", marginBottom:"8px" }}>¿Cambiar tu voto?</div>
            <div style={{ color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"12px", marginBottom:"20px" }}>
              ¿Estás seguro que quieres cambiar tu voto a <span style={{ color:"#38bdf8", fontWeight:"700" }}>{changeModal.label}</span>?
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setChangeModal(null)} style={{ flex:1, padding:"10px", background:"#1e3a5f", border:"1px solid #2d4a6f", borderRadius:"8px", color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", fontWeight:"700" }}>Cancelar</button>
              <button onClick={async () => { const m = changeModal; setChangeModal(null); await vote(m.id, m.newStatus, true); }} style={{ flex:1, padding:"10px", background:"#1d4ed822", border:"1px solid #3b82f6", borderRadius:"8px", color:"#60a5fa", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", fontWeight:"700" }}>Sí, cambiar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB: SEGUNDO ACCESO ---
// --- SLOT TEXT ---
function SlotText({ value, color = "#fff", fontSize = "9px", fontWeight = "700", delay = 0 }) {
  const [displayed, setDisplayed] = useState(value);
  const valueRef = useRef(value);   // siempre tiene el valor más reciente
  const ivRef    = useRef(null);
  const tRef     = useRef(null);
  const animatedOnce = useRef(false);

  valueRef.current = value;

  const reveal = (target) => {
    clearInterval(ivRef.current);
    setDisplayed("");
    let i = 0;
    ivRef.current = setInterval(() => {
      i++;
      // Usar siempre valueRef.current por si cambia durante la animación
      const current = valueRef.current;
      setDisplayed(current.slice(0, i));
      if (i >= current.length) {
        clearInterval(ivRef.current);
        setDisplayed(current); // garantía final
      }
    }, 45);
  };

  // Animación al montar — usa valueRef para tomar el valor más actualizado
  useEffect(() => {
    tRef.current = setTimeout(() => {
      animatedOnce.current = true;
      reveal(valueRef.current);
    }, delay);
    return () => { clearTimeout(tRef.current); clearInterval(ivRef.current); };
  }, []);

  // Animación cuando cambia el valor después del montado
  useEffect(() => {
    if (!animatedOnce.current) return;
    reveal(value);
  }, [value]);

  return (
    <span style={{ color, fontSize, fontWeight, fontFamily:"monospace", display:"inline-block", minWidth:"2ch" }}>
      {displayed}
    </span>
  );
}

// --- MAPA DE TRÁFICO — Datos para 2do Acceso ---
const TRAFICO_POLIGONO = [
  [-104.2956432328187,19.08619209124374],[-104.2958012400686,19.08612353367882],
  [-104.295237002161,19.08548834050964],[-104.2935769847386,19.08346115004283],
  [-104.2929648937837,19.08271533570677],[-104.2927876591146,19.0825059505056],
  [-104.2926958990455,19.08243047868295],[-104.2925098213441,19.08234118866323],
  [-104.2923198787531,19.08228563078084],[-104.2921099866352,19.08227915286889],
  [-104.2918012457869,19.08236984573452],[-104.2912425111083,19.08259531619683],
  [-104.2904769657134,19.08287557945914],[-104.2902670834497,19.08297022506358],
  [-104.2899109973722,19.08327349493017],[-104.2896155062826,19.08354535141965],
  [-104.2894642386681,19.08374550992097],[-104.2893643146049,19.08396303706772],
  [-104.2891251747735,19.08421311626825],[-104.2880868407839,19.085140979565],
  [-104.2862908405063,19.08673429594806],[-104.2851452649081,19.08773494781913],
  [-104.2848239952701,19.08800377725654],[-104.284578976879,19.08790925616328],
  [-104.2845293666355,19.0880134022355],[-104.2849993401042,19.08842799978833],
  [-104.2850684558474,19.08852554320096],[-104.285063519266,19.08885936093019],
  [-104.2850823762815,19.08967029162529],[-104.28487643742,19.09060924337723],
  [-104.284637535181,19.09153000811393],[-104.2845454082646,19.091824845858],
  [-104.2837140360618,19.09328485849791],[-104.2830848869176,19.09439916644509],
  [-104.282875952596,19.09479619656998],[-104.2828539377395,19.09512323676537],
  [-104.2830321652888,19.09591953640828],[-104.2831730456464,19.09655741957823],
  [-104.2833366996257,19.09693315400825],[-104.2833801180437,19.09725733105946],
  [-104.2832808923378,19.09759914423141],[-104.2830810686392,19.09835181633892],
  [-104.2832630559254,19.09844454745516],[-104.2835064852598,19.09746109534955],
  [-104.2835759095441,19.09709534374852],[-104.2834771366589,19.09676893864881],
  [-104.2833830530463,19.09655937108205],[-104.2832535580456,19.0961424961597],
  [-104.2831193966912,19.09542962605835],[-104.2830565882209,19.09510222903079],
  [-104.2830694995621,19.09489180095153],[-104.2832679223545,19.09443543927461],
  [-104.2837297069643,19.09358075378652],[-104.2843303407103,19.0925472223253],
  [-104.2846806347927,19.09192902322917],[-104.2847899463359,19.09168427780067],
  [-104.2849481312142,19.09102076845924],[-104.2851562313191,19.0902180805804],
  [-104.2852761572432,19.08973551293583],[-104.2852326843038,19.08909857089786],
  [-104.2852181469885,19.08842824627107],[-104.2853219530563,19.08802616350718],
  [-104.2854400621628,19.08777906650823],[-104.2855966008766,19.08759158025215],
  [-104.2858788741858,19.0873182784884],[-104.2872117289639,19.08614139684764],
  [-104.2887021935913,19.08480441208977],[-104.2894261290447,19.08420016677874],
  [-104.2895499907893,19.08403106068409],[-104.2896772834872,19.08377100405592],
  [-104.289833747144,19.08359710991313],[-104.2903461857223,19.08314729059766],
  [-104.2906729291834,19.08298499870989],[-104.2914323855376,19.08269258818945],
  [-104.2920481341167,19.08247699820355],[-104.2923002738972,19.08247494003926],
  [-104.2925585156614,19.08254974003597],[-104.2927825558107,19.08276688508045],
  [-104.2931883188278,19.08325875146242],[-104.2936771799497,19.08381058708915],
  [-104.2944559279856,19.08476658875541],[-104.2948519888484,19.08529460955485],
  [-104.2952194575188,19.08574234095812],[-104.2956432328187,19.08619209124374],
];

const TRAFICO_FASES = {
  1: { nombre: "Fase 1", descripcion: "Explanada Zona Norte → Correos de México", coords: [[-104.2956819191555,19.08615187774392],[-104.2933482926518,19.08329862234055],[-104.2926130412677,19.08246484120855],[-104.2923604823659,19.08237622650364],[-104.2919951914411,19.08238298388435],[-104.2912298218874,19.08269613031682],[-104.2903750532096,19.08301205959789],[-104.2897695783387,19.08352106173542],[-104.289595889205,19.08371635973616],[-104.2894480932443,19.08403501303767],[-104.2885276558661,19.08486118178601],[-104.2856464237334,19.08742932269167]] },
  2: { nombre: "Fase 2", descripcion: "Correos de México → Algodones", coords: [[-104.2851377878937,19.08904301224161],[-104.2851611059012,19.08972573464031],[-104.2847464925899,19.09156089341323],[-104.2835650740145,19.09373023521704]] },
  3: { nombre: "Fase 3", descripcion: "Algodones → Libramiento", coords: [[-104.2835322448865,19.0938393761189],[-104.2830335782314,19.09478118077988],[-104.2829477956785,19.09503652399597],[-104.2831681456968,19.09613774222283],[-104.2833216300948,19.09667034384744],[-104.2834821239215,19.09708402791151],[-104.2834505445804,19.09727893231578],[-104.283162837602,19.09844677179581]] },
};

const TRAFICO_STATUS = {
  fluido:   { color: "#22c55e", label: "Fluido",   emoji: "🟢", bg: "#dcfce7", text: "#15803d" },
  moderado: { color: "#f97316", label: "Moderado", emoji: "🟠", bg: "#ffedd5", text: "#c2410c" },
  detenido: { color: "#ef4444", label: "Detenido", emoji: "🔴", bg: "#fee2e2", text: "#b91c1c" },
  sinuso:   { color: "#a855f7", label: "Sin Uso",  emoji: "🟣", bg: "#f3e8ff", text: "#7e22ce" },
};

const TRAFICO_MAP_STYLES = {
  streets:     { name: "Calles",   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",    attribution: "© OpenStreetMap", subdomains: "abc" },
  humanitarian:{ name: "Claro",    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", subdomains: "ab"  },
  satellite:   { name: "Satélite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", subdomains: "" },
};

const toLLC = (coords) => coords.map(([lng, lat]) => [lat, lng]);

const VOTOS_DEFAULT = {
  1: { fluido: 0, moderado: 0, detenido: 0, sinuso: 0 },
  2: { fluido: 0, moderado: 0, detenido: 0, sinuso: 0 },
  3: { fluido: 0, moderado: 0, detenido: 0, sinuso: 0 },
};

function useLeaflet() {
  const [L, setL] = useState(null);
  useEffect(() => {
    if (window.L) { setL(window.L); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => setL(window.L);
    document.head.appendChild(script);
  }, []);
  return L;
}

// --- Sub-componente: Mapa de Tráfico para 2do Acceso ---
function TrafficMapSegundo({ theme }) {
  const L = useLeaflet();
  const mapRef    = useRef(null);
  const mapInstanceRef = useRef(null);
  const linesRef  = useRef({});
  const shadowsRef = useRef({});
  const tileLayerRef = useRef(null);

  const [votos, setVotos]           = useState(VOTOS_DEFAULT);
  const [statusMapa, setStatusMapa] = useState({ 1: "fluido", 2: "fluido", 3: "fluido" });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeVote, setActiveVote] = useState({ fase: null, tipo: null });
  const [mapStyle, setMapStyle]     = useState("streets");

  const TABLA  = "carriles";
  const ROW_ID = "trafico_mapa_votos";

  // -- Calcular status dominante ---
  const calcStatus = (votes) => {
    // "Sin Uso" toma prioridad si tiene al menos un voto
    if ((votes.sinuso || 0) > 0) return "sinuso";
    const entries = Object.entries(votes).filter(([k]) => k !== "sinuso");
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total === 0) return "fluido";
    return entries.reduce((best, [k, n]) => (n > best[1] ? [k, n] : best), ["fluido", -1])[0];
  };

  const recalcAllStatus = (v) => ({
    1: calcStatus(v[1]),
    2: calcStatus(v[2]),
    3: calcStatus(v[3]),
  });

  // -- Cargar votos desde Supabase + suscripción en tiempo real ---
  useEffect(() => {
    sb.from(TABLA).select("*").eq("id", ROW_ID).single().then(({ data }) => {
      if (data?.data) {
        const loaded = { ...VOTOS_DEFAULT, ...data.data };
        setVotos(loaded);
        setStatusMapa(recalcAllStatus(loaded));
      }
    });
    const chan = sb.channel("trafico-mapa-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLA }, ({ new: r }) => {
        if (r?.id === ROW_ID && r?.data) {
          const loaded = { ...VOTOS_DEFAULT, ...r.data };
          setVotos(loaded);
          setStatusMapa(recalcAllStatus(loaded));
        }
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  // -- Inicializar mapa Leaflet ---
  useEffect(() => {
    if (!L || !mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [19.0905, -104.2890], zoom: 15, zoomControl: true });
    const style = TRAFICO_MAP_STYLES[mapStyle];
    tileLayerRef.current = L.tileLayer(style.url, { attribution: style.attribution, subdomains: style.subdomains || "abc", maxZoom: 20 }).addTo(map);
    L.polygon(toLLC(TRAFICO_POLIGONO), { color: "#fbbf24", weight: 2.5, opacity: 0.7, fillColor: "#fbbf24", fillOpacity: 0.08 })
      .addTo(map).bindTooltip("Vialidad — contorno general", { sticky: true });
    Object.entries(TRAFICO_FASES).forEach(([id, fase]) => {
      const shadow = L.polyline(toLLC(fase.coords), { color: "#000", weight: 14, opacity: 0.2, lineCap: "round", lineJoin: "round" }).addTo(map);
      const line   = L.polyline(toLLC(fase.coords), { color: TRAFICO_STATUS.fluido.color, weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(map);
      line.bindTooltip(`<b>${fase.nombre}</b><br>${fase.descripcion}`, { sticky: true });
      shadowsRef.current[id] = shadow;
      linesRef.current[id]   = line;
    });
    L.circleMarker([19.08615, -104.29568], { radius: 8, fillColor: "#6366f1", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(map).bindTooltip("Explanada Zona Norte", { direction: "right" });
    L.circleMarker([19.08743, -104.28564], { radius: 8, fillColor: "#8b5cf6", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(map).bindTooltip("Correos de México",    { direction: "top"   });
    L.circleMarker([19.09373, -104.28356], { radius: 8, fillColor: "#ec4899", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(map).bindTooltip("Algodones",             { direction: "top"   });
    L.circleMarker([19.09845, -104.28316], { radius: 8, fillColor: "#14b8a6", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(map).bindTooltip("Libramiento",           { direction: "left"  });
    mapInstanceRef.current = map;
  }, [L]);

  // -- Cambiar estilo de mapa ---
  const changeMapStyle = (newStyle) => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const style = TRAFICO_MAP_STYLES[newStyle];
    tileLayerRef.current = L.tileLayer(style.url, { attribution: style.attribution, subdomains: style.subdomains || "abc", maxZoom: 20 }).addTo(mapInstanceRef.current);
    setMapStyle(newStyle);
  };

  // -- Actualizar colores en el mapa cuando cambia el status ---
  useEffect(() => {
    Object.entries(statusMapa).forEach(([id, st]) => {
      const line = linesRef.current[id];
      if (line) line.setStyle({ color: TRAFICO_STATUS[st].color });
    });
  }, [statusMapa]);

  // -- Votar y guardar en Supabase ---
  const votar = async (fase, tipo) => {
    setActiveVote({ fase, tipo });
    setTimeout(() => setActiveVote({ fase: null, tipo: null }), 600);

    let next;
    if (tipo === "sinuso") {
      // Toggle: si ya está en sinuso, lo desactiva; si no, lo activa y limpia los demás
      const yaActivo = statusMapa[fase] === "sinuso";
      next = {
        ...votos,
        [fase]: yaActivo
          ? { fluido: 0, moderado: 0, detenido: 0, sinuso: 0 }
          : { fluido: 0, moderado: 0, detenido: 0, sinuso: 1 },
      };
    } else {
      next = {
        ...votos,
        [fase]: { ...votos[fase], sinuso: 0, [tipo]: votos[fase][tipo] + 1 },
      };
    }

    setVotos(next);
    setStatusMapa(recalcAllStatus(next));

    const now = new Date();
    setLastUpdate(`${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`);

    await sb.from(TABLA).upsert({ id: ROW_ID, data: next });
  };

  const totalVotos = (fase) => Object.entries(votos[fase]).filter(([k]) => k !== "sinuso").reduce((a, [,b]) => a + b, 0);

  // -- Render ---
  return (
    <div>
      {/* Header del mapa */}
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "12px 16px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: "10px", color: "#38bdf8", fontFamily: getFont(theme,"secondary"), letterSpacing: "2px", marginBottom: "2px", fontWeight: "700" }}>MAPA — VIALIDAD EN TIEMPO REAL</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontFamily: getFont(theme,"secondary") }}>Reportado por usuarios · Manzanillo, Colima</div>
        </div>
        {lastUpdate && (
          <span style={{ fontSize: "11px", color: "#e2e8f0", background: "rgba(56,189,248,0.12)", padding: "5px 12px", borderRadius: "20px", border: "1px solid rgba(56,189,248,0.3)", fontFamily: getFont(theme,"secondary") }}>
            🕐 {lastUpdate}
          </span>
        )}
      </div>

      {/* Selector de estilo de mapa */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "10px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontFamily: getFont(theme,"secondary") }}>Estilo:</span>
        {Object.entries(TRAFICO_MAP_STYLES).map(([key, style]) => (
          <button key={key} onClick={() => changeMapStyle(key)} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "8px", border: `1.5px solid ${mapStyle === key ? "#38bdf8" : "rgba(255,255,255,0.18)"}`, background: mapStyle === key ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.04)", color: mapStyle === key ? "#38bdf8" : "#e2e8f0", cursor: "pointer", fontWeight: mapStyle === key ? 700 : 500, fontFamily: getFont(theme,"secondary"), transition: "all 0.2s" }}>
            {style.name}
          </button>
        ))}
      </div>

      {/* Mapa Leaflet */}
      <div ref={mapRef} style={{ width: "100%", height: 420, borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", marginBottom: "14px", background: "#1a2942" }} />
      {!L && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", marginBottom: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", fontFamily: getFont(theme,"secondary") }}>Cargando mapa…</div>}

      {/* Cards de votación */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 14 }}>
        {[1, 2, 3].map((id) => {
          const st    = statusMapa[id];
          const t     = TRAFICO_STATUS[st];
          const v     = votos[id];
          const total = totalVotos(id);
          const fase  = TRAFICO_FASES[id];
          return (
            <div key={id} style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", borderRadius: "14px", border: `2px solid ${t.color}`, padding: "14px", display: "flex", flexDirection: "column", gap: 9, transition: "all 0.4s", boxShadow: `0 4px 16px ${t.color}40` }}>
              {/* Encabezado */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", fontFamily: getFont(theme,"secondary") }}>{fase.nombre}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, background: t.bg, color: t.text, padding: "3px 9px", borderRadius: "20px", border: `1px solid ${t.color}40` }}>{t.emoji} {t.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8", lineHeight: 1.5, fontFamily: getFont(theme,"secondary") }}>{fase.descripcion}</p>

              {/* Barra de votos */}
              {total > 0 && (
                <div style={{ display: "flex", gap: 2, height: 5, borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
                  {["fluido","moderado","detenido","sinuso"].map((tipo) => {
                    const pct = (v[tipo] / total) * 100;
                    return pct > 0 ? <div key={tipo} style={{ width: `${pct}%`, background: TRAFICO_STATUS[tipo].color, transition: "width 0.4s" }} /> : null;
                  })}
                </div>
              )}

              {/* Botones de voto */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
                {["fluido","moderado","detenido","sinuso"].map((tipo) => {
                  const tr = TRAFICO_STATUS[tipo];
                  const isActive = activeVote.fase === id && activeVote.tipo === tipo;
                  const isSinUsoOn = tipo === "sinuso" && st === "sinuso";
                  return (
                    <button
                      key={tipo}
                      onClick={() => votar(id, tipo)}
                      style={{ fontSize: "11px", padding: "9px 10px", borderRadius: "9px", border: `2px solid ${tr.color}`, background: isActive || isSinUsoOn ? tr.color : "rgba(255,255,255,0.04)", color: isActive || isSinUsoOn ? "#fff" : "#e2e8f0", cursor: "pointer", fontWeight: 600, transition: "all 0.2s", transform: isActive ? "scale(0.97)" : "scale(1)", display: "flex", alignItems: "center", gap: 7, fontFamily: getFont(theme,"secondary") }}
                      onMouseEnter={(e) => { if (!isActive && !isSinUsoOn) e.currentTarget.style.background = `${tr.color}20`; }}
                      onMouseLeave={(e) => { if (!isActive && !isSinUsoOn) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    >
                      <span style={{ fontSize: "14px" }}>{tr.emoji}</span>
                      <span>{tr.label}{isSinUsoOn ? " (activo — toca para desactivar)" : ""}</span>
                      {v[tipo] > 0 && tipo !== "sinuso" && <span style={{ marginLeft: "auto", background: tr.color, color: "#fff", borderRadius: "12px", padding: "1px 7px", fontSize: "10px", fontWeight: 700 }}>{v[tipo]}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Total votos */}
              <div style={{ fontSize: "10px", color: "#94a3b8", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 7, textAlign: "center", fontFamily: getFont(theme,"secondary") }}>
                {total === 0 ? "Sin votos aún" : `${total} voto${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: "11px", color: "#94a3b8", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ fontWeight: 700, color: "#ffffff", fontFamily: getFont(theme,"secondary") }}>Leyenda:</span>
        {Object.entries(TRAFICO_STATUS).map(([key, t]) => (
          <span key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 24, height: 5, borderRadius: 4, background: t.color, display: "inline-block", boxShadow: `0 0 8px ${t.color}60` }} />
            <span style={{ color: "#e2e8f0", fontFamily: getFont(theme,"secondary") }}>{t.label}</span>
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 24, height: 5, borderRadius: 4, background: "#fbbf24", display: "inline-block", boxShadow: "0 0 8px #fbbf2460" }} />
          <span style={{ color: "#e2e8f0", fontFamily: getFont(theme,"secondary") }}>Vialidad (contorno)</span>
        </span>
      </div>
    </div>
  );
}

function SegundoAccesoTab() {
  const theme = React.useContext(ThemeContext);
  const [subTab, setSubTab] = useState("segundo");

  // -- Estado 2DO ACCESO --
  const [carriles, setCarriles] = useState(mkSegundoIngreso);
  // -- Estado CONFINADA --
  const [confinada, setConfinada] = useState(mkConfinadaState);

  const [toast, setToast] = useState(null);
  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };

  const TABLA = "carriles";
  const ROW_ID = "segundo_acceso";
  const ROW_ID_CF = "confinada_acceso";

  const saveToSupa = async (newState) => { await sb.from(TABLA).upsert({ id: ROW_ID, data: newState }); };
  const saveConfinada = async (newState) => { await sb.from(TABLA).upsert({ id: ROW_ID_CF, data: newState }); };

  useEffect(() => {
    sb.from(TABLA).select("*").eq("id", ROW_ID).single().then(({ data }) => {
      if (data?.data) setCarriles({ ...mkSegundoIngreso(), ...data.data });
    });
    sb.from(TABLA).select("*").eq("id", ROW_ID_CF).single().then(({ data }) => {
      if (data?.data) setConfinada({ ...mkConfinadaState(), ...data.data });
    });
    const chan = sb.channel("segundo-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLA }, ({ new: r }) => {
        if (r?.id === ROW_ID && r?.data) setCarriles(r.data);
        if (r?.id === ROW_ID_CF && r?.data) setConfinada(r.data);
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  // -- Handlers 2DO ACCESO --
  const updateIngreso = async (id, field, value) => {
    if (!carriles) return;
    const next = { ...carriles, [id]: { ...carriles[id], [field]: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Carril actualizado", "#22c55e");
    const carrilDef = SEGUNDO_CARRILES_INGRESO.find(c => c.id === id);
    const fieldLabel = field === "saturado" ? (value ? "Saturado" : "Libre") : (value ? "Con Retornos" : "Sin Retornos");
    await publicarNoticia({ tipo: "segundo", icono: "🛣️", color: "#34d399", titulo: `2do Acceso ${carrilDef?.label || id} — ${fieldLabel}`, detalle: "Estado de carril actualizado" });
  };
  const updateSalida = async (field, value) => {
    const next = { ...carriles, c4: { ...carriles.c4, [field]: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Carril de salida actualizado", "#22c55e");
  };
  const resetAll = async () => {
    const next = mkSegundoIngreso();
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Todos los carriles restablecidos", "#22c55e");
  };
  const resetOne = async (id) => {
    const def = SEGUNDO_CARRILES_INGRESO.find(c => c.id === id);
    const next = { ...carriles, [id]: { terminal: def?.defaultTerminal || "ssa", saturado: false, retornos: false, expo: "libre", expo_contenedor: null, impo: "libre", lastUpdate: Date.now(), updatedBy: "Reset" } };
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Carril restablecido", "#22c55e");
  };

  // -- Handlers CONFINADA --
  const updateConfinada = async (id, field, value) => {
    if (!confinada) return;
    const next = { ...confinada, [id]: { ...confinada[id], [field]: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setConfinada(next);
    await saveConfinada(next);
    notify("✓ Carril Confinada actualizado", "#a78bfa");
    const carrilDef = CONFINADA_CARRILES.find(c => c.id === id);
    const fieldLabel = field === "saturado" ? (value ? "Saturado" : "Libre") : field === "transferencia" ? (value ? "Segundo Acceso" : "Normal") : (value ? "Con Retornos" : "Sin Retornos");
    await publicarNoticia({ tipo: "segundo", icono: "🔒", color: "#a78bfa", titulo: `Confinada ${carrilDef?.label || id} — ${fieldLabel}`, detalle: "Estado de carril actualizado" });
  };
  const resetAllConfinada = async () => {
    const next = mkConfinadaState();
    setConfinada(next);
    await saveConfinada(next);
    notify("✓ Confinada restablecida", "#a78bfa");
  };
  const resetOneConfinada = async (id) => {
    const def = CONFINADA_CARRILES.find(c => c.id === id);
    const next = { ...confinada, [id]: { terminal: def?.defaultTerminal || "timsa", saturado: false, retornos: false, transferencia: false, expo: "libre", expo_contenedor: null, impo: "libre", lastUpdate: Date.now(), updatedBy: "Reset" } };
    setConfinada(next);
    await saveConfinada(next);
    notify("✓ Carril restablecido", "#a78bfa");
  };

  const getTermName = (id) => TODAS_TERMINALES.find(t => t.id === id)?.name || id?.toUpperCase() || "—";
  const getTermZona = (id) => TODAS_TERMINALES.find(t => t.id === id)?.zona || "";
  const termsNorte  = TODAS_TERMINALES.filter(t => t.zona === "Norte");
  const termsSur    = TODAS_TERMINALES.filter(t => t.zona === "Sur");

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>

      {/* -- Header principal -- */}
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"4px" }}>CONFINADOS — PUERTO MANZANILLO</div>
        <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>2do Acceso y zona confinada · Ingreso con terminal asignada.</div>
      </div>

      {/* -- Sub-tab selector -- */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
        {[
          { id:"segundo",   label:"2DO ACCESO",   icon:"🛣️",  color:"#34d399" },
          { id:"confinada", label:"CONFINADA",    icon:"🔒", color:"#a78bfa" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              flex:1, padding:"12px 8px",
              background: subTab===tab.id ? tab.color+"22" : "rgba(255,255,255,0.04)",
              border: `2px solid ${subTab===tab.id ? tab.color : "rgba(255,255,255,0.12)"}`,
              borderRadius:"10px",
              color: subTab===tab.id ? tab.color : "rgba(255,255,255,0.45)",
              fontFamily:getFont(theme, "secondary"), fontSize:"12px", fontWeight:"800",
              cursor:"pointer", letterSpacing:"1px",
              transition:"all 0.2s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
            }}
          >
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ---
          SUB-TAB: 2DO ACCESO
      --- */}
      {subTab === "segundo" && <>
        {/* -- Diagrama visual de carriles -- */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"14px", padding:"14px", marginBottom:"18px", overflow:"hidden" }}>
          <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"12px" }}>DIAGRAMA — VISTA DE CARRILES (PUENTE 2DO ACCESO)</div>

          {/* Carretera con carriles */}
          <div style={{ background:"#1a1a2e", borderRadius:"10px", padding:"14px 10px 10px", position:"relative", border:"1px solid rgba(255,255,255,0.08)" }}>

            {/* Líneas amarillas del pavimento */}
            <div style={{ position:"absolute", top:0, bottom:0, left:"50%", width:"3px", background:"repeating-linear-gradient(to bottom, #f59e0b 0px, #f59e0b 12px, transparent 12px, transparent 22px)", transform:"translateX(-50%)", opacity:0.7 }} />
            <div style={{ position:"absolute", top:0, bottom:0, left:"calc(50% - 80px)", width:"2px", background:"repeating-linear-gradient(to bottom, #4b5563 0px, #4b5563 10px, transparent 10px, transparent 20px)", transform:"translateX(-50%)", opacity:0.5 }} />
            <div style={{ position:"absolute", top:0, bottom:0, left:"calc(50% + 80px)", width:"2px", background:"repeating-linear-gradient(to bottom, #4b5563 0px, #4b5563 10px, transparent 10px, transparent 20px)", transform:"translateX(-50%)", opacity:0.5 }} />

            {/* Flechas de carriles */}
            <div style={{ display:"flex", gap:"6px", position:"relative", zIndex:1 }}>

              {/* C4 — SALIDA (izquierda, rojo) */}
              {(() => {
                const c4sat = carriles?.c4?.saturado;
                const c4col = c4sat ? "#ef4444" : "#f97316";
                return (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                    {/* Flecha hacia ARRIBA (salida) */}
                    <div style={{ position:"relative", width:"52px" }}>
                      <svg viewBox="0 0 52 60" style={{ width:"52px", height:"60px", filter:`drop-shadow(0 0 8px ${c4col}88)` }}>
                        <polygon points="26,4 48,28 36,28 36,56 16,56 16,28 4,28" fill={c4col} opacity="0.9"/>
                      </svg>
                    </div>
                    <div style={{ background:c4col+"22", border:`1.5px solid ${c4col}`, borderRadius:"8px", padding:"4px 6px", textAlign:"center", width:"100%" }}>
                      <div style={{ color:c4col, fontFamily:getFont(theme,"secondary"), fontSize:"13px", fontWeight:"800" }}>C4</div>
                      <div style={{ color:c4col, fontFamily:getFont(theme,"secondary"), fontSize:"9px", fontWeight:"700", letterSpacing:"1px" }}>SALIDA</div>
                      <div style={{ color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme,"secondary"), fontSize:"9px", marginTop:"2px" }}>{c4sat?"SATURADO":"LIBRE"}</div>
                    </div>
                  </div>
                );
              })()}

              {/* C1, C2, C3 — INGRESO (teal/verde) */}
              {[...SEGUNDO_CARRILES_INGRESO].reverse().map((c, i) => {
                const st  = carriles?.[c.id];
                const sat = st?.saturado;
                const col = sat ? "#ef4444" : "#14b8a6";
                const tz  = getTermZona(st?.terminal);
                const tc  = tz === "Todas" ? "#fbbf24" : tz === "Norte" ? "#38bdf8" : "#a78bfa";
                return (
                  <div key={c.id} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                    {/* Flecha hacia ABAJO (ingreso) */}
                    <div style={{ position:"relative", width:"52px" }}>
                      <svg viewBox="0 0 52 60" style={{ width:"52px", height:"60px", filter:`drop-shadow(0 0 8px ${col}88)` }}>
                        <polygon points="26,56 48,32 36,32 36,4 16,4 16,32 4,32" fill={col} opacity="0.9"/>
                      </svg>
                    </div>
                    <div style={{ background:col+"22", border:`1.5px solid ${col}`, borderRadius:"8px", padding:"4px 6px", textAlign:"center", width:"100%" }}>
                      <div style={{ color:col, fontFamily:getFont(theme,"secondary"), fontSize:"13px", fontWeight:"800" }}>{c.label}</div>
                      <div style={{ background:tc+"33", borderRadius:"4px", padding:"2px 3px", marginTop:"3px" }}>
                        <div style={{ color:tc, fontFamily:getFont(theme,"secondary"), fontSize:"8px", fontWeight:"700", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {getTermName(st?.terminal)}
                        </div>
                      </div>
                      {st?.retornos && <div style={{ color:"#f97316", fontSize:"10px", marginTop:"2px" }}>↩</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Etiquetas de dirección */}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"8px", padding:"0 4px" }}>
              <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme,"secondary"), letterSpacing:"1px", fontWeight:"700" }}>↑ HACIA CIUDAD</div>
              <div style={{ fontSize:"9px", color:"#14b8a6", fontFamily:getFont(theme,"secondary"), letterSpacing:"1px", fontWeight:"700" }}>↓ AL PUERTO</div>
            </div>
          </div>

          {/* Leyenda */}
          <div style={{ display:"flex", justifyContent:"center", gap:"12px", marginTop:"10px", flexWrap:"wrap" }}>
            {[["#14b8a6","INGRESO"],["#f97316","SALIDA"],["#ef4444","SATURADO"],["#fbbf24","GENERAL"],["#38bdf8","ZONA NORTE"],["#a78bfa","ZONA SUR"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                <div style={{ width:"8px", height:"8px", background:c, borderRadius:"2px" }} />
                <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary") }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <SectionLabel text="CARRILES DE INGRESO (C1–C3)" rightBtn={<NormalBtn onClick={resetAll} label="TODO NORMAL" />} />
        {SEGUNDO_CARRILES_INGRESO.map(carril => {
          const st        = carriles[carril.id];
          const termObj   = TODAS_TERMINALES.find(t => t.id === st.terminal);
          const zonaColor = termObj?.zona === "Todas" ? "#fbbf24" : termObj?.zona === "Norte" ? "#38bdf8" : "#a78bfa";
          const expoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (st.expo || "libre"));
          const expoContOpt = SEGUNDO_CONTENEDOR_OPTS.find(o => o.id === st.expo_contenedor);
          const impoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (st.impo || "libre"));
          const isChanged = st.saturado || st.retornos || st.terminal !== carril.defaultTerminal || (st.expo && st.expo !== "libre") || (st.impo && st.impo !== "libre");
          return (
            <div key={carril.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${st.saturado ? "#ef444466" : zonaColor+"44"}`, borderRadius:"12px", padding:"14px", marginBottom:"14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={{ background:"#38bdf822", border:"1px solid #38bdf844", borderRadius:"6px", padding:"3px 10px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"700" }}>{carril.label}</div>
                    <Badge color="#22c55e" small>INGRESO</Badge>
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"4px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px" }}>
                  <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <Badge color={st.saturado ? "#ef4444" : "#22c55e"} small>{st.saturado ? "SATURADO" : "LIBRE"}</Badge>
                    {st.retornos && <Badge color="#f97316" small>↩ RETORNOS</Badge>}
                    {expoOpt && expoOpt.id !== "libre" && <Badge color={expoOpt.color} small>EXPO {expoOpt.icon}</Badge>}
                    {expoContOpt && <Badge color={expoContOpt.color} small>{expoContOpt.icon}</Badge>}
                    {impoOpt && impoOpt.id !== "libre" && <Badge color={impoOpt.color} small>IMPO {impoOpt.icon}</Badge>}
                  </div>
                  {isChanged && <button onClick={() => resetOne(carril.id)} style={{ padding:"3px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ NORMAL</button>}
                </div>
              </div>
              <div style={{ background:zonaColor+"11", border:`1px solid ${zonaColor}33`, borderRadius:"8px", padding:"10px 12px", marginBottom:"12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"2px" }}>TERMINAL ASIGNADA HOY</div>
                  <div style={{ color:zonaColor, fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"15px" }}>{termObj?.name}</div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"1px" }}>
                    {termObj?.zona === "Todas" ? "Todas las terminales" : `Zona ${termObj?.zona}`}
                  </div>
                </div>
                <span style={{ fontSize:"22px" }}>🚛</span>
              </div>
              <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>CAMBIAR TERMINAL:</div>
              <div style={{ marginBottom:"8px" }}>
                <div style={{ fontSize:"9px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— GENERAL (TODAS LAS TERMINALES) —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  <button onClick={() => updateIngreso(carril.id,"terminal","general")} style={{ padding:"5px 10px", background: st.terminal==="general"?"#fbbf2422":"#0a1628", border:`1px solid ${st.terminal==="general"?"#fbbf24":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal==="general"?"#fbbf24":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal==="general"?"700":"400" }}>⚡ GENERAL</button>
                </div>
              </div>
              <div style={{ marginBottom:"8px" }}>
                <div style={{ fontSize:"9px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— ZONA NORTE —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  {termsNorte.map(t => <button key={t.id} onClick={() => updateIngreso(carril.id,"terminal",t.id)} style={{ padding:"5px 10px", background: st.terminal===t.id?"#38bdf822":"#0a1628", border:`1px solid ${st.terminal===t.id?"#38bdf8":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal===t.id?"#38bdf8":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal===t.id?"700":"400" }}>{t.name}</button>)}
                </div>
              </div>
              <div style={{ marginBottom:"10px" }}>
                <div style={{ fontSize:"9px", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— ZONA SUR —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  {termsSur.map(t => <button key={t.id} onClick={() => updateIngreso(carril.id,"terminal",t.id)} style={{ padding:"5px 10px", background: st.terminal===t.id?"#a78bfa22":"#0a1628", border:`1px solid ${st.terminal===t.id?"#a78bfa":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal===t.id?"#a78bfa":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal===t.id?"700":"400" }}>{t.name}</button>)}
                </div>
              </div>
              <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px", marginTop:"4px" }}>ESTADO DEL CARRIL:</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"6px" }}>
                <button onClick={() => updateIngreso(carril.id,"saturado",false)} style={{ padding:"9px", background: !st.saturado?"#22c55e22":"#0a1628", border:`1px solid ${!st.saturado?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.saturado?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !st.saturado?"700":"400" }}>✓ LIBRE</button>
                <button onClick={() => updateIngreso(carril.id,"saturado",true)}  style={{ padding:"9px", background: st.saturado?"#ef444422":"#0a1628",  border:`1px solid ${st.saturado?"#ef4444":"#1e3a5f"}`,  borderRadius:"8px", color: st.saturado?"#ef4444":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: st.saturado?"700":"400"  }}>✗ SATURADO</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"10px" }}>
                <button onClick={() => updateIngreso(carril.id,"retornos",false)} style={{ padding:"9px", background: !st.retornos?"#22c55e22":"#0a1628", border:`1px solid ${!st.retornos?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.retornos?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !st.retornos?"700":"400" }}>✓ SIN RETORNOS</button>
                <button onClick={() => updateIngreso(carril.id,"retornos",true)}  style={{ padding:"9px", background: st.retornos?"#f9731622":"#0a1628",  border:`1px solid ${st.retornos?"#f97316":"#1e3a5f"}`,  borderRadius:"8px", color: st.retornos?"#f97316":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: st.retornos?"700":"400"  }}>↩ CON RETORNOS</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📤 EXPORTACIÓN — TRÁFICO</div>
                  <select value={st.expo || "libre"} onChange={e => updateIngreso(carril.id,"expo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${expoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: expoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", marginTop:"8px", fontWeight:"700" }}>📦 CONTENEDOR EXPO</div>
                  <select value={st.expo_contenedor || ""} onChange={e => updateIngreso(carril.id,"expo_contenedor", e.target.value || null)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${expoContOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: expoContOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    <option value="" style={{ background:"#0a1628", color:"#475569" }}>— Sin especificar —</option>
                    {SEGUNDO_CONTENEDOR_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:"9px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📥 IMPORTACIÓN — TRÁFICO</div>
                  <select value={st.impo || "libre"} onChange={e => updateIngreso(carril.id,"impo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${impoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: impoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        <SectionLabel text="CARRIL DE SALIDA (C4)" />
        <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${carriles.c4.saturado?"#ef444466":"#f9731644"}`, borderRadius:"12px", padding:"14px", marginBottom:"14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ background:"#f9731622", border:"1px solid #f9731644", borderRadius:"6px", padding:"3px 10px", color:"#f97316", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"700" }}>Carril 4</div>
                <Badge color="#f97316" small>SALIDA</Badge>
              </div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"4px" }}>{timeAgo(carriles.c4.lastUpdate)} · {carriles.c4.updatedBy}</div>
            </div>
            <Badge color={carriles.c4.saturado?"#ef4444":"#22c55e"} small>{carriles.c4.saturado?"SATURADO":"FLUIDO"}</Badge>
          </div>
          <div style={{ background:"#f9731611", border:"1px solid #f9731633", borderRadius:"8px", padding:"10px 12px", marginBottom:"12px", display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"22px" }}>🚚</span>
            <div>
              <div style={{ color:"#f97316", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px" }}>Salida General del Puerto</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"1px" }}>Todos los vehículos en salida</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"6px" }}>
            <button onClick={() => updateSalida("saturado",false)} style={{ padding:"10px", background: !carriles.c4.saturado?"#22c55e22":"#0a1628", border:`1px solid ${!carriles.c4.saturado?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !carriles.c4.saturado?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !carriles.c4.saturado?"700":"400" }}>✓ FLUIDO</button>
            <button onClick={() => updateSalida("saturado",true)}  style={{ padding:"10px", background: carriles.c4.saturado?"#ef444422":"#0a1628",  border:`1px solid ${carriles.c4.saturado?"#ef4444":"#1e3a5f"}`,  borderRadius:"8px", color: carriles.c4.saturado?"#ef4444":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: carriles.c4.saturado?"700":"400"  }}>✗ SATURADO</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"10px" }}>
            <button onClick={() => updateSalida("retornos",false)} style={{ padding:"10px", background: !carriles.c4.retornos?"#22c55e22":"#0a1628", border:`1px solid ${!carriles.c4.retornos?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !carriles.c4.retornos?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !carriles.c4.retornos?"700":"400" }}>✓ SIN RETORNOS</button>
            <button onClick={() => updateSalida("retornos",true)}  style={{ padding:"10px", background: carriles.c4.retornos?"#f9731622":"#0a1628",  border:`1px solid ${carriles.c4.retornos?"#f97316":"#1e3a5f"}`,  borderRadius:"8px", color: carriles.c4.retornos?"#f97316":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: carriles.c4.retornos?"700":"400"  }}>↩ CON RETORNOS</button>
          </div>
          {(() => {
            const c4ExpoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (carriles.c4.expo || "libre"));
            const c4ExpoContOpt = SEGUNDO_CONTENEDOR_OPTS.find(o => o.id === carriles.c4.expo_contenedor);
            const c4ImpoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (carriles.c4.impo || "libre"));
            return (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📤 EXPORTACIÓN — TRÁFICO</div>
                  <select value={carriles.c4.expo || "libre"} onChange={e => updateSalida("expo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${c4ExpoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: c4ExpoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", marginTop:"8px", fontWeight:"700" }}>📦 CONTENEDOR EXPO</div>
                  <select value={carriles.c4.expo_contenedor || ""} onChange={e => updateSalida("expo_contenedor", e.target.value || null)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${c4ExpoContOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: c4ExpoContOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    <option value="" style={{ background:"#0a1628", color:"#475569" }}>— Sin especificar —</option>
                    {SEGUNDO_CONTENEDOR_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:"9px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📥 IMPORTACIÓN — TRÁFICO</div>
                  <select value={carriles.c4.impo || "libre"} onChange={e => updateSalida("impo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${c4ImpoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: c4ImpoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })()}
        </div>

        {/* -- Segundo Acceso Por Fases -- */}
        <div style={{ marginTop:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
            <div style={{ flex:1, height:"1px", background:"rgba(52,211,153,0.2)" }} />
            <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"5px 12px", background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:"20px" }}>
              <span style={{ fontSize:"13px" }}>🗺️</span>
              <span style={{ fontFamily:getFont(theme,"secondary"), fontSize:"11px", color:"#34d399", fontWeight:"800", letterSpacing:"1px" }}>SEGUNDO ACCESO POR FASES</span>
            </div>
            <div style={{ flex:1, height:"1px", background:"rgba(52,211,153,0.2)" }} />
          </div>
          <TrafficMapSegundo theme={theme} />
        </div>
      </>}

      {/* ---
          SUB-TAB: CONFINADA
      --- */}
      {subTab === "confinada" && <>
        {/* -- MINI-MAPA VIAL CONFINADA — compacto -- */}
        {(() => {
          const getCarrilColor = (id) => {
            const st = confinada[id];
            if (!st || st.terminal === "sin_uso") return "#6b7280";
            if (st.saturado) return "#ef4444";
            if (st.transferencia) return "#fbbf24";
            return "#22c55e";
          };
          const c1 = getCarrilColor("cf_c1");
          const c2 = getCarrilColor("cf_c2");
          const c3 = getCarrilColor("cf_c3");

          const getTermShort = (id) => {
            const st = confinada[id];
            if (!st) return "—";
            if (st.terminal === "sin_uso") return "SIN USO";
            if (st.terminal === "general") return "GENERAL";
            const found = TODAS_TERMINALES.find(t => t.id === st.terminal);
            return found ? found.name : st.terminal.toUpperCase();
          };
          const t1 = getTermShort("cf_c1");
          const t2 = getTermShort("cf_c2");
          const t3 = getTermShort("cf_c3");

          return (
            <div style={{ background:"rgba(4,10,22,0.95)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:"12px", padding:"10px 12px", marginBottom:"16px" }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                <span style={{ fontSize:"9px", color:"rgba(167,139,250,0.7)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1.5px", fontWeight:"700" }}>ZONA CONFINADA · VISTA VIAL</span>
                <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.25)", fontFamily:getFont(theme, "secondary") }}>→ entrada puerto</span>
              </div>

              {/* SVG compacto */}
              <svg viewBox="0 0 300 72" style={{ width:"100%", height:"auto", display:"block" }} xmlns="http://www.w3.org/2000/svg">
                {/* Fondo carretera */}
                <rect width="300" height="72" fill="#0a0f1a" rx="6"/>

                {/* Zona entrada (derecha) */}
                <rect x="268" y="0" width="32" height="72" fill="#071828" rx="0"/>
                <line x1="268" y1="0" x2="268" y2="72" stroke="rgba(56,189,248,0.35)" strokeWidth="1" strokeDasharray="4,3"/>
                <text x="284" y="40" textAnchor="middle" fill="rgba(56,189,248,0.5)" fontSize="5.5" fontFamily="DM Sans,sans-serif" fontWeight="700" transform="rotate(-90,284,40)">PUERTO</text>

                {/* Zona salida (izquierda) */}
                <rect x="0" y="0" width="28" height="72" fill="#071a09" rx="0"/>
                <line x1="28" y1="0" x2="28" y2="72" stroke="rgba(34,197,94,0.2)" strokeWidth="1" strokeDasharray="3,3"/>
                <text x="14" y="40" textAnchor="middle" fill="rgba(34,197,94,0.45)" fontSize="5.5" fontFamily="DM Sans,sans-serif" fontWeight="700" transform="rotate(-90,14,40)">2° ACCESO</text>

                {/* -- Carril 1 — franja superior -- */}
                <rect x="28" y="2" width="240" height="20" fill={c1 + "20"} rx="2"/>
                <line x1="28" y1="2"  x2="268" y2="2"  stroke={c1} strokeWidth="1.5" opacity="0.6"/>
                <line x1="28" y1="22" x2="268" y2="22" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="6,5"/>
                <rect x="28" y="2" width="3" height="20" fill={c1} opacity="0.9"/>
                <text x="32" y="15" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="DM Sans,sans-serif" fontWeight="700">C1</text>
                {/* Terminal en centro */}
                <text x="148" y="15" textAnchor="middle" fill={c1} fontSize="6.5" fontFamily="DM Sans,sans-serif" fontWeight="800" opacity="0.9">{t1}</text>

                {/* -- Carril 2 — franja media -- */}
                <rect x="28" y="26" width="240" height="20" fill={c2 + "20"} rx="2"/>
                <line x1="28" y1="26" x2="268" y2="26" stroke={c2} strokeWidth="1.5" opacity="0.6"/>
                <line x1="28" y1="46" x2="268" y2="46" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="6,5"/>
                <rect x="28" y="26" width="3" height="20" fill={c2} opacity="0.9"/>
                <text x="32" y="39" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="DM Sans,sans-serif" fontWeight="700">C2</text>
                <text x="148" y="39" textAnchor="middle" fill={c2} fontSize="6.5" fontFamily="DM Sans,sans-serif" fontWeight="800" opacity="0.9">{t2}</text>

                {/* -- Carril 3 — franja inferior -- */}
                <rect x="28" y="50" width="240" height="20" fill={c3 + "20"} rx="2"/>
                <line x1="28" y1="50" x2="268" y2="50" stroke={c3} strokeWidth="1.5" opacity="0.6"/>
                <line x1="28" y1="70" x2="268" y2="70" stroke={c3} strokeWidth="1.5" opacity="0.6"/>
                <rect x="28" y="50" width="3" height="20" fill={c3} opacity="0.9"/>
                <text x="32" y="63" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="DM Sans,sans-serif" fontWeight="700">C3</text>
                <text x="148" y="63" textAnchor="middle" fill={c3} fontSize="6.5" fontFamily="DM Sans,sans-serif" fontWeight="800" opacity="0.9">{t3}</text>
              </svg>

              {/* Leyenda inline compacta */}
              <div style={{ display:"flex", gap:"10px", marginTop:"7px", flexWrap:"wrap" }}>
                {[["#22c55e","Libre"],["#ef4444","Saturado"],["#fbbf24","2° Acceso"],["#6b7280","Sin uso"]].map(([c,l]) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                    <div style={{ width:"8px", height:"3px", background:c, borderRadius:"1px" }}/>
                    <span style={{ fontSize:"8px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary") }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <SectionLabel text="CARRILES DE INGRESO (C1–C3) · ZONA SUR" rightBtn={<NormalBtn onClick={resetAllConfinada} label="TODO NORMAL" />} />

        {CONFINADA_CARRILES.map(carril => {
          const st = confinada[carril.id];
          const termObj = TODAS_TERMINALES.find(t => t.id === st.terminal);
          const expoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (st.expo || "libre"));
          const expoContOpt = SEGUNDO_CONTENEDOR_OPTS.find(o => o.id === st.expo_contenedor);
          const impoOpt = SEGUNDO_TRAFICO_OPTS.find(o => o.id === (st.impo || "libre"));
          const borderColor = st.terminal==="sin_uso" ? "#6b7280" : st.terminal==="general" ? "#fbbf24" : st.transferencia ? "#fbbf24" : st.saturado ? "#ef4444" : "#a78bfa";
          const isChanged = st.saturado || st.retornos || st.transferencia || st.terminal !== carril.defaultTerminal || st.terminal==="sin_uso" || st.terminal==="general" || (st.expo && st.expo !== "libre") || (st.impo && st.impo !== "libre");
          return (
            <div key={carril.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${borderColor}44`, borderRadius:"12px", padding:"14px", marginBottom:"14px" }}>
              {/* Header carril */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={{ background:"#a78bfa22", border:"1px solid #a78bfa44", borderRadius:"6px", padding:"3px 10px", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), fontSize:"13px", fontWeight:"700" }}>{carril.label}</div>
                    {st.terminal === "sin_uso"
                      ? <Badge color="#6b7280" small>🚫 SIN USO</Badge>
                      : <Badge color="#22c55e" small>INGRESO</Badge>
                    }
                    {st.transferencia && st.terminal !== "sin_uso" && <Badge color="#fbbf24" small>🔄 2° ACCESO</Badge>}
                  </div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"4px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px" }}>
                  <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <Badge color={st.saturado ? "#ef4444" : "#22c55e"} small>{st.saturado ? "SATURADO" : "LIBRE"}</Badge>
                    {st.retornos && <Badge color="#f97316" small>↩ RETORNOS</Badge>}
                    {expoOpt && expoOpt.id !== "libre" && <Badge color={expoOpt.color} small>EXPO {expoOpt.icon}</Badge>}
                    {expoContOpt && <Badge color={expoContOpt.color} small>{expoContOpt.icon}</Badge>}
                    {impoOpt && impoOpt.id !== "libre" && <Badge color={impoOpt.color} small>IMPO {impoOpt.icon}</Badge>}
                  </div>
                  {isChanged && <button onClick={() => resetOneConfinada(carril.id)} style={{ padding:"3px 8px", background:"#a78bfa15", border:"1px solid #a78bfa44", borderRadius:"5px", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ NORMAL</button>}
                </div>
              </div>

              {/* Terminal asignada */}
              <div style={{ background: st.terminal==="sin_uso" ? "#6b728011" : st.terminal==="general" ? "#fbbf2411" : "#a78bfa11", border:`1px solid ${st.terminal==="sin_uso"?"#6b728033":st.terminal==="general"?"#fbbf2433":"#a78bfa33"}`, borderRadius:"8px", padding:"10px 12px", marginBottom:"12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"2px" }}>TERMINAL ASIGNADA HOY</div>
                  {st.terminal === "sin_uso"
                    ? <><div style={{ color:"#6b7280", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"15px" }}>SIN USO</div><div style={{ color:"rgba(255,255,255,0.3)", fontSize:"10px", marginTop:"1px" }}>Carril no disponible</div></>
                    : st.terminal === "general"
                    ? <><div style={{ color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"15px" }}>GENERAL</div><div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"1px" }}>Todas las terminales</div></>
                    : <><div style={{ color:"#a78bfa", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"15px" }}>{termObj?.name}</div><div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"1px" }}>Zona {termObj?.zona}</div></>
                  }
                </div>
                <span style={{ fontSize:"22px" }}>{st.terminal === "sin_uso" ? "🚫" : "🚛"}</span>
              </div>

              {/* Cambiar terminal — General + Zona Sur + Sin Uso */}
              <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>CAMBIAR TERMINAL:</div>
              <div style={{ marginBottom:"8px" }}>
                <div style={{ fontSize:"9px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— GENERAL (TODAS LAS TERMINALES) —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  <button onClick={() => updateConfinada(carril.id,"terminal","general")} style={{ padding:"5px 10px", background: st.terminal==="general"?"#fbbf2422":"#0a1628", border:`1px solid ${st.terminal==="general"?"#fbbf24":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal==="general"?"#fbbf24":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal==="general"?"700":"400" }}>⚡ GENERAL</button>
                </div>
              </div>
              <div style={{ marginBottom:"8px" }}>
                <div style={{ fontSize:"9px", color:"#a78bfa", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— ZONA SUR —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  {termsSur.map(t => <button key={t.id} onClick={() => updateConfinada(carril.id,"terminal",t.id)} style={{ padding:"5px 10px", background: st.terminal===t.id?"#a78bfa22":"#0a1628", border:`1px solid ${st.terminal===t.id?"#a78bfa":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal===t.id?"#a78bfa":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal===t.id?"700":"400" }}>{t.name}</button>)}
                </div>
              </div>
              <div style={{ marginBottom:"10px" }}>
                <div style={{ fontSize:"9px", color:"#6b7280", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>— SIN USO —</div>
                <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  <button onClick={() => updateConfinada(carril.id,"terminal","sin_uso")} style={{ padding:"5px 10px", background: st.terminal==="sin_uso"?"#6b728022":"#0a1628", border:`1px solid ${st.terminal==="sin_uso"?"#6b7280":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal==="sin_uso"?"#9ca3af":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.terminal==="sin_uso"?"700":"400" }}>🚫 Sin uso</button>
                </div>
              </div>

              {/* Estado del carril */}
              <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px" }}>ESTADO DEL CARRIL:</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"6px" }}>
                <button onClick={() => updateConfinada(carril.id,"saturado",false)} style={{ padding:"9px", background: !st.saturado?"#22c55e22":"#0a1628", border:`1px solid ${!st.saturado?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.saturado?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !st.saturado?"700":"400" }}>✓ LIBRE</button>
                <button onClick={() => updateConfinada(carril.id,"saturado",true)}  style={{ padding:"9px", background: st.saturado?"#ef444422":"#0a1628",  border:`1px solid ${st.saturado?"#ef4444":"#1e3a5f"}`,  borderRadius:"8px", color: st.saturado?"#ef4444":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: st.saturado?"700":"400"  }}>✗ SATURADO</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"10px" }}>
                <button onClick={() => updateConfinada(carril.id,"retornos",false)} style={{ padding:"9px", background: !st.retornos?"#22c55e22":"#0a1628", border:`1px solid ${!st.retornos?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.retornos?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !st.retornos?"700":"400" }}>✓ SIN RETORNOS</button>
                <button onClick={() => updateConfinada(carril.id,"retornos",true)}  style={{ padding:"9px", background: st.retornos?"#f9731622":"#0a1628",  border:`1px solid ${st.retornos?"#f97316":"#1e3a5f"}`,  borderRadius:"8px", color: st.retornos?"#f97316":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: st.retornos?"700":"400"  }}>↩ CON RETORNOS</button>
              </div>

              {/* Tráfico expo/impo */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                <div>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📤 EXPORTACIÓN — TRÁFICO</div>
                  <select value={st.expo || "libre"} onChange={e => updateConfinada(carril.id,"expo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${expoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: expoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                  <div style={{ fontSize:"9px", color:"#f97316", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", marginTop:"8px", fontWeight:"700" }}>📦 CONTENEDOR EXPO</div>
                  <select value={st.expo_contenedor || ""} onChange={e => updateConfinada(carril.id,"expo_contenedor", e.target.value || null)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${expoContOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: expoContOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    <option value="" style={{ background:"#0a1628", color:"#475569" }}>— Sin especificar —</option>
                    {SEGUNDO_CONTENEDOR_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:"9px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px", fontWeight:"700" }}>📥 IMPORTACIÓN — TRÁFICO</div>
                  <select value={st.impo || "libre"} onChange={e => updateConfinada(carril.id,"impo",e.target.value)} style={{ width:"100%", padding:"9px 8px", background:"#0a1628", border:`1px solid ${impoOpt?.color || "#1e3a5f"}`, borderRadius:"8px", color: impoOpt?.color || "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", outline:"none", appearance:"none", WebkitAppearance:"none" }}>
                    {SEGUNDO_TRAFICO_OPTS.map(o => <option key={o.id} value={o.id} style={{ background:"#0a1628", color:"#ffffff" }}>{o.icon} {o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Transferencia de Aduana — al final */}
              <div style={{ background: st.transferencia ? "#fbbf2415" : "rgba(255,255,255,0.03)", border:`1px solid ${st.transferencia?"#fbbf2466":"rgba(255,255,255,0.08)"}`, borderRadius:"10px", padding:"12px" }}>
                <div style={{ fontSize:"10px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px", fontWeight:"700" }}>🔄 SEGUNDO ACCESO</div>
                <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), marginBottom:"8px" }}>Indica si este carril opera como Segundo Acceso.</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
                  <button onClick={() => updateConfinada(carril.id,"transferencia",false)} style={{ padding:"10px", background: !st.transferencia?"#22c55e22":"#0a1628", border:`1px solid ${!st.transferencia?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.transferencia?"#22c55e":"#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: !st.transferencia?"700":"400" }}>✓ NORMAL</button>
                  <button onClick={() => updateConfinada(carril.id,"transferencia",true)}  style={{ padding:"10px", background: st.transferencia?"#fbbf2422":"#0a1628",  border:`1px solid ${st.transferencia?"#fbbf24":"#1e3a5f"}`,  borderRadius:"8px", color: st.transferencia?"#fbbf24":"#64748b",  fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight: st.transferencia?"700":"400"  }}>🔄 TRANSFERENCIA</button>
                </div>
              </div>
            </div>
          );
        })}
      </>}

      <ToastBox toast={toast} />
    </div>
  );
}

// --- TAB: CARRILES ---
function CarrilesTab() {
  const theme = React.useContext(ThemeContext);
  const [estado,  setEstado]  = useState(mkCarrilesState);
  const [accView, setAccView] = useState(() => {
    try { return sessionStorage.getItem("carriles_acc") || "pezvela"; } catch { return "pezvela"; }
  });
  const setAccViewPersist = (v) => {
    try { sessionStorage.setItem("carriles_acc", v); } catch {}
    setAccView(v);
  };
  const [toast,   setToast]   = useState(null);
  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2500); };

  const TABLA  = "carriles";
  const ROW_ID = "expo_impo";

  const saveToSupa = async (newState) => {
    await sb.from(TABLA).upsert({ id: ROW_ID, data: newState });
  };

  useEffect(() => {
    sb.from(TABLA).select("*").eq("id", ROW_ID).single().then(({ data }) => {
      if (data?.data) setEstado(data.data);
    });
    const chan = sb.channel("carriles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLA }, ({ new: r }) => {
        if (r?.id === ROW_ID && r?.data) setEstado(r.data);
      }).subscribe();
    return () => sb.removeChannel(chan);
  }, []);

  const toggle = async (cid, value) => {
    const next = { ...estado, [cid]: { ...estado[cid], abierto: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setEstado(next);
    await saveToSupa(next);
    notify(value ? "✓ Carril abierto" : "⛔ Carril cerrado", value ? "#22c55e" : "#6b7280");
    await publicarNoticia({ tipo: "carril", icono: "🚦", color: value ? "#22c55e" : "#6b7280", titulo: `Carril ${cid.toUpperCase()} — ${value ? "Abierto" : "Cerrado"}`, detalle: "Estado de carril expo/impo actualizado" });
  };

  const resetAcceso = async (acc) => {
    const next = { ...estado };
    acc.carriles.forEach(c => { next[c.id] = { abierto: true, lastUpdate: Date.now(), updatedBy: "Reset" }; });
    setEstado(next);
    await saveToSupa(next);
    notify("✓ Acceso restablecido", "#22c55e");
  };

  const resetAll = async () => {
    const next = mkCarrilesState();
    setEstado(next);
    await saveToSupa(next);
    notify("✓ Todo restablecido", "#22c55e");
  };

  const currentAcc   = ACCESOS_CARRILES.find(a => a.id === accView);
  const expoCarriles = currentAcc?.carriles.filter(c => c.tipo === "expo") || [];
  const impoCarriles = currentAcc?.carriles.filter(c => c.tipo === "impo") || [];
  const EXPO_COLOR = "#f59e0b";
  const IMPO_COLOR = "#60a5fa";

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"4px" }}>CARRILES — PUERTO MANZANILLO</div>
        <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>Estado de carriles de exportación e importación por acceso.</div>
      </div>
      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"10px" }}>RESUMEN GENERAL</div>
        {ACCESOS_CARRILES.map(acc => {
          const total    = acc.carriles.length;
          const abiertos = acc.carriles.filter(c => estado[c.id]?.abierto !== false).length;
          const pct      = Math.round((abiertos / total) * 100);
          return (
            <div key={acc.id} style={{ marginBottom:"8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                <span style={{ fontSize:"11px", color:acc.color, fontFamily:getFont(theme, "secondary"), fontWeight:"700" }}>{acc.label}</span>
                <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary") }}>{abiertos}/{total} abiertos</span>
              </div>
              <div style={{ background:"#1e3a5f", borderRadius:"3px", height:"5px", overflow:"hidden" }}>
                <div style={{ width:`${pct}%`, height:"100%", background: pct===100?"#22c55e": pct>50? acc.color:"#ef4444", transition:"width 0.4s", borderRadius:"3px" }} />
              </div>
            </div>
          );
        })}
        <div style={{ display:"flex", justifyContent:"center", gap:"12px", marginTop:"10px", flexWrap:"wrap" }}>
          {[["#f59e0b","EXPORTACIÓN"],["#60a5fa","IMPORTACIÓN"],["#22c55e","ABIERTO"],["#ef4444","CERRADO"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
              <div style={{ width:"8px", height:"8px", background:c, borderRadius:"2px" }} />
              <span style={{ fontSize:"8px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary") }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {ACCESOS_CARRILES.map(acc => (
          <button key={acc.id} onClick={() => setAccViewPersist(acc.id)} style={{ flex:1, padding:"9px 4px", background: accView===acc.id ? acc.color+"22" : "#0a1628", border:`1px solid ${accView===acc.id ? acc.color : "#1e3a5f"}`, borderRadius:"8px", color: accView===acc.id ? acc.color : "#475569", fontFamily:getFont(theme, "secondary"), fontSize:"9px", fontWeight: accView===acc.id?"700":"400", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
            <div style={{ fontSize:"14px", marginBottom:"2px" }}>{acc.zona==="Norte"?"🔵":"🟣"}</div>
            {acc.label}
          </button>
        ))}
      </div>
      {currentAcc && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ width:"10px", height:"10px", background:currentAcc.color, borderRadius:"50%", boxShadow:`0 0 8px ${currentAcc.color}` }} />
              <span style={{ color:currentAcc.color, fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px" }}>{currentAcc.label}</span>
              <Badge color={currentAcc.zona==="Norte"?"#38bdf8":"#a78bfa"} small>ZONA {currentAcc.zona.toUpperCase()}</Badge>
            </div>
            <NormalBtn onClick={() => resetAcceso(currentAcc)} label="TODO ABIERTO" />
          </div>
          {expoCarriles.length > 0 && (
            <>
              <div style={{ fontSize:"10px", color:EXPO_COLOR, fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"10px" }}>📤 EXPORTACIÓN</div>
              <div style={{ display:"grid", gridTemplateColumns: expoCarriles.length===1?"1fr":"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
                {expoCarriles.map(carril => {
                  const st = estado[carril.id] || {};
                  return (
                    <div key={carril.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`2px solid ${st.abierto?EXPO_COLOR+"88":"#6b728055"}`, borderRadius:"12px", padding:"14px", textAlign:"center", opacity: st.abierto?1:0.65, transition:"all 0.2s" }}>
                      <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), marginBottom:"3px" }}>{carril.label}</div>
                      <div style={{ fontSize:"20px", marginBottom:"6px" }}>📤</div>
                      <div style={{ fontSize:"10px", color:EXPO_COLOR, fontFamily:getFont(theme, "secondary"), fontWeight:"700", marginBottom:"12px" }}>EXPORTACIÓN</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"8px" }}>
                        <button onClick={() => toggle(carril.id, true)}  style={{ padding:"7px 4px", background: st.abierto?"#22c55e22":"#0a1628", border:`1px solid ${st.abierto?"#22c55e":"#1e3a5f"}`, borderRadius:"6px", color: st.abierto?"#22c55e":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.abierto?"700":"400" }}>✓ ABIERTO</button>
                        <button onClick={() => toggle(carril.id, false)} style={{ padding:"7px 4px", background: !st.abierto?"#6b728022":"#0a1628", border:`1px solid ${!st.abierto?"#6b7280":"#1e3a5f"}`, borderRadius:"6px", color: !st.abierto?"#9ca3af":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: !st.abierto?"700":"400" }}>⛔ CERRADO</button>
                      </div>
                      <div style={{ padding:"5px", background: st.abierto?"#22c55e15":"#6b728015", borderRadius:"6px", fontSize:"10px", color: st.abierto?"#22c55e":"#6b7280", fontFamily:getFont(theme, "secondary"), fontWeight:"700" }}>{st.abierto?"● OPERANDO":"● CERRADO"}</div>
                      <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), marginTop:"5px" }}>{timeAgo(st.lastUpdate)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {impoCarriles.length > 0 && (
            <>
              <div style={{ fontSize:"10px", color:IMPO_COLOR, fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"10px" }}>📥 IMPORTACIÓN</div>
              <div style={{ display:"grid", gridTemplateColumns: impoCarriles.length===1?"1fr":"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
                {impoCarriles.map(carril => {
                  const st = estado[carril.id] || {};
                  return (
                    <div key={carril.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`2px solid ${st.abierto?IMPO_COLOR+"88":"#6b728055"}`, borderRadius:"12px", padding:"14px", textAlign:"center", opacity: st.abierto?1:0.65, transition:"all 0.2s" }}>
                      <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), marginBottom:"3px" }}>{carril.label}</div>
                      <div style={{ fontSize:"20px", marginBottom:"6px" }}>📥</div>
                      <div style={{ fontSize:"10px", color:IMPO_COLOR, fontFamily:getFont(theme, "secondary"), fontWeight:"700", marginBottom:"12px" }}>IMPORTACIÓN</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"8px" }}>
                        <button onClick={() => toggle(carril.id, true)}  style={{ padding:"7px 4px", background: st.abierto?"#22c55e22":"#0a1628", border:`1px solid ${st.abierto?"#22c55e":"#1e3a5f"}`, borderRadius:"6px", color: st.abierto?"#22c55e":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: st.abierto?"700":"400" }}>✓ ABIERTO</button>
                        <button onClick={() => toggle(carril.id, false)} style={{ padding:"7px 4px", background: !st.abierto?"#6b728022":"#0a1628", border:`1px solid ${!st.abierto?"#6b7280":"#1e3a5f"}`, borderRadius:"6px", color: !st.abierto?"#9ca3af":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: !st.abierto?"700":"400" }}>⛔ CERRADO</button>
                      </div>
                      <div style={{ padding:"5px", background: st.abierto?"#22c55e15":"#6b728015", borderRadius:"6px", fontSize:"10px", color: st.abierto?"#22c55e":"#6b7280", fontFamily:getFont(theme, "secondary"), fontWeight:"700" }}>{st.abierto?"● OPERANDO":"● CERRADO"}</div>
                      <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), marginTop:"5px" }}>{timeAgo(st.lastUpdate)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      <ToastBox toast={toast} />
    </div>
  );
}

// --- TAB: NOTICIAS ---
// --- VISOR FULLSCREEN ---
function VisorFullscreen({ item, onClose }) {
  const theme = React.useContext(ThemeContext);
  const isPdf = item?.archivo_url?.toLowerCase().includes(".pdf") || item?.archivo_tipo === "application/pdf";
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  if (!item) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:"700px", maxHeight:"90vh", display:"flex", flexDirection:"column", gap:"10px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", color:"rgba(255,255,255,0.95)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.titulo}</div>
            {item.detalle && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)", marginTop:"2px" }}>{item.detalle}</div>}
          </div>
          <button onClick={onClose} style={{ flexShrink:0, marginLeft:"12px", width:"34px", height:"34px", borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.8)", fontSize:"16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        {/* Contenido */}
        <div style={{ flex:1, minHeight:0, borderRadius:"12px", overflow:"hidden", background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {isPdf ? (
            <iframe src={item.archivo_url} title={item.titulo} style={{ width:"100%", height:"80vh", border:"none" }} />
          ) : (
            <img src={item.archivo_url} alt={item.titulo} style={{ maxWidth:"100%", maxHeight:"80vh", objectFit:"contain", display:"block" }} />
          )}
        </div>
        {/* Acciones */}
        <div style={{ display:"flex", gap:"8px", justifyContent:"center", flexShrink:0 }}>
          <a href={item.archivo_url} target="_blank" rel="noopener noreferrer" style={{ padding:"8px 16px", background:"#38bdf822", border:"1px solid #38bdf855", borderRadius:"8px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", textDecoration:"none", display:"flex", alignItems:"center", gap:"6px" }}>
            🔗 Abrir en nueva pestaña
          </a>
          <a href={item.archivo_url} download style={{ padding:"8px 16px", background:"#22c55e22", border:"1px solid #22c55e55", borderRadius:"8px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", textDecoration:"none", display:"flex", alignItems:"center", gap:"6px" }}>
            ⬇️ Descargar
          </a>
        </div>
      </div>
      <div style={{ marginTop:"12px", fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.25)" }}>Toca fuera o presiona ESC para cerrar</div>
    </div>
  );
}


// --- SUBIR COMUNICADO (con fechas y aprobación) ---
function SubirComunicadoPanel({ onSubido, isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const inputRef = useRef();

  const onFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(f.type)) {
      setError("Solo se permiten JPG, PNG o PDF");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("El archivo no debe superar 10 MB");
      return;
    }
    setError("");
    setArchivo(f);
    if (f.type !== "application/pdf") {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview("pdf");
    }
  };

  const handleSubir = async () => {
    if (!titulo.trim()) {
      setError("Escribe un título para el comunicado");
      return;
    }
    if (!archivo) {
      setError("Selecciona un archivo");
      return;
    }
    if (!fechaInicio || !horaInicio) {
      setError("Especifica la fecha y hora de inicio");
      return;
    }
    if (!fechaFin || !horaFin) {
      setError("Especifica la fecha y hora de término");
      return;
    }

    const inicio = new Date(`${fechaInicio}T${horaInicio}`).toISOString();
    const fin = new Date(`${fechaFin}T${horaFin}`).toISOString();

    if (fin <= inicio) {
      setError("La fecha de término debe ser posterior a la fecha de inicio");
      return;
    }

    setSubiendo(true);
    setError("");
    try {
      const ext = archivo.name.split(".").pop();
      const path = `comunicados/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await sb.storage
        .from("comunicados")
        .upload(path, archivo, { contentType: archivo.type, upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = sb.storage.from("comunicados").getPublicUrl(path);
      
      const { error: insErr } = await sb.from("comunicados").insert({
        titulo: titulo.trim(),
        detalle: detalle.trim() || null,
        archivo_url: publicUrl,
        archivo_tipo: archivo.type,
        fecha_inicio: inicio,
        fecha_fin: fin,
        aprobado: isAdmin === true,
        created_at: new Date().toISOString()
      });
      if (insErr) throw insErr;

      setExito(true);
      setTitulo("");
      setDetalle("");
      setArchivo(null);
      setPreview(null);
      setFechaInicio("");
      setHoraInicio("");
      setFechaFin("");
      setHoraFin("");
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setExito(false), 3000);
      if (onSubido) onSubido();
    } catch (err) {
      setError("Error al subir: " + (err.message || "Intenta de nuevo"));
    }
    setSubiendo(false);
  };

  return (
    <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "14px", padding: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <span style={{ fontSize: "18px" }}>📎</span>
        <span style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "12px", letterSpacing: "1px", color: "#fbbf24" }}>
          {isAdmin ? "SUBIR COMUNICADO (Admin)" : "PROPONER COMUNICADO"}
        </span>
      </div>
      
      <input
        type="text"
        placeholder="Título del comunicado *"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={120}
        style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 12px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "12px", marginBottom: "8px", boxSizing: "border-box", outline: "none" }}
      />
      
      <input
        type="text"
        placeholder="Descripción breve (opcional)"
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
        maxLength={200}
        style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 12px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "12px", marginBottom: "10px", boxSizing: "border-box", outline: "none" }}
      />

      {/* Fechas de vigencia */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: getFont(theme, "secondary"), marginBottom: "4px", letterSpacing: "1px" }}>FECHA INICIO *</div>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 8px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "11px", boxSizing: "border-box", outline: "none" }}
          />
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: getFont(theme, "secondary"), marginBottom: "4px", letterSpacing: "1px" }}>HORA INICIO *</div>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 8px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "11px", boxSizing: "border-box", outline: "none" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: getFont(theme, "secondary"), marginBottom: "4px", letterSpacing: "1px" }}>FECHA TÉRMINO *</div>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 8px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "11px", boxSizing: "border-box", outline: "none" }}
          />
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: getFont(theme, "secondary"), marginBottom: "4px", letterSpacing: "1px" }}>HORA TÉRMINO *</div>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            style={{ width: "100%", background: "#060e1a", border: "1px solid #1e3a5f", borderRadius: "8px", padding: "10px 8px", color: "rgba(255,255,255,0.9)", fontFamily: getFont(theme, "secondary"), fontSize: "11px", boxSizing: "border-box", outline: "none" }}
          />
        </div>
      </div>

      {/* Zona de archivo */}
      <div
        onClick={() => inputRef.current?.click()}
        style={{ border: "2px dashed #1e3a5f", borderRadius: "10px", padding: "16px", textAlign: "center", cursor: "pointer", marginBottom: "10px", background: archivo ? "#22c55e08" : "transparent", borderColor: archivo ? "#22c55e55" : "#1e3a5f", transition: "all 0.2s" }}
      >
        {preview && preview !== "pdf" && (
          <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: "160px", objectFit: "contain", borderRadius: "6px", marginBottom: "8px", display: "block", margin: "0 auto 8px" }} />
        )}
        {preview === "pdf" && <div style={{ fontSize: "40px", marginBottom: "6px" }}>📄</div>}
        <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: archivo ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
          {archivo ? `✓ ${archivo.name}` : "Toca aquí para seleccionar JPG, PNG o PDF (máx. 10 MB)"}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFileChange} style={{ display: "none" }} />
      </div>
      
      {!isAdmin && (
        <div style={{ background: "#fbbf2411", border: "1px solid #fbbf2433", borderRadius: "8px", padding: "10px 12px", marginBottom: "10px", fontSize: "10px", color: "#fbbf24", fontFamily: getFont(theme, "secondary"), lineHeight: "1.6" }}>
          ℹ️ Tu comunicado será enviado a revisión y aparecerá después de ser aprobado por un administrador.
        </div>
      )}
      
      {error && (
        <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "#f87171", marginBottom: "8px", padding: "8px 12px", background: "#ef444411", borderRadius: "7px" }}>
          ⚠️ {error}
        </div>
      )}
      {exito && (
        <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "#22c55e", marginBottom: "8px", padding: "8px 12px", background: "#22c55e11", borderRadius: "7px" }}>
          ✅ {isAdmin ? "Comunicado publicado correctamente" : "Comunicado enviado a revisión"}
        </div>
      )}
      
      <button
        onClick={handleSubir}
        disabled={subiendo}
        style={{ width: "100%", padding: "11px", background: subiendo ? "#0a1628" : "linear-gradient(135deg,#fbbf24,#f59e0b)", border: "none", borderRadius: "9px", color: subiendo ? "rgba(255,255,255,0.4)" : "#0a1628", fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "12px", cursor: subiendo ? "not-allowed" : "pointer", letterSpacing: "0.5px" }}
      >
        {subiendo ? "⏳ Subiendo..." : isAdmin ? "📤 PUBLICAR COMUNICADO" : "📤 ENVIAR A REVISIÓN"}
      </button>
    </div>
  );
}

// --- SECCIÓN COMUNICADOS (con sub-tabs: Ver / Proponer) ---
function ComunicadosSection({ isAdmin, comunicados, onReload, setVisorItem, timeAgo, isPdf }) {
  const theme = React.useContext(ThemeContext);
  const [subTab, setSubTab] = useState("ver"); // "ver" | "proponer"
  const [pendientes, setPendientes] = useState([]);
  const [confirmId, setConfirmId] = useState(null); // id del comunicado a eliminar
  const [eliminando, setEliminando] = useState(false); // estado de eliminación en progreso

  const formatDateTime = (timestamp) => {
    const d = new Date(toMs(timestamp));
    return d.toLocaleString("es-MX", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Filtrar comunicados para mostrar
  const ahora = Date.now();
  const vigentes = comunicados.filter(c => {
    // Verificar aprobado — acepta boolean true o string "true"
    const aprobado = c.aprobado === true || c.aprobado === "true" || c.aprobado === 1;
    if (!aprobado) return false;
    // Si no hay fecha_fin, mostrar siempre
    if (!c.fecha_fin) return true;
    const fin = toMs(c.fecha_fin);
    // Si no se puede parsear la fecha, mostrar de todas formas
    if (!fin || isNaN(fin)) return true;
    return fin > ahora;
  });

  const cargarPendientes = () => {
    if (!isAdmin) return;
    sb.from("comunicados")
      .select("*")
      .eq("aprobado", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPendientes(data); });
  };

  // Cargar pendientes (solo admin)
  useEffect(() => {
    cargarPendientes();
  }, [isAdmin]);

  const [procesando, setProcesando] = useState(null); // id del que se está procesando

  const aprobar = async (id) => {
    setProcesando(id);
    const { error } = await sb.from("comunicados").update({ aprobado: true }).eq("id", id);
    setProcesando(null);
    if (error) { alert("Error al aprobar: " + error.message); return; }
    setPendientes(prev => prev.filter(p => p.id !== id));
    onReload();
    cargarPendientes();
  };

  const rechazar = async (id) => {
    setProcesando(id);
    const com = pendientes.find(p => p.id === id);
    if (com?.archivo_url) {
      try {
        const pathParts = com.archivo_url.split("/comunicados/");
        if (pathParts[1]) {
          await sb.storage.from("comunicados").remove([`comunicados/${pathParts[1]}`]);
        }
      } catch {}
    }
    const { error } = await sb.from("comunicados").delete().eq("id", id);
    setProcesando(null);
    if (error) { alert("Error al rechazar: " + error.message); return; }
    setPendientes(prev => prev.filter(p => p.id !== id));
    onReload();
  };

  const pedirEliminar = (id) => setConfirmId(id);

  const eliminar = async (id) => {
    if (eliminando) return;
    setEliminando(true);

    const com = vigentes.find(v => v.id === id) || comunicados.find(c => c.id === id);

    // 1. Eliminar archivo de storage si existe
    if (com?.archivo_url) {
      try {
        const path = com.archivo_url.split("/comunicados/")[1];
        if (path) await sb.storage.from("comunicados").remove([`comunicados/${path}`]);
      } catch (err) {
        console.error("Error al eliminar archivo:", err);
      }
    }

    // 2. Delete con .select() para confirmar que Supabase realmente eliminó la fila
    const { data: deleted, error } = await sb
      .from("comunicados")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error al eliminar comunicado:", error);
      alert("Error al eliminar el comunicado: " + error.message);
      setEliminando(false);
      setConfirmId(null);
      return;
    }

    // 3. Si no se eliminó ninguna fila, probablemente hay un problema de RLS
    if (!deleted || deleted.length === 0) {
      alert("No se pudo eliminar el comunicado.\n\nVerifica que la política RLS de la tabla 'comunicados' en Supabase permita DELETE al rol anon o al usuario actual.");
      setEliminando(false);
      setConfirmId(null);
      return;
    }

    // 4. Cerrar modal y recargar
    setEliminando(false);
    setConfirmId(null);
    onReload();
  };

  const handleSubidoExitoso = () => {
    onReload();
    cargarPendientes();
    setSubTab("ver");
  };



  return (
    <>
      {/* Sub-tabs: Ver / Proponer */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", background: "#060e1a", borderRadius: "12px", padding: "4px", border: "1px solid #1e3a5f" }}>
        <button
          onClick={() => setSubTab("ver")}
          style={{ flex: 1, padding: "10px 8px", borderRadius: "9px", border: "none", background: subTab === "ver" ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "transparent", color: subTab === "ver" ? "#0a1628" : "#475569", fontFamily: getFont(theme, "secondary"), fontSize: "11px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.5px", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
        >
          📋 VER COMUNICADOS
          {vigentes.length > 0 && (
            <span style={{ background: subTab === "ver" ? "rgba(10,22,40,0.3)" : "#fbbf24", color: subTab === "ver" ? "#0a1628" : "#0a1628", borderRadius: "10px", padding: "1px 6px", fontSize: "9px", fontWeight: "700" }}>
              {vigentes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("proponer")}
          style={{ flex: 1, padding: "10px 8px", borderRadius: "9px", border: "none", background: subTab === "proponer" ? "linear-gradient(135deg,#38bdf8,#0ea5e9)" : "transparent", color: subTab === "proponer" ? "#0a1628" : "#475569", fontFamily: getFont(theme, "secondary"), fontSize: "11px", fontWeight: "700", cursor: "pointer", letterSpacing: "0.5px", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
        >
          {isAdmin ? "📤 PUBLICAR" : "✉️ PROPONER"}
          {isAdmin && pendientes.length > 0 && (
            <span style={{ background: "#f97316", color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "9px", fontWeight: "700" }}>
              {pendientes.length}
            </span>
          )}
        </button>
      </div>

      {/* -- MODAL CONFIRMACIÓN ELIMINAR -- position:fixed cubre toda la pantalla sin necesitar portal */}
      {confirmId && (
        <div
          onClick={() => !eliminando && setConfirmId(null)}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d1b2e", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "16px", padding: "24px", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>{eliminando ? "⏳" : "🗑️"}</div>
            <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "14px", color: "#fff", marginBottom: "8px" }}>
              {eliminando ? "Eliminando comunicado..." : "¿Eliminar comunicado?"}
            </div>
            <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "11px", color: "rgba(255,255,255,0.45)", marginBottom: "22px", lineHeight: "1.5" }}>
              {eliminando 
                ? "Por favor espera mientras se elimina el archivo y el registro."
                : <>Esta acción es permanente.<br/>Se eliminará el archivo y no podrá recuperarse.</>
              }
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirmId(null)}
                disabled={eliminando}
                style={{ 
                  flex: 1, 
                  padding: "12px", 
                  background: "transparent", 
                  border: "1px solid #1e3a5f", 
                  borderRadius: "10px", 
                  color: eliminando ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)", 
                  fontFamily: getFont(theme, "secondary"), 
                  fontSize: "12px", 
                  fontWeight: "700", 
                  cursor: eliminando ? "not-allowed" : "pointer",
                  opacity: eliminando ? 0.5 : 1
                }}
              >Cancelar</button>
              <button
                onClick={() => eliminar(confirmId)}
                disabled={eliminando}
                style={{ 
                  flex: 1, 
                  padding: "12px", 
                  background: eliminando ? "#0a1628" : "linear-gradient(135deg,#ef4444,#dc2626)", 
                  border: "none", 
                  borderRadius: "10px", 
                  color: eliminando ? "rgba(255,255,255,0.4)" : "#fff", 
                  fontFamily: getFont(theme, "secondary"), 
                  fontSize: "12px", 
                  fontWeight: "700", 
                  cursor: eliminando ? "not-allowed" : "pointer",
                  opacity: eliminando ? 0.7 : 1
                }}
              >{eliminando ? "Eliminando..." : "Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* -- SUB-TAB: VER COMUNICADOS -- */}
      {subTab === "ver" && (
        <>
          {vigentes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", border: "1px dashed #1e3a5f", borderRadius: "14px", color: "rgba(255,255,255,0.25)", fontFamily: getFont(theme, "secondary"), fontSize: "12px" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>📭</div>
              Sin comunicados vigentes en este momento
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
                {vigentes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setVisorItem(c)}
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, border-color 0.15s", position: "relative" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  >
                    <div style={{ width: "100%", aspectRatio: "4/3", background: "#060e1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {isPdf(c.archivo_url) ? (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "32px" }}>📄</div>
                          <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "9px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>PDF</div>
                        </div>
                      ) : (
                        <img src={c.archivo_url} alt={c.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "11px", color: "rgba(255,255,255,0.9)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</div>
                      {c.detalle && <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "4px" }}>{c.detalle}</div>}
                      <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>🕐 Vence: {formatDateTime(c.fecha_fin)}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); pedirEliminar(c.id); }}
                        style={{ position: "absolute", top: "6px", right: "6px", width: "28px", height: "28px", background: "rgba(239,68,68,0.85)", border: "1px solid rgba(239,68,68,0.6)", borderRadius: "50%", color: "#fff", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                        title="Eliminar comunicado"
                      >🗑</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", padding: "16px", color: "rgba(255,255,255,0.3)", fontFamily: getFont(theme, "secondary"), fontSize: "10px" }}>
                Toca cualquier comunicado para verlo a pantalla completa
              </div>
            </>
          )}
        </>
      )}

      {/* -- SUB-TAB: PROPONER / PUBLICAR -- */}
      {subTab === "proponer" && (
        <>
          {/* Descripción contextual */}
          <div style={{ background: isAdmin ? "rgba(56,189,248,0.06)" : "rgba(251,191,36,0.06)", border: `1px solid ${isAdmin ? "rgba(56,189,248,0.2)" : "rgba(251,191,36,0.2)"}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "16px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>{isAdmin ? "📤" : "✉️"}</span>
            <div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "12px", color: isAdmin ? "#38bdf8" : "#fbbf24", marginBottom: "3px", letterSpacing: "0.5px" }}>
                {isAdmin ? "PUBLICAR COMUNICADO OFICIAL" : "PROPONER COMUNICADO"}
              </div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.45)", lineHeight: "1.5" }}>
                {isAdmin
                  ? "Tus comunicados se publican de inmediato y aparecen en la sección Ver Comunicados."
                  : "Tu propuesta será revisada por un administrador antes de ser visible para la comunidad."}
              </div>
            </div>
          </div>

          <SubirComunicadoPanel onSubido={handleSubidoExitoso} isAdmin={isAdmin} />

          {/* -- PENDIENTES DE APROBACIÓN (solo admin) -- */}
          {isAdmin && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ flex: 1, height: "1px", background: "#1e3a5f" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "#f97316", fontWeight: "700", letterSpacing: "1px", whiteSpace: "nowrap" }}>
                  ⏳ SOLICITUDES PENDIENTES
                  {pendientes.length > 0 && (
                    <span style={{ background: "#f97316", color: "#fff", borderRadius: "8px", padding: "1px 7px", fontSize: "10px" }}>{pendientes.length}</span>
                  )}
                </div>
                <div style={{ flex: 1, height: "1px", background: "#1e3a5f" }} />
              </div>

              {pendientes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", border: "1px dashed #1e3a5f", borderRadius: "12px", color: "rgba(255,255,255,0.25)", fontFamily: getFont(theme, "secondary"), fontSize: "11px" }}>
                  Sin solicitudes pendientes
                </div>
              ) : (
                pendientes.map((p) => (
                  <div key={p.id} style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.25)", borderLeft: "3px solid #f97316", borderRadius: "12px", padding: "12px 14px", marginBottom: "10px" }}>
                    {/* Info del comunicado */}
                    <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                      {/* Thumbnail */}
                      <div style={{ flexShrink: 0, width: "64px", height: "64px", borderRadius: "8px", overflow: "hidden", background: "#060e1a", border: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isPdf(p.archivo_url) ? (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "24px" }}>📄</div>
                            <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "8px", color: "rgba(255,255,255,0.4)" }}>PDF</div>
                          </div>
                        ) : (
                          <img src={p.archivo_url} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>
                      {/* Datos */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "12px", color: "rgba(255,255,255,0.95)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</div>
                        {p.detalle && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.detalle}</div>}
                        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: getFont(theme, "secondary"), lineHeight: "1.6" }}>
                          <div>📅 Inicio: {formatDateTime(p.fecha_inicio)}</div>
                          <div>⏰ Fin: {formatDateTime(p.fecha_fin)}</div>
                        </div>
                      </div>
                    </div>
                    {/* Acciones: 3 botones */}
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => setVisorItem(p)}
                        disabled={procesando === p.id}
                        style={{ flex: 1, padding: "8px 4px", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.4)", borderRadius: "8px", color: "#38bdf8", fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                      >
                        👁 VER
                      </button>
                      <button
                        onClick={() => aprobar(p.id)}
                        disabled={procesando !== null}
                        style={{ flex: 1, padding: "8px 4px", background: procesando === p.id ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.5)", borderRadius: "8px", color: "#22c55e", fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", cursor: procesando !== null ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", opacity: procesando !== null && procesando !== p.id ? 0.5 : 1 }}
                      >
                        {procesando === p.id ? "⏳" : "✓"} APROBAR
                      </button>
                      <button
                        onClick={() => rechazar(p.id)}
                        disabled={procesando !== null}
                        style={{ flex: 1, padding: "8px 4px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: "8px", color: "#ef4444", fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", cursor: procesando !== null ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", opacity: procesando !== null && procesando !== p.id ? 0.5 : 1 }}
                      >
                        ✕ RECHAZAR
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

// --- TAB: NOTICIAS ---
function NoticiasTab({ isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [noticias,      setNoticias]      = useState([]);
  const [comunicados,   setComunicados]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filtro,        setFiltro]        = useState("todos");
  const [visorItem,     setVisorItem]     = useState(null);
  const [seccion,       setSeccion]       = useState("noticias"); // "noticias" | "comunicados"

  const cargarComunicados = () => {
    // Trae todos los comunicados — el filtro por aprobado se hace en el cliente
    // Cargar solo comunicados aprobados (vigentes)
    // para evitar problemas con tipos booleanos en Supabase
    sb.from("comunicados")
      .select("*")
      .eq("aprobado", true)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error("Error cargando comunicados:", error);
        if (data) setComunicados(data);
      });
  };

  useEffect(() => {
    sb.from("noticias").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { if (data) setNoticias(data); setLoading(false); });
    cargarComunicados();
    const chan = sb.channel("noticias-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "noticias" }, ({ new: r }) => {
        if (r) setNoticias(prev => [r, ...prev].slice(0, 100));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comunicados" }, ({ new: r }) => {
        // Solo agregar si está aprobado
        const aprobado = r.aprobado === true || r.aprobado === "true" || r.aprobado === 1;
        if (r && aprobado) setComunicados(prev => [r, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "comunicados" }, ({ new: r }) => {
        // Si se aprobó, agregarlo a la lista (si no estaba)
        const aprobado = r.aprobado === true || r.aprobado === "true" || r.aprobado === 1;
        if (r && aprobado) {
          setComunicados(prev => {
            // Si ya existe, no duplicar
            if (prev.some(c => c.id === r.id)) return prev;
            return [r, ...prev].slice(0, 50);
          });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comunicados" }, ({ old: r }) => {
        // Remover de la lista cuando se elimina
        if (r?.id) setComunicados(prev => prev.filter(c => c.id !== r.id));
      })
      .subscribe();
    return () => sb.removeChannel(chan);
  }, []);


  const FILTROS = [
    { id: "todos",     label: "Todos",      icon: "📰" },
    { id: "acceso",    label: "Accesos",    icon: "📍" },
    { id: "terminal",  label: "Terminales", icon: "⚓" },
    { id: "incidente", label: "Incidentes", icon: "🚨" },
    { id: "segundo",   label: "2do Acceso", icon: "🛣️" },
    { id: "carril",    label: "Carriles",   icon: "🚦" },
  ];

  const filtered = filtro === "todos" ? noticias : noticias.filter(n => n.tipo === filtro || (filtro === "incidente" && n.tipo === "resuelto"));

  const timeAgo = (ts) => {
    const d = Date.now() - new Date(ts).getTime();
    if (d < 60000)    return "hace un momento";
    if (d < 3600000)  return `hace ${Math.floor(d/60000)}min`;
    if (d < 86400000) return `hace ${Math.floor(d/3600000)}h`;
    return `hace ${Math.floor(d/86400000)}d`;
  };

  const isPdf = (url) => url?.toLowerCase().endsWith(".pdf");

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>
      {/* Visor fullscreen */}
      {visorItem && <VisorFullscreen item={visorItem} onClose={() => setVisorItem(null)} />}

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a2540)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"14px", padding:"16px", marginBottom:"16px", textAlign:"center" }}>
        <div style={{ fontSize:"32px", marginBottom:"8px" }}>📰</div>
        <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", letterSpacing:"1px" }}>NOTICIAS DEL PUERTO</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px", marginTop:"4px", fontFamily:getFont(theme, "secondary") }}>Actualizaciones en tiempo real de toda la operación</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"16px", marginTop:"8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div style={{ width:"6px", height:"6px", background:"#22c55e", borderRadius:"50%" }} />
            <span style={{ fontSize:"10px", color:"#22c55e", fontFamily:getFont(theme, "secondary") }}>{noticias.length} actualizaciones</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <div style={{ width:"6px", height:"6px", background:"#fbbf24", borderRadius:"50%" }} />
            <span style={{ fontSize:"10px", color:"#fbbf24", fontFamily:getFont(theme, "secondary") }}>{comunicados.filter(c => {
              const aprobado = c.aprobado === true || c.aprobado === "true" || c.aprobado === 1;
              if (!aprobado) return false;
              if (!c.fecha_fin) return true;
              const fin = toMs(c.fecha_fin);
              if (!fin || isNaN(fin)) return true;
              return fin > Date.now();
            }).length} comunicados</span>
          </div>
        </div>
      </div>

      {/* Selector de sección */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
        <button onClick={() => setSeccion("noticias")} style={{ flex:1, padding:"10px", borderRadius:"10px", border:`1px solid ${seccion==="noticias"?"#38bdf8":"#1e3a5f"}`, background: seccion==="noticias"?"#38bdf822":"#0a1628", color: seccion==="noticias"?"#38bdf8":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor:"pointer", letterSpacing:"0.5px" }}>
          📰 NOTICIAS
        </button>
        <button onClick={() => setSeccion("comunicados")} style={{ flex:1, padding:"10px", borderRadius:"10px", border:`1px solid ${seccion==="comunicados"?"#fbbf24":"#1e3a5f"}`, background: seccion==="comunicados"?"#fbbf2422":"#0a1628", color: seccion==="comunicados"?"#fbbf24":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor:"pointer", letterSpacing:"0.5px" }}>
          📎 COMUNICADOS
        </button>
      </div>

      {/* -- SECCIÓN NOTICIAS -- */}
      {seccion === "noticias" && (
        <>
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"16px" }}>
            {FILTROS.map(f => (
              <button key={f.id} onClick={() => setFiltro(f.id)} style={{ padding:"5px 10px", borderRadius:"20px", border:`1px solid ${filtro===f.id?"#38bdf8":"#1e3a5f"}`, background: filtro===f.id?"#38bdf822":"#0a1628", color: filtro===f.id?"#38bdf8":"#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight: filtro===f.id?"700":"400", display:"flex", alignItems:"center", gap:"4px" }}>
                <span>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
          {loading && <div style={{ textAlign:"center", padding:"40px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}>Cargando noticias...</div>}
          {!loading && filtered.length === 0 && <div style={{ textAlign:"center", padding:"40px", border:"1px dashed #1e3a5f", borderRadius:"12px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), fontSize:"12px" }}>📭 Sin noticias aún — los cambios aparecerán aquí en tiempo real</div>}
          {filtered.map((n) => (
            <div key={n.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${n.color || "#1e3a5f"}33`, borderLeft:`3px solid ${n.color || "#38bdf8"}`, borderRadius:"10px", padding:"12px 14px", marginBottom:"8px" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:"10px" }}>
                <div style={{ width:"32px", height:"32px", flexShrink:0, background:(n.color||"#38bdf8")+"22", border:`1px solid ${n.color||"#38bdf8"}44`, borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>{n.icono || "📰"}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", marginBottom:"3px" }}>{n.titulo}</div>
                  {n.detalle && <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px", marginBottom:"5px" }}>{n.detalle}</div>}
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary") }}>{timeAgo(n.created_at)}</span>
                    <span style={{ width:"3px", height:"3px", background:"#334155", borderRadius:"50%" }} />
                    <span style={{ fontSize:"9px", color:(n.color||"#38bdf8"), fontFamily:getFont(theme, "secondary"), fontWeight:"700", textTransform:"uppercase" }}>{n.tipo}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length > 0 && <div style={{ textAlign:"center", padding:"16px", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), fontSize:"10px" }}>— Mostrando {filtered.length} actualizaciones —</div>}
        </>
      )}

      {/* -- SECCIÓN COMUNICADOS -- */}
      {seccion === "comunicados" && (
        <ComunicadosSection 
          isAdmin={isAdmin}
          comunicados={comunicados}
          onReload={cargarComunicados}
          setVisorItem={setVisorItem}
          timeAgo={timeAgo}
          isPdf={isPdf}
        />
      )}
    </div>
  );
}

// --- TAB: DONATIVOS ---
function DonativosTab() {
  const theme = React.useContext(ThemeContext);
  const [copied, setCopied] = useState(false);
  const [copiedAlbo, setCopiedAlbo] = useState(false);
  const CLABE = "042180010045965913";
  const CLABE_ALBO = "721180100036945704";
  const copyClabe = () => {
    navigator.clipboard.writeText(CLABE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  const copyClabeAlbo = () => {
    navigator.clipboard.writeText(CLABE_ALBO).then(() => {
      setCopiedAlbo(true);
      setTimeout(() => setCopiedAlbo(false), 2500);
    });
  };
  return (
    <div style={{ padding:"20px 24px", paddingBottom:"80px", maxWidth:"960px", margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:"32px" }}>
        <div style={{ fontSize:"48px", marginBottom:"12px" }}>⚓</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"16px", letterSpacing:"2px", color:"rgba(255,255,255,0.95)", marginBottom:"8px" }}>JUNTOS SOMOS MÁS FUERTES</div>
        <div style={{ width:"48px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"0 auto 16px" }} />
      </div>
      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a1628)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"16px", padding:"20px", marginBottom:"20px" }}>
        <div style={{ fontSize:"22px", textAlign:"center", marginBottom:"14px" }}>💙🚛💙</div>
        <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.7)", lineHeight:"1.9", marginBottom:"12px" }}>Puerto Tráfico nació de la comunidad y <span style={{ color:"#38bdf8", fontWeight:"700" }}>para la comunidad</span>. Cada operador, transportista y trabajador portuario que comparte información en tiempo real hace que este sistema funcione.</p>
        <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.7)", lineHeight:"1.9", marginBottom:"12px" }}>Mantener esta plataforma activa tiene costos reales: servidores, desarrollo y mejoras constantes. Si Puerto Tráfico te ha ahorrado tiempo, considera apoyar con lo que puedas.</p>
        <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.7)", lineHeight:"1.9" }}>No importa el monto — cada aportación es un <span style={{ color:"#a78bfa", fontWeight:"700" }}>voto de confianza</span> en que podemos construir algo mejor, juntos. 🙏</p>
      </div>
      <div style={{ textAlign:"center", fontSize:"13px", color:"#1e3a5f", marginBottom:"20px", letterSpacing:"6px" }}>♥ ♥ ♥</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"16px", marginBottom:"16px" }}>
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"2px solid #38bdf855", borderRadius:"16px", padding:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
          <div style={{ width:"8px", height:"8px", background:"#38bdf8", borderRadius:"50%", boxShadow:"0 0 8px #38bdf8" }} />
          <span style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", letterSpacing:"2px", color:"#38bdf8" }}>DATOS PARA DONATIVO</span>
        </div>
        <div style={{ marginBottom:"14px" }}>
          <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>BANCO</div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"16px", color:"rgba(255,255,255,0.95)", letterSpacing:"2px" }}>MIFEL</div>
        </div>
        <div style={{ marginBottom:"18px" }}>
          <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px" }}>CUENTA CLABE</div>
          <div style={{ background:"#060e1a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", color:"#38bdf8", letterSpacing:"2px" }}>{CLABE}</span>
            <button onClick={copyClabe} style={{ padding:"6px 12px", background: copied ? "#22c55e22" : "#38bdf822", border:`1px solid ${copied ? "#22c55e" : "#38bdf855"}`, borderRadius:"7px", color: copied ? "#22c55e" : "#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s", flexShrink:0, marginLeft:"10px" }}>{copied ? "✓ COPIADO" : "📋 COPIAR"}</button>
          </div>
        </div>
        <div style={{ background:"#22c55e11", border:"1px solid #22c55e33", borderRadius:"10px", padding:"12px", textAlign:"center" }}>
          <div style={{ fontSize:"20px", marginBottom:"4px" }}>🙏</div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#22c55e", fontWeight:"700" }}>GRACIAS POR MANTENER VIVA LA COMUNIDAD</div>
        </div>
      </div>
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"2px solid #a78bfa55", borderRadius:"16px", padding:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
          <div style={{ width:"8px", height:"8px", background:"#a78bfa", borderRadius:"50%", boxShadow:"0 0 8px #a78bfa" }} />
          <span style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", letterSpacing:"2px", color:"#a78bfa" }}>DATOS PARA DONATIVO</span>
        </div>
        <div style={{ marginBottom:"14px" }}>
          <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"5px" }}>BANCO</div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"16px", color:"rgba(255,255,255,0.95)", letterSpacing:"2px" }}>ALBO</div>
        </div>
        <div style={{ marginBottom:"18px" }}>
          <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px" }}>CUENTA CLABE</div>
          <div style={{ background:"#060e1a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", color:"#a78bfa", letterSpacing:"2px" }}>{CLABE_ALBO}</span>
            <button onClick={copyClabeAlbo} style={{ padding:"6px 12px", background: copiedAlbo ? "#22c55e22" : "#a78bfa22", border:`1px solid ${copiedAlbo ? "#22c55e" : "#a78bfa55"}`, borderRadius:"7px", color: copiedAlbo ? "#22c55e" : "#a78bfa", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s", flexShrink:0, marginLeft:"10px" }}>{copiedAlbo ? "✓ COPIADO" : "📋 COPIAR"}</button>
          </div>
        </div>
        <div style={{ background:"#22c55e11", border:"1px solid #22c55e33", borderRadius:"10px", padding:"12px", textAlign:"center" }}>
          <div style={{ fontSize:"20px", marginBottom:"4px" }}>🙏</div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#22c55e", fontWeight:"700" }}>GRACIAS POR MANTENER VIVA LA COMUNIDAD</div>
        </div>
      </div>
      </div>{/* end grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:"12px", marginBottom:"16px" }}>
      <a href="https://link.mercadopago.com.mx/conectmanzanillo" target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none" }}>
        <div style={{ background:"linear-gradient(135deg,#00b1ea22,#009ee322)", border:"2px solid #00b1ea88", borderRadius:"16px", padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ fontSize:"28px" }}>💳</div>
            <div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", color:"#00b1ea", letterSpacing:"1px", marginBottom:"3px" }}>DONAR CON MERCADO PAGO</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", letterSpacing:"0.5px" }}>Tú eliges cuánto aportar</div>
            </div>
          </div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#00b1ea", fontWeight:"700", letterSpacing:"1px" }}>→</div>
        </div>
      </a>
      <a href="https://mpago.la/1okB3a4" target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none" }}>
        <div style={{ background:"linear-gradient(135deg,#00b1ea11,#009ee311)", border:"1px solid #00b1ea44", borderRadius:"16px", padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ fontSize:"28px" }}>⚡</div>
            <div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", color:"#00b1ea", letterSpacing:"1px", marginBottom:"3px" }}>DONACIÓN RÁPIDA</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", letterSpacing:"0.5px" }}>Mercado Pago · Rápido y seguro</div>
            </div>
          </div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#00b1ea", fontWeight:"700", letterSpacing:"1px" }}>→</div>
        </div>
      </a>
      <a href="https://ko-fi.com/conectmanzanillo" target="_blank" rel="noopener noreferrer" style={{ display:"block", textDecoration:"none" }}>
        <div style={{ background:"linear-gradient(135deg,#ff5e5b22,#ff914d22)", border:"2px solid #ff5e5b88", borderRadius:"16px", padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", transition:"all 0.2s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ fontSize:"28px" }}>☕</div>
            <div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", color:"#ff5e5b", letterSpacing:"1px", marginBottom:"3px" }}>DONAR EN KO-FI</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", letterSpacing:"0.5px" }}>Anónimo · Internacional · Fácil</div>
            </div>
          </div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"#ff5e5b", fontWeight:"700", letterSpacing:"1px" }}>→</div>
        </div>
      </a>
      </div>{/* end payment grid */}
      <div style={{ textAlign:"center", padding:"12px" }}>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px" }}>Hecho con ❤️ por y para los que mueven el puerto</div>
      </div>
    </div>
  );
}

// --- TAB: PATIO REGULADOR ---
function PatioReguladorTab({ myId }) {
  const theme = React.useContext(ThemeContext);
  const [patios,      setPatios]      = useState(null);  // null = loading
  const [toast,       setToast]       = useState(null);
  const [changeModal, setChangeModal] = useState(null);
  const [notas,       setNotas]       = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("patio_notas") || "{}"); } catch { return {}; }
  });

  const updateNota = (id, val) => {
    const next = { ...notas, [id]: val };
    setNotas(next);
    try { sessionStorage.setItem("patio_notas", JSON.stringify(next)); } catch {}
  };

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };
  const getOpt = (id) => PATIO_STATUS_OPTIONS.find(o => o.id === id) || PATIO_STATUS_OPTIONS[0];

  useEffect(() => {
    sb.from("patios").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("patios").upsert(PATIOS_REGULADORES.map(p => ({ id: p.id, status: "libre", last_update: Date.now(), updated_by: "Sistema", pending_voters: {} })));
        setPatios(mkPatios());
        return;
      }
      const map = {};
      data.forEach(r => {
        map[r.id] = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
      });
      setPatios({ ...(mkPatios()), ...map });
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
    // Optimistic update
    setPatios(prev => ({ ...prev, [patioId]: { ...prev[patioId], status: statusGanador, lastUpdate: Date.now(), updatedBy: `${votosGanador} votos`, pendingVoters: conteo } }));
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

  const patioTickerItems = !patios ? [] : PATIOS_REGULADORES.map(p => {
    const st  = patios[p.id] || { status:"libre" };
    const opt = PATIO_STATUS_OPTIONS.find(o => o.id === st.status) || PATIO_STATUS_OPTIONS[0];
    return { text: `${p.name} — ${opt.label.toUpperCase()}`, color: opt.color };
  });

  return (
    <div style={{ padding:"16px", paddingBottom:"80px", minHeight:"100vh" }}>
      <TypewriterTicker items={patioTickerItems} />
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#fb923c", fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"4px" }}>PATIO REGULADOR — PUERTO MANZANILLO</div>
        <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>Estatus en tiempo real de los 8 patios reguladores del puerto.</div>
      </div>
      <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
        {PATIO_STATUS_OPTIONS.map(o => (
          <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"4px", background:o.color+"15", border:`1px solid ${o.color}33`, padding:"3px 8px", borderRadius:"4px" }}>
            <span style={{ color:o.color, fontSize:"11px", fontWeight:"700" }}>{o.icon}</span>
            <span style={{ color:o.color, fontSize:"10px", fontFamily:getFont(theme, "secondary") }}>{o.label}</span>
          </div>
        ))}
      </div>
      <SectionLabel text="PATIOS REGULADORES" rightBtn={<NormalBtn onClick={resetAll} label="TODOS LIBRES" />} />
      {(!patios) ? <SkeletonCard n={4}/> : PATIOS_REGULADORES.map(patio => {
        const st  = patios[patio.id] || { status:"libre", lastUpdate: Date.now(), updatedBy:"Sistema", pendingVoters:{} };
        const opt = getOpt(st.status);
        const votes = st.pendingVoters || {};
        const totalVotes = Object.values(votes).reduce((a,b)=>a+b,0);
        return (
          <div key={patio.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${opt.color}44`, borderRadius:"12px", padding:"14px", marginBottom:"14px", boxShadow:`0 0 18px ${opt.color}08` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
              <div>
                <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px" }}>{patio.name}</div>
                <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", marginTop:"2px" }}>{patio.fullName}</div>
                <div style={{ color:"rgba(255,255,255,0.3)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"3px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
                <div style={{ background:opt.color+"22", border:`1px solid ${opt.color}66`, color:opt.color, padding:"5px 10px", borderRadius:"6px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", gap:"4px" }}>{opt.icon} {opt.label}</div>
                {totalVotes > 0 && <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary") }}>{totalVotes} voto(s)</span>}
                {st.status !== "libre" && <button onClick={() => resetOne(patio.id)} style={{ padding:"4px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ TODO NORMAL</button>}
              </div>
            </div>
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"7px" }}>REPORTAR ESTATUS:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {PATIO_STATUS_OPTIONS.map(o => {
                const isAct = st.status === o.id;
                return (
                  <button key={o.id} onClick={() => vote(patio.id, o.id)} style={{ padding:"8px 6px", background: isAct ? o.color+"33" : "#0a1628", border:`1px solid ${isAct ? o.color : "#1e3a5f"}`, borderRadius:"8px", color: isAct ? o.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px" }}>
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
            <div style={{ color:"#e2e8f0", fontFamily:getFont(theme, "secondary"), fontSize:"14px", fontWeight:"700", marginBottom:"8px" }}>¿Cambiar tu voto?</div>
            <div style={{ color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"12px", marginBottom:"20px" }}>
              ¿Estás seguro que quieres cambiar tu voto a <span style={{ color:"#fb923c", fontWeight:"700" }}>{changeModal.label}</span>?
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setChangeModal(null)} style={{ flex:1, padding:"10px", background:"#1e3a5f", border:"1px solid #2d4a6f", borderRadius:"8px", color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", fontWeight:"700" }}>Cancelar</button>
              <button onClick={async () => { const m = changeModal; setChangeModal(null); await vote(m.id, m.newStatus, true); }} style={{ flex:1, padding:"10px", background:"#fb923c22", border:"1px solid #fb923c", borderRadius:"8px", color:"#fb923c", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", fontWeight:"700" }}>Sí, cambiar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB: TUTORIAL ---
function TutorialTab({ setActive, isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen(prev => prev === id ? null : id);

  // -- Auth panel state --
  const [authMode, setAuthMode] = useState("login"); // "login" | "registro" | "forgot"
  // Login
  const [loginUser, setLoginUser]   = useState(() => { try { return localStorage.getItem("cm_remember_email") || ""; } catch { return ""; } });
  const [loginPass, setLoginPass]   = useState(() => { try { return localStorage.getItem("cm_remember_pass") || ""; } catch { return ""; } });
  const [loginRemember, setLoginRemember] = useState(() => { try { return !!localStorage.getItem("cm_remember_email"); } catch { return false; } });
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegPass2, setShowRegPass2] = useState(false);
  const [loginMsg, setLoginMsg]     = useState(null); // {type:"ok"|"err", text}
  // Registro — paso 1: básico | paso 2: teléfono | paso 3: correo | paso 4: contraseña
  const [regStep, setRegStep]       = useState(1);
  const [regNombre, setRegNombre]   = useState("");
  const [regApellidos, setRegApellidos] = useState("");
  const [regUsername, setRegUsername]   = useState("");
  const [regFecha, setRegFecha]     = useState("");
  const [regPais, setRegPais]       = useState("");
  const [regCiudad, setRegCiudad]   = useState("");
  const [regTel, setRegTel]         = useState("");
  const [regOtp, setRegOtp]         = useState("");
  const [otpEnviado, setOtpEnviado] = useState(false);
  const [regCorreo, setRegCorreo]   = useState("");
  const [regCorreo2, setRegCorreo2] = useState("");
  const [regPass, setRegPass]       = useState("");
  const [regPass2, setRegPass2]     = useState("");
  const [regTerminos, setRegTerminos] = useState(false);
  const [regPrivacidad, setRegPrivacidad] = useState(false);
  const [regAntibot, setRegAntibot] = useState("");
  const [regMsg, setRegMsg]         = useState(null);
  // Forgot
  const [forgotCorreo, setForgotCorreo] = useState("");
  const [forgotMsg, setForgotMsg]   = useState(null);

  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", padding:"12px 14px", color:"rgba(255,255,255,0.9)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", boxSizing:"border-box", outline:"none", marginBottom:"10px" };
  const btnPrimary = (color="#38bdf8") => ({ width:"100%", padding:"13px", background:`linear-gradient(135deg,${color},${color}cc)`, border:"none", borderRadius:"10px", color:"#0a1628", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", cursor:"pointer", letterSpacing:"0.5px", marginTop:"4px" });
  const btnSecondary = { background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", padding:"4px 0" };
  const MsgBox = ({ msg }) => msg ? (
    <div style={{ padding:"10px 12px", borderRadius:"8px", marginBottom:"10px", fontSize:"11px", fontFamily:getFont(theme, "secondary"), background: msg.type==="ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border:`1px solid ${msg.type==="ok" ? "#22c55e55" : "#ef444455"}`, color: msg.type==="ok" ? "#22c55e" : "#ef4444" }}>
      {msg.type==="ok" ? "✅ " : "⚠️ "}{msg.text}
    </div>
  ) : null;

  const [loading, setLoading] = useState(false);

  const passStrong = (p) => p.length >= 10 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

  // -- LOGIN con correo/contraseña real --
  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPass) { setLoginMsg({type:"err", text:"Completa usuario y contraseña"}); return; }
    setLoading(true); setLoginMsg(null);
    const email = loginUser.includes("@") ? loginUser.trim() : null;
    if (!email) { setLoginMsg({type:"err", text:"Ingresa tu correo electrónico para iniciar sesión"}); setLoading(false); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: loginPass });
    setLoading(false);
    if (error) { setLoginMsg({type:"err", text: error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message }); }
    else {
      setLoginMsg({type:"ok", text:"¡Sesión iniciada correctamente! Bienvenido."});
      if (loginRemember) {
        try { localStorage.setItem("cm_remember_email", loginUser.trim()); localStorage.setItem("cm_remember_pass", loginPass); } catch {}
      } else {
        try { localStorage.removeItem("cm_remember_email"); localStorage.removeItem("cm_remember_pass"); } catch {}
        setLoginUser("");
        setLoginPass("");
      }
    }
  };

  // -- LOGIN con Google --
  const handleLoginGoogle = async () => {
    setLoading(true); setLoginMsg(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href }
    });
    if (error) { setLoginMsg({type:"err", text:"Error al conectar con Google: " + error.message}); setLoading(false); }
  };

  // -- ENVIAR OTP por SMS --
  const handleEnviarOtp = async () => {
    const tel = regTel.trim();
    if (!tel.match(/^\+[0-9]{10,15}$/)) { setRegMsg({type:"err", text:"Número inválido. Usa formato internacional: +521XXXXXXXXXX"}); return; }
    setLoading(true); setRegMsg(null);
    const { error } = await sb.auth.signInWithOtp({ phone: tel });
    setLoading(false);
    if (error) { setRegMsg({type:"err", text:"Error al enviar SMS: " + error.message}); }
    else { setOtpEnviado(true); setRegMsg({type:"ok", text:"✅ Código enviado por SMS. Revisa tu teléfono."}); }
  };

  // -- VERIFICAR OTP --
  const handleVerificarOtp = async () => {
    if (regOtp.length < 6) { setRegMsg({type:"err", text:"El código debe tener 6 dígitos"}); return; }
    setLoading(true); setRegMsg(null);
    const { error } = await sb.auth.verifyOtp({ phone: regTel.trim(), token: regOtp, type: "sms" });
    setLoading(false);
    if (error) { setRegMsg({type:"err", text:"Código incorrecto o expirado. Inténtalo de nuevo."}); }
    else { setRegMsg({type:"ok", text:"✅ Teléfono verificado correctamente."}); setRegStep(3); }
  };

  // -- REGISTRO completo con Supabase --
  const handleRegStep = async () => {
    setRegMsg(null);
    if (regStep === 1) {
      if (!regNombre.trim() || !regApellidos.trim() || !regUsername.trim() || !regFecha || !regPais.trim() || !regCiudad.trim()) { setRegMsg({type:"err", text:"Completa todos los campos obligatorios"}); return; }
      setRegStep(2);
    } else if (regStep === 2) {
      // El paso 2 tiene sus propios botones (Enviar SMS / Verificar), solo avanza si ya verificó
      setRegMsg({type:"err", text:"Verifica tu número de teléfono primero"});
    } else if (regStep === 3) {
      if (!regCorreo.trim() || !regCorreo2.trim()) { setRegMsg({type:"err", text:"Ingresa tu correo electrónico"}); return; }
      if (regCorreo !== regCorreo2) { setRegMsg({type:"err", text:"Los correos no coinciden"}); return; }
      if (!regCorreo.includes("@")) { setRegMsg({type:"err", text:"Correo electrónico no válido"}); return; }
      setRegStep(4);
    } else if (regStep === 4) {
      if (!passStrong(regPass)) { setRegMsg({type:"err", text:"La contraseña debe tener mínimo 10 caracteres, 1 mayúscula, 1 número y 1 símbolo"}); return; }
      if (regPass !== regPass2) { setRegMsg({type:"err", text:"Las contraseñas no coinciden"}); return; }
      if (regAntibot.trim() !== "8") { setRegMsg({type:"err", text:"Respuesta incorrecta — ¿cuánto es 3 + 5?"}); return; }
      if (!regTerminos || !regPrivacidad) { setRegMsg({type:"err", text:"Debes aceptar los términos y la política de privacidad"}); return; }
      setLoading(true);
      const { error } = await sb.auth.signUp({
        email: regCorreo.trim(),
        password: regPass,
        options: {
          data: {
            nombre: regNombre.trim(),
            apellidos: regApellidos.trim(),
            username: regUsername.trim(),
            fecha_nacimiento: regFecha,
            pais: regPais.trim(),
            ciudad: regCiudad.trim(),
            telefono: regTel.trim(),
          }
        }
      });
      setLoading(false);
      if (error) { setRegMsg({type:"err", text: error.message.includes("already registered") ? "Este correo ya está registrado" : error.message }); }
      else { setRegMsg({type:"ok", text:"✅ ¡Cuenta creada! Revisa tu correo para confirmar tu registro antes de iniciar sesión."}); }
    }
  };

  // -- RECUPERAR CONTRASEÑA real --
  const handleForgot = async () => {
    if (!forgotCorreo.includes("@")) { setForgotMsg({type:"err", text:"Ingresa un correo válido"}); return; }
    setLoading(true); setForgotMsg(null);
    const { error } = await sb.auth.resetPasswordForEmail(forgotCorreo.trim(), {
      redirectTo: window.location.href
    });
    setLoading(false);
    if (error) { setForgotMsg({type:"err", text:"Error: " + error.message}); }
    else { setForgotMsg({type:"ok", text:"✅ Si el correo existe, recibirás el enlace de recuperación en minutos. Revisa también tu carpeta de spam."}); }
  };

  const stepLabels = ["Datos básicos","Teléfono","Correo","Contraseña"];

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
    { id: "registro", icon: "👤", color: "#38bdf8", title: "CREAR CUENTA", subtitle: "Registro seguro — no es obligatorio", items: [
      { label: "¿Es obligatorio registrarse?", desc: "No. Puedes usar toda la app sin crear una cuenta. El registro es opcional y te permite participar con identidad verificada en la comunidad." },
      { label: "Información básica", desc: "Nombre, apellidos, nombre de usuario (único), fecha de nacimiento, país y ciudad. Esto permite identificar al usuario y detectar cuentas duplicadas o sospechosas." },
      { label: "Verificación por teléfono (obligatoria)", desc: "Introduce tu número de teléfono y recibirás un código SMS (OTP). Solo si el código es correcto podrás continuar. Esto evita que bots creen cuentas falsas, ya que no pueden verificar teléfonos reales." },
      { label: "Correo electrónico", desc: "Ingresa tu correo y confírmalo. Se enviará un correo de verificación antes de activar la cuenta. Usa un correo real — los correos temporales o desechables son bloqueados." },
      { label: "Contraseña segura", desc: "Mínimo 10 caracteres, al menos 1 mayúscula, 1 número y 1 símbolo. Ejemplo válido: Micuenta#2026. Las contraseñas débiles serán rechazadas automáticamente." },
      { label: "Información antifraude", desc: "Se solicitará dirección y código postal para detectar registros masivos falsos. Esta información es confidencial y no se comparte públicamente." },
      { label: "Protección anti-bots", desc: "Se incluye una verificación humana (ej: ¿Cuánto es 3 + 5?) o CAPTCHA para evitar registros automatizados." },
      { label: "Confirmaciones obligatorias", desc: "Deberás aceptar los Términos y Condiciones y la Política de Privacidad antes de completar el registro." },
      { label: "Reglas contra perfiles falsos", desc: "Solo se permite 1 cuenta por número de teléfono. Se bloquean teléfonos temporales, correos desechables, registros masivos desde la misma IP y dispositivos con múltiples cuentas detectadas." },
    ]},
    { id: "login", icon: "🔑", color: "#a78bfa", title: "INICIO DE SESIÓN", subtitle: "Accede a tu cuenta de forma segura", items: [
      { label: "¿Cómo iniciar sesión?", desc: "Puedes ingresar con tu correo electrónico o nombre de usuario junto con tu contraseña. También puedes optar por un acceso rápido vía código SMS si tienes tu teléfono verificado." },
      { label: "Sesión activa", desc: "Tu sesión se mantiene activa en el dispositivo para que no tengas que ingresar tus datos cada vez. Puedes cerrar sesión manualmente desde tu perfil." },
      { label: "Intentos fallidos", desc: "Después de varios intentos fallidos, la cuenta se bloquea temporalmente como medida de seguridad. Recibirás un aviso con las instrucciones para desbloquearla." },
      { label: "Sin cuenta", desc: "Si no tienes cuenta o prefieres no crearla, puedes seguir usando la app normalmente. El inicio de sesión no es obligatorio para acceder a la información del puerto." },
    ]},
    { id: "password", icon: "🔒", color: "#f97316", title: "OLVIDÉ MI CONTRASEÑA", subtitle: "Recupera el acceso a tu cuenta", items: [
      { label: "Paso 1 · Ingresa tu correo", desc: "En la pantalla de inicio de sesión, toca '¿Olvidaste tu contraseña?' e introduce el correo electrónico con el que te registraste." },
      { label: "Paso 2 · Revisa tu bandeja", desc: "Recibirás un correo con un enlace de recuperación. Revisa también la carpeta de spam si no lo encuentras en los primeros minutos." },
      { label: "Paso 3 · Crea una nueva contraseña", desc: "El enlace te llevará a una pantalla donde puedes establecer una contraseña nueva. Recuerda que debe cumplir los requisitos: mínimo 10 caracteres, 1 mayúscula, 1 número y 1 símbolo." },
      { label: "Verificación por SMS (alternativa)", desc: "Si ya no tienes acceso al correo, puedes solicitar el código de recuperación vía SMS al número de teléfono registrado en tu cuenta." },
      { label: "Cuenta bloqueada", desc: "Si tu cuenta fue bloqueada por seguridad, el proceso de recuperación también la desbloqueará una vez verificada tu identidad por correo o SMS." },
    ]},
  ];

  return (
    <div style={{ padding:"20px 16px", paddingBottom:"80px" }}>

      {/* ---
          PANEL DE AUTENTICACIÓN
      --- */}
      <div style={{ background:"linear-gradient(160deg,#0d1b2e,#0a2540)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:"20px", padding:"24px 20px", marginBottom:"28px" }}>

        {/* Avatar */}
        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:"linear-gradient(135deg,#1e3a5f,#0d2a4a)", border:"2px solid rgba(56,189,248,0.35)", margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px" }}>
            {authMode==="login" ? "🔑" : authMode==="registro" ? "👤" : "🔒"}
          </div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", color:"rgba(255,255,255,0.9)", letterSpacing:"1px" }}>
            {authMode==="login" ? "INICIAR SESIÓN" : authMode==="registro" ? "CREAR CUENTA" : "RECUPERAR CONTRASEÑA"}
          </div>
          {authMode !== "forgot" && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.35)", marginTop:"4px" }}>No es obligatorio — puedes usar la app sin cuenta</div>}
        </div>

        {/* Tab selector */}
        <div style={{ display:"flex", gap:"6px", marginBottom:"20px", background:"rgba(255,255,255,0.05)", borderRadius:"12px", padding:"4px" }}>
          {[{id:"login",label:"Iniciar sesión"},{id:"registro",label:"Crear cuenta"}].map(t => (
            <button key={t.id} onClick={() => { setAuthMode(t.id); setLoginMsg(null); setRegMsg(null); setRegStep(1); }}
              style={{ flex:1, padding:"9px", borderRadius:"9px", border:"none", background: authMode===t.id ? "linear-gradient(135deg,#38bdf8,#0ea5e9)" : "transparent", color: authMode===t.id ? "#0a1628" : "rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* -- LOGIN -- */}
        {authMode === "login" && (
          <div>
            <MsgBox msg={loginMsg} />
            {/* Botón Google */}
            <button onClick={handleLoginGoogle} disabled={loading} style={{ width:"100%", padding:"12px", background:"#ffffff", border:"none", borderRadius:"10px", color:"#1f2937", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", marginBottom:"16px", opacity: loading?0.7:1 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              Continuar con Google
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
              <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.1)" }} />
              <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>o con correo</span>
              <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.1)" }} />
            </div>
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), marginBottom:"4px", letterSpacing:"1px" }}>CORREO ELECTRÓNICO</div>
            <input value={loginUser} onChange={e=>setLoginUser(e.target.value)} placeholder="tu@correo.com" style={inputStyle} />
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", fontFamily:getFont(theme, "secondary"), marginBottom:"4px", letterSpacing:"1px" }}>CONTRASEÑA</div>
            <div style={{ position:"relative" }}>
              <input type={showLoginPass ? "text" : "password"} value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="Tu contraseña" style={{...inputStyle, paddingRight:"38px"}} onKeyDown={e => e.key==="Enter" && handleLogin()} />
              <span onClick={() => setShowLoginPass(v => !v)} style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", cursor:"pointer", fontSize:"16px", userSelect:"none" }}>{showLoginPass ? "🙈" : "👁"}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
              <label style={{ display:"flex", alignItems:"center", gap:"7px", cursor:"pointer" }}>
                <div onClick={() => setLoginRemember(!loginRemember)} style={{ width:"16px", height:"16px", borderRadius:"4px", border:`2px solid ${loginRemember?"#38bdf8":"rgba(255,255,255,0.2)"}`, background: loginRemember?"#38bdf8":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loginRemember && <span style={{ color:"#0a1628", fontSize:"10px", fontWeight:"900" }}>✓</span>}
                </div>
                <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)" }}>Recordarme</span>
              </label>
              <button onClick={() => { setAuthMode("forgot"); setForgotMsg(null); }} style={btnSecondary}>¿Olvidaste tu contraseña?</button>
            </div>
            <button onClick={handleLogin} disabled={loading} style={{...btnPrimary(), opacity: loading?0.7:1}}>{loading ? "Iniciando..." : "INICIAR SESIÓN"}</button>
          </div>
        )}

        {/* -- REGISTRO MULTI-PASO -- */}
        {authMode === "registro" && (
          <div>
            {/* Progress bar */}
            <div style={{ display:"flex", gap:"4px", marginBottom:"16px" }}>
              {stepLabels.map((s,i) => (
                <div key={i} style={{ flex:1, textAlign:"center" }}>
                  <div style={{ height:"3px", borderRadius:"2px", background: i+1 <= regStep ? "#38bdf8" : "rgba(255,255,255,0.1)", marginBottom:"4px", transition:"background 0.3s" }} />
                  <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"8px", color: i+1===regStep ? "#38bdf8" : "rgba(255,255,255,0.25)" }}>{s}</span>
                </div>
              ))}
            </div>
            <MsgBox msg={regMsg} />

            {/* Paso 1: Datos básicos */}
            {regStep === 1 && (
              <>
                <input value={regNombre} onChange={e=>setRegNombre(e.target.value)} placeholder="Nombre *" style={inputStyle} />
                <input value={regApellidos} onChange={e=>setRegApellidos(e.target.value)} placeholder="Apellidos *" style={inputStyle} />
                <input value={regUsername} onChange={e=>setRegUsername(e.target.value)} placeholder="Nombre de usuario único *" style={inputStyle} />
                <input type="date" value={regFecha} onChange={e=>setRegFecha(e.target.value)} style={{...inputStyle, colorScheme:"dark"}} />
                <input value={regPais} onChange={e=>setRegPais(e.target.value)} placeholder="País *" style={inputStyle} />
                <input value={regCiudad} onChange={e=>setRegCiudad(e.target.value)} placeholder="Ciudad *" style={inputStyle} />
              </>
            )}

            {/* Paso 2: Teléfono + OTP */}
            {regStep === 2 && (
              <>
                <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", marginBottom:"8px", lineHeight:"1.6" }}>📱 Verificación por SMS obligatoria para evitar cuentas falsas. Usa formato internacional: <span style={{color:"#38bdf8"}}>+521XXXXXXXXXX</span></div>
                <div style={{ display:"flex", gap:"8px", marginBottom:"10px" }}>
                  <input value={regTel} onChange={e=>setRegTel(e.target.value)} placeholder="+521XXXXXXXXXX *" style={{...inputStyle, marginBottom:0, flex:1}} />
                  <button onClick={handleEnviarOtp} disabled={loading} style={{ padding:"0 14px", background:"rgba(56,189,248,0.15)", border:"1px solid #38bdf855", borderRadius:"10px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", flexShrink:0, opacity: loading?0.6:1 }}>
                    {loading ? "..." : otpEnviado ? "Reenviar" : "Enviar SMS"}
                  </button>
                </div>
                {otpEnviado && (
                  <>
                    <input value={regOtp} onChange={e=>setRegOtp(e.target.value)} placeholder="Código de 6 dígitos *" style={inputStyle} maxLength={6} />
                    <button onClick={handleVerificarOtp} disabled={loading} style={{...btnPrimary("#22c55e"), marginBottom:"8px", opacity: loading?0.6:1}}>
                      {loading ? "Verificando..." : "✓ VERIFICAR CÓDIGO"}
                    </button>
                  </>
                )}
              </>
            )}

            {/* Paso 3: Correo */}
            {regStep === 3 && (
              <>
                <input type="email" value={regCorreo} onChange={e=>setRegCorreo(e.target.value)} placeholder="Correo electrónico *" style={inputStyle} />
                <input type="email" value={regCorreo2} onChange={e=>setRegCorreo2(e.target.value)} placeholder="Confirmar correo *" style={inputStyle} />
              </>
            )}

            {/* Paso 4: Contraseña + antifraude */}
            {regStep === 4 && (
              <>
                <div style={{ position:"relative" }}>
                  <input type={showRegPass ? "text" : "password"} value={regPass} onChange={e=>setRegPass(e.target.value)} placeholder="Contraseña * (mín. 10 car., 1 may., 1 núm., 1 símbolo)" style={{...inputStyle, paddingRight:"38px"}} />
                  <span onClick={() => setShowRegPass(v => !v)} style={{ position:"absolute", right:"12px", top:"38%", transform:"translateY(-50%)", cursor:"pointer", fontSize:"16px", userSelect:"none" }}>{showRegPass ? "🙈" : "👁"}</span>
                </div>
                {regPass && (
                  <div style={{ display:"flex", gap:"4px", marginBottom:"10px" }}>
                    {[regPass.length>=10, /[A-Z]/.test(regPass), /[0-9]/.test(regPass), /[^A-Za-z0-9]/.test(regPass)].map((ok,i) => (
                      <div key={i} style={{ flex:1, height:"3px", borderRadius:"2px", background: ok?"#22c55e":"rgba(255,255,255,0.1)" }} />
                    ))}
                  </div>
                )}
                <div style={{ position:"relative" }}>
                  <input type={showRegPass2 ? "text" : "password"} value={regPass2} onChange={e=>setRegPass2(e.target.value)} placeholder="Confirmar contraseña *" style={{...inputStyle, paddingRight:"38px"}} />
                  <span onClick={() => setShowRegPass2(v => !v)} style={{ position:"absolute", right:"12px", top:"38%", transform:"translateY(-50%)", cursor:"pointer", fontSize:"16px", userSelect:"none" }}>{showRegPass2 ? "🙈" : "👁"}</span>
                </div>
                <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", marginBottom:"6px" }}>🤖 Verificación anti-bots</div>
                <input value={regAntibot} onChange={e=>setRegAntibot(e.target.value)} placeholder="¿Cuánto es 3 + 5? *" style={inputStyle} />
                <label style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"8px", cursor:"pointer" }}>
                  <div onClick={() => setRegTerminos(!regTerminos)} style={{ width:"16px", height:"16px", borderRadius:"4px", border:`2px solid ${regTerminos?"#38bdf8":"rgba(255,255,255,0.2)"}`, background: regTerminos?"#38bdf8":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                    {regTerminos && <span style={{ color:"#0a1628", fontSize:"10px", fontWeight:"900" }}>✓</span>}
                  </div>
                  <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", lineHeight:"1.6" }}>Acepto los Términos y Condiciones</span>
                </label>
                <label style={{ display:"flex", alignItems:"flex-start", gap:"8px", marginBottom:"14px", cursor:"pointer" }}>
                  <div onClick={() => setRegPrivacidad(!regPrivacidad)} style={{ width:"16px", height:"16px", borderRadius:"4px", border:`2px solid ${regPrivacidad?"#38bdf8":"rgba(255,255,255,0.2)"}`, background: regPrivacidad?"#38bdf8":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px" }}>
                    {regPrivacidad && <span style={{ color:"#0a1628", fontSize:"10px", fontWeight:"900" }}>✓</span>}
                  </div>
                  <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", lineHeight:"1.6" }}>Acepto la Política de Privacidad</span>
                </label>
              </>
            )}

            <div style={{ display:"flex", gap:"8px" }}>
              {regStep > 1 && regStep !== 2 && (
                <button onClick={() => { setRegStep(regStep-1); setRegMsg(null); }} style={{ flex:"0 0 44px", padding:"13px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), fontSize:"14px", cursor:"pointer" }}>←</button>
              )}
              {regStep !== 2 && (
                <button onClick={handleRegStep} disabled={loading} style={{ ...btnPrimary(), marginTop:0, flex:1, opacity: loading?0.7:1 }}>
                  {loading ? "Procesando..." : regStep < 4 ? "CONTINUAR →" : "CREAR CUENTA"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* -- RECUPERAR CONTRASEÑA -- */}
        {authMode === "forgot" && (
          <div>
            <MsgBox msg={forgotMsg} />
            <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", marginBottom:"8px", lineHeight:"1.6" }}>Ingresa el correo con el que te registraste y recibirás un enlace de recuperación.</div>
            <input type="email" value={forgotCorreo} onChange={e=>setForgotCorreo(e.target.value)} placeholder="Correo electrónico" style={inputStyle} />
            <button onClick={handleForgot} disabled={loading} style={{...btnPrimary("#f97316"), opacity: loading?0.7:1}}>{loading ? "Enviando..." : "ENVIAR ENLACE"}</button>
            <div style={{ textAlign:"center", marginTop:"12px" }}>
              <button onClick={() => { setAuthMode("login"); setForgotMsg(null); }} style={btnSecondary}>← Volver al inicio de sesión</button>
            </div>
          </div>
        )}

      </div>
      {/* -- fin panel auth -- */}

      {/* ---
          GUÍA DE USO
      {/* ---
          GUÍA DE USO - SECCIÓN "MÁS INFO" ACTUALIZADA
      --- */}
      <div style={{ textAlign:"center", marginBottom:"24px" }}>
        <div style={{ fontSize:"36px", marginBottom:"10px" }}>📖</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", letterSpacing:"2px", color:"rgba(255,255,255,0.95)", marginBottom:"6px" }}>MÁS INFORMACIÓN</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px" }}>PUERTO TRÁFICO · MANZANILLO</div>
        <div style={{ width:"40px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"12px auto 0" }} />
      </div>
      {[
        // ---
        // INICIO
        // ---
        { id: "inicio", icon: "🏠", color: "#38bdf8", title: "INICIO", subtitle: "Panel de control general", items: [
          { label: "Resumen Visual", desc: "Vista rápida del estado actual del puerto: tráfico, terminales, patios y accesos principales." },
          { label: "Incidentes Activos", desc: "Muestra alertas e incidentes verificados por la comunidad en tiempo real." },
          { label: "Estado de Terminales", desc: "Resumen del status de las 9 terminales del puerto (libres/llenas/retorno)." },
          { label: "Acceso Rápido", desc: "Botones directos para reportar incidentes y acceder a secciones clave." },
          { label: "Alertas Importantes", desc: "Notificaciones y avisos relevantes del día publicados por administradores." },
        ]},
        
        // ---
        // TRÁFICO
        // ---
        { id: "trafico", icon: "🗺️", color: "#38bdf8", title: "TRÁFICO", subtitle: "Mapa en vivo + Accesos + Incidentes", items: [
          { label: "Mapa en vivo", desc: "Muestra visualmente los accesos principales con su estatus actual, además de los pins de incidentes activos reportados por la comunidad." },
          { label: "Accesos Principales", desc: "Cada acceso muestra su estatus en tiempo real con colores: Verde (libre/fluido), Amarillo (tráfico lento), Rojo (saturado), Gris (cerrado). Puedes votar el estado actual que observes." },
          { label: "Tipo de Retorno", desc: "Indica si hay retornos activos: Sin Retornos (verde), Retorno Terminal (naranja) o Retorno ASIPONA (morado)." },
          { label: "Filtros por Acceso", desc: "Filtra la información por Acceso Norte o Acceso Sur para ver datos específicos de cada zona." },
          { label: "Tiempo de Espera", desc: "Estimación del tiempo de espera basado en reportes de la comunidad y estado actual del tráfico." },
          { label: "Actualización Automática", desc: "Los datos se actualizan cada 5 minutos automáticamente para mantener información precisa." },
          { label: "Incidentes Pendientes", desc: "Reportes que aún no tienen votos suficientes. Puedes confirmar o marcar como falso para validar la información." },
          { label: "Incidentes Activos", desc: "Reportes verificados por la comunidad con 3+ votos de confirmación. Puedes votar para marcarlos como resueltos cuando ya no existan." },
        ]},
        
        // ---
        // REPORTAR
        // ---
        { id: "reporte", icon: "📍", color: "#f97316", title: "REPORTAR", subtitle: "Envía un nuevo incidente al mapa", items: [
          { label: "Paso 1 · Categoría", desc: "Elige entre: Incidente ⚠️ (problemas mecánicos, camiones varados, obstrucciones), Accidente 🚨 (choques, heridos, volcaduras, personas sin vida), Bloqueo/Corte 🚧 (manifestaciones, cierres viales) u Obra/Desvío 🏗️ (construcciones, mantenimiento)." },
          { label: "Paso 2 · Tipo específico", desc: "Selecciona el subtipo exacto: falla mecánica, camión atravesado, falta de diesel, contenedor ladeado, plataforma/carga/camión abandonado, atropellado, choque, volcadura, herido, caída de material, persona sin vida, zona de asalto/robo." },
          { label: "Paso 3 · Zona (opcional)", desc: "Indica en qué acceso o zona ocurrió: Acceso Norte, Acceso Sur, Zona Industrial, Centro, etc., para mayor contexto geográfico." },
          { label: "Paso 4 · Ubicación", desc: "Selecciona de la lista predefinida (Jalipa-Puerto, Puerto-Jalipa, Libramiento, Manzanillo-Colima, Colima-Manzanillo, Calle Algodones, etc.) o escribe manualmente el punto exacto con km, carril o referencia visual." },
          { label: "Paso 5 · Descripción", desc: "Agrega detalles adicionales: número de carril afectado, vehículos involucrados, severidad, dirección del tráfico afectado. La descripción es sanitizada automáticamente para evitar contenido malicioso." },
          { label: "Rate Limiting", desc: "El sistema permite 1 reporte cada 30 segundos por usuario para evitar spam y garantizar calidad de la información." },
          { label: "Validación Comunitaria", desc: "Tu reporte aparece como PENDIENTE y necesita al menos 3 votos de confirmación de otros usuarios para mostrarse en el mapa como ACTIVO." },
          { label: "Notificaciones", desc: "Recibirás confirmación visual (toast) de que tu reporte fue enviado exitosamente o si hubo algún error." },
        ]},
        
        // ---
        // TERMINALES
        // ---
        { id: "terminales", icon: "⚓", color: "#a78bfa", title: "TERMINALES", subtitle: "Estatus de las 9 terminales del puerto", items: [
          { label: "Zona Norte (2 terminales)", desc: "CONTECON (Contecon Manzanillo S.A.) y HAZESA (Hazesa Terminal Especializada). Operaciones de carga/descarga de contenedores de la zona norte del puerto." },
          { label: "Zona Sur (7 terminales)", desc: "TIMSA (Terminal Internacional de Manzanillo), SSA (SSA México Terminal), OCUPA (Terminal Multipropósito), MULTIMODAL (Terminal Multimodal), FRIMAN (Frigoríficos de Manzanillo), LA JUNTA (Terminal TAP), CEMEX (Terminal Marítima)." },
          { label: "Estados disponibles", desc: "✓ Terminal Libre (verde): aceptando camiones. ✗ Terminal Llena (rojo): capacidad máxima alcanzada. ↩ Retorno Terminal (naranja): regresando camiones a espera. ⚓ Retorno ASIPONA (morado): enviando camiones al patio regulador ASIPONA." },
          { label: "Actualizar estatus", desc: "Toca el estado que observas. El sistema contabiliza los votos de toda la comunidad y muestra el estado con mayor consenso en tiempo real." },
          { label: "Sistema de Votación", desc: "Cada terminal mantiene un conteo de votos. El estado con más votos se muestra como oficial. Tu voto cuenta y se actualiza instantáneamente vía realtime." },
          { label: "Votos cada 15 minutos", desc: "Los votos se limpian automáticamente cada 15 minutos para mantener el estatus actualizado. Tu selección se guarda en localStorage y se re-envía automáticamente — no necesitas volver a votar." },
          { label: "Persistencia de Voto", desc: "Tu último voto se guarda en tu dispositivo y sobrevive la limpieza de 15 minutos, manteniéndose activo hasta que cambies de opinión." },
          { label: "TODO NORMAL", desc: "Botón para restablecer todas las terminales a 'Libre' de una sola vez. Útil al inicio del turno o cuando todas normalizan operaciones." },
          { label: "Última Actualización", desc: "Cada terminal muestra quién actualizó su estado y hace cuánto tiempo (ej: 'hace 2min', 'hace 1h')." },
          { label: "Indicadores Visuales", desc: "Cada terminal tiene un color distintivo y un ícono que facilita identificar su estado de un vistazo." },
        ]},
        
        // ---
        // PATIOS
        // ---
        { id: "patio", icon: "🏭", color: "#fb923c", title: "PATIO REGULADOR", subtitle: "Estatus de los patios de contenedores", items: [
          { label: "¿Qué es el Patio Regulador?", desc: "Áreas de espera y almacenaje externas al puerto donde los camiones aguardan antes de ingresar a terminales. Hay 6 patios principales más ASIPONA." },
          { label: "Patios Disponibles", desc: "ASIPONA (Asociación de Prestadores de Servicios del Puerto de Manzanillo A.C.), BAYER, DEL SUR, LÓPEZ, CHECO (El Checo), VENUSTIANO (Venustiano Carranza)." },
          { label: "Estados posibles", desc: "✓ Disponible (verde): hay espacio, camiones pueden ingresar. ⚠ Espacio Limitado (naranja): capacidad reducida, considerar alternativas. ✗ Lleno (rojo): sin espacio disponible, buscar otro patio." },
          { label: "Cómo votar", desc: "Toca el estado que observas en el patio. El sistema contabiliza todos los votos de la comunidad y muestra el estatus con más consenso." },
          { label: "Votación Comunitaria", desc: "Similar a Terminales: cada voto cuenta, el estado con más votos prevalece, actualización en tiempo real vía Supabase Realtime." },
          { label: "Persistencia Local", desc: "Tu voto se guarda localmente y sobrevive las limpiezas periódicas de 15 minutos, re-enviándose automáticamente." },
          { label: "Información Expandible", desc: "Cada patio puede expandirse para mostrar detalles adicionales: ubicación exacta, capacidad estimada, notas de operación." },
          { label: "TODO LIBRE", desc: "Botón 'TODOS LIBRES' para restablecer todos los patios a 'Disponible' simultáneamente. Ideal al inicio de jornada laboral." },
          { label: "Indicador de Capacidad", desc: "Algunos patios muestran el porcentaje aproximado de ocupación basado en votos acumulados." },
        ]},
        
        // ---
        // SEGUNDO ACCESO
        // ---
        { id: "segundo", icon: "🛣️", color: "#34d399", title: "2DO ACCESO", subtitle: "Carriles de ingreso con terminal asignada", items: [
          { label: "Accesos disponibles", desc: "Acceso Pez Vela (Zona Sur - morado) con 8 carriles, Puerta 15 (Zona Sur - verde) con 3 carriles, Acceso Zona Norte (azul) con 3 carriles. Total: 14 carriles monitoreados." },
          { label: "Carriles de Ingreso", desc: "Cada carril tiene asignada una terminal de destino (GENERAL, CONTECON, HAZESA, TIMSA, SSA, etc.). Puedes cambiar la terminal, indicar saturación o activar retornos." },
          { label: "Terminal Asignada", desc: "Los carriles 1-4 de Pez Vela permiten seleccionar qué terminal están atendiendo en ese momento. La opción GENERAL indica que aceptan cualquier terminal." },
          { label: "Carriles de Exportación", desc: "Marcados con 📤. Exclusivos para camiones que llevan carga hacia los barcos. Se marcan como Abierto/Cerrado/Saturado." },
          { label: "Carriles de Importación", desc: "Marcados con 📥. Para camiones que retiran mercancía del puerto. Misma lógica de estado que exportación." },
          { label: "Estados del Carril", desc: "Abierto (verde): operando normalmente. Cerrado (rojo): fuera de servicio. Saturado (amarillo): congestionado pero funcionando. Retornos (morado): enviando camiones de regreso." },
          { label: "Última Actualización", desc: "Cada carril muestra quién lo actualizó y cuándo, garantizando transparencia en la información." },
          { label: "TODO ABIERTO", desc: "Botón por acceso para restablecer todos sus carriles a estado Abierto simultáneamente." },
        ]},
        
        // ---
        // CARRILES
        // ---
        { id: "carriles", icon: "🚦", color: "#eab308", title: "CARRILES", subtitle: "Carriles individuales por acceso", items: [
          { label: "Acceso Norte", desc: "3 carriles monitoreados: Norte 1, Norte 2, Norte 3. Cada uno con estado independiente de operación." },
          { label: "Acceso Sur", desc: "4 carriles principales: Sur 1, Sur 2, Sur 3, Sur 4. Mayor capacidad de ingreso debido al volumen de tráfico." },
          { label: "Estados disponibles", desc: "✓ Libre (verde): flujo normal de tráfico. ⚠ Lento (amarillo): demoras moderadas, tráfico reducido. ✗ Cerrado (rojo): carril bloqueado o fuera de servicio. 🚫 Congestión (rojo oscuro): completamente saturado, evitar." },
          { label: "Actualización cada 3 min", desc: "Los carriles se actualizan automáticamente cada 3 minutos para reflejar cambios rápidos en el flujo vehicular." },
          { label: "Motivo de Cierre", desc: "Cuando un carril está cerrado, se puede especificar el motivo: mantenimiento, accidente, inspección, etc." },
          { label: "Estimado de Reapertura", desc: "Para carriles cerrados, opcionalmente se puede indicar la hora estimada de reapertura." },
          { label: "Indicador Visual", desc: "Cada carril tiene un color distintivo que facilita identificar rápidamente su estado desde el panel principal." },
          { label: "TODO ABIERTO", desc: "Restablece todos los carriles del acceso seleccionado a estado Libre de una sola vez." },
        ]},
        
        // ---
        // VIALIDADES
        // ---
        { id: "vialidades", icon: "🛣️", color: "#38bdf8", title: "VIALIDADES", subtitle: "Estado del tráfico en vialidades principales", items: [
          { label: "¿Qué son las Vialidades?", desc: "Carreteras y calles principales de acceso: Jalipa → Puerto, Puerto → Jalipa (sentidos opuestos), Libramiento Cihuatlán-Manzanillo, Manzanillo → Colima, Colima → Manzanillo, Calle Algodones." },
          { label: "Estados disponibles", desc: "Libre (verde): tráfico fluido, sin demoras. Tráfico Lento (amarillo): demoras moderadas, avance reducido. Saturado (naranja): alta congestión, considerar ruta alterna. Tráfico Detenido (rojo): sin avance, totalmente bloqueado." },
          { label: "Cómo votar", desc: "Toca el estado que observas en la vialidad mientras circulas o estás detenido. Tu reporte ayuda a otros conductores a tomar decisiones informadas." },
          { label: "Sistema de Consenso", desc: "El sistema muestra el estado con mayor número de votos entre todos los usuarios activos en esa vialidad." },
          { label: "Renovación cada 15 min", desc: "Los votos se limpian automáticamente cada 15 minutos para mantener la información actualizada. Tu voto se guarda y reenvía sin necesidad de votar nuevamente." },
          { label: "Mapa Integrado", desc: "Las vialidades se muestran en el mapa con colores correspondientes a su estado actual para visualización rápida." },
          { label: "Alertas de Congestión", desc: "Cuando una vialidad cambia a estado Saturado o Detenido, se genera una alerta automática visible en el inicio." },
        ]},
        
        // ---
        // NOTICIAS
        // ---
        { id: "noticias", icon: "📰", color: "#3b82f6", title: "NOTICIAS", subtitle: "Comunicados y avisos oficiales", items: [
          { label: "Centro de Noticias", desc: "Publicaciones oficiales de administradores sobre cambios operativos, eventos, mantenimientos y avisos importantes del puerto." },
          { label: "Comunicados Oficiales", desc: "Anuncios formales de las autoridades portuarias, terminales y entidades reguladoras." },
          { label: "Avisos Importantes", desc: "Alertas sobre cambios en horarios, cierres temporales, nuevos procedimientos, requisitos de acceso." },
          { label: "Eventos Especiales", desc: "Información sobre eventos que afectan operaciones: llegadas de buques importantes, operativos especiales, visitas oficiales." },
          { label: "Mantenimientos Programados", desc: "Calendario de mantenimientos planificados en terminales, carriles, vialidades que afectarán el flujo normal." },
          { label: "Alertas Meteorológicas", desc: "Avisos de condiciones climáticas adversas: huracanes, tormentas, vientos fuertes que afecten operaciones portuarias." },
          { label: "Actualizaciones de Horarios", desc: "Cambios en horarios de operación de terminales, patios, carriles por temporada alta/baja." },
          { label: "Categorización", desc: "Las noticias se clasifican por importancia: Crítico (rojo), Importante (naranja), Informativo (azul), General (gris)." },
          { label: "Fecha y Hora", desc: "Cada noticia muestra claramente cuándo fue publicada y por quién (usuario admin que la creó)." },
          { label: "Búsqueda y Filtros", desc: "Busca noticias por palabra clave o filtra por categoría, fecha, terminal afectada." },
          { label: "Archivado Automático", desc: "Las noticias se archivan automáticamente después de su fecha de expiración para mantener el feed limpio." },
        ]},
        
        // ---
        // DONATIVOS
        // ---
        { id: "donativos", icon: "💙", color: "#ec4899", title: "DONATIVOS", subtitle: "Apoya el proyecto de la comunidad", items: [
          { label: "¿Para qué sirven?", desc: "Cubren costos de servidor Supabase, dominio, desarrollo continuo, nuevas funcionalidades, mantenimiento de base de datos y mejoras de rendimiento." },
          { label: "Transferencia MIFEL", desc: "Banco: MIFEL. Titular: Ramon Romero. CLABE: 014028090014825779. Cualquier monto es apreciado y ayuda a mantener el servicio activo." },
          { label: "Mercado Pago", desc: "Enlaces de donación rápida vía Mercado Pago: tú eliges el monto, proceso seguro, confirmación instantánea." },
          { label: "Ko-fi Internacional", desc: "Para usuarios internacionales: Ko-fi permite donativos anónimos con tarjeta de crédito o PayPal." },
          { label: "Transparencia", desc: "Los fondos se utilizan exclusivamente para infraestructura técnica: servidor, almacenamiento de base de datos, ancho de banda, actualizaciones." },
          { label: "No es obligatorio", desc: "El sistema es 100% gratuito para todos los usuarios. Los donativos son voluntarios y opcionales." },
          { label: "Botón Flotante", desc: "Acceso rápido desde cualquier sección mediante el botón flotante con ícono 💝 en la esquina inferior." },
          { label: "Agradecimiento", desc: "Mensaje de agradecimiento personalizado para todos los donantes que apoyan el proyecto comunitario." },
        ]},
        // ---
        // REGISTRO Y AUTENTICACIÓN
        // ---
        { id: "registro", icon: "👤", color: "#38bdf8", title: "CREAR CUENTA", subtitle: "Registro seguro — no es obligatorio", items: [
          { label: "¿Es obligatorio registrarse?", desc: "No. Puedes usar toda la app sin crear una cuenta. El registro es opcional y te permite participar con identidad verificada en la comunidad." },
          { label: "Información básica", desc: "Nombre, apellidos, nombre de usuario (único), fecha de nacimiento, país y ciudad. Esto permite identificar al usuario y detectar cuentas duplicadas o sospechosas." },
          { label: "Verificación por teléfono (obligatoria)", desc: "Introduce tu número de teléfono en formato internacional (+521XXXXXXXXXX) y recibirás un código SMS (OTP de 6 dígitos). Solo si el código es correcto podrás continuar. Esto evita que bots creen cuentas falsas." },
          { label: "Correo electrónico", desc: "Ingresa tu correo y confírmalo. Se enviará un correo de verificación antes de activar la cuenta. Usa un correo real — los correos temporales o desechables son bloqueados por Supabase." },
          { label: "Contraseña segura", desc: "Mínimo 10 caracteres, al menos 1 mayúscula, 1 número y 1 símbolo especial. Ejemplo válido: Micuenta#2026. Las contraseñas débiles son rechazadas automáticamente. Barra de fortaleza visual." },
          { label: "Protección anti-bots", desc: "Verificación humana simple: ¿Cuánto es 3 + 5? Respuesta incorrecta bloquea el registro." },
          { label: "Confirmaciones obligatorias", desc: "Debes aceptar explícitamente los Términos y Condiciones y la Política de Privacidad (checkboxes requeridos)." },
          { label: "Reglas contra perfiles falsos", desc: "Solo se permite 1 cuenta por número de teléfono. Se bloquean: teléfonos temporales/VoIP, correos desechables, registros masivos desde la misma IP, dispositivos con múltiples cuentas detectadas." },
          { label: "Proceso de 4 Pasos", desc: "Paso 1: Datos básicos. Paso 2: Verificación de teléfono vía SMS. Paso 3: Correo electrónico y confirmación. Paso 4: Contraseña segura + anti-bot + términos." },
          { label: "Indicador de Progreso", desc: "Barra visual muestra en qué paso del registro te encuentras (1/4, 2/4, 3/4, 4/4)." },
        ]},
        
        // ---
        // INICIO DE SESIÓN
        // ---
        { id: "login", icon: "🔑", color: "#a78bfa", title: "INICIO DE SESIÓN", subtitle: "Accede a tu cuenta de forma segura", items: [
          { label: "¿Cómo iniciar sesión?", desc: "Ingresa tu correo electrónico y contraseña. El sistema valida las credenciales vía Supabase Auth con encriptación segura." },
          { label: "Login con Google", desc: "Botón 'Continuar con Google' para autenticación OAuth2. Redirige a Google, autoriza y regresa automáticamente con sesión activa." },
          { label: "Recordar Sesión", desc: "Checkbox 'Recordarme' guarda tu correo en localStorage para autocompletar la próxima vez. La contraseña NO se guarda por seguridad." },
          { label: "Mostrar/Ocultar Contraseña", desc: "Ícono de ojo 👁/🙈 permite alternar visibilidad de la contraseña para verificar que la escribiste correctamente." },
          { label: "Sesión Persistente", desc: "Una vez iniciada sesión, el token se guarda en localStorage y la sesión persiste al cerrar/reabrir el navegador (hasta 7 días o logout manual)." },
          { label: "Intentos Fallidos", desc: "Después de 5 intentos fallidos en 15 minutos, Supabase bloquea temporalmente la cuenta por seguridad (60 minutos de espera)." },
          { label: "Recuperar Contraseña", desc: "Link '¿Olvidaste tu contraseña?' debajo del formulario. Redirige a flujo de recuperación por correo electrónico." },
          { label: "Sin Cuenta", desc: "Botón 'Crear cuenta' para cambiar a modo de registro. Puedes también continuar usando la app sin autenticarte." },
          { label: "Mensajes de Error", desc: "Errores claros: 'Correo o contraseña incorrectos', 'Completa usuario y contraseña', 'Error al conectar con Google', etc." },
          { label: "Loading States", desc: "Botones se deshabilitan mientras procesa la autenticación, mostrando 'Iniciando sesión...' para evitar doble-submit." },
        ]},
        
        // ---
        // RECUPERACIÓN DE CONTRASEÑA
        // ---
        { id: "password", icon: "🔒", color: "#f97316", title: "OLVIDÉ MI CONTRASEÑA", subtitle: "Recupera el acceso a tu cuenta", items: [
          { label: "Paso 1 · Ingresa tu correo", desc: "En la pantalla de inicio de sesión, toca '¿Olvidaste tu contraseña?', introduce el correo electrónico registrado y envía." },
          { label: "Paso 2 · Revisa tu bandeja", desc: "Recibirás un correo de Supabase con enlace de recuperación seguro (token de un solo uso con expiración de 1 hora). Revisa también carpeta de spam/promociones." },
          { label: "Paso 3 · Crea nueva contraseña", desc: "El enlace te lleva a pantalla de reset. Introduce nueva contraseña (cumpliendo requisitos: 10+ chars, 1 mayúscula, 1 número, 1 símbolo) y confirma." },
          { label: "Validación de Fortaleza", desc: "Barra visual de 4 segmentos verifica en tiempo real: longitud, mayúscula, número, símbolo. Debe cumplir los 4 para aceptar." },
          { label: "Token de Seguridad", desc: "El enlace de recuperación es token criptográfico único, válido por 1 hora, de un solo uso. Usado o expirado requiere generar nuevo." },
          { label: "Cuenta Bloqueada", desc: "Si tu cuenta fue bloqueada por múltiples intentos fallidos, el proceso de recuperación también la desbloquea automáticamente una vez verificada tu identidad." },
          { label: "Sin Acceso al Correo", desc: "Si perdiste acceso al correo registrado, contacta al administrador del sistema con prueba de identidad para recuperación manual." },
          { label: "Confirmación", desc: "Una vez cambiada la contraseña, recibirás correo de confirmación y podrás iniciar sesión inmediatamente con la nueva contraseña." },
        ]},
      ].map(sec => (
        <div key={sec.id} style={{ marginBottom:"10px" }}>
          <button onClick={() => toggle(sec.id)} style={{ width:"100%", background: open===sec.id ? sec.color+"22" : "#0d1b2e", border:`1px solid ${open===sec.id ? sec.color+"88" : "#1e3a5f"}`, borderRadius: open===sec.id ? "12px 12px 0 0" : "12px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"10px", cursor:"pointer", transition:"all 0.2s", textAlign:"left" }}>
            <span style={{ fontSize:"20px" }}>{sec.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", color: open===sec.id ? sec.color : "#e2e8f0", letterSpacing:"1px" }}>{sec.title}</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", marginTop:"2px" }}>{sec.subtitle}</div>
            </div>
            <span style={{ color: open===sec.id ? sec.color : "#334155", fontSize:"14px", transition:"transform 0.2s", transform: open===sec.id ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </button>
          {open === sec.id && (
            <div style={{ background:"#060e1a", border:`1px solid ${sec.color}44`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
              {sec.items.map((item, i) => (
                <div key={i} style={{ marginBottom: i < sec.items.length-1 ? "14px" : "0", paddingBottom: i < sec.items.length-1 ? "14px" : "0", borderBottom: i < sec.items.length-1 ? "1px solid #0d1b2e" : "none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                    <div style={{ width:"5px", height:"5px", background:sec.color, borderRadius:"50%", flexShrink:0 }} />
                    <span style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"11px", color:sec.color }}>{item.label}</span>
                  </div>
                  <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", lineHeight:"1.8", paddingLeft:"11px", margin:0 }}>{item.desc}</p>
                </div>
              ))}
              {!["registro","login","password","tech","updates","admin"].includes(sec.id) && (<button onClick={() => setActive(sec.id)} style={{ width:"100%", marginTop:"14px", padding:"10px", background:`${sec.color}22`, border:`1px solid ${sec.color}55`, borderRadius:"8px", color:sec.color, fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px" }}>IR A {sec.title} →</button>)}
            </div>
          )}
        </div>
      ))}
      {/* ---
          ENCUESTA DE SATISFACCIÓN
      --- */}
      <EncuestaSatisfaccion isAdmin={isAdmin} />

      <div style={{ textAlign:"center", marginTop:"24px", padding:"14px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ fontSize:"20px", marginBottom:"6px" }}>⚓</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.3)", lineHeight:"1.8" }}>Puerto Tráfico es una herramienta colaborativa.<br/><span style={{ color:"#38bdf8" }}>Tu información hace la diferencia.</span></div>
      </div>
    </div>
  );
}

// --- ENCUESTA DE SATISFACCIÓN ---
function EncuestaSatisfaccion({ isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState("form"); // "form" | "thanks"
  const [loading, setLoading] = useState(false);
  const [adminView, setAdminView] = useState(false);
  const [respuestas, setRespuestas] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Campos de la encuesta
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [dispositivo, setDispositivo] = useState("");
  const [frecuencia, setFrecuencia] = useState("");
  const [calificacion, setCalificacion] = useState("");
  const [funciones, setFunciones] = useState([]);
  const [agregarDesc, setAgregarDesc] = useState("");
  const [quitarDesc, setQuitarDesc] = useState("");
  const [comentario, setComentario] = useState("");
  const [msg, setMsg] = useState(null);

  const DISPOSITIVOS = ["Celular Android", "iPhone / iOS", "Tablet", "Computadora / Laptop", "Varios dispositivos"];
  const FRECUENCIAS  = ["Varias veces al día", "Una vez al día", "Algunas veces por semana", "Ocasionalmente"];
  const CALIFICACIONES = ["⭐ Muy mala","⭐⭐ Mala","⭐⭐⭐ Regular","⭐⭐⭐⭐ Buena","⭐⭐⭐⭐⭐ Excelente"];
  const FUNCIONES_LIST = ["Tráfico / Mapa", "Terminales", "Patio Regulador", "Segundo Acceso", "Carriles Expo/Impo", "Vialidades", "Noticias", "Reportar incidentes"];

  const toggleFuncion = (f) => setFunciones(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f]);

  const handleEnviar = async () => {
    if (!dispositivo || !calificacion || !frecuencia) {
      setMsg({type:"err", text:"Por favor completa los campos obligatorios (dispositivo, frecuencia y calificación)."});
      return;
    }
    const rl = rateLimiter.check("encuesta_" + (correo||"anon"), 86400000); // 1 vez por día
    if (!rl.allowed) {
      setMsg({type:"err", text:`Ya enviaste una encuesta recientemente. Puedes enviar otra en ${Math.ceil(rl.remaining/3600)}h.`});
      return;
    }
    setLoading(true); setMsg(null);
    const payload = {
      nombre: sanitize(nombre) || null,
      correo: sanitize(correo) || null,
      dispositivo,
      frecuencia,
      calificacion,
      funciones_usadas: funciones,
      agregar: sanitize(agregarDesc) || null,
      quitar: sanitize(quitarDesc) || null,
      comentario: sanitize(comentario) || null,
      created_at: new Date().toISOString(),
    };
    const { error } = await sb.from("encuestas_satisfaccion").insert([payload]);
    setLoading(false);
    if (error) {
      setMsg({type:"err", text:"Error al enviar. Intenta de nuevo."});
    } else {
      setStep("thanks");
    }
  };

  const cargarRespuestas = async () => {
    setLoadingAdmin(true);
    const { data } = await sb.from("encuestas_satisfaccion").select("*").order("created_at", { ascending: false }).limit(200);
    setRespuestas(data || []);
    setLoadingAdmin(false);
  };

  const handleAdminView = () => {
    setAdminView(true);
    cargarRespuestas();
  };

  // Estadísticas
  const calcStats = () => {
    if (!respuestas.length) return null;
    const total = respuestas.length;
    const byDisp = {};
    const byFreq = {};
    const byCal = {};
    const byFunc = {};
    respuestas.forEach(r => {
      if (r.dispositivo) byDisp[r.dispositivo] = (byDisp[r.dispositivo]||0)+1;
      if (r.frecuencia)  byFreq[r.frecuencia]  = (byFreq[r.frecuencia]||0)+1;
      if (r.calificacion) byCal[r.calificacion] = (byCal[r.calificacion]||0)+1;
      (r.funciones_usadas||[]).forEach(f => { byFunc[f] = (byFunc[f]||0)+1; });
    });
    return { total, byDisp, byFreq, byCal, byFunc };
  };

  const stats = calcStats();

  const StatBar = ({ label, count, total, color="#38bdf8" }) => (
    <div style={{ marginBottom:"8px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:color, fontWeight:"700" }}>{count} <span style={{color:"rgba(255,255,255,0.3)"}}>({Math.round(count/total*100)}%)</span></span>
      </div>
      <div style={{ height:"5px", background:"rgba(255,255,255,0.06)", borderRadius:"3px", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.round(count/total*100)}%`, background:color, borderRadius:"3px", transition:"width 0.6s ease" }} />
      </div>
    </div>
  );

  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"10px", padding:"10px 12px", color:"rgba(255,255,255,0.85)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", boxSizing:"border-box", outline:"none", marginBottom:"10px" };
  const chipStyle = (sel) => ({ display:"inline-block", padding:"6px 12px", borderRadius:"20px", margin:"3px", cursor:"pointer", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"600", letterSpacing:"0.3px", border:`1px solid ${sel?"#38bdf8":"rgba(255,255,255,0.15)"}`, background: sel?"rgba(56,189,248,0.18)":"rgba(255,255,255,0.04)", color: sel?"#38bdf8":"rgba(255,255,255,0.55)", transition:"all 0.15s", userSelect:"none" });

  return (
    <div style={{ marginTop:"24px", marginBottom:"16px" }}>
      {/* -- Botón trigger -- */}
      <button
        onClick={() => { setExpanded(v=>!v); setAdminView(false); }}
        style={{ width:"100%", background: expanded ? "linear-gradient(135deg,rgba(251,191,36,0.12),rgba(167,139,250,0.12))" : "linear-gradient(135deg,rgba(56,189,248,0.08),rgba(167,139,250,0.08))", border:`1px solid ${expanded?"rgba(251,191,36,0.4)":"rgba(56,189,248,0.25)"}`, borderRadius: expanded?"14px 14px 0 0":"14px", padding:"14px 18px", display:"flex", alignItems:"center", gap:"12px", cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}
      >
        <div style={{ fontSize:"24px" }}>📊</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", color: expanded?"#fbbf24":"rgba(255,255,255,0.9)", letterSpacing:"1px" }}>ENCUESTA DE SATISFACCIÓN</div>
          <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", marginTop:"2px" }}>Tu opinión mejora la plataforma · 2 minutos</div>
        </div>
        <span style={{ color: expanded?"#fbbf24":"rgba(255,255,255,0.3)", fontSize:"13px", transition:"transform 0.25s", transform: expanded?"rotate(180deg)":"rotate(0deg)" }}>▼</span>
      </button>

      {expanded && (
        <div style={{ background:"#060e1a", border:"1px solid rgba(251,191,36,0.2)", borderTop:"none", borderRadius:"0 0 14px 14px", overflow:"hidden" }}>

          {/* -- VISTA ADMIN -- */}
          {isAdmin && !adminView && step !== "thanks" && (
            <div style={{ padding:"12px 16px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:"4px" }}>
              <button onClick={handleAdminView} style={{ padding:"7px 14px", background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.35)", borderRadius:"8px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", letterSpacing:"0.5px" }}>
                🔑 VER RESPUESTAS (SOLO ADMIN)
              </button>
            </div>
          )}

          {/* -- Panel de respuestas admin -- */}
          {isAdmin && adminView && (
            <div style={{ padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
                <div>
                  <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"12px", color:"#fbbf24", letterSpacing:"1px" }}>🔑 PANEL ADMIN · ENCUESTAS</div>
                  <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", marginTop:"2px" }}>Información privada — solo visible al administrador</div>
                </div>
                <button onClick={() => setAdminView(false)} style={{ padding:"5px 10px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"7px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer" }}>← Volver</button>
              </div>

              {loadingAdmin && <div style={{ textAlign:"center", padding:"20px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>Cargando respuestas...</div>}

              {!loadingAdmin && stats && (
                <>
                  {/* Resumen numérico */}
                  <div style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:"10px", padding:"12px 14px", marginBottom:"16px", display:"flex", gap:"20px", flexWrap:"wrap" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"900", fontSize:"28px", color:"#fbbf24" }}>{stats.total}</div>
                      <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px" }}>RESPUESTAS</div>
                    </div>
                  </div>

                  {/* Stats por sección */}
                  {[
                    { title:"📱 Dispositivo más usado", data: stats.byDisp, color:"#38bdf8" },
                    { title:"🕐 Frecuencia de uso",     data: stats.byFreq, color:"#34d399" },
                    { title:"⭐ Calificación general",  data: stats.byCal,  color:"#fbbf24" },
                    { title:"🛠️ Funciones más usadas",  data: stats.byFunc, color:"#a78bfa" },
                  ].map(({ title, data, color }) => (
                    <div key={title} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"12px 14px", marginBottom:"10px" }}>
                      <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"10px", color:"rgba(255,255,255,0.6)", letterSpacing:"1px", marginBottom:"10px" }}>{title}</div>
                      {Object.entries(data).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                        <StatBar key={k} label={k} count={v} total={stats.total} color={color} />
                      ))}
                    </div>
                  ))}

                  {/* Respuestas abiertas */}
                  <div style={{ marginTop:"8px" }}>
                    <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"10px", color:"rgba(255,255,255,0.5)", letterSpacing:"1px", marginBottom:"10px" }}>💬 RESPUESTAS ABIERTAS ({respuestas.length})</div>
                    {respuestas.map((r, i) => (
                      <div key={i} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"12px", marginBottom:"8px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px", flexWrap:"wrap", gap:"4px" }}>
                          <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#38bdf8", fontWeight:"700" }}>{r.nombre || "Anónimo"}</span>
                          <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)" }}>{r.correo || "—"} · {new Date(r.created_at).toLocaleDateString("es-MX")}</span>
                        </div>
                        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
                          {r.dispositivo && <span style={{ padding:"2px 8px", background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:"12px", fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"#38bdf8" }}>{r.dispositivo}</span>}
                          {r.calificacion && <span style={{ padding:"2px 8px", background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:"12px", fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"#fbbf24" }}>{r.calificacion}</span>}
                          {r.frecuencia && <span style={{ padding:"2px 8px", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"12px", fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"#34d399" }}>{r.frecuencia}</span>}
                        </div>
                        {(r.funciones_usadas||[]).length > 0 && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(167,139,250,0.8)", marginBottom:"5px" }}>Usa: {(r.funciones_usadas||[]).join(", ")}</div>}
                        {r.agregar    && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.55)", marginBottom:"3px" }}><span style={{color:"#34d399",fontWeight:"700"}}>+ Agregar: </span>{r.agregar}</div>}
                        {r.quitar     && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.55)", marginBottom:"3px" }}><span style={{color:"#ef4444",fontWeight:"700"}}>− Quitar: </span>{r.quitar}</div>}
                        {r.comentario && <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.55)" }}><span style={{color:"#fbbf24",fontWeight:"700"}}>💬 </span>{r.comentario}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!loadingAdmin && !stats && (
                <div style={{ textAlign:"center", padding:"24px", fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.25)" }}>Aún no hay respuestas registradas.</div>
              )}
            </div>
          )}

          {/* -- FORMULARIO PÚBLICO -- */}
          {!adminView && step === "form" && (
            <div style={{ padding:"16px" }}>
              <div style={{ textAlign:"center", marginBottom:"18px" }}>
                <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)", lineHeight:"1.7" }}>
                  Ayúdanos a mejorar Conect Manzanillo.<br/>
                  <span style={{ color:"rgba(255,255,255,0.25)", fontSize:"10px" }}>🔒 Tus respuestas son anónimas. Solo el administrador puede verlas.</span>
                </div>
              </div>

              {msg && (
                <div style={{ padding:"10px 12px", borderRadius:"8px", marginBottom:"10px", fontSize:"10px", fontFamily:getFont(theme, "secondary"), background: msg.type==="ok"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", border:`1px solid ${msg.type==="ok"?"#22c55e55":"#ef444455"}`, color: msg.type==="ok"?"#22c55e":"#ef4444" }}>
                  {msg.text}
                </div>
              )}

              {/* Datos opcionales */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>DATOS DE CONTACTO (OPCIONALES)</div>
              <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre (opcional)" style={inputStyle} maxLength={80} />
              <input type="email" value={correo} onChange={e=>setCorreo(e.target.value)} placeholder="Tu correo (opcional)" style={inputStyle} maxLength={120} />

              {/* Dispositivo — múltiple choice */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px", marginTop:"4px" }}>📱 ¿EN QUÉ DISPOSITIVO USAS MÁS LA APP? <span style={{color:"#ef4444"}}>*</span></div>
              <div style={{ marginBottom:"12px" }}>
                {DISPOSITIVOS.map(d => (
                  <span key={d} onClick={() => setDispositivo(d)} style={chipStyle(dispositivo===d)}>{d}</span>
                ))}
              </div>

              {/* Frecuencia */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>🕐 ¿CON QUÉ FRECUENCIA LA USAS? <span style={{color:"#ef4444"}}>*</span></div>
              <div style={{ marginBottom:"12px" }}>
                {FRECUENCIAS.map(f => (
                  <span key={f} onClick={() => setFrecuencia(f)} style={chipStyle(frecuencia===f)}>{f}</span>
                ))}
              </div>

              {/* Funciones más usadas */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>🛠️ ¿QUÉ FUNCIONES UTILIZAS MÁS? <span style={{color:"rgba(255,255,255,0.2)"}}>(selecciona todas las que apliquen)</span></div>
              <div style={{ marginBottom:"12px" }}>
                {FUNCIONES_LIST.map(f => (
                  <span key={f} onClick={() => toggleFuncion(f)} style={chipStyle(funciones.includes(f))}>{f}</span>
                ))}
              </div>

              {/* Calificación */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>⭐ ¿CÓMO CALIFICARÍAS LA APP EN GENERAL? <span style={{color:"#ef4444"}}>*</span></div>
              <div style={{ marginBottom:"14px" }}>
                {CALIFICACIONES.map(c => (
                  <span key={c} onClick={() => setCalificacion(c)} style={chipStyle(calificacion===c)}>{c}</span>
                ))}
              </div>

              {/* Preguntas abiertas */}
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>✨ ¿QUÉ TE GUSTARÍA QUE SE AÑADIERA?</div>
              <textarea value={agregarDesc} onChange={e=>setAgregarDesc(e.target.value)} placeholder="Escribe aquí tus sugerencias..." style={{...inputStyle, resize:"vertical", minHeight:"64px", lineHeight:"1.6"}} maxLength={400} />

              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>🗑️ ¿QUÉ TE GUSTARÍA QUE SE QUITARA O MEJORARA?</div>
              <textarea value={quitarDesc} onChange={e=>setQuitarDesc(e.target.value)} placeholder="Algo que consideres innecesario o molesto..." style={{...inputStyle, resize:"vertical", minHeight:"64px", lineHeight:"1.6"}} maxLength={400} />

              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"6px" }}>💬 COMENTARIO LIBRE</div>
              <textarea value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="Lo que quieras compartir con el equipo..." style={{...inputStyle, resize:"vertical", minHeight:"64px", lineHeight:"1.6"}} maxLength={600} />

              {/* Aviso privacidad + botón enviar */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"4px", gap:"12px", flexWrap:"wrap" }}>
                <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"9px", color:"rgba(255,255,255,0.2)", lineHeight:"1.6", flex:1 }}>
                  🔒 Tus respuestas son anónimas y confidenciales.<br/>Solo el administrador de la plataforma puede verlas.
                </div>
                <button
                  onClick={handleEnviar}
                  disabled={loading}
                  style={{ padding:"9px 18px", background: loading?"rgba(56,189,248,0.1)":"linear-gradient(135deg,#38bdf8,#0ea5e9)", border:"none", borderRadius:"10px", color: loading?"#38bdf8":"#0a1628", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor: loading?"not-allowed":"pointer", letterSpacing:"0.5px", flexShrink:0, opacity: loading?0.7:1, transition:"all 0.2s" }}
                >
                  {loading ? "Enviando..." : "ENVIAR ✓"}
                </button>
              </div>
            </div>
          )}

          {/* -- GRACIAS -- */}
          {!adminView && step === "thanks" && (
            <div style={{ padding:"28px 20px", textAlign:"center" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>🙏</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", color:"#34d399", marginBottom:"8px" }}>¡Gracias por tu respuesta!</div>
              <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.4)", lineHeight:"1.8", maxWidth:"260px", margin:"0 auto 16px" }}>
                Tu opinión es muy valiosa para seguir mejorando Conect Manzanillo. El equipo la tomará en cuenta.
              </div>
              <button onClick={() => { setStep("form"); setNombre(""); setCorreo(""); setDispositivo(""); setFrecuencia(""); setCalificacion(""); setFunciones([]); setAgregarDesc(""); setQuitarDesc(""); setComentario(""); setMsg(null); }} style={{ padding:"8px 18px", background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:"10px", color:"#34d399", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer" }}>
                Enviar otra respuesta
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// --- TAB: REDES SOCIALES ---
function InicioTab({ isAdmin, logout, onOpenAdminModal, onOpenThemeConfig }) {
  const theme = React.useContext(ThemeContext);
  const [showQR, setShowQR] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef(null);

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

  // Admin trigger: tap logo 7 times → abre el modal seguro del hook useAdminMode
  const handleLogoClick = () => {
    if (isAdmin) return;

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 7) {
        setTimeout(() => { if (onOpenAdminModal) onOpenAdminModal(); }, 0);
        return 0;
      }
      return next;
    });

    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 3000);
  };

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

      {/* --- SPEECH --- */}
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
          <div 
            onClick={handleLogoClick}
            style={{ 
              width:"46px", 
              height:"46px", 
              background:"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(167,139,250,0.2))", 
              border:"1px solid rgba(56,189,248,0.35)", 
              borderRadius:"12px", 
              display:"flex", 
              alignItems:"center", 
              justifyContent:"center", 
              fontSize:"24px", 
              flexShrink:0,
              cursor: isAdmin ? "default" : "pointer",
              userSelect: "none"
            }}
          >⚓</div>
          <div>
            <div style={{ fontFamily:getFont(theme, "title"), fontWeight:"900", fontSize:"16px", color:"#ffffff", letterSpacing:"0.5px" }}>Conect Manzanillo</div>
            <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(56,189,248,0.8)", fontWeight:"600", letterSpacing:"1.5px", marginTop:"3px" }}>COMUNIDAD EN VIVO · PUERTO</div>
          {isAdmin && (
            <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"8px" }}>
              <span style={{ background:"#38bdf822", border:"1px solid #38bdf855", borderRadius:"20px", padding:"2px 10px", fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#38bdf8", fontWeight:"700" }}>⚡ ADMIN</span>
              <button 
                onClick={onOpenThemeConfig}
                style={{ background:"rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.4)", borderRadius:"20px", padding:"2px 10px", fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"#a78bfa", fontWeight:"700", cursor:"pointer" }}
              >🎨 TEMA</button>
              <button onClick={logout} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", padding:"2px 4px" }}>✕</button>
            </div>
          )}
          </div>
        </div>

        <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"12px", color:"rgba(255,255,255,0.78)", lineHeight:"1.8", margin:"0 0 16px 0" }}>
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
              <span style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.7)", lineHeight:"1.6" }}>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:"14px", display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"3px", height:"38px", background:"linear-gradient(to bottom, #38bdf8, #a78bfa)", borderRadius:"2px", flexShrink:0 }} />
          <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"11px", color:"rgba(255,255,255,0.5)", lineHeight:"1.7", margin:0, fontStyle:"italic" }}>
            "La operación del puerto nos afecta a todos. Compartir lo que sabes es ayudar a quien viene detrás. <span style={{ color:"rgba(56,189,248,0.85)", fontStyle:"normal", fontWeight:"600" }}>Juntos hacemos la diferencia.</span>"
          </p>
        </div>
      </div>

      {/* --- ANIMACIÓN CONVOY --- */}
      <div style={{ marginBottom: "28px" }}>
        <ConvoyScene accentColor="#38bdf8" />
      </div>

      {/* --- REDES SOCIALES --- */}
      <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"2px", fontWeight:"600", marginBottom:"14px", paddingLeft:"2px" }}>SÍGUENOS · COMUNIDAD</div>

      {/* -- WhatsApp Channel --- */}
      <div style={{ marginBottom: "14px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "16px", overflow: "hidden" }}>
        {/* Badge */}
        <div style={{ background: "rgba(37,211,102,0.15)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(37,211,102,0.15)" }}>
          <div style={{ width: "8px", height: "8px", background: "#25D366", borderRadius: "50%", boxShadow: "0 0 8px #25D366", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", color: "#25D366", letterSpacing: "1.5px" }}>CANAL DE NOTICIAS · WHATSAPP</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <IconWA size={42} />
            <div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Únete al Canal de Noticias</div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Recibe las últimas noticias del puerto directamente en WhatsApp</div>
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
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "9px", color: "#075E54", marginTop: "8px", fontWeight: "700", letterSpacing: "1px" }}>ESCANEA PARA UNIRTE</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <a href={WA_CHANNEL} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
              <button style={{
                width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#25D366,#128C7E)",
                border: "none", borderRadius: "12px", color: "#ffffff",
                fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "700", cursor: "pointer",
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
                borderRadius: "12px", color: "#25D366", cursor: "pointer", fontFamily: getFont(theme, "secondary"), fontSize: "18px",
              }}
              title="Ver QR"
            >
              {qrVisible ? "✕" : "⊞"}
            </button>
          </div>
          <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "9px", color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: "8px" }}>
            El QR se muestra automáticamente · también puedes escanearlo aquí
          </div>
        </div>
      </div>

      {/* -- Facebook Group --- */}
      <div style={{ marginBottom: "14px", background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.3)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(24,119,242,0.15)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(24,119,242,0.15)" }}>
          <span style={{ fontSize: "14px" }}>👥</span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", color: "#60a5fa", letterSpacing: "1.5px" }}>GRUPO COMUNITARIO · FACEBOOK</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <IconFB size={42} />
            <div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Grupo Conect Manzanillo</div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Comunidad de transportistas, empresas y ciudadanos del puerto</div>
            </div>
          </div>

          <a href={FB_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#1877F2,#0a5dc7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 20px rgba(24,119,242,0.4)", letterSpacing: "0.5px",
            }}>
              <IconFB size={18} />
              UNIRME AL GRUPO
            </button>
          </a>
        </div>
      </div>

      {/* -- Facebook Page --- */}
      <div style={{ marginBottom: "14px", background: "rgba(24,119,242,0.05)", border: "1px solid rgba(24,119,242,0.25)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(24,119,242,0.12)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(24,119,242,0.12)" }}>
          <span style={{ fontSize: "14px" }}>📣</span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", color: "#93c5fd", letterSpacing: "1.5px" }}>PÁGINA OFICIAL · FACEBOOK</span>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <IconFB size={42} />
            <div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>Conect Manzanillo Oficial</div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Síguenos para noticias, actualizaciones y avisos oficiales del puerto</div>
            </div>
          </div>

          <a href={FB_PAGE} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px", background: "linear-gradient(135deg,#1877F2,#0a5dc7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "700", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: "0 4px 20px rgba(24,119,242,0.35)", letterSpacing: "0.5px",
            }}>
              <IconFB size={18} />
              SEGUIR PÁGINA
            </button>
          </a>
        </div>
      </div>

      {/* -- Instagram --- */}
      <div style={{ marginBottom: "14px", background: "rgba(225,48,108,0.06)", border: "1px solid rgba(225,48,108,0.28)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ background: "rgba(225,48,108,0.13)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(225,48,108,0.13)" }}>
          <span style={{ fontSize: "14px" }}>📸</span>
          <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", fontWeight: "700", color: "#f472b6", letterSpacing: "1.5px" }}>PERFIL OFICIAL · INSTAGRAM</span>
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
              <div style={{ fontFamily: getFont(theme, "secondary"), fontWeight: "700", fontSize: "13px", color: "#ffffff" }}>@conectmanzanillo</div>
              <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>Fotos, videos y noticias del puerto en Instagram</div>
            </div>
          </div>
          <a href={IG_PAGE} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "13px 16px",
              background: "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)",
              border: "none", borderRadius: "12px", color: "#ffffff",
              fontFamily: getFont(theme, "secondary"), fontSize: "12px", fontWeight: "700", cursor: "pointer",
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
        <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: "1.9" }}>
          Únete a la comunidad de Conect Manzanillo<br/>
          <span style={{ color: "#25D366" }}>WhatsApp</span> · <span style={{ color: "#1877F2" }}>Facebook</span> · <span style={{ color: "#f472b6" }}>Instagram</span> · información en tiempo real
        </div>
      </div>
    </div>
  );
}

// --- COOKIE BANNER ---
// ✅ FIX: Botones con estilos completos y handlers correctos
function CookieBanner({ onAccept, onReject }) {
  const theme = React.useContext(ThemeContext);
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
            <div style={{ fontFamily: getFont(theme, "title"), color: "#fff", fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>Cookies y privacidad</div>
            <div style={{ fontFamily: getFont(theme, "secondary"), color: "rgba(255,255,255,0.6)", fontSize: "11px", lineHeight: "1.6" }}>
              Conect Manzanillo usa <strong style={{ color: "rgba(255,255,255,0.85)" }}>cookies esenciales</strong> para recordar tu ID de dispositivo y preferencias de votación. No compartimos datos con terceros ni mostramos publicidad. Tu participación es anónima.
            </div>
          </div>
        </div>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: getFont(theme, "secondary"), marginBottom: "12px", paddingLeft: "34px" }}>
          Al continuar aceptas nuestra política de privacidad · Datos procesados en servidores de Supabase (UE/EUA)
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onReject}
            style={{
              padding: "10px 18px", background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px",
              color: "rgba(255,255,255,0.7)", fontFamily: getFont(theme, "secondary"), fontSize: "12px",
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
              color: "#fff", fontFamily: getFont(theme, "secondary"), fontSize: "12px",
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

// --- COPYROW — componente auxiliar para filas copiables (HOOKS fuera de .map()) --
function CopyRow({ label, value, mono, theme, getFont }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };
  return (
    <div
      onClick={handleCopy}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: copied ? "rgba(168,85,247,0.18)" : (mono ? "rgba(255,255,255,0.05)" : "transparent"),
        borderRadius: "8px",
        padding: "8px 10px",
        marginBottom: "6px",
        cursor: "pointer",
        border: `1px solid ${copied ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.07)"}`,
        transition: "all 0.2s",
        userSelect: "none",
      }}
      title={`Toca para copiar ${label}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: getFont(theme, "secondary"), fontSize: "9px", letterSpacing: "1px" }}>{label.toUpperCase()}</span>
        <span style={{
          color: mono ? "#A855F7" : "#fff",
          fontFamily: mono ? "'Space Mono', monospace" : getFont(theme, "secondary"),
          fontSize: mono ? "13px" : "12px",
          fontWeight: "700",
          letterSpacing: mono ? "0.5px" : "0",
        }}>{value}</span>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: copied ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.1)",
        border: `1px solid ${copied ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.15)"}`,
        borderRadius: "6px",
        padding: "4px 8px",
        transition: "all 0.2s",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "11px" }}>{copied ? "✓" : "📋"}</span>
        <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "10px", color: copied ? "#c084fc" : "rgba(255,255,255,0.6)", fontWeight: "700" }}>
          {copied ? "¡Copiado!" : "Copiar"}
        </span>
      </div>
    </div>
  );
}

// --- APP (RAÍZ) ---
// ✅ FIX PRINCIPAL: hooks declarados DENTRO del cuerpo de la función, no en los parámetros


function App() {
  const { isAdmin, handleLogoTap, openModal, logout, Modal } = useAdminMode();

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
  
  // ✅ TEMA GLOBAL: Hook con soporte para preview local (admin) y aplicación global
  const { 
    supabaseTheme, 
    loadingTheme, 
    previewMode,
    savePreview,
    applyToAll,
    cancelPreview
  } = useGlobalTheme(isAdmin);
  
  // ✅ El tema activo: usa supabaseTheme (que ahora se inicializa con DEFAULT_THEME)
  // El fallback || DEFAULT_THEME es redundante pero mantiene seguridad adicional
  const theme = supabaseTheme || DEFAULT_THEME;
  
  const [showThemeConfig, setShowThemeConfig] = useState(false);
  
  // 🎨 Guardar preview local (solo admin ve cambios)
  const handlePreviewTheme = (newTheme) => {
    if (isAdmin) {
      savePreview(newTheme);
    }
  };
  
  // 🌍 Aplicar tema a TODOS los usuarios
  const handleApplyToAll = async (newTheme) => {
    if (!isAdmin) return false;
    
    const result = await applyToAll(newTheme);
    return result.success;
  };
  
  // ❌ Cancelar preview
  const handleCancelPreview = () => {
    if (isAdmin) {
      cancelPreview();
    }
  };
  
  // Cargar fuentes personalizadas
  useEffect(() => {
    if (theme.customPrimaryFontData) {
      const fontName = theme.primaryFont.replace(/['"]/g, '').split(',')[0];
      const style = document.createElement('style');
      style.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url(${theme.customPrimaryFontData}) format('truetype');
        }
      `;
      document.head.appendChild(style);
      return () => document.head.removeChild(style);
    }
  }, [theme.customPrimaryFontData, theme.primaryFont]);
  
  useEffect(() => {
    if (theme.customSecondaryFontData) {
      const fontName = theme.secondaryFont.replace(/['"]/g, '').split(',')[0];
      const style = document.createElement('style');
      style.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url(${theme.customSecondaryFontData}) format('truetype');
        }
      `;
      document.head.appendChild(style);
      return () => document.head.removeChild(style);
    }
  }, [theme.customSecondaryFontData, theme.secondaryFont]);

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

  // -- Sesión de usuario Supabase Auth --
  const [authUser, setAuthUser] = useState(null);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  
  // -- Widget de Soporte WhatsApp --
  const [supportExpanded, setSupportExpanded] = useState(false);
  const [showQRPanel, setShowQRPanel] = useState(null); // 'whatsapp', 'facebook', 'canal', 'donativo'
  const handleSignOut = async () => {
    try {
      await sb.auth.signOut();
    } catch(e) {
      console.error("signOut error:", e);
    }
    setAuthUser(null);
    setShowSessionMenu(false);
  };

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setAuthUser(data?.session?.user ?? null);
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

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
        coords: r.coords || null,
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
            coords: r.coords || null,
          })));
        });
      }).subscribe();

    return () => sb.removeChannel(chan);
  }, []);
  
  // ✅ Aplicar fondo según configuración
  const getBackgroundStyle = () => {
    switch (theme.backgroundType) {
      case "color":
        return { 
          background: theme.backgroundColor 
        };
      case "image":
        return { 
          backgroundImage: `url(${theme.backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed"
        };
      case "gradient":
      default:
        return { 
          background: theme.backgroundGradient 
        };
    }
  };

  // ✅ CORRECCIÓN: Estilos completos del contenedor principal (fondo + tipografía + color)
  const getMainContainerStyle = () => {
    return {
      minHeight: "100vh",
      width: "100vw",
      maxWidth: "100vw",
      overflowX: "hidden",
      position: "relative",
      // ✅ Aplicar tipografía del tema
      fontFamily: theme.secondaryFont || "'DM Sans', sans-serif",
      fontSize: `${theme.baseFontSize || 14}px`,
      color: theme.textColors?.primary || "#ffffff",
      // ✅ Aplicar fondo del tema
      ...getBackgroundStyle()
    };
  };

  return (
    <ThemeContext.Provider value={theme}>
    <>
      {/* Global styles to prevent gray highlight on tap/click */}
      <style>{`
        * {
          -webkit-tap-highlight-color: transparent !important;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        
        button, a, div[onclick], [role="button"] {
          -webkit-tap-highlight-color: transparent !important;
          outline: none !important;
          user-select: none !important;
        }
        
        button:focus, button:active, button:hover {
          outline: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        
        button::-moz-focus-inner {
          border: 0 !important;
        }
        
        input, textarea {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
      `}</style>
    <div style={getMainContainerStyle()}>
      {/* ✅ FIX: Overlay oscuro para imágenes de fondo con opacidad configurable */}
      {theme.backgroundType === "image" && theme.backgroundImage && (
        <div style={{ 
          position: "fixed", 
          top: 0, 
          left: 0, 
          width: "100%", 
          height: "100%", 
          background: `rgba(0, 0, 0, ${theme.backgroundImageOverlayOpacity || 0.65})`, 
          zIndex: 1,
          pointerEvents: "none"
        }} />
      )}
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
          src="/logo.png" alt="Conect Manzanillo" style={{ width:"48px", height:"48px", objectFit:"contain", flexShrink:0 }} />
          <div>
            <div style={{ fontFamily:getFont(theme, "title"), fontWeight:"700", fontSize:"17px", letterSpacing:"0.5px", color:"#ffffff" }}>Conect Manzanillo</div>
            <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif", letterSpacing:"1px", fontWeight:"300" }}>COMUNIDAD EN VIVO · PUERTO</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <div style={{ width:"7px", height:"7px", background:"#4ade80", borderRadius:"50%", boxShadow:"0 0 8px #4ade80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:"10px", color:"#4ade80", fontFamily:"'DM Sans',sans-serif", fontWeight:"600" }}>EN VIVO</span>
              {isAdmin && (
                <div title="Sesión admin activa" style={{ display:"flex", alignItems:"center", gap:"3px", background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.4)", borderRadius:"5px", padding:"1px 6px", marginLeft:"2px" }}>
                  <span style={{ fontSize:"11px" }}>🔑</span>
                  <span style={{ fontSize:"9px", color:"#fbbf24", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>ADMIN</span>
                </div>
              )}
              {!isAdmin && authUser && (
                <div
                  onClick={() => setShowSessionMenu(v => !v)}
                  style={{ display:"flex", alignItems:"center", gap:"3px", background: showSessionMenu ? "rgba(56,189,248,0.22)" : "rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.35)", borderRadius:"5px", padding:"1px 6px", marginLeft:"2px", cursor:"pointer", userSelect:"none", transition:"background 0.2s" }}
                >
                  <span style={{ fontSize:"11px" }}>👤</span>
                  <span style={{ fontSize:"9px", color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>SESIÓN</span>
                  <span style={{ fontSize:"8px", color:"#38bdf8", marginLeft:"1px" }}>{showSessionMenu ? "▲" : "▼"}</span>
                </div>
              )}
            </div>
            {visitas !== null && (
              <div style={{ display:"flex", alignItems:"center", gap:"4px", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)", borderRadius:"6px", padding:"2px 7px" }}>
                <span style={{ fontSize:"10px" }}>👁</span>
                <span style={{ fontSize:"10px", color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>{visitas.toLocaleString()}</span>
                <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans',sans-serif" }}>visitas</span>
              </div>
            )}
          </div>
        </div>

        <NavBar active={active} set={setActive} />

        <AnunciosBanner isAdmin={isAdmin} />

        {active === "inicio"      && <InicioTab isAdmin={isAdmin} logout={logout} onOpenAdminModal={openModal} onOpenThemeConfig={() => setShowThemeConfig(true)} />}
        {active === "trafico"    && <TraficoTab    myId={myId} incidents={incidents} setIncidents={setIncidents} isAdmin={isAdmin} />}
        {active === "reporte"    && <ReporteTab    myId={myId} incidents={incidents} setIncidents={setIncidents} setActiveTab={setActive} isAdmin={isAdmin} />}
        {active === "terminales" && <TerminalesTab myId={myId} />}
        {active === "patio"      && <PatioReguladorTab myId={myId} />}
        {active === "segundo"    && <SegundoAccesoTab />}
        {active === "carriles"   && <CarrilesTab />}
        {active === "noticias"   && <NoticiasTab isAdmin={isAdmin} />}
        {active === "donativos"  && <DonativosTab />}
        {active === "tutorial"   && <TutorialTab setActive={setActive} isAdmin={isAdmin} />}

        {/* ✅ FIX: Banner solo aparece cuando consent es null (no ha decidido aún) */}
        {consent === null && (
          <CookieBanner onAccept={handleAccept} onReject={handleReject} />
        )}
        
        <DonateBanner active={active} />
      </div>

      {/* Modal Admin — fuera de cualquier stacking context */}
      {Modal}
      
      {/* Panel de Configuración de Tema */}
      {showThemeConfig && (
        <ThemeConfigPanel
          theme={theme}
          previewMode={previewMode}
          onPreview={handlePreviewTheme}
          onApplyToAll={handleApplyToAll}
          onCancel={handleCancelPreview}
          onClose={() => setShowThemeConfig(false)}
        />
      )}

      {/* Session menu — fuera de cualquier stacking context */}
      {!isAdmin && authUser && showSessionMenu && (
        <div
          style={{ position:"fixed", top:"62px", right:"12px", background:"#0d1f3c", border:"1px solid rgba(56,189,248,0.3)", borderRadius:"12px", padding:"10px", minWidth:"190px", zIndex:99999, boxShadow:"0 12px 40px rgba(0,0,0,0.8)" }}
        >
          <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", fontFamily:"'DM Sans',sans-serif", padding:"2px 6px 8px", borderBottom:"1px solid rgba(255,255,255,0.08)", marginBottom:"8px", wordBreak:"break-all" }}>
            {authUser.email}
          </div>
          <button
            onClick={handleSignOut}
            style={{ width:"100%", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:"8px", padding:"10px 12px", color:"#ef4444", fontFamily:"'DM Sans',sans-serif", fontSize:"12px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", letterSpacing:"0.5px" }}
          >
            <span>🚪</span> CERRAR SESIÓN
          </button>
        </div>
      )}

      {/* Widget de Contacto y Redes - FAB Expandible */}
      <div 
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 99998
        }}
      >
        {/* Burbujas expandibles */}
        {supportExpanded && (
          <div style={{
            position: "absolute",
            bottom: "70px",
            right: "0",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "flex-end"
          }}>
            {/* Burbuja: Soporte WhatsApp */}
            <div
              onClick={() => setShowQRPanel(showQRPanel === 'whatsapp' ? null : 'whatsapp')}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                animation: "bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                animationDelay: "0.05s",
                opacity: 0
              }}
            >
              <div style={{
                background: "rgba(13, 31, 60, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(37, 211, 102, 0.3)",
                borderRadius: "20px",
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Soporte WhatsApp
              </div>
              <div style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: "24px",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                💬
              </div>
            </div>

            {/* Burbuja: Página Facebook */}
            <div
              onClick={() => window.open('https://www.facebook.com/conectmanzanillooficial/', '_blank')}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                animation: "bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                animationDelay: "0.1s",
                opacity: 0
              }}
            >
              <div style={{
                background: "rgba(13, 31, 60, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(24, 119, 242, 0.3)",
                borderRadius: "20px",
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Página Facebook
              </div>
              <div style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(135deg, #1877F2 0%, #0D5DBE 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(24, 119, 242, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: "24px",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                📘
              </div>
            </div>

            {/* Burbuja: Canal WhatsApp */}
            <div
              onClick={() => setShowQRPanel(showQRPanel === 'canal' ? null : 'canal')}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                animation: "bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                animationDelay: "0.15s",
                opacity: 0
              }}
            >
              <div style={{
                background: "rgba(13, 31, 60, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(37, 211, 102, 0.3)",
                borderRadius: "20px",
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Canal WhatsApp
              </div>
              <div style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(18, 140, 126, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: "24px",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                📢
              </div>
            </div>

            {/* Burbuja: Donativo Mifel */}
            <div
              onClick={() => setShowQRPanel(showQRPanel === 'donativo' ? null : 'donativo')}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                animation: "bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                animationDelay: "0.2s",
                opacity: 0,
                outline: "none",
                WebkitTapHighlightColor: "transparent",
                userSelect: "none",
              }}
            >
              <div style={{
                background: "rgba(13, 31, 60, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: "20px",
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Donar (Mifel)
              </div>
              <div style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(168, 85, 247, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: "24px",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                💝
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes bubbleIn {
            from {
              opacity: 0;
              transform: translateX(20px) scale(0.8);
            }
            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        {/* Botón principal FAB */}
        <div
          onClick={() => {
            setSupportExpanded(!supportExpanded);
            setShowQRPanel(null);
          }}
          style={{
            width: "56px",
            height: "56px",
            background: supportExpanded 
              ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" 
              : "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: supportExpanded
              ? "0 4px 20px rgba(239, 68, 68, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3)"
              : "0 4px 20px rgba(37, 211, 102, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            transform: supportExpanded ? "rotate(45deg)" : "rotate(0deg)"
          }}
          onMouseEnter={(e) => {
            if (!supportExpanded) e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            if (!supportExpanded) e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span style={{ 
            fontSize: "28px", 
            lineHeight: 1,
            transform: supportExpanded ? "rotate(-45deg)" : "rotate(0deg)",
            transition: "transform 0.3s"
          }}>
            {supportExpanded ? "✕" : "💬"}
          </span>
        </div>

        {/* Panel QR WhatsApp Soporte */}
        {showQRPanel === 'whatsapp' && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              right: "60px",
              background: "rgba(13, 31, 60, 0.98)",
              border: "1px solid rgba(37, 211, 102, 0.3)",
              borderRadius: "16px",
              padding: "20px",
              minWidth: "280px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 1
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                💬
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: "16px",
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Soporte Técnico
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "11px",
                  marginTop: "2px"
                }}>
                  ¿Necesitas ayuda?
                </div>
              </div>
              <button
                onClick={() => setShowQRPanel(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "16px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }}
              >
                ✕
              </button>
            </div>

            {/* QR Code */}
            <div style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent('https://wa.me/5215612463102')}`}
                alt="QR WhatsApp Soporte"
                style={{
                  width: "140px",
                  height: "140px",
                  display: "block"
                }}
              />
            </div>

            {/* Botón WhatsApp */}
            <a
              href="https://wa.me/5215612463102"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                border: "none",
                borderRadius: "12px",
                padding: "14px 20px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                textDecoration: "none",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 211, 102, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 211, 102, 0.3)";
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Abrir WhatsApp
            </a>

            <div style={{
              marginTop: "12px",
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: getFont(theme, "secondary"),
              fontSize: "10px",
              lineHeight: 1.4
            }}>
              Escanea el código QR o<br/>
              haz clic para chatear
            </div>
          </div>
        )}

        {/* Panel QR Canal WhatsApp */}
        {showQRPanel === 'canal' && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              right: "60px",
              background: "rgba(13, 31, 60, 0.98)",
              border: "1px solid rgba(18, 140, 126, 0.3)",
              borderRadius: "16px",
              padding: "20px",
              minWidth: "280px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 1
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                📢
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: "16px",
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Canal WhatsApp
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "11px",
                  marginTop: "2px"
                }}>
                  Únete a nuestro canal
                </div>
              </div>
              <button
                onClick={() => setShowQRPanel(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "16px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent('https://whatsapp.com/channel/0029VbBN73rId7nJ3RTSsq3s')}`}
                alt="QR Canal WhatsApp"
                style={{
                  width: "140px",
                  height: "140px",
                  display: "block"
                }}
              />
            </div>

            <a
              href="https://whatsapp.com/channel/0029VbBN73rId7nJ3RTSsq3s"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                border: "none",
                borderRadius: "12px",
                padding: "14px 20px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                textDecoration: "none",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(18, 140, 126, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(18, 140, 126, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(18, 140, 126, 0.3)";
              }}
            >
              📢 Unirse al Canal
            </a>

            <div style={{
              marginTop: "12px",
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: getFont(theme, "secondary"),
              fontSize: "10px",
              lineHeight: 1.4
            }}>
              Recibe actualizaciones y noticias<br/>
              directamente en WhatsApp
            </div>
          </div>
        )}

        {/* Panel Donativo Mifel */}
        {showQRPanel === 'donativo' && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              right: "60px",
              background: "rgba(13, 31, 60, 0.98)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "16px",
              padding: "20px",
              minWidth: "280px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 1
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}>
                💝
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: "16px",
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Apoya el Proyecto
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "11px",
                  marginTop: "2px"
                }}>
                  Tu donativo nos ayuda
                </div>
              </div>
              <button
                onClick={() => setShowQRPanel(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "16px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }}
              >
                ✕
              </button>
            </div>

            {/* Información de cuenta Mifel */}
            <div style={{
              background: "rgba(168, 85, 247, 0.1)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px"
            }}>
              <div style={{
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: "12px",
                marginBottom: "12px",
                fontWeight: "600",
                textAlign: "center"
              }}>
                Datos para transferencia:
              </div>
              
              {/* Filas con botón copiar */}
              {[
                { label: "Banco",   value: "Mifel",              mono: false },
                { label: "Titular", value: "Ramon Romero",        mono: false },
                { label: "CLABE",   value: "014028090014825779",  mono: true  },
              ].map(({ label, value, mono }) => (
                <CopyRow key={label} label={label} value={value} mono={mono} theme={theme} getFont={getFont} />
              ))}

              {/* Hint */}
              <div style={{ textAlign: "center", marginTop: "8px", fontFamily: getFont(theme, "secondary"), fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
                Toca cualquier dato para copiarlo al portapapeles
              </div>
            </div>

            <div style={{
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: getFont(theme, "secondary"),
              fontSize: "10px",
              lineHeight: 1.4
            }}>
              Cualquier monto es apreciado 💜<br/>
              ¡Gracias por tu apoyo!
            </div>
          </div>
        )}
      </div>
    </div>
    </>
    </ThemeContext.Provider>
  );
}

export default App;
