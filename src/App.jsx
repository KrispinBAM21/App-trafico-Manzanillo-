import React, { useState, useEffect, useRef, createContext, useContext } from "react";
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
// Parseo robusto de fechas: acepta ms numérico, string numérico o ISO string
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  if (!isNaN(n) && n > 1e12) return n;   // string "1741826400000"
  return new Date(v).getTime();           // ISO string "2026-03-12T..."
};

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
  bgType: "gradient",
  bgGradient: "linear-gradient(135deg, #0a1628 0%, #1a2332 50%, #0d1b2a 100%)",
  bgImage: "",
  bgBlur: 0,
  
  // Iconos de tabs
  tabIcons: {
    inicio: "🏠",
    trafico: "🚗",
    reporte: "📢",
    terminales: "🏭",
    patio: "📦",
    segundo: "🛣️",
    carriles: "🚦",
    noticias: "📰",
    donativos: "💝",
    tutorial: "🎓"
  },
  
  // Tipografías
  fontTitle: "'Playfair Display', serif",
  fontSecondary: "'DM Sans', sans-serif",
  fontSizeMultiplier: 1.0,
  
  // Ventanas
  windowBlur: 12,
  windowOpacity: 0.95
};

// ✅ HELPER FUNCTIONS QUE RECIBEN theme COMO PARÁMETRO
const getFont = (themeObj, type) => {
  if (!themeObj) return type === "title" ? DEFAULT_THEME.fontTitle : DEFAULT_THEME.fontSecondary;
  return type === "title" ? themeObj.fontTitle : themeObj.fontSecondary;
};

const getBackdrop = (themeObj) => {
  if (!themeObj) return `blur(${DEFAULT_THEME.windowBlur}px)`;
  return `blur(${themeObj.windowBlur || DEFAULT_THEME.windowBlur}px)`;
};

const getFontSize = (themeObj, baseSize) => {
  if (!themeObj) return `${baseSize}px`;
  const multiplier = themeObj.fontSizeMultiplier || 1.0;
  return `${baseSize * multiplier}px`;
};

const getWindowOpacity = (themeObj) => {
  if (!themeObj) return DEFAULT_THEME.windowOpacity;
  return themeObj.windowOpacity || DEFAULT_THEME.windowOpacity;
};

