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

// Inject Google Fonts - ahora incluye más opciones para personalización
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=Roboto:wght@300;400;700&family=Montserrat:wght@300;400;700&family=Open+Sans:wght@300;400;700&family=Lato:wght@300;400;700&family=Poppins:wght@300;400;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://wnchrhglwsrzrcrhhukg.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY2hyaGdsd3NyenJjcmhodWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyMzI0NzksImV4cCI6MjA1MjgwODQ3OX0.4EUDMOIKFUOa7pQZU8KBp_bC8xt--u10iQO5Ru4pC5Y";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE TEMA POR DEFECTO
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_THEME = {
  // Fondo
  backgroundType: "gradient", // "color" | "gradient" | "image"
  backgroundColor: "#0a1628",
  backgroundGradient: "linear-gradient(135deg, #0a1628 0%, #1a2942 100%)",
  backgroundImage: "",
  backgroundImageOverlayOpacity: 0.65, // ✨ NUEVO: Opacidad de la capa oscura sobre imagen de fondo (0-1)
  
  // Tipografía - VALORES BASE PARA MÓVIL (se escalan automáticamente en desktop)
  primaryFont: "'Playfair Display', serif",
  secondaryFont: "'DM Sans', sans-serif",
  baseFontSize: 14,      // Mobile: 14px, Desktop: ~18px (auto-escalado)
  titleFontSize: 17,     // Mobile: 17px, Desktop: ~24px (auto-escalado)
  
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
  ],
};

const UBICACIONES = [
  { id: "pezvela",      label: "Acceso Pez Vela",          icon: "🐟", color: "#3b82f6" },
  { id: "puerta15",     label: "Puerta 15",                icon: "🚪", color: "#8b5cf6" },
  { id: "zonanorte",    label: "Zona Norte",               icon: "🧭", color: "#06b6d4" },
  { id: "libramientovial", label: "Libramiento Vial",     icon: "🛣️", color: "#10b981" },
  { id: "bulevardcostero", label: "Bulevar Costero",      icon: "🏖️", color: "#f59e0b" },
  { id: "bulevardhazesa",  label: "Bulevar (HAZESA)",     icon: "🛤️", color: "#ec4899" },
  { id: "ingresoasipona",  label: "Ingreso ASIPONA",      icon: "⚓", color: "#a855f7" },
  { id: "otro",            label: "Otro",                 icon: "📍", color: "#6b7280" },
];

const ACCESS_POINTS = [
  { 
    id: "pezvela", 
    label: "Acceso Pez Vela", 
    icon: "🐟",
    lanes: [
      { id: "pezvela_1", label: "Carril 1" },
      { id: "pezvela_2", label: "Carril 2" },
      { id: "pezvela_3", label: "Carril 3" },
      { id: "pezvela_4", label: "Carril 4" },
    ]
  },
  { 
    id: "puerta15", 
    label: "Puerta 15", 
    icon: "🚪",
    lanes: [
      { id: "puerta15_1", label: "Carril 1" },
      { id: "puerta15_2", label: "Carril 2" },
      { id: "puerta15_3", label: "Carril 3" },
    ]
  },
  { 
    id: "zonanorte", 
    label: "Zona Norte", 
    icon: "🧭",
    lanes: [
      { id: "zonanorte_1", label: "Carril 1" },
      { id: "zonanorte_2", label: "Carril 2" },
    ]
  },
];

const ACCESOS_PRINCIPALES = [
  { id: "pezvela",   label: "Pez Vela",   icon: "🐟" },
  { id: "puerta15",  label: "Puerta 15",  icon: "🚪" },
  { id: "zonanorte", label: "Zona Norte", icon: "🧭" },
];

