import React, { useState, useEffect, useRef, createPortal } from "react";
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

// Inject Google Fonts
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://wnchrhglwsrzrcrhhukg.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduY2hyaGdsd3NyenJjcmhodWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyMzI0NzksImV4cCI6MjA1MjgwODQ3OX0.4EUDMOIKFUOa7pQZU8KBp_bC8xt--u10iQO5Ru4pC5Y";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MN    = "'DM Sans', sans-serif";

// Parseo robusto de fechas: acepta ms numérico, string numérico o ISO string
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  if (!isNaN(n) && n > 1e12) return n;   // string "1741826400000"
  return new Date(v).getTime();           // ISO string "2026-03-12T..."
};
const TITLE = "'Playfair Display', serif";

const TERMINALS_NORTE = [
  { id: "contecon", name: "CONTECON", fullName: "Contecon Manzanillo S.A." },
  { id: "hazesa",   name: "HAZESA",   fullName: "Hazesa Terminal Especializada" },
];
const TERMINALS_SUR = [
  { id: "timsa",      name: "TIMSA",      fullName: "Terminal Internacional de Manzanillo S.A." },
  { id: "ssa",        name: "SSA",        fullName: "SSA México Terminal" },
  { id: "oceanterminal", name: "Ocean Terminal", fullName: "Ocean Terminal Manzanillo" },
];

// ─── Componentes (omitidos para brevedad, se mantienen del original) ─────────

// [Aquí irían todos los componentes originales: NavBar, InicioTab, TraficoTab, etc.]
// Por brevedad, voy a incluir solo los componentes nuevos y modificados