// ✅ CONTEXT
const ThemeContext = createContext(DEFAULT_THEME);
const useTheme = () => useContext(ThemeContext);

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const loadThemeFromStorage = () => {
  try {
    const stored = localStorage.getItem("cm_user_theme");
    if (!stored) return DEFAULT_THEME;
    const parsed = JSON.parse(stored);
    // Merge con defaults para asegurar que todas las propiedades existan
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
};

const saveThemeToStorage = (theme) => {
  try {
    localStorage.setItem("cm_user_theme", JSON.stringify(theme));
  } catch (e) {
    console.error("Error guardando tema:", e);
  }
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

// ✅ WindowCard: Card con soporte de tema dinámico
function WindowCard({ title, children, style = {}, titleIcon = "" }) {
  const theme = useTheme();
  
  return (
    <div
      style={{
        background: `rgba(13,31,60,${getWindowOpacity(theme)})`,
        backdropFilter: getBackdrop(theme),
        WebkitBackdropFilter: getBackdrop(theme),
        border: "1px solid rgba(56,189,248,0.15)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        ...style
      }}
    >
      {title && (
        <h2
          style={{
            fontFamily: getFont(theme, "title"),
            fontSize: getFontSize(theme, 26),
            fontWeight: "700",
            color: "#ffffff",
            marginBottom: "18px",
            letterSpacing: "0.5px"
          }}
        >
          {titleIcon && <span style={{ marginRight: "8px" }}>{titleIcon}</span>}
          {title}
        </h2>
      )}
      <div style={{ fontFamily: getFont(theme, "secondary") }}>
        {children}
      </div>
    </div>
  );
}

// ✅ NavBar con iconos dinámicos
function NavBar({ active, set }) {
  const theme = useTheme();
  
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        padding: "10px 12px",
        background: `rgba(13,31,60,${getWindowOpacity(theme) * 0.85})`,
        backdropFilter: getBackdrop(theme),
        WebkitBackdropFilter: getBackdrop(theme),
        borderRadius: "14px",
        marginBottom: "18px",
        border: "1px solid rgba(56,189,248,0.12)",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(56,189,248,0.3) transparent"
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        // Usar icono del tema o el icono por defecto
        const icon = (theme.tabIcons && theme.tabIcons[key]) || DEFAULT_THEME.tabIcons[key];
        
        return (
          <button
            key={key}
            onClick={() => set(key)}
            style={{
              background: isActive
                ? "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)"
                : "rgba(56,189,248,0.08)",
              border: isActive
                ? "1px solid rgba(56,189,248,0.5)"
                : "1px solid rgba(56,189,248,0.15)",
              borderRadius: "10px",
              padding: "10px 16px",
              color: isActive ? "#ffffff" : "#94a3b8",
              fontFamily: getFont(theme, "secondary"),
              fontSize: getFontSize(theme, 12),
              fontWeight: isActive ? "700" : "500",
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
              letterSpacing: "0.3px",
              boxShadow: isActive
                ? "0 4px 12px rgba(56,189,248,0.25)"
                : "none"
            }}
          >
            <span style={{ fontSize: getFontSize(theme, 14) }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ✅ THEME CONFIG PANEL - Panel de configuración de tema
function ThemeConfigPanel({ theme, previewMode, onPreview, onApplyToAll, onCancel, onClose }) {
  const [localTheme, setLocalTheme] = useState(theme);
  const [activeSection, setActiveSection] = useState("background");
  const fileInputRef = useRef(null);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const handleChange = (key, value) => {
    const updated = { ...localTheme, [key]: value };
    setLocalTheme(updated);
    onPreview(updated);
  };

  const handleIconChange = (tabKey, emoji) => {
    const updated = {
      ...localTheme,
      tabIcons: {
        ...localTheme.tabIcons,
        [tabKey]: emoji
      }
    };
    setLocalTheme(updated);
    onPreview(updated);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      handleChange('bgImage', imageUrl);
      handleChange('bgType', 'image');
    };
    reader.readAsDataURL(file);
  };

  const sections = [
    { id: "background", label: "Fondo", icon: "🎨" },
    { id: "typography", label: "Tipografía", icon: "✍️" },
    { id: "windows", label: "Ventanas", icon: "🪟" },
    { id: "icons", label: "Iconos", icon: "🎯" }
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d1f3c 0%, #1a2744 100%)",
          borderRadius: "20px",
          width: "min(800px, 100%)",
          maxHeight: "90vh",
          overflow: "hidden",
          border: "1px solid rgba(56,189,248,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid rgba(56,189,248,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: getFont(localTheme, "title"),
                fontSize: "24px",
                fontWeight: "700",
                color: "#ffffff",
                margin: 0,
                marginBottom: "4px"
              }}
            >
              ⚙️ Personalizar Tema
            </h2>
            <p
              style={{
                fontFamily: getFont(localTheme, "secondary"),
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                margin: 0
              }}
            >
              {previewMode ? "Vista previa activa - Los cambios no son permanentes" : "Configura la apariencia de la aplicación"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "10px",
              padding: "10px 14px",
              color: "#ef4444",
              fontFamily: getFont(localTheme, "secondary"),
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>

        {/* Section Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(56,189,248,0.15)",
            overflowX: "auto"
          }}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                background: activeSection === section.id
                  ? "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)"
                  : "rgba(56,189,248,0.1)",
                border: activeSection === section.id
                  ? "1px solid rgba(56,189,248,0.5)"
                  : "1px solid rgba(56,189,248,0.2)",
                borderRadius: "10px",
                padding: "10px 16px",
                color: activeSection === section.id ? "#ffffff" : "#94a3b8",
                fontFamily: getFont(localTheme, "secondary"),
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px"
          }}
        >
          {/* Background Section */}
          {activeSection === "background" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Tipo de Fondo
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleChange('bgType', 'gradient')}
                    style={{
                      flex: 1,
                      background: localTheme.bgType === 'gradient'
                        ? "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)"
                        : "rgba(56,189,248,0.1)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: "10px",
                      padding: "12px",
                      color: localTheme.bgType === 'gradient' ? "#ffffff" : "#94a3b8",
                      fontFamily: getFont(localTheme, "secondary"),
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Degradado
                  </button>
                  <button
                    onClick={() => handleChange('bgType', 'image')}
                    style={{
                      flex: 1,
                      background: localTheme.bgType === 'image'
                        ? "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)"
                        : "rgba(56,189,248,0.1)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: "10px",
                      padding: "12px",
                      color: localTheme.bgType === 'image' ? "#ffffff" : "#94a3b8",
                      fontFamily: getFont(localTheme, "secondary"),
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer"
                    }}
                  >
                    Imagen
                  </button>
                </div>
              </div>

              {localTheme.bgType === 'gradient' && (
                <div>
                  <label
                    style={{
                      fontFamily: getFont(localTheme, "secondary"),
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#38bdf8",
                      display: "block",
                      marginBottom: "10px"
                    }}
                  >
                    Degradado CSS
                  </label>
                  <textarea
                    value={localTheme.bgGradient}
                    onChange={(e) => handleChange('bgGradient', e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(13,31,60,0.6)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: "10px",
                      padding: "12px",
                      color: "#ffffff",
                      fontFamily: "'Courier New', monospace",
                      fontSize: "12px",
                      minHeight: "80px",
                      resize: "vertical"
                    }}
                    placeholder="linear-gradient(135deg, #0a1628 0%, #1a2332 100%)"
                  />
                </div>
              )}

              {localTheme.bgType === 'image' && (
                <div>
                  <label
                    style={{
                      fontFamily: getFont(localTheme, "secondary"),
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#38bdf8",
                      display: "block",
                      marginBottom: "10px"
                    }}
                  >
                    Imagen de Fondo
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      background: "rgba(56,189,248,0.15)",
                      border: "1px dashed rgba(56,189,248,0.4)",
                      borderRadius: "10px",
                      padding: "16px",
                      color: "#38bdf8",
                      fontFamily: getFont(localTheme, "secondary"),
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <span>📁</span>
                    {localTheme.bgImage ? "Cambiar Imagen" : "Seleccionar Imagen"}
                  </button>
                  {localTheme.bgImage && (
                    <div style={{ marginTop: "10px", textAlign: "center" }}>
                      <img
                        src={localTheme.bgImage}
                        alt="Preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "150px",
                          borderRadius: "10px",
                          border: "1px solid rgba(56,189,248,0.3)"
                        }}
                      />
                    </div>
                  )}
                  
                  <div style={{ marginTop: "16px" }}>
                    <label
                      style={{
                        fontFamily: getFont(localTheme, "secondary"),
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#38bdf8",
                        display: "block",
                        marginBottom: "10px"
                      }}
                    >
                      Desenfoque de Fondo: {localTheme.bgBlur}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={localTheme.bgBlur}
                      onChange={(e) => handleChange('bgBlur', Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Typography Section */}
          {activeSection === "typography" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Fuente de Títulos
                </label>
                <select
                  value={localTheme.fontTitle}
                  onChange={(e) => handleChange('fontTitle', e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(13,31,60,0.6)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    borderRadius: "10px",
                    padding: "12px",
                    color: "#ffffff",
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px"
                  }}
                >
                  <option value="'Playfair Display', serif">Playfair Display (Elegante)</option>
                  <option value="'Montserrat', sans-serif">Montserrat (Moderna)</option>
                  <option value="'Roboto', sans-serif">Roboto (Limpia)</option>
                  <option value="'Poppins', sans-serif">Poppins (Redondeada)</option>
                  <option value="'Lato', sans-serif">Lato (Versátil)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Fuente Principal
                </label>
                <select
                  value={localTheme.fontSecondary}
                  onChange={(e) => handleChange('fontSecondary', e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(13,31,60,0.6)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    borderRadius: "10px",
                    padding: "12px",
                    color: "#ffffff",
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px"
                  }}
                >
                  <option value="'DM Sans', sans-serif">DM Sans (Por defecto)</option>
                  <option value="'Roboto', sans-serif">Roboto</option>
                  <option value="'Open Sans', sans-serif">Open Sans</option>
                  <option value="'Lato', sans-serif">Lato</option>
                  <option value="'Poppins', sans-serif">Poppins</option>
                  <option value="'Montserrat', sans-serif">Montserrat</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Tamaño de Texto: {Math.round(localTheme.fontSizeMultiplier * 100)}%
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.1"
                  value={localTheme.fontSizeMultiplier}
                  onChange={(e) => handleChange('fontSizeMultiplier', Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "8px",
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.5)"
                  }}
                >
                  <span>80%</span>
                  <span>100%</span>
                  <span>140%</span>
                </div>
              </div>

              {/* Preview */}
              <div
                style={{
                  background: "rgba(13,31,60,0.4)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: "10px",
                  padding: "16px",
                  marginTop: "10px"
                }}
              >
                <div
                  style={{
                    fontFamily: getFont(localTheme, "title"),
                    fontSize: getFontSize(localTheme, 20),
                    fontWeight: "700",
                    color: "#ffffff",
                    marginBottom: "8px"
                  }}
                >
                  Título de ejemplo
                </div>
                <div
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: getFontSize(localTheme, 14),
                    color: "rgba(255,255,255,0.8)"
                  }}
                >
                  Este es un texto de ejemplo con la fuente principal. Los cambios se aplican en tiempo real.
                </div>
              </div>
            </div>
          )}

          {/* Windows Section */}
          {activeSection === "windows" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Desenfoque de Ventanas: {localTheme.windowBlur}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={localTheme.windowBlur}
                  onChange={(e) => handleChange('windowBlur', Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#38bdf8",
                    display: "block",
                    marginBottom: "10px"
                  }}
                >
                  Opacidad de Ventanas: {Math.round(localTheme.windowOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={localTheme.windowOpacity}
                  onChange={(e) => handleChange('windowOpacity', Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Preview */}
              <div
                style={{
                  background: `rgba(13,31,60,${getWindowOpacity(localTheme)})`,
                  backdropFilter: getBackdrop(localTheme),
                  WebkitBackdropFilter: getBackdrop(localTheme),
                  border: "1px solid rgba(56,189,248,0.3)",
                  borderRadius: "12px",
                  padding: "16px",
                  marginTop: "10px"
                }}
              >
                <div
                  style={{
                    fontFamily: getFont(localTheme, "title"),
                    fontSize: getFontSize(localTheme, 18),
                    fontWeight: "700",
                    color: "#ffffff",
                    marginBottom: "8px"
                  }}
                >
                  Vista Previa de Ventana
                </div>
                <div
                  style={{
                    fontFamily: getFont(localTheme, "secondary"),
                    fontSize: getFontSize(localTheme, 13),
                    color: "rgba(255,255,255,0.7)"
                  }}
                >
                  Así se verán las ventanas con la configuración actual de desenfoque y opacidad.
                </div>
              </div>
            </div>
          )}

          {/* Icons Section */}
          {activeSection === "icons" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  fontFamily: getFont(localTheme, "secondary"),
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.6)",
                  padding: "12px",
                  background: "rgba(56,189,248,0.1)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: "8px"
                }}
              >
                💡 Haz clic en un icono para cambiarlo. Puedes usar emojis o caracteres especiales.
              </div>
              
              {TABS.map(({ key, label }) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "rgba(13,31,60,0.4)",
                    border: "1px solid rgba(56,189,248,0.2)",
                    borderRadius: "10px"
                  }}
                >
                  <input
                    type="text"
                    value={localTheme.tabIcons[key] || DEFAULT_THEME.tabIcons[key]}
                    onChange={(e) => handleIconChange(key, e.target.value.slice(0, 2))}
                    maxLength={2}
                    style={{
                      width: "50px",
                      height: "50px",
                      textAlign: "center",
                      fontSize: "24px",
                      background: "rgba(56,189,248,0.1)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: "10px",
                      color: "#ffffff",
                      cursor: "pointer"
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: getFont(localTheme, "secondary"),
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#ffffff",
                        marginBottom: "2px"
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: getFont(localTheme, "secondary"),
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.4)"
                      }}
                    >
                      {key}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "20px 24px",
            borderTop: "1px solid rgba(56,189,248,0.2)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap"
          }}
        >
          {previewMode ? (
            <>
              <button
                onClick={onApplyToAll}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "1px solid rgba(16,185,129,0.5)",
                  borderRadius: "10px",
                  padding: "14px",
                  color: "#ffffff",
                  fontFamily: getFont(localTheme, "secondary"),
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <span>✓</span> Aplicar Cambios
              </button>
              <button
                onClick={onCancel}
                style={{
                  flex: 1,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: "10px",
                  padding: "14px",
                  color: "#ef4444",
                  fontFamily: getFont(localTheme, "secondary"),
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <span>↶</span> Descartar
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.4)",
                borderRadius: "10px",
                padding: "14px",
                color: "#38bdf8",
                fontFamily: getFont(localTheme, "secondary"),
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ✅ CookieBanner
function CookieBanner({ onAccept, onReject }) {
  const theme = useTheme();
  
  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "500px",
        width: "calc(100% - 40px)",
        background: `rgba(13,31,60,${getWindowOpacity(theme)})`,
        backdropFilter: getBackdrop(theme),
        WebkitBackdropFilter: getBackdrop(theme),
        border: "1px solid rgba(56,189,248,0.3)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        zIndex: 99999
      }}
    >
      <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: getFontSize(theme, 13), color: "rgba(255,255,255,0.9)", marginBottom: "16px", lineHeight: "1.6" }}>
        🍪 Usamos cookies para mejorar tu experiencia. Al continuar, aceptas nuestra{" "}
        <a href="#" style={{ color: "#38bdf8", textDecoration: "underline" }}>
          política de privacidad
        </a>
        .
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={onAccept}
          style={{
            flex: 1,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            border: "1px solid rgba(16,185,129,0.5)",
            borderRadius: "10px",
            padding: "12px",
            color: "#ffffff",
            fontFamily: getFont(theme, "secondary"),
            fontSize: getFontSize(theme, 13),
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Aceptar
        </button>
        <button
          onClick={onReject}
          style={{
            flex: 1,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: "10px",
            padding: "12px",
            color: "#ef4444",
            fontFamily: getFont(theme, "secondary"),
            fontSize: getFontSize(theme, 13),
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

// ✅ DonateBanner (ejemplo simplificado)
function DonateBanner({ active }) {
  const theme = useTheme();
  if (active === "donativos") return null;
  
  return (
    <div
      style={{
        marginTop: "auto",
        padding: "16px 12px",
        background: `rgba(13,31,60,${getWindowOpacity(theme) * 0.7})`,
        backdropFilter: getBackdrop(theme),
        WebkitBackdropFilter: getBackdrop(theme),
        borderRadius: "12px",
        border: "1px solid rgba(251,191,36,0.2)",
        textAlign: "center"
      }}
    >
      <div style={{ fontFamily: getFont(theme, "secondary"), fontSize: getFontSize(theme, 12), color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
        💝 ¿Te gusta esta app? Apoya al proyecto
      </div>
      <a
        href="#donativos"
        style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
          border: "1px solid rgba(251,191,36,0.5)",
          borderRadius: "8px",
          padding: "8px 16px",
          color: "#0a1628",
          fontFamily: getFont(theme, "secondary"),
          fontSize: getFontSize(theme, 12),
          fontWeight: "700",
          textDecoration: "none"
        }}
      >
        Donar Ahora
      </a>
    </div>
  );
}

// ✅ AnunciosBanner
function AnunciosBanner({ isAdmin }) {
  const theme = useTheme();
  const [anuncios, setAnuncios] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchAnuncios = async () => {
      const { data, error } = await sb
        .from("anuncios")
        .select("*")
        .eq("activo", true)
        .order("created_at", { ascending: false });
      if (!error && data) setAnuncios(data);
    };
    fetchAnuncios();
    const sub = sb
      .channel("anuncios-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "anuncios" }, fetchAnuncios)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (anuncios.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % anuncios.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [anuncios]);

  if (anuncios.length === 0) return null;

  const anuncio = anuncios[currentIndex];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${anuncio.color_fondo || "#1e3a8a"} 0%, ${anuncio.color_fondo ? `${anuncio.color_fondo}dd` : "#1e40af"} 100%)`,
        backdropFilter: getBackdrop(theme),
        WebkitBackdropFilter: getBackdrop(theme),
        border: `1px solid ${anuncio.color_fondo ? `${anuncio.color_fondo}80` : "rgba(59,130,246,0.3)"}`,
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "18px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          position: "relative",
          zIndex: 1
        }}
      >
        {anuncio.icono && (
          <div style={{ fontSize: "28px", flexShrink: 0 }}>{anuncio.icono}</div>
        )}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: getFont(theme, "title"),
              fontSize: getFontSize(theme, 16),
              fontWeight: "700",
              color: anuncio.color_texto || "#ffffff",
              marginBottom: "4px",
              letterSpacing: "0.3px"
            }}
          >
            {sanitize(anuncio.titulo)}
          </div>
          <div
            style={{
              fontFamily: getFont(theme, "secondary"),
              fontSize: getFontSize(theme, 13),
              color: anuncio.color_texto ? `${anuncio.color_texto}cc` : "rgba(255,255,255,0.85)",
              lineHeight: "1.5"
            }}
          >
            {sanitize(anuncio.mensaje)}
          </div>
        </div>
        {anuncios.length > 1 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              flexShrink: 0
            }}
          >
            {anuncios.map((_, i) => (
              <div
                key={i}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: i === currentIndex ? (anuncio.color_texto || "#ffffff") : `${anuncio.color_texto || "#ffffff"}40`,
                  transition: "all 0.3s"
                }}
              />
            ))}
          </div>
        )}
      </div>
      {isAdmin && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "rgba(251,191,36,0.2)",
            border: "1px solid rgba(251,191,36,0.4)",
            borderRadius: "6px",
            padding: "2px 6px",
            fontSize: "9px",
            color: "#fbbf24",
            fontFamily: getFont(theme, "secondary"),
            fontWeight: "700",
            zIndex: 2
          }}
        >
          ADMIN
        </div>
      )}
    </div>
  );
}

// ─── TAB COMPONENTS (SIMPLIFICADOS PARA EL EJEMPLO) ──────────────────────────

function InicioTab({ isAdmin, logout, onOpenAdminModal, onOpenThemeConfig }) {
  const theme = useTheme();
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <WindowCard title="Bienvenido a Conect Manzanillo" titleIcon="👋">
        <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.8)", lineHeight: "1.6", marginBottom: "16px" }}>
          Tu fuente de información en tiempo real sobre el puerto de Manzanillo.
        </p>
        
        {/* Botón de configuración de tema */}
        <button
          onClick={onOpenThemeConfig}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            border: "1px solid rgba(139,92,246,0.5)",
            borderRadius: "10px",
            padding: "14px",
            color: "#ffffff",
            fontFamily: getFont(theme, "secondary"),
            fontSize: getFontSize(theme, 14),
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "12px"
          }}
        >
          <span>⚙️</span>
          Personalizar Tema
        </button>

        {isAdmin && (
          <button
            onClick={onOpenAdminModal}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              border: "1px solid rgba(251,191,36,0.5)",
              borderRadius: "10px",
              padding: "14px",
              color: "#0a1628",
              fontFamily: getFont(theme, "secondary"),
              fontSize: getFontSize(theme, 14),
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "12px"
            }}
          >
            <span>🔑</span>
            Panel de Administración
          </button>
        )}

        {isAdmin && (
          <button
            onClick={logout}
            style={{
              width: "100%",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "10px",
              padding: "14px",
              color: "#ef4444",
              fontFamily: getFont(theme, "secondary"),
              fontSize: getFontSize(theme, 14),
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <span>🚪</span>
            Cerrar Sesión Admin
          </button>
        )}
      </WindowCard>
    </div>
  );
}

function TraficoTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Estado del Tráfico" titleIcon="🚗">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Vista de tráfico en desarrollo...
      </p>
    </WindowCard>
  );
}

function ReporteTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Reportar Incidente" titleIcon="📢">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Formulario de reporte en desarrollo...
      </p>
    </WindowCard>
  );
}

function TerminalesTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Terminales" titleIcon="🏭">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Información de terminales en desarrollo...
      </p>
    </WindowCard>
  );
}

function PatioReguladorTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Patios Reguladores" titleIcon="📦">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Información de patios en desarrollo...
      </p>
    </WindowCard>
  );
}

function SegundoAccesoTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Segundo Acceso" titleIcon="🛣️">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Información del segundo acceso en desarrollo...
      </p>
    </WindowCard>
  );
}

function CarrilesTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Estado de Carriles" titleIcon="🚦">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Estado de carriles en desarrollo...
      </p>
    </WindowCard>
  );
}

function NoticiasTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Noticias" titleIcon="📰">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Noticias en desarrollo...
      </p>
    </WindowCard>
  );
}

function DonativosTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Apoya el Proyecto" titleIcon="💝">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)", lineHeight: "1.6" }}>
        Si encuentras útil esta aplicación, considera hacer una donación para mantener el proyecto activo.
      </p>
    </WindowCard>
  );
}

function TutorialTab() {
  const theme = useTheme();
  return (
    <WindowCard title="Tutorial" titleIcon="🎓">
      <p style={{ fontSize: getFontSize(theme, 14), color: "rgba(255,255,255,0.7)" }}>
        Guía de uso en desarrollo...
      </p>
    </WindowCard>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function App() {
  const [active, setActive] = useState("inicio");
  const [consent, setConsent] = useState(getCookieConsent());
  const [visitas, setVisitas] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [myId] = useState(() => Math.random().toString(36).slice(2, 11));
  const [isAdmin, setIsAdmin] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showThemeConfig, setShowThemeConfig] = useState(false);

  // ✅ THEME STATE
  const [theme, setTheme] = useState(() => loadThemeFromStorage());
  const [previewMode, setPreviewMode] = useState(false);
  const [savedTheme, setSavedTheme] = useState(null);

  // Background computed style
  const backgroundStyle = {
    background: theme.bgType === 'image' && theme.bgImage
      ? `url(${theme.bgImage}) center/cover no-repeat`
      : theme.bgGradient,
    ...(theme.bgType === 'image' && theme.bgBlur > 0 && {
      filter: `blur(${theme.bgBlur}px)`,
      transform: 'scale(1.1)'
    })
  };

  useEffect(() => {
    const checkAdmin = () => {
      try {
        const stored = sessionStorage.getItem(ADMIN_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.exp > Date.now()) {
            setIsAdmin(true);
            return;
          }
        }
      } catch {}
      setIsAdmin(false);
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const { data: authListener } = sb.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user || null);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const fetchVisitas = async () => {
      const { data, error } = await sb.from("config").select("valor").eq("clave", "visitas").single();
      if (!error && data) setVisitas(Number(data.valor) || 0);
    };
    fetchVisitas();
    const sub = sb
      .channel("visitas-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "config", filter: "clave=eq.visitas" }, fetchVisitas)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const handleAccept = () => {
    saveCookieConsent("accepted");
    setConsent("accepted");
  };

  const handleReject = () => {
    saveCookieConsent("rejected");
    setConsent("rejected");
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_KEY);
    setIsAdmin(false);
  };

  const handleSignOut = async () => {
    await sb.auth.signOut();
    setShowSessionMenu(false);
  };

  const openModal = () => setShowAdminModal(true);

  // ✅ THEME HANDLERS
  const handlePreviewTheme = (newTheme) => {
    if (!previewMode) {
      setSavedTheme(theme);
      setPreviewMode(true);
    }
    setTheme(newTheme);
  };

  const handleApplyToAll = () => {
    saveThemeToStorage(theme);
    setPreviewMode(false);
    setSavedTheme(null);
    setShowThemeConfig(false);
  };

  const handleCancelPreview = () => {
    if (savedTheme) {
      setTheme(savedTheme);
    }
    setPreviewMode(false);
    setSavedTheme(null);
  };

  const Modal = showAdminModal ? (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      onClick={(e) => e.target === e.currentTarget && setShowAdminModal(false)}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d1f3c 0%, #1a2744 100%)",
          borderRadius: "20px",
          padding: "32px",
          maxWidth: "500px",
          width: "100%",
          border: "1px solid rgba(251,191,36,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
        }}
      >
        <h2
          style={{
            fontFamily: getFont(theme, "title"),
            fontSize: getFontSize(theme, 24),
            fontWeight: "700",
            color: "#fbbf24",
            marginBottom: "20px",
            textAlign: "center"
          }}
        >
          🔑 Panel de Administración
        </h2>
        <p
          style={{
            fontFamily: getFont(theme, "secondary"),
            fontSize: getFontSize(theme, 14),
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            marginBottom: "24px"
          }}
        >
          Configuración del sistema en desarrollo...
        </p>
        <button
          onClick={() => setShowAdminModal(false)}
          style={{
            width: "100%",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: "10px",
            padding: "14px",
            color: "#ef4444",
            fontFamily: getFont(theme, "secondary"),
            fontSize: getFontSize(theme, 14),
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  ) : null;

  return (
    <ThemeContext.Provider value={theme}>
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Background layer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          ...backgroundStyle
        }}
      />

      {/* Content layer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "12px",
          maxWidth: "1200px",
          margin: "0 auto"
        }}
      >
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: ${getFont(theme, "secondary")}; }
          `}
        </style>

        <div
          style={{
            background: `rgba(13,31,60,${getWindowOpacity(theme)})`,
            backdropFilter: getBackdrop(theme),
            WebkitBackdropFilter: getBackdrop(theme),
            borderRadius: "16px",
            padding: "16px 14px",
            marginBottom: "16px",
            border: "1px solid rgba(56,189,248,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
          }}
        >
          <div>
            <div style={{ fontFamily: getFont(theme, "title"), fontWeight: "700", fontSize: getFontSize(theme, 17), letterSpacing: "0.5px", color: "#ffffff" }}>
              Conect Manzanillo
            </div>
            <div style={{ fontSize: getFontSize(theme, 10), color: "rgba(255,255,255,0.5)", fontFamily: getFont(theme, "secondary"), letterSpacing: "1px", fontWeight: "300" }}>
              COMUNIDAD EN VIVO · PUERTO
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "7px", height: "7px", background: "#4ade80", borderRadius: "50%", boxShadow: "0 0 8px #4ade80", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: getFontSize(theme, 10), color: "#4ade80", fontFamily: getFont(theme, "secondary"), fontWeight: "600" }}>EN VIVO</span>
              {isAdmin && (
                <div
                  title="Sesión admin activa"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.4)",
                    borderRadius: "5px",
                    padding: "1px 6px",
                    marginLeft: "2px"
                  }}
                >
                  <span style={{ fontSize: getFontSize(theme, 11) }}>🔑</span>
                  <span style={{ fontSize: getFontSize(theme, 9), color: "#fbbf24", fontFamily: getFont(theme, "secondary"), fontWeight: "700", letterSpacing: "0.5px" }}>
                    ADMIN
                  </span>
                </div>
              )}
              {!isAdmin && authUser && (
                <div
                  onClick={() => setShowSessionMenu((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    background: showSessionMenu ? "rgba(56,189,248,0.22)" : "rgba(56,189,248,0.12)",
                    border: "1px solid rgba(56,189,248,0.35)",
                    borderRadius: "5px",
                    padding: "1px 6px",
                    marginLeft: "2px",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "background 0.2s"
                  }}
                >
                  <span style={{ fontSize: getFontSize(theme, 11) }}>👤</span>
                  <span style={{ fontSize: getFontSize(theme, 9), color: "#38bdf8", fontFamily: getFont(theme, "secondary"), fontWeight: "700", letterSpacing: "0.5px" }}>
                    SESIÓN
                  </span>
                  <span style={{ fontSize: getFontSize(theme, 8), color: "#38bdf8", marginLeft: "1px" }}>{showSessionMenu ? "▲" : "▼"}</span>
                </div>
              )}
            </div>
            {visitas !== null && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(56,189,248,0.1)",
                  border: "1px solid rgba(56,189,248,0.25)",
                  borderRadius: "6px",
                  padding: "2px 7px"
                }}
              >
                <span style={{ fontSize: getFontSize(theme, 10) }}>👁</span>
                <span style={{ fontSize: getFontSize(theme, 10), color: "#38bdf8", fontFamily: getFont(theme, "secondary"), fontWeight: "700", letterSpacing: "0.5px" }}>
                  {visitas.toLocaleString()}
                </span>
                <span style={{ fontSize: getFontSize(theme, 9), color: "rgba(255,255,255,0.35)", fontFamily: getFont(theme, "secondary") }}>visitas</span>
              </div>
            )}
          </div>
        </div>

        <NavBar active={active} set={setActive} />

        <AnunciosBanner isAdmin={isAdmin} />

        {active === "inicio" && <InicioTab isAdmin={isAdmin} logout={logout} onOpenAdminModal={openModal} onOpenThemeConfig={() => setShowThemeConfig(true)} />}
        {active === "trafico" && <TraficoTab myId={myId} incidents={incidents} setIncidents={setIncidents} isAdmin={isAdmin} />}
        {active === "reporte" && <ReporteTab myId={myId} incidents={incidents} setIncidents={setIncidents} setActiveTab={setActive} />}
        {active === "terminales" && <TerminalesTab myId={myId} />}
        {active === "patio" && <PatioReguladorTab myId={myId} />}
        {active === "segundo" && <SegundoAccesoTab />}
        {active === "carriles" && <CarrilesTab />}
        {active === "noticias" && <NoticiasTab isAdmin={isAdmin} />}
        {active === "donativos" && <DonativosTab />}
        {active === "tutorial" && <TutorialTab setActive={setActive} isAdmin={isAdmin} />}

        {consent === null && <CookieBanner onAccept={handleAccept} onReject={handleReject} />}

        <DonateBanner active={active} />
      </div>

      {Modal}

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

      {!isAdmin && authUser && showSessionMenu && (
        <div
          style={{
            position: "fixed",
            top: "62px",
            right: "12px",
            background: "#0d1f3c",
            border: "1px solid rgba(56,189,248,0.3)",
            borderRadius: "12px",
            padding: "10px",
            minWidth: "190px",
            zIndex: 99999,
            boxShadow: "0 12px 40px rgba(0,0,0,0.8)"
          }}
        >
          <div
            style={{
              fontSize: getFontSize(theme, 10),
              color: "rgba(255,255,255,0.4)",
              fontFamily: getFont(theme, "secondary"),
              padding: "2px 6px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: "8px",
              wordBreak: "break-all"
            }}
          >
            {authUser.email}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "8px",
              padding: "10px 12px",
              color: "#ef4444",
              fontFamily: getFont(theme, "secondary"),
              fontSize: getFontSize(theme, 12),
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              letterSpacing: "0.5px"
            }}
          >
            <span>🚪</span> CERRAR SESIÓN
          </button>
        </div>
      )}
    </div>
    </ThemeContext.Provider>
  );
}

export default App;