const PATIOS_LIST = [
  { id: "libramientovial", label: "Libramiento Vial",   icon: "🛣️", color: "#10b981" },
  { id: "bulevardcostero", label: "Bulevar Costero",    icon: "🏖️", color: "#f59e0b" },
  { id: "bulevardhazesa",  label: "Bulevar (HAZESA)",   icon: "🛤️", color: "#ec4899" },
  { id: "ingresoasipona",  label: "Ingreso ASIPONA",    icon: "⚓", color: "#a855f7" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ✨ SISTEMA DE ESCALADO RESPONSIVE PARA TIPOGRAFÍA (MEJORADO)
// ─────────────────────────────────────────────────────────────────────────────
const useResponsiveFontScale = () => {
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      
      if (width < 768) {
        setIsMobile(true);
        setScale(1); // Móvil: sin cambios
      } else {
        setIsMobile(false);
        // Desktop: escalado progresivo similar a copoma.com.mx
        if (width >= 1920) {
          setScale(1.85);
        } else if (width >= 1440) {
          setScale(1.7);
        } else if (width >= 1024) {
          setScale(1.5);
        } else {
          setScale(1.3);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return { scale, isMobile };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// ✨ Función helper para obtener fuentes del tema
const getFont = (theme, type) => {
  if (type === "title" || type === "primary") {
    return theme?.primaryFont || DEFAULT_THEME.primaryFont;
  }
  return theme?.secondaryFont || DEFAULT_THEME.secondaryFont;
};

// ✨ Función helper para obtener tamaños de fuente CON ESCALADO RESPONSIVE
const getFontSize = (theme, type, scale = 1) => {
  const baseSize = type === "title" 
    ? (theme?.titleFontSize || DEFAULT_THEME.titleFontSize)
    : (theme?.baseFontSize || DEFAULT_THEME.baseFontSize);
  
  return Math.round(baseSize * scale);
};

// ✨ Función helper para obtener color de texto del tema
const getTextColor = (theme, type = "primary") => {
  return theme?.textColors?.[type] || DEFAULT_THEME.textColors[type];
};

// ✨ Función helper para obtener estilos de content box
const getContentBoxStyle = (theme) => {
  const box = theme?.contentBox || DEFAULT_THEME.contentBox;
  if (!box.enabled) return {};
  
  const styles = {
    background: box.background,
    backdropFilter: `blur(${box.backdropBlur}px)`,
    WebkitBackdropFilter: `blur(${box.backdropBlur}px)`,
    border: `${box.borderWidth}px solid ${box.borderColor}`,
    borderRadius: `${box.borderRadius}px`,
    padding: `${box.padding}px`,
  };
  
  if (box.shadow?.enabled) {
    styles.boxShadow = `${box.shadow.offsetX}px ${box.shadow.offsetY}px ${box.shadow.blur}px ${box.shadow.color}`;
  }
  
  return styles;
};

// ✨ Función helper para obtener icono (emoji o imagen)
const getIcon = (theme, category, key) => {
  const iconConfig = theme?.[category]?.[key] || DEFAULT_THEME[category]?.[key];
  if (!iconConfig) return null;
  
  if (iconConfig.type === "emoji") {
    return { 
      type: "emoji", 
      value: iconConfig.value,
      size: iconConfig.size 
    };
  } else if (iconConfig.type === "image") {
    return { 
      type: "image", 
      url: iconConfig.url,
      size: iconConfig.size 
    };
  }
  return null;
};

// ✨ NUEVO HOOK: Gestión global del tema (incluye carga desde Supabase)
function useGlobalThemeBasic() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThemeFromDatabase();
  }, []);

  const loadThemeFromDatabase = async () => {
    try {
      const { data, error } = await sb
        .from("app_theme")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error loading theme:", error);
        setTheme(DEFAULT_THEME);
      } else if (data?.theme_config) {
        // Merge con DEFAULT_THEME para garantizar que todos los campos existen
        setTheme({ ...DEFAULT_THEME, ...data.theme_config });
      } else {
        setTheme(DEFAULT_THEME);
      }
    } catch (err) {
      console.error("Theme load exception:", err);
      setTheme(DEFAULT_THEME);
    } finally {
      setLoading(false);
    }
  };

  const updateTheme = (newTheme) => {
    setTheme({ ...DEFAULT_THEME, ...newTheme });
  };

  return { theme, updateTheme, loading, reload: loadThemeFromDatabase };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────────────────────

// Hook: contador de votos en vivo desde RT subscription
function useVoteCount(accesoId) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accesoId) {
      setLoading(false);
      return;
    }

    const fetchCount = async () => {
      const { count: c, error } = await sb
        .from("votos_acceso")
        .select("*", { count: "exact", head: true })
        .eq("acceso_id", accesoId)
        .gte("voted_at", new Date(Date.now() - 3600000).toISOString());
      if (!error) setCount(c || 0);
      setLoading(false);
    };

    fetchCount();

    const channel = sb
      .channel(`votos:${accesoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votos_acceso",
          filter: `acceso_id=eq.${accesoId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [accesoId]);

  return { count, loading };
}

// Hook: determina qué acceso tiene mayor tráfico
function useActiveAccesoStatus() {
  const [activeAcceso, setActiveAcceso] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActive = async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data, error } = await sb
        .from("votos_acceso")
        .select("acceso_id")
        .gte("voted_at", oneHourAgo);

      if (!error && data) {
        const counts = {};
        data.forEach((v) => {
          counts[v.acceso_id] = (counts[v.acceso_id] || 0) + 1;
        });
        const max = Math.max(...Object.values(counts), 0);
        if (max > 0) {
          const winner = Object.keys(counts).find((k) => counts[k] === max);
          setActiveAcceso(winner);
        } else {
          setActiveAcceso(null);
        }
      }
      setLoading(false);
    };

    fetchActive();

    const channel = sb
      .channel("votos_all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votos_acceso" },
        () => fetchActive()
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  return { activeAcceso, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function CookieBanner({ onAccept, onReject }) {
  const theme = React.useContext(ThemeContext);
  const fontScale = useResponsiveFontScale();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(13, 31, 60, 0.98)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        padding: "16px 20px",
        borderTop: "1px solid rgba(168, 85, 247, 0.3)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.4)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          fontFamily: getFont(theme, "secondary"),
          fontSize: `${getFontSize(theme, "base", fontScale)}px`,
          color: getTextColor(theme, "secondary"),
          lineHeight: 1.5,
        }}
      >
        Usamos cookies para mejorar tu experiencia. Al continuar, aceptas nuestra política de privacidad.
      </div>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          onClick={onReject}
          style={{
            fontFamily: getFont(theme, "secondary"),
            fontSize: `${getFontSize(theme, "base", fontScale)}px`,
            padding: "8px 16px",
            background: "rgba(255, 255, 255, 0.1)",
            color: getTextColor(theme, "secondary"),
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Rechazar
        </button>
        <button
          onClick={onAccept}
          style={{
            fontFamily: getFont(theme, "secondary"),
            fontSize: `${getFontSize(theme, "base", fontScale)}px`,
            padding: "8px 16px",
            background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            transition: "all 0.2s",
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ✨ Componente: Panel Flotante Admin
// ─────────────────────────────────────────────────────────────────────────────
function FloatingAdminPanel({ onLogout, onOpenThemeConfig }) {
  const theme = React.useContext(ThemeContext);
  const fontScale = useResponsiveFontScale();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: 9999
      }}
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
            border: "1px solid rgba(168, 85, 247, 0.5)",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: `${getFontSize(theme, "base", fontScale)}px`,
            boxShadow: "0 4px 12px rgba(168, 85, 247, 0.4)",
            transition: "all 0.2s"
          }}
        >
          🔑
        </button>
      ) : (
        <div
          style={{
            background: "rgba(13, 31, 60, 0.98)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: "12px",
            padding: "12px",
            minWidth: "200px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)"
          }}
        >
          <div
            style={{
              fontFamily: getFont(theme, "secondary"),
              fontSize: `${getFontSize(theme, "base", fontScale * 0.9)}px`,
              fontWeight: "600",
              color: "#A855F7",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span>🔑 Admin</span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.5)",
                cursor: "pointer",
                fontSize: `${getFontSize(theme, "base", fontScale)}px`,
                padding: "0",
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          <button
            onClick={onOpenThemeConfig}
            style={{
              fontFamily: getFont(theme, "secondary"),
              fontSize: `${getFontSize(theme, "base", fontScale * 0.9)}px`,
              width: "100%",
              padding: "8px 12px",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "8px",
              color: "#38bdf8",
              cursor: "pointer",
              marginBottom: "8px",
              textAlign: "left",
              transition: "all 0.2s"
            }}
          >
            ⚙️ Configurar Tema
          </button>

          <button
            onClick={onLogout}
            style={{
              fontFamily: getFont(theme, "secondary"),
              fontSize: `${getFontSize(theme, "base", fontScale * 0.9)}px`,
              width: "100%",
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#ef4444",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s"
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
    // Componente de lista de anuncios (admin)
   function AnunciosList({ lista, setLista, onEdit, onDelete, onToggle, isReordering }) {
  const theme = React.useContext(ThemeContext);
  const [draggedIndex, setDraggedIndex] = React.useState(null);
  const [dragOverIndex, setDragOverIndex] = React.useState(null);

  return (
    <div>
      {lista.map((a, idx) => (
        <div
          key={a.id}
          draggable={isReordering}
          onDragStart={() => setDraggedIndex(idx)}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverIndex(idx);
          }}
          onDrop={() => {
            if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
              const newLista = [...lista];
              const [moved] = newLista.splice(draggedIndex, 1);
              newLista.splice(dragOverIndex, 0, moved);
              setLista(newLista);
              newLista.forEach((item, i) => {
                sb.from("anuncios")
                  .update({ orden: newLista.length - i })
                  .eq("id", item.id)
                  .then();
              });
            }
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          style={{
            background: dragOverIndex === idx && isReordering
              ? "rgba(251,191,36,0.1)"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${
              dragOverIndex === idx && isReordering
                ? "rgba(251,191,36,0.3)"
                : "rgba(255,255,255,0.08)"
            }`,
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
            cursor: isReordering ? "move" : "default",
            opacity: draggedIndex === idx ? 0.5 : 1,
            transition: "all 0.2s"
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              {isReordering && (
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)", cursor: "move" }}>
                  ⋮⋮
                </span>
              )}

              <div
                style={{
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "11px",
                  color: "#fff",
                  fontWeight: "700",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {a.titulo}
              </div>

              {idx === 0 && !isReordering && (
                <span
                  style={{
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.35)",
                    borderRadius: "4px",
                    padding: "1px 5px",
                    fontSize: "8px",
                    color: "#fbbf24",
                    fontFamily: getFont(theme, "secondary"),
                    fontWeight: "700",
                    letterSpacing: "0.5px"
                  }}
                >
                  ★ PRINCIPAL
                </span>
              )}
            </div>

            <div
              style={{
                fontFamily: getFont(theme, "secondary"),
                fontSize: "9px",
                color: "rgba(255,255,255,0.35)"
              }}
            >
              {a.empresa} · fin:{" "}
              {new Date(a.fecha_fin).toLocaleString("es-MX", {
                dateStyle: "short",
                timeStyle: "short"
              })}
            </div>
          </div>

          {!isReordering && (
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              {idx !== 0 && (
                <button
                  onClick={() => handleSetPrincipal(a.id)}
                  title="Establecer como principal"
                  style={{
                    background: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    borderRadius: "6px",
                    padding: "5px 9px",
                    color: "#fbbf24",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: "10px",
                    cursor: "pointer",
                    fontWeight: "700"
                  }}
                >
                  ★
                </button>
              )}

              <button
                onClick={() => onEdit(a.id)}
                title="Editar anuncio"
                style={{
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.3)",
                  borderRadius: "6px",
                  padding: "5px 9px",
                  color: "#38bdf8",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "10px",
                  cursor: "pointer",
                  fontWeight: "700"
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
                      .then(({ data }) => {
                        if (data) setLista(data);
                      });
                  }, 300);
                }}
                style={{
                  background: a.activo ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${a.activo ? "#22c55e55" : "rgba(255,255,255,0.15)"}`,
                  borderRadius: "6px",
                  padding: "5px 9px",
                  color: a.activo ? "#22c55e" : "rgba(255,255,255,0.4)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "10px",
                  cursor: "pointer",
                  fontWeight: "700"
                }}
              >
                {a.activo ? "ON" : "OFF"}
              </button>

              <button
                onClick={() => {
                  onDelete(a.id);
                  setLista((l) => l.filter((x) => x.id !== a.id));
                }}
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "6px",
                  padding: "5px 9px",
                  color: "#ef4444",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: "10px",
                  cursor: "pointer"
                }}
              >
                🗑
              </button>
            </div>
          )}
        </div>
      ))}

      {isReordering && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px 12px",
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: "8px",
            fontFamily: getFont(theme, "secondary"),
            fontSize: "9px",
            color: "rgba(255,255,255,0.5)",
            textAlign: "center"
          }}
        >
          💡 Arrastra los anuncios para cambiar su orden. El primero será el principal.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 HOOK: CARGAR Y SUSCRIBIRSE AL TEMA GLOBAL EN SUPABASE (TIEMPO REAL)