// ─── NUEVO: Modal de Encuesta de Satisfacción ───────────────────────────────
function EncuestaModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    dispositivo: "",
    satisfaccion: "",
    facilidad_uso: "",
    frecuencia_uso: "",
    funciones_favoritas: "",
    agregar: "",
    quitar: "",
    mejoras: "",
    comentarios: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validaciones básicas
    if (!formData.nombre.trim() || !formData.email.trim()) {
      setError("Por favor completa nombre y correo electrónico");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Por favor ingresa un correo electrónico válido");
      return;
    }

    setLoading(true);

    try {
      const { data, error: supaError } = await sb
        .from("encuestas_satisfaccion")
        .insert([{
          nombre: sanitize(formData.nombre),
          email: sanitize(formData.email),
          dispositivo: formData.dispositivo,
          satisfaccion: formData.satisfaccion,
          facilidad_uso: formData.facilidad_uso,
          frecuencia_uso: formData.frecuencia_uso,
          funciones_favoritas: sanitize(formData.funciones_favoritas),
          agregar: sanitize(formData.agregar),
          quitar: sanitize(formData.quitar),
          mejoras: sanitize(formData.mejoras),
          comentarios: sanitize(formData.comentarios),
          fecha: new Date().toISOString()
        }]);

      if (supaError) throw supaError;

      onSubmit();
    } catch (err) {
      console.error("Error al enviar encuesta:", err);
      setError("Error al enviar la encuesta. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000, padding: "20px", overflowY: "auto" }}>
      <div style={{ background: "linear-gradient(145deg, #0f2642 0%, #1a3a5c 100%)", borderRadius: "20px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto", border: "2px solid rgba(56,189,248,0.3)", boxShadow: "0 25px 60px rgba(0,0,0,0.9)" }}>
        
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: "linear-gradient(135deg, #1e3a5f 0%, #0d1f3c 100%)", padding: "24px", borderBottom: "2px solid rgba(56,189,248,0.2)", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: TITLE, fontSize: "28px", color: "#ffffff", fontWeight: "700" }}>
                📋 Encuesta de Satisfacción
              </h2>
              <p style={{ margin: "8px 0 0", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                Tu opinión nos ayuda a mejorar Conect Manzanillo
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "10px", width: "40px", height: "40px", color: "#ef4444", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          
          {/* Información Personal */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontFamily: TITLE, fontSize: "18px", color: "#38bdf8", marginBottom: "16px", fontWeight: "600" }}>
              📝 Información Personal
            </h3>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                Nombre completo *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange("nombre", e.target.value)}
                placeholder="Ej: Juan Pérez"
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                Correo electrónico *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              />
            </div>
          </div>

          {/* Preguntas sobre la App */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontFamily: TITLE, fontSize: "18px", color: "#38bdf8", marginBottom: "16px", fontWeight: "600" }}>
              📱 Sobre la Aplicación
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué dispositivo utilizas principalmente?
              </label>
              <select
                value={formData.dispositivo}
                onChange={(e) => handleChange("dispositivo", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              >
                <option value="">Selecciona una opción</option>
                <option value="smartphone">📱 Smartphone</option>
                <option value="tablet">📲 Tablet</option>
                <option value="computadora">💻 Computadora</option>
                <option value="varios">🔄 Varios dispositivos</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué tan satisfecho estás con la aplicación?
              </label>
              <select
                value={formData.satisfaccion}
                onChange={(e) => handleChange("satisfaccion", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              >
                <option value="">Selecciona una opción</option>
                <option value="muy_satisfecho">😄 Muy satisfecho</option>
                <option value="satisfecho">🙂 Satisfecho</option>
                <option value="neutral">😐 Neutral</option>
                <option value="insatisfecho">😕 Insatisfecho</option>
                <option value="muy_insatisfecho">😞 Muy insatisfecho</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué tan fácil es usar la aplicación?
              </label>
              <select
                value={formData.facilidad_uso}
                onChange={(e) => handleChange("facilidad_uso", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              >
                <option value="">Selecciona una opción</option>
                <option value="muy_facil">⭐⭐⭐⭐⭐ Muy fácil</option>
                <option value="facil">⭐⭐⭐⭐ Fácil</option>
                <option value="normal">⭐⭐⭐ Normal</option>
                <option value="dificil">⭐⭐ Difícil</option>
                <option value="muy_dificil">⭐ Muy difícil</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Con qué frecuencia usas la app?
              </label>
              <select
                value={formData.frecuencia_uso}
                onChange={(e) => handleChange("frecuencia_uso", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px" }}
              >
                <option value="">Selecciona una opción</option>
                <option value="diario">📅 Diariamente</option>
                <option value="semanal">📆 Varias veces por semana</option>
                <option value="mensual">📋 Varias veces al mes</option>
                <option value="ocasional">🔄 Ocasionalmente</option>
                <option value="primera_vez">✨ Es mi primera vez</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Cuáles son tus funciones favoritas?
              </label>
              <textarea
                value={formData.funciones_favoritas}
                onChange={(e) => handleChange("funciones_favoritas", e.target.value)}
                placeholder="Ej: Tráfico en vivo, reportes de incidentes, horarios de terminales..."
                rows="3"
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px", resize: "vertical" }}
              />
            </div>
          </div>

          {/* Sugerencias */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontFamily: TITLE, fontSize: "18px", color: "#38bdf8", marginBottom: "16px", fontWeight: "600" }}>
              💡 Tus Sugerencias
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué te gustaría que agreguemos?
              </label>
              <textarea
                value={formData.agregar}
                onChange={(e) => handleChange("agregar", e.target.value)}
                placeholder="Funciones, información o servicios que te gustaría ver..."
                rows="3"
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px", resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué te gustaría que quitemos o mejoremos?
              </label>
              <textarea
                value={formData.quitar}
                onChange={(e) => handleChange("quitar", e.target.value)}
                placeholder="Funciones que no usas o que podrían mejorarse..."
                rows="3"
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px", resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                ¿Qué mejoras propondrías?
              </label>
              <textarea
                value={formData.mejoras}
                onChange={(e) => handleChange("mejoras", e.target.value)}
                placeholder="Ideas para mejorar la experiencia de usuario..."
                rows="3"
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px", resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)", marginBottom: "8px", fontWeight: "500" }}>
                Comentarios adicionales
              </label>
              <textarea
                value={formData.comentarios}
                onChange={(e) => handleChange("comentarios", e.target.value)}
                placeholder="Cualquier otro comentario que quieras compartir..."
                rows="4"
                style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "10px", padding: "12px", color: "#ffffff", fontFamily: MN, fontSize: "14px", resize: "vertical" }}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "#ef4444" }}>
                ⚠️ {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", background: loading ? "rgba(56,189,248,0.3)" : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)", border: "none", borderRadius: "12px", padding: "16px", color: "#ffffff", fontFamily: MN, fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.5px", boxShadow: loading ? "none" : "0 4px 15px rgba(56,189,248,0.4)" }}
          >
            {loading ? "Enviando..." : "✅ Enviar Encuesta"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── NUEVO: Panel de Resultados de Encuestas (Solo Admin) ───────────────────
function EncuestasAdminPanel({ onClose }) {
  const [encuestas, setEncuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("graficas"); // "graficas" o "respuestas"
  const canvasRefs = {
    dispositivos: useRef(null),
    satisfaccion: useRef(null),
    facilidad: useRef(null),
    frecuencia: useRef(null)
  };

  useEffect(() => {
    cargarEncuestas();
  }, []);

  useEffect(() => {
    if (vista === "graficas" && encuestas.length > 0) {
      renderCharts();
    }
  }, [vista, encuestas]);

  const cargarEncuestas = async () => {
    try {
      const { data, error } = await sb
        .from("encuestas_satisfaccion")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      setEncuestas(data || []);
    } catch (err) {
      console.error("Error al cargar encuestas:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderCharts = () => {
    // Procesar datos
    const dispositivosCount = {};
    const satisfaccionCount = {};
    const facilidadCount = {};
    const frecuenciaCount = {};

    encuestas.forEach(enc => {
      dispositivosCount[enc.dispositivo] = (dispositivosCount[enc.dispositivo] || 0) + 1;
      satisfaccionCount[enc.satisfaccion] = (satisfaccionCount[enc.satisfaccion] || 0) + 1;
      facilidadCount[enc.facilidad_uso] = (facilidadCount[enc.facilidad_uso] || 0) + 1;
      frecuenciaCount[enc.frecuencia_uso] = (frecuenciaCount[enc.frecuencia_uso] || 0) + 1;
    });

    // Colores
    const bgColors = ['rgba(56, 189, 248, 0.8)', 'rgba(74, 222, 128, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(248, 113, 113, 0.8)', 'rgba(167, 139, 250, 0.8)'];
    const borderColors = ['#38bdf8', '#4ade80', '#fbbf24', '#f87171', '#a78bfa'];

    // Función helper para crear gráficas
    const createChart = (canvas, data, label) => {
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const labels = Object.keys(data);
      const values = Object.values(data);

      // Limpiar canvas anterior
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Configurar dimensiones
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / labels.length - 40;
      const maxValue = Math.max(...values);
      const scale = (height - 80) / maxValue;

      // Dibujar barras
      labels.forEach((lbl, i) => {
        const barHeight = values[i] * scale;
        const x = i * (width / labels.length) + 20;
        const y = height - barHeight - 40;

        // Barra
        ctx.fillStyle = bgColors[i % bgColors.length];
        ctx.fillRect(x, y, barWidth, barHeight);

        // Borde
        ctx.strokeStyle = borderColors[i % borderColors.length];
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Valor
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "DM Sans"';
        ctx.textAlign = 'center';
        ctx.fillText(values[i], x + barWidth / 2, y - 10);

        // Etiqueta
        ctx.save();
        ctx.translate(x + barWidth / 2, height - 10);
        ctx.rotate(-Math.PI / 4);
        ctx.font = '12px "DM Sans"';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'right';
        const labelText = formatLabel(lbl);
        ctx.fillText(labelText, 0, 0);
        ctx.restore();
      });
    };

    const formatLabel = (key) => {
      const labels = {
        smartphone: "Smartphone",
        tablet: "Tablet",
        computadora: "PC",
        varios: "Varios",
        muy_satisfecho: "Muy satisfecho",
        satisfecho: "Satisfecho",
        neutral: "Neutral",
        insatisfecho: "Insatisfecho",
        muy_insatisfecho: "Muy insatisfecho",
        muy_facil: "Muy fácil",
        facil: "Fácil",
        normal: "Normal",
        dificil: "Difícil",
        muy_dificil: "Muy difícil",
        diario: "Diario",
        semanal: "Semanal",
        mensual: "Mensual",
        ocasional: "Ocasional",
        primera_vez: "1ª vez"
      };
      return labels[key] || key;
    };

    // Renderizar todas las gráficas
    setTimeout(() => {
      if (canvasRefs.dispositivos.current) createChart(canvasRefs.dispositivos.current, dispositivosCount, "Dispositivos");
      if (canvasRefs.satisfaccion.current) createChart(canvasRefs.satisfaccion.current, satisfaccionCount, "Satisfacción");
      if (canvasRefs.facilidad.current) createChart(canvasRefs.facilidad.current, facilidadCount, "Facilidad de uso");
      if (canvasRefs.frecuencia.current) createChart(canvasRefs.frecuencia.current, frecuenciaCount, "Frecuencia");
    }, 100);
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000 }}>
        <div style={{ background: "#0f2642", borderRadius: "20px", padding: "40px", border: "2px solid rgba(56,189,248,0.3)" }}>
          <p style={{ fontFamily: MN, fontSize: "16px", color: "#ffffff" }}>Cargando encuestas...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000, padding: "20px", overflowY: "auto" }}>
      <div style={{ background: "linear-gradient(145deg, #0f2642 0%, #1a3a5c 100%)", borderRadius: "20px", maxWidth: "1200px", width: "100%", maxHeight: "90vh", overflowY: "auto", border: "2px solid rgba(56,189,248,0.3)", boxShadow: "0 25px 60px rgba(0,0,0,0.9)" }}>
        
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: "linear-gradient(135deg, #1e3a5f 0%, #0d1f3c 100%)", padding: "24px", borderBottom: "2px solid rgba(56,189,248,0.2)", borderRadius: "20px 20px 0 0", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: TITLE, fontSize: "28px", color: "#ffffff", fontWeight: "700" }}>
                📊 Resultados de Encuestas
              </h2>
              <p style={{ margin: "8px 0 0", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                Total de respuestas: {encuestas.length}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "10px", width: "40px", height: "40px", color: "#ef4444", fontSize: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => setVista("graficas")}
              style={{ flex: 1, background: vista === "graficas" ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${vista === "graficas" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", padding: "12px", color: vista === "graficas" ? "#38bdf8" : "rgba(255,255,255,0.6)", fontFamily: MN, fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
            >
              📊 Gráficas
            </button>
            <button
              onClick={() => setVista("respuestas")}
              style={{ flex: 1, background: vista === "respuestas" ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${vista === "respuestas" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", padding: "12px", color: vista === "respuestas" ? "#38bdf8" : "rgba(255,255,255,0.6)", fontFamily: MN, fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
            >
              📝 Respuestas
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          {vista === "graficas" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(56,189,248,0.2)" }}>
                <h3 style={{ fontFamily: TITLE, fontSize: "16px", color: "#38bdf8", marginBottom: "16px", textAlign: "center" }}>
                  Dispositivos Utilizados
                </h3>
                <canvas ref={canvasRefs.dispositivos} width="300" height="250" />
              </div>

              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(56,189,248,0.2)" }}>
                <h3 style={{ fontFamily: TITLE, fontSize: "16px", color: "#38bdf8", marginBottom: "16px", textAlign: "center" }}>
                  Nivel de Satisfacción
                </h3>
                <canvas ref={canvasRefs.satisfaccion} width="300" height="250" />
              </div>

              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(56,189,248,0.2)" }}>
                <h3 style={{ fontFamily: TITLE, fontSize: "16px", color: "#38bdf8", marginBottom: "16px", textAlign: "center" }}>
                  Facilidad de Uso
                </h3>
                <canvas ref={canvasRefs.facilidad} width="300" height="250" />
              </div>

              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(56,189,248,0.2)" }}>
                <h3 style={{ fontFamily: TITLE, fontSize: "16px", color: "#38bdf8", marginBottom: "16px", textAlign: "center" }}>
                  Frecuencia de Uso
                </h3>
                <canvas ref={canvasRefs.frecuencia} width="300" height="250" />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {encuestas.map((enc, idx) => (
                <div key={idx} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(56,189,248,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <div>
                      <h4 style={{ margin: 0, fontFamily: TITLE, fontSize: "18px", color: "#ffffff" }}>
                        {enc.nombre}
                      </h4>
                      <p style={{ margin: "4px 0 0", fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                        {enc.email}
                      </p>
                    </div>
                    <span style={{ fontFamily: MN, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                      {new Date(enc.fecha).toLocaleDateString('es-MX')}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Dispositivo:</span>
                      <span style={{ fontFamily: MN, fontSize: "13px", color: "#38bdf8" }}>{enc.dispositivo || "—"}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Satisfacción:</span>
                      <span style={{ fontFamily: MN, fontSize: "13px", color: "#4ade80" }}>{enc.satisfaccion || "—"}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Facilidad:</span>
                      <span style={{ fontFamily: MN, fontSize: "13px", color: "#fbbf24" }}>{enc.facilidad_uso || "—"}</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Frecuencia:</span>
                      <span style={{ fontFamily: MN, fontSize: "13px", color: "#a78bfa" }}>{enc.frecuencia_uso || "—"}</span>
                    </div>
                  </div>

                  {enc.funciones_favoritas && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Funciones favoritas:</span>
                      <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{enc.funciones_favoritas}</p>
                    </div>
                  )}

                  {enc.agregar && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Agregar:</span>
                      <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{enc.agregar}</p>
                    </div>
                  )}

                  {enc.quitar && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Quitar/Mejorar:</span>
                      <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{enc.quitar}</p>
                    </div>
                  )}

                  {enc.mejoras && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Mejoras propuestas:</span>
                      <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{enc.mejoras}</p>
                    </div>
                  )}

                  {enc.comentarios && (
                    <div>
                      <span style={{ fontFamily: MN, fontSize: "11px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "4px" }}>Comentarios:</span>
                      <p style={{ margin: 0, fontFamily: MN, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>{enc.comentarios}</p>
                    </div>
                  )}
                </div>
              ))}

              {encuestas.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <p style={{ fontFamily: MN, fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
                    No hay encuestas registradas aún
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MODIFICACIÓN: InicioTab con botón de encuesta ──────────────────────────
// [El resto del código del archivo original se mantiene igual hasta InicioTab]
// En la sección "Más Info", agregar el botón de encuesta

// Por brevedad, incluyo solo la parte modificada de InicioTab:
/*
En la función InicioTab, en la sección de "Más Info", agregar:

<button
  onClick={() => setShowEncuesta(true)}
  style={{
    width: "100%",
    background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)",
    border: "none",
    borderRadius: "12px",
    padding: "16px",
    color: "#ffffff",
    fontFamily: MN,
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    letterSpacing: "0.5px",
    boxShadow: "0 4px 15px rgba(74,222,128,0.4)",
    marginTop: "16px"
  }}
>
  📋 Encuesta de Satisfacción
</button>

Y agregar estos estados en InicioTab:
const [showEncuesta, setShowEncuesta] = useState(false);
const [showEncuestaGracias, setShowEncuestaGracias] = useState(false);

Y al final del return de InicioTab, antes del cierre:
{showEncuesta && (
  <EncuestaModal
    onClose={() => setShowEncuesta(false)}
    onSubmit={() => {
      setShowEncuesta(false);
      setShowEncuestaGracias(true);
      setTimeout(() => setShowEncuestaGracias(false), 3000);
    }}
  />
)}

{showEncuestaGracias && (
  <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)", borderRadius: "12px", padding: "16px 24px", zIndex: 100001, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
    <p style={{ margin: 0, fontFamily: MN, fontSize: "14px", color: "#ffffff", fontWeight: "600" }}>
      ✅ ¡Gracias por tu retroalimentación!
    </p>
  </div>
)}

En el AdminModal, agregar un nuevo botón para ver encuestas:
<button
  onClick={() => {
    setShowAdminModal(false);
    setShowEncuestasPanel(true);
  }}
  style={{ /* estilos similares a otros botones admin */ }}
>
  📊 Ver Encuestas
</button>

Y en el componente principal App, agregar:
const [showEncuestasPanel, setShowEncuestasPanel] = useState(false);

{isAdmin && showEncuestasPanel && (
  <EncuestasAdminPanel onClose={() => setShowEncuestasPanel(false)} />
)}
*/
export default App;