// Permite que TODOS los usuarios vean los cambios de tema instantáneamente
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 FUNCIÓN: GUARDAR TEMA EN SUPABASE (SOLO ADMIN)
// Sincroniza el tema para todos los usuarios en tiempo real
// ─────────────────────────────────────────────────────────────────────────────
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


// ─── NAVBAR ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PANEL DE CONFIGURACIÓN DE TEMA
// ─────────────────────────────────────────────────────────────────────────────
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
                    Código CSS del Degradado
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
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Fuente Principal (Títulos)
                  </label>
                  <select
                    value={config.primaryFont}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryFont: e.target.value }))}
                    style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"13px" }}
                  >
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    {config.customPrimaryFont && <option value={config.customPrimaryFont}>Fuente Personalizada</option>}
                  </select>
                  
                  <div style={{ marginTop:"12px" }}>
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
                
                <div>
                  <label style={{ display:"block", marginBottom:"8px", fontFamily:getFont(theme, "secondary"), fontSize:"13px", color:"rgba(255,255,255,0.7)", fontWeight:"500" }}>
                    Fuente Secundaria (Texto)
                  </label>
                  <select
                    value={config.secondaryFont}
                    onChange={(e) => setConfig(prev => ({ ...prev, secondaryFont: e.target.value }))}
                    style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.05)", color:"#fff", fontFamily:getFont(theme, "secondary"), fontSize:"13px" }}
                  >
                    <option value="'DM Sans', sans-serif">DM Sans</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    {config.customSecondaryFont && <option value={config.customSecondaryFont}>Fuente Personalizada</option>}
                  </select>
                  
                  <div style={{ marginTop:"12px" }}>
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
          outline: "none",
          touchAction: "manipulation"
        }}
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

// ─── CONVOY SCENE ────────────────────────────────────────────────────────────
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

// ─── SKELETON CARD ────────────────────────────────────────────────────────────
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

  // ── Accesos ──
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

  // ── Vialidades ──
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
          <style>{`@media(min-width:640px){.acc-btn-grid{grid-template-columns:repeat(4,1fr)!important;}}`}</style>
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

      {/* ══════════════════════════════════════
          SECCIÓN: VIALIDADES
      ══════════════════════════════════════ */}
      {activeSection === "vialidades" && (
        <div style={{ padding: "16px" }}>
          <style>{`@media(min-width:640px){.vial-btn-grid{grid-template-columns:repeat(4,1fr)!important;}}`}</style>
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

      {/* ══════════════════════════════════════
          SECCIÓN: INCIDENTES
      ══════════════════════════════════════ */}
      {activeSection === "incidentes" && (
        <div style={{ padding: "16px" }}>
          {activeIncidents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontFamily: getFont(theme, "secondary"), fontSize: "14px" }}>
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
          })}
        </div>
      )}

      <ToastBox toast={toast} />

    </div>
  );
}

// ─── MAPA DE TRÁFICO (Leaflet con KML real) ──────────────────────────────────
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

function MapaTrafico({ incidents, accesos, vialidades, compact = false }) {
  const theme = React.useContext(ThemeContext);
  const mapRef    = useRef(null);
  const leafRef   = useRef(null);
  const layersRef = useRef({});
  const tileRef      = useRef(null);
  const labelLayerRef = useRef(null);
  const [tileMode, setTileMode] = useState("dark");

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {LEGEND_ITEMS.filter(i => { const accesoNames = ["Acceso Zona Norte","Acceso Pez Vela","Acceso Puerta 15","Acceso Patios"]; return i.type === "dot" && !accesoNames.includes(i.label); }).map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "7px 10px" }}>
              <div style={{ width: "12px", height: "12px", background: item.color, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0 }} />
              <span style={{ fontFamily: getFont(theme, "secondary"), fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}



function ReporteTab({ myId, incidents, setIncidents, setActiveTab }) {
  const theme = React.useContext(ThemeContext);
  const [categoria, setCategoria] = useState("incidente");
  const [subcat,    setSubcat]    = useState("");
  const [acceso,    setAcceso]    = useState("");
  const [location,  setLocation]  = useState("");
  const [showUbic,  setShowUbic]  = useState(false);
  const [grupoOpen, setGrupoOpen] = useState(null);
  const [toast,     setToast]     = useState(null);
  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const subcats = INCIDENT_SUBCATEGORIAS[categoria] || [];
  const catObj  = INCIDENT_CATEGORIAS.find(c => c.id === categoria) || INCIDENT_CATEGORIAS[0];
  const subcatObj = subcats.find(s => s.id === subcat);

  const submit = async () => {
    if (!subcat)          return notify("Selecciona el tipo específico", "#ef4444");
    if (!location.trim()) return notify("Ingresa la ubicación", "#ef4444");
    const rl = rateLimiter.check(`report_${myId}`, 120000);
    if (!rl.allowed) return notify(`Espera ${rl.remaining}s para reportar de nuevo`, "#f97316");
    const labelFull = `${subcatObj?.icon || ""} ${subcatObj?.label || subcat}`;
    const safeLoc   = sanitize(acceso ? `${acceso} — ${location}` : location);
    const safeDesc  = sanitize(labelFull);
    if (!safeLoc.trim()) return notify("Ubicación inválida", "#ef4444");
    await sb.from("incidents").insert({ type: categoria, location: safeLoc, description: safeDesc, votes: {}, resolve_votes: {}, visible: false, resolved: false, ts: Date.now() });
    setSubcat(""); setLocation(""); setAcceso("");
    notify("📍 Reporte enviado — se verificará con la comunidad", "#22c55e");
    setTimeout(() => setActiveTab("trafico"), 1200);
  };

  const incType = (id) => INCIDENT_TYPES.find(t => t.id === id) || INCIDENT_TYPES[0];
  const pendingMine = incidents.filter(i => !i.visible && !i.resolved);

  return (
    <div style={{ padding:"16px", paddingBottom:"80px" }}>
      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a2540)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"14px", padding:"16px", marginBottom:"20px", textAlign:"center" }}>
        <div style={{ fontSize:"32px", marginBottom:"8px" }}>📍</div>
        <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", letterSpacing:"1px" }}>REPORTAR INCIDENTE</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px", marginTop:"4px" }}>Tu reporte será verificado por la comunidad antes de aparecer en el mapa.</div>
      </div>

      {/* Mapa de referencia */}
      <div style={{ marginBottom:"16px" }}>
        <MapaTrafico incidents={incidents} accesos={{}} vialidades={{}} compact />
      </div>

      {/* Paso 1: Categoría */}
      <div style={{ marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px" }}>PASO 1 · CATEGORÍA</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          {INCIDENT_CATEGORIAS.map(cat => (
            <button key={cat.id} onClick={() => { setCategoria(cat.id); setSubcat(""); }} style={{ padding:"14px 8px", border:`1px solid ${categoria===cat.id ? cat.color : "#1e3a5f"}`, background: categoria===cat.id ? cat.color+"22" : "#0d1b2e", borderRadius:"10px", color: categoria===cat.id ? cat.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"13px", cursor:"pointer", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", fontWeight: categoria===cat.id ? "700" : "400" }}>
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
            <button key={s.id} onClick={() => setSubcat(s.id)} style={{ padding:"11px 14px", border:`1px solid ${subcat===s.id ? catObj.color : "#1e3a5f"}`, background: subcat===s.id ? catObj.color+"22" : "#0a1628", borderRadius:"10px", color: subcat===s.id ? catObj.color : "#64748b", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", gap:"10px", fontWeight: subcat===s.id ? "700" : "400", textAlign:"left" }}>
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
            <button key={a} onClick={() => setAcceso(a)} style={{ padding:"6px 10px", background: acceso===a ? "#0369a122" : "#0a1628", border:`1px solid ${acceso===a ? "#0ea5e9" : "#1e3a5f"}`, borderRadius:"6px", color: acceso===a ? "#38bdf8" : "#475569", fontFamily:getFont(theme, "secondary"), fontSize:"10px", cursor:"pointer", transition:"all 0.15s" }}>{a === "" ? "Sin zona" : a}</button>
          ))}
        </div>
      </div>

      {/* Paso 4: Ubicación */}
      <div style={{ marginBottom:"18px" }}>
        <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"6px" }}>PASO 4 · UBICACIÓN *</div>

        {/* Botón desplegable de ubicaciones */}
        <button onClick={() => setShowUbic(p => !p)} style={{ width:"100%", padding:"11px 14px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`1px solid ${showUbic ? "#38bdf8" : "rgba(255,255,255,0.15)"}`, borderRadius: showUbic ? "10px 10px 0 0" : "10px", color:"rgba(255,255,255,0.7)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0", boxSizing:"border-box" }}>
          <span>📍 Seleccionar ubicación predefinida</span>
          <span style={{ fontSize:"10px", color:"#38bdf8", transform: showUbic ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▼</span>
        </button>

        {showUbic && (
          <div style={{ background:"#060e1a", border:"1px solid #38bdf855", borderTop:"none", borderRadius:"0 0 10px 10px", maxHeight:"320px", overflowY:"auto", marginBottom:"8px" }}>
            {UBICACIONES_REPORTE.map(grupo => (
              <div key={grupo.grupo}>
                <button onClick={() => setGrupoOpen(p => p === grupo.grupo ? null : grupo.grupo)} style={{ width:"100%", padding:"10px 14px", background: grupoOpen===grupo.grupo ? "#1e3a5f" : "transparent", border:"none", borderBottom:"1px solid #1e3a5f22", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), fontSize:"11px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px", textAlign:"left" }}>
                  <span>{grupo.icon}</span>
                  <span style={{ flex:1 }}>{grupo.grupo}</span>
                  <span style={{ fontSize:"9px", opacity:0.6 }}>{grupoOpen===grupo.grupo ? "▲" : "▼"}</span>
                </button>
                {grupoOpen === grupo.grupo && grupo.opciones.map(op => (
                  <button key={op} onClick={() => { setLocation(op); setShowUbic(false); setGrupoOpen(null); }} style={{ width:"100%", padding:"9px 14px 9px 34px", background: location===op ? "#38bdf822" : "transparent", border:"none", borderBottom:"1px solid #0d1b2e", color: location===op ? "#38bdf8" : "rgba(255,255,255,0.65)", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"6px" }}>
                    {location===op && <span style={{ color:"#38bdf8", fontSize:"10px" }}>✓</span>}
                    {op}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Campo de texto para detalles adicionales */}
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="O escribe la ubicación / añade detalle (km, carril, referencia...)"
          style={{ width:"100%", padding:"11px 14px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"10px", color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", boxSizing:"border-box", outline:"none", marginTop:"8px" }}
        />
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
            </div>
          </div>
        </div>
      )}

      <button onClick={submit} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#0369a1,#0ea5e9)", border:"none", borderRadius:"12px", color:"#fff", fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"13px", cursor:"pointer", letterSpacing:"1px", marginBottom:"20px" }}>ENVIAR REPORTE →</button>

      {pendingMine.length > 0 && (
        <>
          <SectionLabel text="REPORTES PENDIENTES DE VERIFICACIÓN" />
          {pendingMine.map(inc => {
            const t      = incType(inc.type);
            const myVote = inc.votes[myId];
            const conf   = Object.values(inc.votes).filter(v=>v===1).length;
            const falsos = Object.values(inc.votes).filter(v=>v===-1).length;
            const borderC = falsos > conf && falsos >= 2 ? "#ef4444" : conf >= 2 ? "#22c55e" : "#f97316";
            return (
              <div key={inc.id} style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:`2px solid ${borderC}`, borderRadius:"12px", padding:"12px", marginBottom:"10px", transition:"border-color 0.3s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
                  <div style={{ display:"flex", gap:"8px", flex:1 }}>
                    <span style={{ fontSize:"20px" }}>{t.icon}</span>
                    <div>
                      <div style={{ color:"rgba(255,255,255,0.95)", fontFamily:getFont(theme, "secondary"), fontSize:"12px", fontWeight:"700" }}>{inc.location}</div>
                      {inc.desc && <div style={{ color:"rgba(255,255,255,0.6)", fontSize:"11px", marginTop:"2px" }}>{inc.desc}</div>}
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"10px", fontFamily:getFont(theme, "secondary"), marginTop:"3px" }}>{timeAgo(inc.ts)}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
                    <Badge color={borderC} small>PENDIENTE</Badge>
                    <div style={{ fontSize:"9px", fontFamily:getFont(theme, "secondary"), color:"rgba(255,255,255,0.4)" }}>✓{conf} ✗{falsos}</div>
                  </div>
                </div>
                <VoteBar count={conf} needed={15} />
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px", marginTop:"10px" }}>
                  <button onClick={async () => {
                    const votes = { ...inc.votes, [myId]: 1 };
                    const visible = Object.values(votes).filter(v=>v===1).length >= 15;
                    await sb.from("incidents").update({ votes, visible }).eq("id", inc.id);
                    notify(visible ? "✅ Reporte verificado" : `✓ Confirmado (${Object.values(votes).filter(v=>v===1).length}/15)`, "#22c55e");
                  }} style={{ padding:"9px 4px", background: myVote===1?"#22c55e33":"#16a34a15", border:`1px solid ${myVote===1?"#22c55e":"#16a34a44"}`, borderRadius:"8px", color:"#22c55e", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>✅</span>
                    <span>CONFIRMO</span>
                  </button>
                  <button onClick={async () => {
                    const votes = { ...inc.votes, [myId]: -1 };
                    await sb.from("incidents").update({ votes }).eq("id", inc.id);
                    notify("✗ Marcado como falso", "#ef4444");
                  }} style={{ padding:"9px 4px", background: myVote===-1?"#ef444433":"#ef444415", border:`1px solid ${myVote===-1?"#ef4444":"#ef444444"}`, borderRadius:"8px", color:"#ef4444", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>❌</span>
                    <span>FALSO</span>
                  </button>
                  <button onClick={async () => {
                    const rv = { ...inc.resolveVotes, [myId]: 1 };
                    const resolved = Object.keys(rv).length >= 15;
                    await sb.from("incidents").update({ resolve_votes: rv, resolved }).eq("id", inc.id);
                    notify(resolved ? "✓ Marcado como resuelto" : `Voto (${Object.keys(rv).length}/15)`, "#6b7280");
                  }} style={{ padding:"9px 4px", background:"#6b728015", border:"1px solid #6b728044", borderRadius:"8px", color:"#94a3b8", fontFamily:getFont(theme, "secondary"), fontSize:"11px", cursor:"pointer", fontWeight:"700", display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
                    <span style={{ fontSize:"16px" }}>🏁</span>
                    <span>RESUELTO</span>
                  </button>
                </div>
                {myVote !== undefined && (
                  <div style={{ fontSize:"9px", color: myVote===1?"#22c55e":"#ef4444", fontFamily:getFont(theme, "secondary"), marginTop:"6px", textAlign:"center" }}>
                    {myVote===1 ? "✓ Confirmaste este reporte" : "✗ Lo marcaste como falso"}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      <ToastBox toast={toast} />
    </div>
  );
}

// ─── TAB: TERMINALES ──────────────────────────────────────────────────────────
// ─── TICKER MÁQUINA DE ESCRIBIR ───────────────────────────────────────────────
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

// ─── TAB: SEGUNDO ACCESO ──────────────────────────────────────────────────────
// ─── SLOT TEXT ───────────────────────────────────────────────────────────────
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
const mkSegundoIngreso = () => ({});
const mkConfinadaState = () => ({});
function SegundoAccesoTab() {
  const theme = React.useContext(ThemeContext);
  const [subTab, setSubTab] = useState("segundo");

  // ── Estado 2DO ACCESO ──
  const [carriles, setCarriles] = useState(mkSegundoIngreso);
  // ── Estado CONFINADA ──
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

  // ── Handlers 2DO ACCESO ──
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

  // ── Handlers CONFINADA ──
  const updateConfinada = async (id, field, value) => {
    if (!confinada) return;
    const next = { ...confinada, [id]: { ...confinada[id], [field]: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setConfinada(next);
    await saveConfinada(next);
    notify("✓ Carril Confinada actualizado", "#a78bfa");
    const carrilDef = CONFINADA_CARRILES.find(c => c.id === id);
    const fieldLabel = field === "saturado" ? (value ? "Saturado" : "Libre") : field === "transferencia" ? (value ? "Transferencia Aduana" : "Normal") : (value ? "Con Retornos" : "Sin Retornos");
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

      {/* ── Header principal ── */}
      <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:getFont(theme, "secondary"), letterSpacing:"2px", marginBottom:"4px" }}>CONFINADOS — PUERTO MANZANILLO</div>
        <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>2do Acceso y zona confinada · Ingreso con terminal asignada.</div>
      </div>

      {/* ── Sub-tab selector ── */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
        {[
          { id:"segundo",   label:"2DO ACCESO", icon:"🛣️",  color:"#34d399" },
          { id:"confinada", label:"CONFINADA",  icon:"🔒", color:"#a78bfa" },
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

      {/* ════════════════════════════════════════════════════
          SUB-TAB: 2DO ACCESO
      ════════════════════════════════════════════════════ */}
      {subTab === "segundo" && <>
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px", padding:"14px", marginBottom:"18px" }}>
          <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"10px" }}>DIAGRAMA — VISTA RÁPIDA</div>
          <div style={{ display:"flex", gap:"8px" }}>
            {SEGUNDO_CARRILES_INGRESO.map((c, i) => {
              const st = carriles[c.id];
              const bc = st.saturado ? "#ef4444" : "#22c55e";
              const tz = getTermZona(st.terminal);
              const tc = tz === "Todas" ? "#fbbf24" : tz === "Norte" ? "#38bdf8" : "#a78bfa";
              return (
                <div key={c.id} style={{ flex:1, background:bc+"15", border:`2px solid ${bc}`, borderRadius:"10px", padding:"12px 6px", textAlign:"center", display:"flex", flexDirection:"column", gap:"6px", justifyContent:"center" }}>
                  <div style={{ color:"rgba(255,255,255,0.85)", fontFamily:getFont(theme, "secondary"), fontSize:"clamp(13px,2.5vw,18px)", fontWeight:"800", letterSpacing:"1px" }}>{c.label}</div>
                  <div style={{ background:tc+"22", border:`1px solid ${tc}55`, borderRadius:"6px", padding:"4px 4px" }}>
                    <SlotText value={getTermName(st.terminal)} color={tc} fontSize="clamp(10px,1.8vw,14px)" delay={i * 180} />
                  </div>
                  {st.retornos && <div style={{ fontSize:"14px" }}>↩</div>}
                  <div>
                    <SlotText value={st.saturado ? "SAT" : "OK"} color={bc} fontSize="clamp(12px,2vw,16px)" delay={i * 180 + 90} />
                  </div>
                </div>
              );
            })}
            {carriles && <div style={{ flex:1, background: carriles.c4.saturado?"#ef444415":"#f9731615", border:`2px solid ${carriles.c4.saturado?"#ef4444":"#f97316"}`, borderRadius:"10px", padding:"12px 6px", textAlign:"center", display:"flex", flexDirection:"column", gap:"6px", justifyContent:"center" }}>
              <div style={{ color:"rgba(255,255,255,0.85)", fontFamily:getFont(theme, "secondary"), fontSize:"clamp(13px,2.5vw,18px)", fontWeight:"800", letterSpacing:"1px" }}>C4</div>
              <div style={{ fontSize:"clamp(10px,1.8vw,14px)", color:"#f97316", fontFamily:getFont(theme, "secondary"), fontWeight:"700" }}>SALIDA</div>
              <div>
                <SlotText value={carriles.c4.saturado ? "SAT" : "OK"} color={carriles.c4.saturado?"#ef4444":"#22c55e"} fontSize="clamp(12px,2vw,16px)" delay={540} />
              </div>
            </div>}
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:"10px", marginTop:"10px", flexWrap:"wrap" }}>
            {[["#22c55e","LIBRE"],["#ef4444","SATURADO"],["#f59e0b","T. LENTO"],["#dc2626","T. DETENIDO"],["#fbbf24","GENERAL"],["#38bdf8","ZONA NORTE"],["#a78bfa","ZONA SUR"]].map(([c,l]) => (
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
      </>}

      {/* ════════════════════════════════════════════════════
          SUB-TAB: CONFINADA
      ════════════════════════════════════════════════════ */}
      {subTab === "confinada" && <>
        {/* Diagrama rápido */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:"12px", padding:"14px", marginBottom:"18px" }}>
          <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"10px" }}>DIAGRAMA — VISTA RÁPIDA</div>
          <div style={{ display:"flex", gap:"8px" }}>
            {CONFINADA_CARRILES.map((c, i) => {
              const st = confinada[c.id];
              const sinUso = st.terminal === "sin_uso";
              const esGeneral = st.terminal === "general";
              const bc = sinUso ? "#6b7280" : st.saturado ? "#ef4444" : st.transferencia ? "#fbbf24" : "#22c55e";
              const tc = esGeneral ? "#fbbf24" : "#a78bfa";
              return (
                <div key={c.id} style={{ flex:1, background:bc+"15", border:`2px solid ${bc}`, borderRadius:"10px", padding:"12px 6px", textAlign:"center", display:"flex", flexDirection:"column", gap:"6px", justifyContent:"center" }}>
                  <div style={{ color:"rgba(255,255,255,0.85)", fontFamily:getFont(theme, "secondary"), fontSize:"clamp(13px,2.5vw,18px)", fontWeight:"800", letterSpacing:"1px" }}>{c.label}</div>
                  {sinUso
                    ? <div style={{ background:"#6b728022", border:"1px solid #6b728055", borderRadius:"6px", padding:"4px 4px" }}>
                        <SlotText value="SIN USO" color="#9ca3af" fontSize="clamp(10px,1.8vw,14px)" delay={i * 180} />
                      </div>
                    : <div style={{ background:tc+"22", border:`1px solid ${tc}55`, borderRadius:"6px", padding:"4px 4px" }}>
                        <SlotText value={getTermName(st.terminal)} color={tc} fontSize="clamp(10px,1.8vw,14px)" delay={i * 180} />
                      </div>
                  }
                  {!sinUso && st.transferencia && <div style={{ fontSize:"11px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontWeight:"700" }}>🔄 TRANS.</div>}
                  {!sinUso && st.retornos && <div style={{ fontSize:"14px" }}>↩</div>}
                  <div>
                    <SlotText value={sinUso ? "N/A" : st.saturado ? "SAT" : st.transferencia ? "TRANS" : "OK"} color={bc} fontSize="clamp(12px,2vw,16px)" delay={i * 180 + 90} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:"10px", marginTop:"10px", flexWrap:"wrap" }}>
            {[["#22c55e","LIBRE"],["#ef4444","SATURADO"],["#fbbf24","GENERAL/TRANS."],["#a78bfa","ZONA SUR"],["#6b7280","SIN USO"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                <div style={{ width:"8px", height:"8px", background:c, borderRadius:"2px" }} />
                <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary") }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

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
                    {st.transferencia && st.terminal !== "sin_uso" && <Badge color="#fbbf24" small>🔄 ADUANA</Badge>}
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
                <div style={{ fontSize:"10px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), letterSpacing:"1px", marginBottom:"8px", fontWeight:"700" }}>🔄 TRANSFERENCIA DE ADUANA</div>
                <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.5)", fontFamily:getFont(theme, "secondary"), marginBottom:"8px" }}>Indica si este carril es utilizado para transferencias aduanales.</div>
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
const mkCarrilesState = () => ({});
const ACCESOS_CARRILES = ACCESS_POINTS.map(acc => ({
  ...acc,
  carriles: (acc.lanes || []).map(lane => ({
    ...lane,
    tipo: lane.tipo || "expo"
  }))
}));
// ─── TAB: CARRILES ────────────────────────────────────────────────────────────
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
  const expoCarriles = (currentAcc?.carriles || []).filter(c => c.tipo === "expo");
  const impoCarriles = (currentAcc?.carriles || []).filter(c => c.tipo === "impo");
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
          const carriles = acc.carriles || [];
          const total = carriles.length;
          const abiertos = carriles.filter(c => estado[c.id]?.abierto !== false).length;
          const pct = total > 0 ? Math.round((abiertos / total) * 100) : 0;
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

// ─── TAB: NOTICIAS ────────────────────────────────────────────────────────────
// ─── VISOR FULLSCREEN ─────────────────────────────────────────────────────────
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


// ─── SUBIR COMUNICADO (con fechas y aprobación) ──────────────────────────────
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

// ─── SECCIÓN COMUNICADOS (con sub-tabs: Ver / Proponer) ──────────────────────
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

      {/* ── MODAL CONFIRMACIÓN ELIMINAR ── position:fixed cubre toda la pantalla sin necesitar portal */}
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

      {/* ── SUB-TAB: VER COMUNICADOS ── */}
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

      {/* ── SUB-TAB: PROPONER / PUBLICAR ── */}
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

          {/* ── PENDIENTES DE APROBACIÓN (solo admin) ── */}
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

// ─── TAB: NOTICIAS ────────────────────────────────────────────────────────────
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

      {/* ── SECCIÓN NOTICIAS ── */}
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

      {/* ── SECCIÓN COMUNICADOS ── */}
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

// ─── TAB: DONATIVOS ───────────────────────────────────────────────────────────
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

// ─── TAB: PATIO REGULADOR ─────────────────────────────────────────────────────
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

// ─── TAB: TUTORIAL ────────────────────────────────────────────────────────────
function TutorialTab({ setActive, isAdmin }) {
  const theme = React.useContext(ThemeContext);
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen(prev => prev === id ? null : id);

  // ── Auth panel state ──
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

  // ── LOGIN con correo/contraseña real ──
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

  // ── LOGIN con Google ──
  const handleLoginGoogle = async () => {
    setLoading(true); setLoginMsg(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href }
    });
    if (error) { setLoginMsg({type:"err", text:"Error al conectar con Google: " + error.message}); setLoading(false); }
  };

  // ── ENVIAR OTP por SMS ──
  const handleEnviarOtp = async () => {
    const tel = regTel.trim();
    if (!tel.match(/^\+[0-9]{10,15}$/)) { setRegMsg({type:"err", text:"Número inválido. Usa formato internacional: +521XXXXXXXXXX"}); return; }
    setLoading(true); setRegMsg(null);
    const { error } = await sb.auth.signInWithOtp({ phone: tel });
    setLoading(false);
    if (error) { setRegMsg({type:"err", text:"Error al enviar SMS: " + error.message}); }
    else { setOtpEnviado(true); setRegMsg({type:"ok", text:"✅ Código enviado por SMS. Revisa tu teléfono."}); }
  };

  // ── VERIFICAR OTP ──
  const handleVerificarOtp = async () => {
    if (regOtp.length < 6) { setRegMsg({type:"err", text:"El código debe tener 6 dígitos"}); return; }
    setLoading(true); setRegMsg(null);
    const { error } = await sb.auth.verifyOtp({ phone: regTel.trim(), token: regOtp, type: "sms" });
    setLoading(false);
    if (error) { setRegMsg({type:"err", text:"Código incorrecto o expirado. Inténtalo de nuevo."}); }
    else { setRegMsg({type:"ok", text:"✅ Teléfono verificado correctamente."}); setRegStep(3); }
  };

  // ── REGISTRO completo con Supabase ──
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

  // ── RECUPERAR CONTRASEÑA real ──
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

      {/* ══════════════════════════════════════════════════════
          PANEL DE AUTENTICACIÓN
      ══════════════════════════════════════════════════════ */}
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

        {/* ── LOGIN ── */}
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

        {/* ── REGISTRO MULTI-PASO ── */}
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

        {/* ── RECUPERAR CONTRASEÑA ── */}
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
      {/* ── fin panel auth ── */}

      {/* ══════════════════════════════════════════════════════
          GUÍA DE USO
      ══════════════════════════════════════════════════════ */}
      <div style={{ textAlign:"center", marginBottom:"24px" }}>
        <div style={{ fontSize:"36px", marginBottom:"10px" }}>📖</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontWeight:"700", fontSize:"14px", letterSpacing:"2px", color:"rgba(255,255,255,0.95)", marginBottom:"6px" }}>MÁS INFORMACIÓN</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px" }}>PUERTO TRÁFICO · MANZANILLO</div>
        <div style={{ width:"40px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"12px auto 0" }} />
      </div>
      {sections.map(sec => (
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
                  <p style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.5)", lineHeight:"1.8", paddingLeft:"11px" }}>{item.desc}</p>
                </div>
              ))}
              {!["registro","login","password"].includes(sec.id) && (<button onClick={() => setActive(sec.id)} style={{ width:"100%", marginTop:"14px", padding:"10px", background:`${sec.color}22`, border:`1px solid ${sec.color}55`, borderRadius:"8px", color:sec.color, fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", letterSpacing:"1px" }}>IR A {sec.title} →</button>)}
            </div>
          )}
        </div>
      ))}
      {/* ══════════════════════════════════════════════════════
          ENCUESTA DE SATISFACCIÓN
      ══════════════════════════════════════════════════════ */}
      <EncuestaSatisfaccion isAdmin={isAdmin} />

      <div style={{ textAlign:"center", marginTop:"24px", padding:"14px", background:"rgba(255,255,255,0.08)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ fontSize:"20px", marginBottom:"6px" }}>⚓</div>
        <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.3)", lineHeight:"1.8" }}>Puerto Tráfico es una herramienta colaborativa.<br/><span style={{ color:"#38bdf8" }}>Tu información hace la diferencia.</span></div>
      </div>
    </div>
  );
}

// ─── ENCUESTA DE SATISFACCIÓN ─────────────────────────────────────────────────
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
      {/* ── Botón trigger ── */}
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

          {/* ── VISTA ADMIN ── */}
          {isAdmin && !adminView && step !== "thanks" && (
            <div style={{ padding:"12px 16px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:"4px" }}>
              <button onClick={handleAdminView} style={{ padding:"7px 14px", background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.35)", borderRadius:"8px", color:"#fbbf24", fontFamily:getFont(theme, "secondary"), fontSize:"10px", fontWeight:"700", cursor:"pointer", letterSpacing:"0.5px" }}>
                🔑 VER RESPUESTAS (SOLO ADMIN)
              </button>
            </div>
          )}

          {/* ── Panel de respuestas admin ── */}
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

          {/* ── FORMULARIO PÚBLICO ── */}
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

          {/* ── GRACIAS ── */}
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

// ─── TAB: REDES SOCIALES ──────────────────────────────────────────────────────
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

      {/* ─── ANIMACIÓN CONVOY ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <ConvoyScene accentColor="#38bdf8" />
      </div>

      {/* ─── REDES SOCIALES ──────────────────────────────────────────────────── */}
      <div style={{ fontFamily:getFont(theme, "secondary"), fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"2px", fontWeight:"600", marginBottom:"14px", paddingLeft:"2px" }}>SÍGUENOS · COMUNIDAD</div>

      {/* ── WhatsApp Channel ─────────────────────────────────── */}
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

      {/* ── Facebook Group ───────────────────────────────────── */}
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

      {/* ── Facebook Page ────────────────────────────────────── */}
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

      {/* ── Instagram ──────────────────────────────────────── */}
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

// ─── APP (RAÍZ) ───────────────────────────────────────────────────────────────
// ✅ FIX PRINCIPAL: hooks declarados DENTRO del cuerpo de la función, no en los parámetros

function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef(null);

  useEffect(() => {
    try {
      setIsAdmin(localStorage.getItem(ADMIN_KEY) === "true");
    } catch {
      setIsAdmin(false);
    }

    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    };
  }, []);

  const handleLogoTap = () => {
    if (isAdmin) return;

    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    setClickCount((prev) => {
      const next = prev + 1;

      if (next >= 7) {
        setTimeout(() => setOpenModal(true), 0);
        return 0;
      }

      return next;
    });

    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 3000);
  };

  const logout = () => {
    try {
      localStorage.removeItem(ADMIN_KEY);
    } catch {}
    setIsAdmin(false);
    setOpenModal(false);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleSubmit = async (password) => {
    const ok = await verifyAdminPass(password);
    if (!ok) {
      alert("Contraseña incorrecta");
      return;
    }

    try {
      localStorage.setItem(ADMIN_KEY, "true");
    } catch {}

    setIsAdmin(true);
    setOpenModal(false);
  };

  const Modal = openModal ? (
    <AdminLoginModal
      onClose={handleCloseModal}
      onSubmit={handleSubmit}
    />
  ) : null;

  return {
    isAdmin,
    handleLogoTap,
    openModal,
    logout,
    Modal,
  };
}
function App() {
  // ✨ HOOK DE ESCALADO RESPONSIVE
  const { scale, isMobile } = useResponsiveFontScale();
  const fs = (size) => Math.round(size * scale);
  
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

  // ── Sesión de usuario Supabase Auth ──
  const [authUser, setAuthUser] = useState(null);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  
  // ── Widget de Soporte WhatsApp ──
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
        <div style={{ background:"rgba(255,255,255,0.08)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", gap: `${fs(12)}px` }}>
          <img src="data:image/png;base64,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" alt="Conect Manzanillo" style={{ width: `${fs(48)}px`, height: `${fs(48)}px`, objectFit:"contain", flexShrink:0 }} />
          <div>
            <div style={{ fontFamily:getFont(theme, "title"), fontWeight:"700", fontSize: `${fs(17)}px`, letterSpacing:"0.5px", color:"#ffffff" }}>Conect Manzanillo</div>
            <div style={{ fontSize: `${fs(10)}px`, color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif", letterSpacing:"1px", fontWeight:"300" }}>COMUNIDAD EN VIVO · PUERTO</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap: `${fs(5)}px`, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap: `${fs(6)}px` }}>
              <div style={{ width: `${fs(7)}px`, height: `${fs(7)}px`, background:"#4ade80", borderRadius:"50%", boxShadow:"0 0 8px #4ade80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize: `${fs(10)}px`, color:"#4ade80", fontFamily:"'DM Sans',sans-serif", fontWeight:"600" }}>EN VIVO</span>
              {isAdmin && (
                <div title="Sesión admin activa" style={{ display:"flex", alignItems:"center", gap: `${fs(3)}px`, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.4)", borderRadius: `${fs(5)}px`, padding:"1px 6px", marginLeft:"2px" }}>
                  <span style={{ fontSize: `${fs(11)}px` }}>🔑</span>
                  <span style={{ fontSize: `${fs(9)}px`, color:"#fbbf24", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>ADMIN</span>
                </div>
              )}
              {!isAdmin && authUser && (
                <div
                  onClick={() => setShowSessionMenu(v => !v)}
                  style={{ display:"flex", alignItems:"center", gap: `${fs(3)}px`, background: showSessionMenu ? "rgba(56,189,248,0.22)" : "rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.35)", borderRadius: `${fs(5)}px`, padding:"1px 6px", marginLeft:"2px", cursor:"pointer", userSelect:"none", transition:"background 0.2s" }}
                >
                  <span style={{ fontSize: `${fs(11)}px` }}>👤</span>
                  <span style={{ fontSize: `${fs(9)}px`, color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>SESIÓN</span>
                  <span style={{ fontSize: `${fs(8)}px`, color:"#38bdf8", marginLeft:"1px" }}>{showSessionMenu ? "▲" : "▼"}</span>
                </div>
              )}
            </div>
            {visitas !== null && (
              <div style={{ display:"flex", alignItems:"center", gap: `${fs(4)}px`, background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.25)", borderRadius: `${fs(6)}px`, padding:"2px 7px" }}>
                <span style={{ fontSize: `${fs(10)}px` }}>👁</span>
                <span style={{ fontSize: `${fs(10)}px`, color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", fontWeight:"700", letterSpacing:"0.5px" }}>{visitas.toLocaleString()}</span>
                <span style={{ fontSize: `${fs(9)}px`, color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans',sans-serif" }}>visitas</span>
              </div>
            )}
          </div>
        </div>

        <NavBar active={active} set={setActive} />

      {/* 
<AnunciosList
  lista={...}
  setLista={...}
  onEdit={...}
  onDelete={...}
  onToggle={...}
  isReordering={...}
/> 
*/}

        {active === "inicio"      && <InicioTab isAdmin={isAdmin} logout={logout} onOpenAdminModal={openModal} onOpenThemeConfig={() => setShowThemeConfig(true)} />}
        {active === "trafico"    && <TraficoTab    myId={myId} incidents={incidents} setIncidents={setIncidents} isAdmin={isAdmin} />}
        {active === "reporte"    && <ReporteTab    myId={myId} incidents={incidents} setIncidents={setIncidents} setActiveTab={setActive} />}
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
        
       {/* <DonateBanner active={active} /> */}
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
          style={{ position:"fixed", top:"62px", right:"12px", background:"#0d1f3c", border:"1px solid rgba(56,189,248,0.3)", borderRadius: `${fs(12)}px`, padding: `${fs(10)}px`, minWidth:"190px", zIndex:99999, boxShadow:"0 12px 40px rgba(0,0,0,0.8)" }}
        >
          <div style={{ fontSize: `${fs(10)}px`, color:"rgba(255,255,255,0.4)", fontFamily:"'DM Sans',sans-serif", padding:"2px 6px 8px", borderBottom:"1px solid rgba(255,255,255,0.08)", marginBottom:"8px", wordBreak:"break-all" }}>
            {authUser.email}
          </div>
          <button
            onClick={handleSignOut}
            style={{ width:"100%", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius: `${fs(8)}px`, padding:"10px 12px", color:"#ef4444", fontFamily:"'DM Sans',sans-serif", fontSize: `${fs(12)}px`, fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap: `${fs(6)}px`, letterSpacing:"0.5px" }}
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
            gap: `${fs(12)}px`,
            alignItems: "flex-end"
          }}>
            {/* Burbuja: Soporte WhatsApp */}
            <div
              onClick={() => setShowQRPanel(showQRPanel === 'whatsapp' ? null : 'whatsapp')}
              style={{
                display: "flex",
                alignItems: "center",
                gap: `${fs(12)}px`,
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
                borderRadius: `${fs(20)}px`,
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(13)}px`,
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Soporte WhatsApp
              </div>
              <div style={{
                width: `${fs(48)}px`,
                height: `${fs(48)}px`,
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: `${fs(24)}px`,
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
                gap: `${fs(12)}px`,
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
                borderRadius: `${fs(20)}px`,
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(13)}px`,
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Página Facebook
              </div>
              <div style={{
                width: `${fs(48)}px`,
                height: `${fs(48)}px`,
                background: "linear-gradient(135deg, #1877F2 0%, #0D5DBE 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(24, 119, 242, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: `${fs(24)}px`,
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
                gap: `${fs(12)}px`,
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
                borderRadius: `${fs(20)}px`,
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(13)}px`,
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Canal WhatsApp
              </div>
              <div style={{
                width: `${fs(48)}px`,
                height: `${fs(48)}px`,
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(18, 140, 126, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: `${fs(24)}px`,
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
                gap: `${fs(12)}px`,
                cursor: "pointer",
                animation: "bubbleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                animationDelay: "0.2s",
                opacity: 0
              }}
            >
              <div style={{
                background: "rgba(13, 31, 60, 0.95)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: `${fs(20)}px`,
                padding: "8px 16px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(13)}px`,
                fontWeight: "600",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
              }}>
                Donar (Mifel)
              </div>
              <div style={{
                width: `${fs(48)}px`,
                height: `${fs(48)}px`,
                background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(168, 85, 247, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                fontSize: `${fs(24)}px`,
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
            width: `${fs(56)}px`,
            height: `${fs(56)}px`,
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
            fontSize: `${fs(28)}px`, 
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
              borderRadius: `${fs(16)}px`,
              padding: `${fs(20)}px`,
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
              gap: `${fs(10)}px`,
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: `${fs(36)}px`,
                height: `${fs(36)}px`,
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: `${fs(20)}px`
              }}>
                💬
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: `${fs(16)}px`,
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Soporte Técnico
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: `${fs(11)}px`,
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
                  width: `${fs(24)}px`,
                  height: `${fs(24)}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: `${fs(16)}px`,
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
              borderRadius: `${fs(12)}px`,
              padding: `${fs(12)}px`,
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
                gap: `${fs(10)}px`,
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                border: "none",
                borderRadius: `${fs(12)}px`,
                padding: "14px 20px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(14)}px`,
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
              fontSize: `${fs(10)}px`,
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
              borderRadius: `${fs(16)}px`,
              padding: `${fs(20)}px`,
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
              gap: `${fs(10)}px`,
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: `${fs(36)}px`,
                height: `${fs(36)}px`,
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: `${fs(20)}px`
              }}>
                📢
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: `${fs(16)}px`,
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Canal WhatsApp
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: `${fs(11)}px`,
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
                  width: `${fs(24)}px`,
                  height: `${fs(24)}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: `${fs(16)}px`,
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
              borderRadius: `${fs(12)}px`,
              padding: `${fs(12)}px`,
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
                gap: `${fs(10)}px`,
                background: "linear-gradient(135deg, #128C7E 0%, #075E54 100%)",
                border: "none",
                borderRadius: `${fs(12)}px`,
                padding: "14px 20px",
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(14)}px`,
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
              fontSize: `${fs(10)}px`,
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
              borderRadius: `${fs(16)}px`,
              padding: `${fs(20)}px`,
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
              gap: `${fs(10)}px`,
              marginBottom: "16px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
            }}>
              <div style={{
                width: `${fs(36)}px`,
                height: `${fs(36)}px`,
                background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: `${fs(20)}px`
              }}>
                💝
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: "#fff",
                  fontFamily: getFont(theme, "title"),
                  fontSize: `${fs(16)}px`,
                  fontWeight: "700",
                  lineHeight: 1.2
                }}>
                  Apoya el Proyecto
                </div>
                <div style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontFamily: getFont(theme, "secondary"),
                  fontSize: `${fs(11)}px`,
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
                  width: `${fs(24)}px`,
                  height: `${fs(24)}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: `${fs(16)}px`,
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
              borderRadius: `${fs(12)}px`,
              padding: `${fs(16)}px`,
              marginBottom: "16px"
            }}>
              <div style={{
                color: "#fff",
                fontFamily: getFont(theme, "secondary"),
                fontSize: `${fs(12)}px`,
                marginBottom: "12px",
                fontWeight: "600",
                textAlign: "center"
              }}>
                Datos para transferencia:
              </div>
              
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: `${fs(8)}px`
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{
                    color: "rgba(255, 255, 255, 0.6)",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: `${fs(11)}px`
                  }}>
                    Banco:
                  </span>
                  <span style={{
                    color: "#fff",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: `${fs(12)}px`,
                    fontWeight: "600"
                  }}>
                    Mifel
                  </span>
                </div>
                
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{
                    color: "rgba(255, 255, 255, 0.6)",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: `${fs(11)}px`
                  }}>
                    Titular:
                  </span>
                  <span style={{
                    color: "#fff",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: `${fs(12)}px`,
                    fontWeight: "600"
                  }}>
                    Ramon Romero
                  </span>
                </div>
                
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: `${fs(8)}px`,
                  padding: "8px 12px",
                  marginTop: "4px"
                }}>
                  <span style={{
                    color: "rgba(255, 255, 255, 0.6)",
                    fontFamily: getFont(theme, "secondary"),
                    fontSize: `${fs(11)}px`
                  }}>
                    CLABE:
                  </span>
                  <span style={{
                    color: "#A855F7",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: `${fs(13)}px`,
                    fontWeight: "700",
                    letterSpacing: "0.5px"
                  }}>
                    014028090014825779
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: getFont(theme, "secondary"),
              fontSize: `${fs(10)}px`,
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
