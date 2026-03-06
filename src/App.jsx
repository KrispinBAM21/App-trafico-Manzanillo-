import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://wnchrhglwsrzrcrhhukg.supabase.co";
const SUPA_KEY = "sb_publishable_9Uiui8fhiBXeds4OkKbGCQ_NvYEMO5O";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MN = "'Space Mono', monospace";

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

const INCIDENT_TYPES = [
  { id: "accidente", label: "Accidente",      icon: "🚨", color: "#ef4444" },
  { id: "trafico",   label: "Tráfico Pesado", icon: "🚦", color: "#f97316" },
  { id: "bloqueo",   label: "Bloqueo / Corte",icon: "🚧", color: "#eab308" },
  { id: "obra",      label: "Obra / Desvío",  icon: "🏗️", color: "#3b82f6" },
];

const ACCESOS_PRINCIPALES = [
  { id: "pezvela",   label: "Acceso Pez Vela",  color: "#a78bfa", zona: "Zona Sur"   },
  { id: "zonanorte", label: "Acceso Zona Norte", color: "#38bdf8", zona: "Zona Norte" },
];
const ACCESO_STATUS_OPTIONS = [
  { id: "libre",    label: "Libre / Fluido",  color: "#22c55e", icon: "✓" },
  { id: "lento",    label: "Tráfico Lento",   color: "#eab308", icon: "⚠" },
  { id: "saturado", label: "Saturado",         color: "#ef4444", icon: "✗" },
  { id: "cerrado",  label: "Cerrado / Corte",  color: "#6b7280", icon: "⛔" },
];
const RETORNO_OPTIONS = [
  { id: "none",     label: "Sin Retornos",     color: "#22c55e", icon: "✓" },
  { id: "terminal", label: "Retorno Terminal", color: "#f97316", icon: "↩" },
  { id: "asipona",  label: "Retorno ASIPONA",  color: "#a855f7", icon: "⚓" },
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

// ─── ACCESOS DEL SEGUNDO ACCESO ───────────────────────────────────────────────
// Cada acceso tiene sus propios carriles con tipo (expo/impo) y flujo (ingreso/salida)
const ACCESOS_SEGUNDO = [
  {
    id: "pezvela", label: "Acceso Pez Vela", color: "#a78bfa", zona: "Sur",
    carriles: [
      // C1-C4 = ingreso normal (terminal asignable)
      { id: "pv_c1", label: "Carril 1", tipo: "ingreso", defaultTerminal: "timsa" },
      { id: "pv_c2", label: "Carril 2", tipo: "ingreso", defaultTerminal: "ssa"   },
      { id: "pv_c3", label: "Carril 3", tipo: "ingreso", defaultTerminal: "ocupa" },
      { id: "pv_c4", label: "Carril 4", tipo: "ingreso", defaultTerminal: "multimodal" },
      // C5-C8 = exportación/importación, solo abierto/cerrado
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

const mkAccesos = () =>
  Object.fromEntries(ACCESOS_PRINCIPALES.map(a => [a.id, {
    status: "libre", retornos: "none",
    lastUpdate: Date.now(), updatedBy: "Sistema", pendingVoters: {},
  }]));

// mkSegundoState defined above with ACCESOS_SEGUNDO

// ── Segundo Acceso: carriles de ingreso originales (C1-C3 + C4 salida) ────────
const SEGUNDO_CARRILES_INGRESO = [
  { id: "c1", label: "Carril 1", defaultTerminal: "ssa"   },
  { id: "c2", label: "Carril 2", defaultTerminal: "timsa" },
  { id: "c3", label: "Carril 3", defaultTerminal: "ocupa" },
];
const mkSegundoIngreso = () => ({
  ...Object.fromEntries(SEGUNDO_CARRILES_INGRESO.map(c => [c.id, {
    terminal: c.defaultTerminal, saturado: false, retornos: false,
    lastUpdate: Date.now(), updatedBy: "Sistema",
  }])),
  c4: { saturado: false, retornos: false, lastUpdate: Date.now(), updatedBy: "Sistema" },
});

// ── Carriles Tab: expo/impo por acceso ────────────────────────────────────────
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
        <span style={{ fontSize: "9px", color: "#64748b", fontFamily: MN }}>VERIFICACIÓN COMUNITARIA</span>
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
      background: "#0d1b2e", border: `1px solid ${toast.color}`, color: toast.color,
      padding: "9px 18px", borderRadius: "8px", fontFamily: MN, fontSize: "11px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)", zIndex: 999, whiteSpace: "nowrap", pointerEvents: "none",
    }}>{toast.msg}</div>
  );
}

// Muestra en tiempo real cuántos votos hay para una opción
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
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
      <span style={{ fontSize: "10px", color: "#64748b", fontFamily: MN, letterSpacing: "2px" }}>{text}</span>
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

// ─── NAVBAR (5 tabs) ──────────────────────────────────────────────────────────
function NavBar({ active, set }) {
  const tabs = [
    { id: "trafico",    label: "Tráfico",    icon: "🗺️" },
    { id: "reporte",    label: "Reportar",   icon: "📍"  },
    { id: "terminales", label: "Terminales", icon: "⚓"  },
    { id: "segundo",    label: "2do Acceso", icon: "🛣️" },
    { id: "carriles",   label: "Carriles",   icon: "🚦"  },
    { id: "donativos",  label: "Donativos",  icon: "💙"  },
    { id: "tutorial",   label: "Tutorial",   icon: "📖"  },
  ];
  return (
    <nav style={{ display: "flex", background: "#0a0f1e", borderBottom: "1px solid #1e3a5f", position: "sticky", top: 0, zIndex: 100 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => set(t.id)} style={{
          flex: 1, padding: "12px 4px",
          background: active === t.id ? "#0d2a4a" : "transparent",
          border: "none", borderBottom: active === t.id ? "2px solid #38bdf8" : "2px solid transparent",
          color: active === t.id ? "#38bdf8" : "#475569",
          fontSize: "10px", fontFamily: MN, fontWeight: "600",
          cursor: "pointer", display: "flex", flexDirection: "column",
          alignItems: "center", gap: "3px", transition: "all 0.15s", letterSpacing: "0.5px",
        }}>
          <span style={{ fontSize: "16px" }}>{t.icon}</span>
          {t.label.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}

// ─── TAB: TRÁFICO (mapa + accesos + incidentes activos) ───────────────────────
function TraficoTab({ myId, incidents, setIncidents }) {
  const [accesos, setAccesos] = useState(mkAccesos);
  const [toast,   setToast]   = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  // ── incidentes ──
  const voteConfirm = async (id) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc) return;
    if (inc.votes[myId] !== undefined) return notify("Ya votaste en este reporte", "#f97316");
    const votes   = { ...inc.votes, [myId]: 1 };
    const visible = Object.values(votes).filter(v => v === 1).length >= 15;
    await sb.from("incidents").update({ votes, visible }).eq("id", id);
    if (visible && !inc.visible) notify("✅ Reporte verificado — ya aparece en el mapa", "#22c55e");
    else notify("✓ Voto registrado", "#38bdf8");
  };

  const voteFalse = async (id) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc || inc.votes[myId] !== undefined) return;
    const votes = { ...inc.votes, [myId]: -1 };
    await sb.from("incidents").update({ votes }).eq("id", id);
  };

  const voteResolve = async (id) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc) return;
    if (inc.resolveVotes[myId]) return notify("Ya reportaste esto como resuelto", "#f97316");
    const rv       = { ...inc.resolveVotes, [myId]: 1 };
    const resolved = Object.keys(rv).length >= 15;
    await sb.from("incidents").update({ resolve_votes: rv, resolved }).eq("id", id);
    if (resolved) notify("✓ Incidente marcado como resuelto", "#22c55e");
    else notify(`Voto registrado (${Object.keys(rv).length}/15 para resolver)`, "#38bdf8");
  };

  const clearIncidents = async () => {
    await sb.from("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    notify("✓ Incidentes limpiados", "#22c55e");
  };

  // ── accesos ──
  useEffect(() => {
    sb.from("accesos").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        await sb.from("accesos").upsert(ACCESOS_PRINCIPALES.map(a => ({
          id: a.id, status: "libre", retornos: "none",
          pending_voters: {}, last_update: Date.now(), updated_by: "Sistema"
        })));
        return;
      }
      const map = {};
      data.forEach(r => {
        map[r.id] = { status: r.status, retornos: r.retornos, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
      });
      setAccesos(prev => ({ ...prev, ...map }));
    });

    const chan = sb.channel("accesos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "accesos" }, ({ new: r }) => {
        if (!r) return;
        setAccesos(prev => ({ ...prev, [r.id]: { status: r.status, retornos: r.retornos, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} } }));
      }).subscribe();

    return () => sb.removeChannel(chan);
  }, []);

  const voteAcceso = async (accesoId, newStatus) => {
    const key = `acceso_${accesoId}_${newStatus}`;
    // Verificar si ya votó este dispositivo
    const { data: existing } = await sb.from("votos").select("id").eq("key", key).eq("user_id", myId).single();
    if (existing) return notify("Ya votaste por este estatus", "#f97316");
    // Registrar voto
    await sb.from("votos").insert({ key, user_id: myId, acceso_id: accesoId, status: newStatus, tipo: "acceso" });
    // Contar votos totales para esta opción
    const { count } = await sb.from("votos").select("id", { count: "exact" }).eq("key", key);
    const total = count || 1;
    notify(`Voto registrado (${total}/50 confirmaciones)`, "#38bdf8");
    if (total >= 50) {
      // Limpiar votos de este acceso y actualizar estatus
      await sb.from("votos").delete().eq("acceso_id", accesoId).eq("tipo", "acceso");
      await sb.from("accesos").upsert({ id: accesoId, status: newStatus, retornos: accesos[accesoId]?.retornos || "none", pending_voters: {}, last_update: Date.now(), updated_by: `${total} usuarios` });
      notify(`✅ ${ACCESO_STATUS_OPTIONS.find(o => o.id === newStatus)?.label} confirmado!`, "#22c55e");
    }
  };

  const setRetornos = async (accesoId, value) => {
    await sb.from("accesos").upsert({ id: accesoId, status: accesos[accesoId].status, retornos: value, last_update: Date.now(), updated_by: "Tú" });
    notify("✓ Retornos actualizados", "#22c55e");
  };

  const resetAcceso = async (accesoId) => {
    await sb.from("accesos").upsert({ id: accesoId, status: "libre", retornos: "none", pending_voters: {}, last_update: Date.now(), updated_by: "Reset" });
    notify("✓ Acceso restablecido", "#22c55e");
  };

  const resetAll = async () => {
    await sb.from("accesos").upsert(ACCESOS_PRINCIPALES.map(a => ({ id: a.id, status: "libre", retornos: "none", pending_voters: {}, last_update: Date.now(), updated_by: "Reset" })));
    await sb.from("incidents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    notify("✓ Todo normal", "#22c55e");
  };

  const incType  = (id) => INCIDENT_TYPES.find(t => t.id === id) || INCIDENT_TYPES[0];
  const getAcOpt = (id) => ACCESO_STATUS_OPTIONS.find(o => o.id === id) || ACCESO_STATUS_OPTIONS[0];
  const getRetOpt= (id) => RETORNO_OPTIONS.find(r => r.id === id) || RETORNO_OPTIONS[0];

  const active   = incidents.filter(i =>  i.visible && !i.resolved);
  const pending  = incidents.filter(i => !i.visible && !i.resolved);
  const resolved = incidents.filter(i =>  i.resolved);

  return (
    <div style={{ padding: "16px", paddingBottom: "80px" }}>

      {/* ── MAPA ── */}
      <div style={{
        background: "linear-gradient(135deg,#0d1b2e,#0a2540,#061a30)",
        border: "1px solid #1e3a5f", borderRadius: "12px",
        height: "180px", marginBottom: "16px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position:"absolute",inset:0, backgroundImage:"linear-gradient(#1e3a5f22 1px,transparent 1px),linear-gradient(90deg,#1e3a5f22 1px,transparent 1px)", backgroundSize:"28px 28px" }} />

        {/* Incident pins */}
        {active.map((inc, i) => {
          const t = incType(inc.type);
          return (
            <div key={inc.id} style={{ position:"absolute", top:`${20+i*28}%`, left:`${18+i*18}%`, zIndex:3 }}>
              <div style={{ background:t.color, borderRadius:"50% 50% 50% 0", width:"24px", height:"24px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", transform:"rotate(-45deg)", boxShadow:`0 0 12px ${t.color}99` }}>
                <span style={{ transform:"rotate(45deg)" }}>{t.icon}</span>
              </div>
            </div>
          );
        })}

        {/* Fixed acceso pins */}
        {[
          { left:"18%", color:"#a78bfa", label:"Pez Vela",   acc:"pezvela"   },
          { right:"18%", color:"#38bdf8", label:"Zona Norte", acc:"zonanorte" },
        ].map(p => {
          const st  = accesos[p.acc];
          const opt = getAcOpt(st.status);
          const ro  = getRetOpt(st.retornos);
          return (
            <div key={p.acc} style={{ position:"absolute", top:"18%", left:p.left, right:p.right, zIndex:2 }}>
              <div style={{ background:p.color, borderRadius:"50% 50% 50% 0", width:"26px", height:"26px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", transform:"rotate(-45deg)", boxShadow:`0 0 14px ${p.color}99`, border:`2px solid ${opt.color}` }}>
                <span style={{ transform:"rotate(45deg)" }}>📍</span>
              </div>
              <div style={{ marginTop:"3px", fontSize:"8px", color:p.color, fontFamily:MN, whiteSpace:"nowrap", fontWeight:"700" }}>{p.label}</div>
              <div style={{ fontSize:"7px", color:opt.color, fontFamily:MN, whiteSpace:"nowrap" }}>{opt.icon} {opt.label}</div>
              {st.retornos !== "none" && <div style={{ fontSize:"7px", color:ro.color, fontFamily:MN }}>{ro.icon} {ro.label}</div>}
            </div>
          );
        })}

        <div style={{ position:"relative",zIndex:1,height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
          <div style={{ fontSize:"11px",color:"#38bdf855",fontFamily:MN,letterSpacing:"2px" }}>MANZANILLO — EN VIVO</div>
          <div style={{ fontSize:"10px",color:"#47556944",marginTop:"4px",fontFamily:MN }}>{active.length} incidente(s)</div>
        </div>
        <button onClick={() => {
          const lat = 19.0525, lng = -104.3154;
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isAndroid = /Android/.test(navigator.userAgent);
          if (isIOS) {
            window.location.href = `maps://?q=${lat},${lng}`;
          } else if (isAndroid) {
            window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(Puerto+Manzanillo)`;
          } else {
            window.open(`https://maps.google.com/?q=${lat},${lng}&z=15`, "_blank");
          }
        }} style={{
          position:"absolute",bottom:"10px",right:"10px",
          background:"#38bdf8",color:"#0a0f1e",padding:"5px 10px",borderRadius:"6px",
          fontSize:"10px",fontFamily:MN,fontWeight:"700",border:"none",cursor:"pointer",
        }}>VER EN MAPS ↗</button>
      </div>

      {/* ── ACCESOS PRINCIPALES ── */}
      <SectionLabel text="ACCESOS PRINCIPALES" rightBtn={<NormalBtn onClick={resetAll} label="TODO NORMAL" />} />

      {ACCESOS_PRINCIPALES.map(acc => {
        const st     = accesos[acc.id];
        const opt    = getAcOpt(st.status);
        const retOpt = getRetOpt(st.retornos);
        const isChanged = st.status !== "libre" || st.retornos !== "none";
        return (
          <div key={acc.id} style={{
            background:"#0d1b2e", border:`2px solid ${acc.color}44`,
            borderRadius:"14px", padding:"14px", marginBottom:"14px",
            boxShadow:`0 0 24px ${acc.color}0a`,
          }}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <div style={{ width:"10px", height:"10px", background:acc.color, borderRadius:"50%", boxShadow:`0 0 8px ${acc.color}` }} />
                  <span style={{ color:acc.color, fontFamily:MN, fontWeight:"700", fontSize:"14px" }}>{acc.label}</span>
                </div>
                <div style={{ color:"#475569", fontSize:"10px", fontFamily:MN, marginTop:"3px" }}>
                  {acc.zona} · {timeAgo(st.lastUpdate)} · {st.updatedBy}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px" }}>
                <div style={{ background:opt.color+"22", border:`1px solid ${opt.color}66`, color:opt.color, padding:"5px 10px", borderRadius:"6px", fontFamily:MN, fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", gap:"4px" }}>
                  {opt.icon} {opt.label}
                </div>
                {st.retornos !== "none" && (
                  <Badge color={retOpt.color} small>{retOpt.icon} {retOpt.label}</Badge>
                )}
                {isChanged && (
                  <button onClick={() => resetAcceso(acc.id)} style={{ padding:"3px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ NORMAL</button>
                )}
              </div>
            </div>

            {/* Estatus voting */}
            <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>ESTATUS DEL ACCESO:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"12px" }}>
              {ACCESO_STATUS_OPTIONS.map(o => {
                const key    = `${acc.id}_${o.id}`;
                const vCount = (st.pendingVoters[key] || []).length;
                const isAct  = st.status === o.id;
                return (
                  <button key={o.id} onClick={() => voteAcceso(acc.id, o.id)} style={{
                    padding:"8px 6px",
                    background: isAct ? o.color+"33" : "#0a1628",
                    border:`1px solid ${isAct ? o.color : "#1e3a5f"}`,
                    borderRadius:"8px", color: isAct ? o.color : "#64748b",
                    fontFamily:MN, fontSize:"10px", cursor:"pointer",
                    transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
                  }}>
                    {o.icon} {o.label}
                    <VoteCountBadge accesoId={acc.id} status={o.id} myId={myId} />
                  </button>
                );
              })}
            </div>

            {/* Retornos — 3 opciones */}
            <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>TIPO DE RETORNO:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px" }}>
              {RETORNO_OPTIONS.map(r => {
                const isAct = st.retornos === r.id;
                return (
                  <button key={r.id} onClick={() => setRetornos(acc.id, r.id)} style={{
                    padding:"10px 4px",
                    background: isAct ? r.color+"33" : "#0a1628",
                    border:`1px solid ${isAct ? r.color : "#1e3a5f"}`,
                    borderRadius:"8px", color: isAct ? r.color : "#64748b",
                    fontFamily:MN, fontSize:"10px", cursor:"pointer",
                    fontWeight: isAct ? "700" : "400",
                    transition:"all 0.15s", textAlign:"center",
                  }}>
                    <div style={{ fontSize:"16px" }}>{r.icon}</div>
                    <div style={{ marginTop:"3px", fontSize:"9px", lineHeight:"1.3" }}>{r.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── INCIDENTES ── */}
      <div style={{ borderTop:"1px solid #1e3a5f", margin:"4px 0 16px" }} />

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <SectionLabel text="PENDIENTES DE VERIFICACIÓN" />
          {pending.map(inc => {
            const t = incType(inc.type);
            const myVote = inc.votes[myId];
            const conf   = Object.values(inc.votes).filter(v => v === 1).length;
            return (
              <div key={inc.id} style={{ background:"#0d1b2e", border:`1px solid ${t.color}44`, borderRadius:"10px", padding:"12px", marginBottom:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                  <div style={{ display:"flex", gap:"8px", flex:1 }}>
                    <span style={{ fontSize:"16px" }}>{t.icon}</span>
                    <div>
                      <div style={{ color:"#e2e8f0", fontFamily:MN, fontWeight:"700", fontSize:"12px" }}>{inc.location}</div>
                      {inc.desc && <div style={{ color:"#64748b", fontSize:"11px", marginTop:"2px" }}>{inc.desc}</div>}
                      <div style={{ color:"#475569", fontSize:"10px", marginTop:"3px", fontFamily:MN }}>{timeAgo(inc.ts)}</div>
                    </div>
                  </div>
                  <Badge color="#f97316" small>PENDIENTE</Badge>
                </div>
                <VoteBar count={conf} needed={15} />
                {myVote === undefined ? (
                  <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                    <button onClick={() => voteConfirm(inc.id)} style={{ flex:1, padding:"7px", background:"#16a34a22", border:"1px solid #16a34a55", borderRadius:"6px", color:"#22c55e", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight:"700" }}>✓ CONFIRMAR</button>
                    <button onClick={() => voteFalse(inc.id)}   style={{ flex:1, padding:"7px", background:"#ef444422", border:"1px solid #ef444455", borderRadius:"6px", color:"#ef4444", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight:"700" }}>✗ FALSO</button>
                  </div>
                ) : (
                  <div style={{ marginTop:"8px", fontSize:"10px", color:"#22c55e", fontFamily:MN }}>
                    {myVote === 1 ? "✓ Confirmaste este reporte" : "✗ Marcaste como falso"}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Active */}
      <SectionLabel text="INCIDENTES ACTIVOS" rightBtn={active.length > 0 ? <NormalBtn onClick={clearIncidents} label="LIMPIAR TODO" /> : null} />
      {active.length === 0 && (
        <div style={{ textAlign:"center", color:"#334155", padding:"26px", fontFamily:MN, fontSize:"12px", border:"1px dashed #1e3a5f", borderRadius:"10px", marginBottom:"12px" }}>
          Sin incidentes activos ✓
        </div>
      )}
      {active.map(inc => {
        const t       = incType(inc.type);
        const rvCount = Object.keys(inc.resolveVotes).length;
        return (
          <div key={inc.id} style={{ background:"#0d1b2e", border:`1px solid ${t.color}66`, borderRadius:"10px", padding:"12px", marginBottom:"10px", boxShadow:`0 0 16px ${t.color}0d` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
              <div style={{ display:"flex", gap:"8px", flex:1 }}>
                <span style={{ fontSize:"18px" }}>{t.icon}</span>
                <div>
                  <div style={{ color:"#e2e8f0", fontFamily:MN, fontWeight:"700", fontSize:"12px" }}>{inc.location}</div>
                  {inc.desc && <div style={{ color:"#94a3b8", fontSize:"11px", marginTop:"2px" }}>{inc.desc}</div>}
                  <div style={{ color:"#475569", fontSize:"10px", marginTop:"3px", fontFamily:MN }}>
                    {timeAgo(inc.ts)} · {Object.values(inc.votes).filter(v=>v===1).length} confirmaciones
                  </div>
                </div>
              </div>
              <Badge color={t.color} small>ACTIVO</Badge>
            </div>
            <div style={{ borderTop:"1px solid #1e3a5f", paddingTop:"8px" }}>
              {rvCount > 0 && <div style={{ marginBottom:"8px" }}><VoteBar count={rvCount} needed={15} color="#22c55e" /></div>}
              <button onClick={() => voteResolve(inc.id)} style={{
                width:"100%", padding:"8px", background:"#22c55e15",
                border:"1px solid #22c55e44", borderRadius:"6px",
                color:"#22c55e", fontFamily:MN, fontSize:"11px",
                cursor:"pointer", fontWeight:"700",
              }}>✓ YA SE RESOLVIÓ ({rvCount}/15)</button>
            </div>
          </div>
        );
      })}

      {/* Resolved */}
      {resolved.length > 0 && (
        <>
          <SectionLabel text="RESUELTOS RECIENTES" />
          {resolved.map(inc => {
            const t = incType(inc.type);
            return (
              <div key={inc.id} style={{ background:"#0d1b2e", border:"1px solid #1e3a5f33", borderRadius:"10px", padding:"10px", marginBottom:"8px", opacity:0.5 }}>
                <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                  <span style={{ fontSize:"14px" }}>{t.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#94a3b8", fontFamily:MN, fontSize:"11px" }}>{inc.location}</div>
                    <div style={{ color:"#475569", fontSize:"10px", fontFamily:MN }}>{timeAgo(inc.ts)}</div>
                  </div>
                  <Badge color="#22c55e" small>RESUELTO</Badge>
                </div>
              </div>
            );
          })}
        </>
      )}

      <ToastBox toast={toast} />
    </div>
  );
}

// ─── TAB: REPORTAR (formulario propio) ────────────────────────────────────────
function ReporteTab({ myId, incidents, setIncidents, setActiveTab }) {
  const [newInc, setNewInc] = useState({ type: "trafico", location: "", acceso: "", desc: "" });
  const [toast,  setToast]  = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000); };

  const submit = async () => {
    if (!newInc.location.trim()) return notify("Ingresa la ubicación del incidente", "#ef4444");
    const loc = newInc.acceso ? `${newInc.acceso} — ${newInc.location}` : newInc.location;
    await sb.from("incidents").insert({
      type: newInc.type, location: loc,
      description: newInc.desc, votes: {}, resolve_votes: {},
      visible: false, resolved: false, ts: Date.now(),
    });
    setNewInc({ type: "trafico", location: "", acceso: "", desc: "" });
    notify("📍 Reporte enviado — se verificará con la comunidad", "#22c55e");
    setTimeout(() => setActiveTab("trafico"), 1200);
  };

  const incType = (id) => INCIDENT_TYPES.find(t => t.id === id) || INCIDENT_TYPES[0];
  const pendingMine = incidents.filter(i => !i.visible && !i.resolved);

  return (
    <div style={{ padding: "16px", paddingBottom: "80px" }}>

      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a2540)", border:"1px solid #1e3a5f", borderRadius:"14px", padding:"16px", marginBottom:"20px", textAlign:"center" }}>
        <div style={{ fontSize:"32px", marginBottom:"8px" }}>📍</div>
        <div style={{ color:"#e2e8f0", fontFamily:MN, fontWeight:"700", fontSize:"14px", letterSpacing:"1px" }}>REPORTAR INCIDENTE</div>
        <div style={{ color:"#64748b", fontSize:"11px", marginTop:"4px" }}>
          Tu reporte será verificado por la comunidad antes de aparecer en el mapa.
          Se necesitan 3 confirmaciones.
        </div>
      </div>

      {/* Tipo */}
      <div style={{ marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"8px" }}>TIPO DE INCIDENTE</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
          {INCIDENT_TYPES.map(t => (
            <button key={t.id} onClick={() => setNewInc(p=>({...p,type:t.id}))} style={{
              padding:"12px 8px",
              border:`1px solid ${newInc.type===t.id ? t.color : "#1e3a5f"}`,
              background: newInc.type===t.id ? t.color+"22" : "#0d1b2e",
              borderRadius:"10px", color: newInc.type===t.id ? t.color : "#64748b",
              fontFamily:MN, fontSize:"12px", cursor:"pointer", transition:"all 0.15s",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"5px",
              fontWeight: newInc.type===t.id ? "700" : "400",
            }}>
              <span style={{ fontSize:"22px" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Acceso rápido — vincular a acceso */}
      <div style={{ marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"8px" }}>ZONA / ACCESO (opcional)</div>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {["", "Acceso Pez Vela", "Acceso Zona Norte", "Blvd. Miguel de la Madrid", "Segundo Acceso"].map(a => (
            <button key={a} onClick={() => setNewInc(p=>({...p,acceso:a}))} style={{
              padding:"6px 10px",
              background: newInc.acceso===a ? "#0369a122" : "#0a1628",
              border:`1px solid ${newInc.acceso===a ? "#0ea5e9" : "#1e3a5f"}`,
              borderRadius:"6px", color: newInc.acceso===a ? "#38bdf8" : "#475569",
              fontFamily:MN, fontSize:"10px", cursor:"pointer", transition:"all 0.15s",
            }}>{a === "" ? "Sin zona" : a}</button>
          ))}
        </div>
      </div>

      {/* Ubicación */}
      <div style={{ marginBottom:"12px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"6px" }}>UBICACIÓN *</div>
        <input
          value={newInc.location}
          onChange={e => setNewInc(p=>({...p,location:e.target.value}))}
          placeholder="Ej: km 8, frente a caseta, carril derecho..."
          style={{ width:"100%", padding:"11px 14px", background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:"10px", color:"#e2e8f0", fontFamily:MN, fontSize:"12px", boxSizing:"border-box", outline:"none" }}
        />
      </div>

      {/* Descripción */}
      <div style={{ marginBottom:"18px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"6px" }}>DESCRIPCIÓN (opcional)</div>
        <textarea
          value={newInc.desc}
          onChange={e => setNewInc(p=>({...p,desc:e.target.value}))}
          placeholder="Detalles del incidente, carriles afectados..."
          rows={3}
          style={{ width:"100%", padding:"11px 14px", background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:"10px", color:"#e2e8f0", fontFamily:MN, fontSize:"12px", boxSizing:"border-box", outline:"none", resize:"none" }}
        />
      </div>

      {/* Preview */}
      {(newInc.location || newInc.acceso) && (
        <div style={{ background:"#0a1628", border:`1px solid ${incType(newInc.type).color}44`, borderRadius:"10px", padding:"12px", marginBottom:"16px" }}>
          <div style={{ fontSize:"9px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"6px" }}>VISTA PREVIA</div>
          <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
            <span style={{ fontSize:"18px" }}>{incType(newInc.type).icon}</span>
            <div>
              <div style={{ color:"#e2e8f0", fontFamily:MN, fontSize:"12px", fontWeight:"700" }}>
                {newInc.acceso ? `${newInc.acceso}${newInc.location ? ` — ${newInc.location}` : ""}` : newInc.location}
              </div>
              {newInc.desc && <div style={{ color:"#64748b", fontSize:"11px", marginTop:"2px" }}>{newInc.desc}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button onClick={submit} style={{
        width:"100%", padding:"14px",
        background: "linear-gradient(135deg,#0369a1,#0ea5e9)",
        border:"none", borderRadius:"12px", color:"#fff",
        fontFamily:MN, fontWeight:"700", fontSize:"13px",
        cursor:"pointer", letterSpacing:"1px", marginBottom:"20px",
      }}>ENVIAR REPORTE →</button>

      {/* Mis reportes pendientes */}
      {pendingMine.length > 0 && (
        <>
          <SectionLabel text="REPORTES PENDIENTES DE VERIFICACIÓN" />
          {pendingMine.map(inc => {
            const t    = incType(inc.type);
            const conf = Object.values(inc.votes).filter(v=>v===1).length;
            return (
              <div key={inc.id} style={{ background:"#0d1b2e", border:`1px solid ${t.color}33`, borderRadius:"10px", padding:"12px", marginBottom:"8px" }}>
                <div style={{ display:"flex", gap:"8px", alignItems:"flex-start", marginBottom:"8px" }}>
                  <span style={{ fontSize:"15px" }}>{t.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#e2e8f0", fontFamily:MN, fontSize:"12px", fontWeight:"700" }}>{inc.location}</div>
                    <div style={{ color:"#475569", fontSize:"10px", fontFamily:MN, marginTop:"2px" }}>{timeAgo(inc.ts)}</div>
                  </div>
                  <Badge color="#f97316" small>PENDIENTE</Badge>
                </div>
                <VoteBar count={conf} needed={15} />
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
function TerminalesTab({ myId }) {
  const [zona,   setZona]   = useState("norte");
  const [stN,    setStN]    = useState(mkTerminals(TERMINALS_NORTE));
  const [stS,    setStS]    = useState(mkTerminals(TERMINALS_SUR));
  const [pvotes, setPvotes] = useState({});
  const [toast,  setToast]  = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };
  const terminals = zona === "norte" ? TERMINALS_NORTE : TERMINALS_SUR;
  const stMap     = zona === "norte" ? stN : stS;
  const setSt     = zona === "norte" ? setStN : setStS;

  // Cargar terminales desde Supabase
  useEffect(() => {
    const allTerms = [...TERMINALS_NORTE, ...TERMINALS_SUR];
    sb.from("terminals").select("*").then(async ({ data }) => {
      if (!data || data.length === 0) {
        // Inicializar si están vacías
        await sb.from("terminals").upsert(allTerms.map(t => ({
          id: t.id, status: "libre", last_update: Date.now(), updated_by: "Sistema"
        })));
        return;
      }
      const mapN = {}; const mapS = {};
      data.forEach(r => {
        const entry = { status: r.status, lastUpdate: r.last_update, updatedBy: r.updated_by, pendingVoters: r.pending_voters || {} };
        if (TERMINALS_NORTE.find(t => t.id === r.id)) mapN[r.id] = entry;
        else mapS[r.id] = entry;
      });
      if (Object.keys(mapN).length) setStN(prev => ({ ...prev, ...mapN }));
      if (Object.keys(mapS).length) setStS(prev => ({ ...prev, ...mapS }));
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

  const vote = async (termId, newStatus) => {
    const key = `terminal_${termId}_${newStatus}`;
    // Verificar si ya votó este dispositivo
    const { data: existing } = await sb.from("votos").select("id").eq("key", key).eq("user_id", myId).single();
    if (existing) return notify("Ya votaste por este estatus", "#f97316");
    // Registrar voto
    await sb.from("votos").insert({ key, user_id: myId, terminal_id: termId, status: newStatus, tipo: "terminal" });
    // Contar votos totales para esta opción
    const { count } = await sb.from("votos").select("id", { count: "exact" }).eq("key", key);
    const total = count || 1;
    notify(`Voto registrado (${total}/50 confirmaciones)`, "#38bdf8");
    if (total >= 50) {
      await sb.from("votos").delete().eq("terminal_id", termId).eq("tipo", "terminal");
      await sb.from("terminals").upsert({ id: termId, status: newStatus, pending_voters: {}, last_update: Date.now(), updated_by: `${total} usuarios` });
      notify(`✅ ${TERMINAL_STATUS_OPTIONS.find(o=>o.id===newStatus)?.label} confirmado!`, "#22c55e");
    }
  };

  const resetAll = async () => {
    const allTerms = [...TERMINALS_NORTE, ...TERMINALS_SUR];
    await sb.from("terminals").upsert(allTerms.map(t => ({
      id: t.id, status: "libre", last_update: Date.now(), updated_by: "Reset"
    })));
    notify("✓ Todas las terminales marcadas como Libres", "#22c55e");
  };

  const resetOne = async (id) => {
    await sb.from("terminals").upsert({ id, status: "libre", last_update: Date.now(), updated_by: "Reset" });
    notify("✓ Terminal marcada como Libre", "#22c55e");
  };

  const getOpt = (id) => TERMINAL_STATUS_OPTIONS.find(o=>o.id===id) || TERMINAL_STATUS_OPTIONS[0];

  return (
    <div style={{ padding:"16px", paddingBottom:"80px" }}>
      {/* Zone toggle */}
      <div style={{ display:"flex", background:"#0a1628", borderRadius:"10px", padding:"4px", marginBottom:"14px", border:"1px solid #1e3a5f" }}>
        {["norte","sur"].map(z => (
          <button key={z} onClick={() => setZona(z)} style={{
            flex:1, padding:"10px",
            background: zona===z ? "linear-gradient(135deg,#0369a1,#0ea5e9)" : "transparent",
            border:"none", borderRadius:"8px", color: zona===z ? "#fff" : "#64748b",
            fontFamily:MN, fontSize:"12px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s", letterSpacing:"1px",
          }}>ZONA {z.toUpperCase()}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"14px" }}>
        {TERMINAL_STATUS_OPTIONS.map(o => (
          <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"4px", background:o.color+"15", border:`1px solid ${o.color}33`, padding:"3px 8px", borderRadius:"4px" }}>
            <span style={{ color:o.color, fontSize:"11px", fontWeight:"700" }}>{o.icon}</span>
            <span style={{ color:o.color, fontSize:"10px", fontFamily:MN }}>{o.label}</span>
          </div>
        ))}
      </div>

      <SectionLabel text={`TERMINALES ZONA ${zona.toUpperCase()}`} rightBtn={<NormalBtn onClick={resetAll} label="TODAS LIBRES" />} />

      {terminals.map(terminal => {
        const st  = stMap[terminal.id];
        const opt = getOpt(st.status);
        return (
          <div key={terminal.id} style={{ background:"#0d1b2e", border:`1px solid ${opt.color}44`, borderRadius:"12px", padding:"14px", marginBottom:"14px", boxShadow:`0 0 18px ${opt.color}08` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
              <div>
                <div style={{ color:"#e2e8f0", fontFamily:MN, fontWeight:"700", fontSize:"14px" }}>{terminal.name}</div>
                <div style={{ color:"#475569", fontSize:"10px", marginTop:"2px" }}>{terminal.fullName}</div>
                <div style={{ color:"#334155", fontSize:"10px", fontFamily:MN, marginTop:"3px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
                <div style={{ background:opt.color+"22", border:`1px solid ${opt.color}66`, color:opt.color, padding:"5px 10px", borderRadius:"6px", fontFamily:MN, fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", gap:"4px" }}>
                  {opt.icon} {opt.label}
                </div>
                {st.status !== "libre" && (
                  <button onClick={() => resetOne(terminal.id)} style={{ padding:"4px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ TODO NORMAL</button>
                )}
              </div>
            </div>
            <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>REPORTAR ESTATUS:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {TERMINAL_STATUS_OPTIONS.map(o => {
                const key    = `${terminal.id}_${o.id}`;
                const vCount = (pvotes[key] || []).length;
                const isAct  = st.status === o.id;
                return (
                  <button key={o.id} onClick={() => vote(terminal.id, o.id)} style={{
                    padding:"8px 6px",
                    background: isAct ? o.color+"33" : "#0a1628",
                    border:`1px solid ${isAct ? o.color : "#1e3a5f"}`,
                    borderRadius:"8px", color: isAct ? o.color : "#64748b",
                    fontFamily:MN, fontSize:"10px", cursor:"pointer",
                    transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px",
                  }}>
                    {o.icon} {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <ToastBox toast={toast} />
    </div>
  );
}

// ─── TAB: SEGUNDO ACCESO ──────────────────────────────────────────────────────
function SegundoAccesoTab() {
  const [carriles, setCarriles] = useState(mkSegundoIngreso);
  const [toast,    setToast]    = useState(null);

  const notify = (msg, color = "#38bdf8") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2800); };

  const TABLA = "carriles";
  const ROW_ID = "segundo_acceso";

  const saveToSupa = async (newState) => {
    await sb.from(TABLA).upsert({ id: ROW_ID, data: newState });
  };

  useEffect(() => {
    sb.from(TABLA).select("*").eq("id", ROW_ID).single().then(({ data }) => {
      if (data?.data) setCarriles(data.data);
    });

    const chan = sb.channel("segundo-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLA }, ({ new: r }) => {
        if (r?.id === ROW_ID && r?.data) setCarriles(r.data);
      }).subscribe();

    return () => sb.removeChannel(chan);
  }, []);

  const updateIngreso = async (id, field, value) => {
    const next = { ...carriles, [id]: { ...carriles[id], [field]: value, lastUpdate: Date.now(), updatedBy: "Tú" } };
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Carril actualizado", "#22c55e");
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
    const next = { ...carriles, [id]: { terminal: def?.defaultTerminal || "ssa", saturado: false, retornos: false, lastUpdate: Date.now(), updatedBy: "Reset" } };
    setCarriles(next);
    await saveToSupa(next);
    notify("✓ Carril restablecido", "#22c55e");
  };

  const getTermName = (id) => TODAS_TERMINALES.find(t => t.id === id)?.name || id?.toUpperCase() || "—";
  const getTermZona = (id) => TODAS_TERMINALES.find(t => t.id === id)?.zona || "";
  const termsNorte  = TODAS_TERMINALES.filter(t => t.zona === "Norte");
  const termsSur    = TODAS_TERMINALES.filter(t => t.zona === "Sur");

  return (
    <div style={{ padding:"16px", paddingBottom:"80px" }}>
      <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"12px", marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:MN, letterSpacing:"2px", marginBottom:"4px" }}>SEGUNDO ACCESO — PUERTO MANZANILLO</div>
        <div style={{ color:"#94a3b8", fontSize:"12px" }}>C1–C3 ingreso con terminal asignada · C4 salida.</div>
      </div>

      {/* Diagram */}
      <div style={{ background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"14px", marginBottom:"18px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"10px" }}>DIAGRAMA — VISTA RÁPIDA</div>
        <div style={{ display:"flex", gap:"6px" }}>
          {SEGUNDO_CARRILES_INGRESO.map(c => {
            const st = carriles[c.id];
            const bc = st.saturado ? "#ef4444" : "#22c55e";
            const tz = getTermZona(st.terminal);
            const tc = tz === "Norte" ? "#38bdf8" : "#a78bfa";
            return (
              <div key={c.id} style={{ flex:1, background:bc+"15", border:`2px solid ${bc}`, borderRadius:"8px", padding:"8px 4px", textAlign:"center" }}>
                <div style={{ color:"#94a3b8", fontFamily:MN, fontSize:"9px", fontWeight:"700" }}>{c.label}</div>
                <div style={{ fontSize:"9px", fontWeight:"700", marginTop:"3px", background:tc+"22", border:`1px solid ${tc}44`, color:tc, borderRadius:"4px", padding:"2px 3px", fontFamily:MN }}>{getTermName(st.terminal)}</div>
                {st.retornos && <div style={{ marginTop:"3px", fontSize:"11px" }}>↩</div>}
                <div style={{ marginTop:"3px", fontSize:"9px", color:bc, fontFamily:MN, fontWeight:"700" }}>{st.saturado ? "SAT" : "OK"}</div>
              </div>
            );
          })}
          <div style={{ flex:1, background: carriles.c4.saturado?"#ef444415":"#f9731615", border:`2px solid ${carriles.c4.saturado?"#ef4444":"#f97316"}`, borderRadius:"8px", padding:"8px 4px", textAlign:"center" }}>
            <div style={{ color:"#94a3b8", fontFamily:MN, fontSize:"9px", fontWeight:"700" }}>C4</div>
            <div style={{ fontSize:"9px", color:"#f97316", fontFamily:MN, marginTop:"3px" }}>SALIDA</div>
            <div style={{ marginTop:"3px", fontSize:"9px", color: carriles.c4.saturado?"#ef4444":"#22c55e", fontFamily:MN, fontWeight:"700" }}>{carriles.c4.saturado ? "SAT" : "OK"}</div>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:"10px", marginTop:"10px", flexWrap:"wrap" }}>
          {[["#22c55e","LIBRE"],["#ef4444","SATURADO"],["#38bdf8","ZONA NORTE"],["#a78bfa","ZONA SUR"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:"3px" }}>
              <div style={{ width:"8px", height:"8px", background:c, borderRadius:"2px" }} />
              <span style={{ fontSize:"9px", color:"#64748b", fontFamily:MN }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ingreso */}
      <SectionLabel text="CARRILES DE INGRESO (C1–C3)" rightBtn={<NormalBtn onClick={resetAll} label="TODO NORMAL" />} />

      {SEGUNDO_CARRILES_INGRESO.map(carril => {
        const st        = carriles[carril.id];
        const termObj   = TODAS_TERMINALES.find(t => t.id === st.terminal);
        const zonaColor = termObj?.zona === "Norte" ? "#38bdf8" : "#a78bfa";
        const isChanged = st.saturado || st.retornos || st.terminal !== carril.defaultTerminal;
        return (
          <div key={carril.id} style={{
            background:"#0d1b2e",
            border:`1px solid ${st.saturado ? "#ef444466" : zonaColor+"44"}`,
            borderRadius:"12px", padding:"14px", marginBottom:"14px",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ background:"#38bdf822", border:"1px solid #38bdf844", borderRadius:"6px", padding:"3px 10px", color:"#38bdf8", fontFamily:MN, fontSize:"13px", fontWeight:"700" }}>{carril.label}</div>
                  <Badge color="#22c55e" small>INGRESO</Badge>
                </div>
                <div style={{ color:"#475569", fontSize:"10px", fontFamily:MN, marginTop:"4px" }}>{timeAgo(st.lastUpdate)} · {st.updatedBy}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"5px" }}>
                <div style={{ display:"flex", gap:"5px" }}>
                  <Badge color={st.saturado ? "#ef4444" : "#22c55e"} small>{st.saturado ? "SATURADO" : "LIBRE"}</Badge>
                  {st.retornos && <Badge color="#f97316" small>↩ RETORNOS</Badge>}
                </div>
                {isChanged && <button onClick={() => resetOne(carril.id)} style={{ padding:"3px 8px", background:"#22c55e15", border:"1px solid #22c55e44", borderRadius:"5px", color:"#22c55e", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight:"700" }}>✓ NORMAL</button>}
              </div>
            </div>

            <div style={{ background:zonaColor+"11", border:`1px solid ${zonaColor}33`, borderRadius:"8px", padding:"10px 12px", marginBottom:"12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:"9px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"2px" }}>TERMINAL ASIGNADA HOY</div>
                <div style={{ color:zonaColor, fontFamily:MN, fontWeight:"700", fontSize:"15px" }}>{termObj?.name}</div>
                <div style={{ color:"#475569", fontSize:"10px", marginTop:"1px" }}>Zona {termObj?.zona}</div>
              </div>
              <span style={{ fontSize:"22px" }}>🚛</span>
            </div>

            <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"8px" }}>CAMBIAR TERMINAL:</div>
            <div style={{ marginBottom:"8px" }}>
              <div style={{ fontSize:"9px", color:"#38bdf8", fontFamily:MN, letterSpacing:"1px", marginBottom:"5px" }}>— ZONA NORTE —</div>
              <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                {termsNorte.map(t => <button key={t.id} onClick={() => updateIngreso(carril.id,"terminal",t.id)} style={{ padding:"5px 10px", background: st.terminal===t.id?"#38bdf822":"#0a1628", border:`1px solid ${st.terminal===t.id?"#38bdf8":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal===t.id?"#38bdf8":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: st.terminal===t.id?"700":"400" }}>{t.name}</button>)}
              </div>
            </div>
            <div style={{ marginBottom:"10px" }}>
              <div style={{ fontSize:"9px", color:"#a78bfa", fontFamily:MN, letterSpacing:"1px", marginBottom:"5px" }}>— ZONA SUR —</div>
              <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
                {termsSur.map(t => <button key={t.id} onClick={() => updateIngreso(carril.id,"terminal",t.id)} style={{ padding:"5px 10px", background: st.terminal===t.id?"#a78bfa22":"#0a1628", border:`1px solid ${st.terminal===t.id?"#a78bfa":"#1e3a5f"}`, borderRadius:"6px", color: st.terminal===t.id?"#a78bfa":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: st.terminal===t.id?"700":"400" }}>{t.name}</button>)}
              </div>
            </div>

            <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px", marginTop:"4px" }}>ESTADO DEL CARRIL:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"6px" }}>
              <button onClick={() => updateIngreso(carril.id,"saturado",false)} style={{ padding:"9px", background: !st.saturado?"#22c55e22":"#0a1628", border:`1px solid ${!st.saturado?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.saturado?"#22c55e":"#64748b", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: !st.saturado?"700":"400", transition:"all 0.15s" }}>✓ LIBRE</button>
              <button onClick={() => updateIngreso(carril.id,"saturado",true)}  style={{ padding:"9px", background: st.saturado?"#ef444422":"#0a1628",  border:`1px solid ${st.saturado?"#ef4444":"#1e3a5f"}`,  borderRadius:"8px", color: st.saturado?"#ef4444":"#64748b",  fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: st.saturado?"700":"400",  transition:"all 0.15s" }}>✗ SATURADO</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              <button onClick={() => updateIngreso(carril.id,"retornos",false)} style={{ padding:"9px", background: !st.retornos?"#22c55e22":"#0a1628", border:`1px solid ${!st.retornos?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !st.retornos?"#22c55e":"#64748b", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: !st.retornos?"700":"400", transition:"all 0.15s" }}>✓ SIN RETORNOS</button>
              <button onClick={() => updateIngreso(carril.id,"retornos",true)}  style={{ padding:"9px", background: st.retornos?"#f9731622":"#0a1628",  border:`1px solid ${st.retornos?"#f97316":"#1e3a5f"}`,  borderRadius:"8px", color: st.retornos?"#f97316":"#64748b",  fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: st.retornos?"700":"400",  transition:"all 0.15s" }}>↩ CON RETORNOS</button>
            </div>
          </div>
        );
      })}

      {/* Salida */}
      <SectionLabel text="CARRIL DE SALIDA (C4)" />
      <div style={{ background:"#0d1b2e", border:`1px solid ${carriles.c4.saturado?"#ef444466":"#f9731644"}`, borderRadius:"12px", padding:"14px", marginBottom:"14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ background:"#f9731622", border:"1px solid #f9731644", borderRadius:"6px", padding:"3px 10px", color:"#f97316", fontFamily:MN, fontSize:"13px", fontWeight:"700" }}>Carril 4</div>
              <Badge color="#f97316" small>SALIDA</Badge>
            </div>
            <div style={{ color:"#475569", fontSize:"10px", fontFamily:MN, marginTop:"4px" }}>{timeAgo(carriles.c4.lastUpdate)} · {carriles.c4.updatedBy}</div>
          </div>
          <Badge color={carriles.c4.saturado?"#ef4444":"#22c55e"} small>{carriles.c4.saturado?"SATURADO":"FLUIDO"}</Badge>
        </div>
        <div style={{ background:"#f9731611", border:"1px solid #f9731633", borderRadius:"8px", padding:"10px 12px", marginBottom:"12px", display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"22px" }}>🚚</span>
          <div>
            <div style={{ color:"#f97316", fontFamily:MN, fontWeight:"700", fontSize:"13px" }}>Salida General del Puerto</div>
            <div style={{ color:"#475569", fontSize:"10px", marginTop:"1px" }}>Todos los vehículos en salida</div>
          </div>
        </div>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>ESTADO DEL CARRIL:</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"6px" }}>
          <button onClick={() => updateSalida("saturado",false)} style={{ padding:"10px", background: !carriles.c4.saturado?"#22c55e22":"#0a1628", border:`1px solid ${!carriles.c4.saturado?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !carriles.c4.saturado?"#22c55e":"#64748b", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: !carriles.c4.saturado?"700":"400" }}>✓ FLUIDO</button>
          <button onClick={() => updateSalida("saturado",true)}  style={{ padding:"10px", background: carriles.c4.saturado?"#ef444422":"#0a1628",  border:`1px solid ${carriles.c4.saturado?"#ef4444":"#1e3a5f"}`,  borderRadius:"8px", color: carriles.c4.saturado?"#ef4444":"#64748b",  fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: carriles.c4.saturado?"700":"400"  }}>✗ SATURADO</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
          <button onClick={() => updateSalida("retornos",false)} style={{ padding:"10px", background: !carriles.c4.retornos?"#22c55e22":"#0a1628", border:`1px solid ${!carriles.c4.retornos?"#22c55e":"#1e3a5f"}`, borderRadius:"8px", color: !carriles.c4.retornos?"#22c55e":"#64748b", fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: !carriles.c4.retornos?"700":"400" }}>✓ SIN RETORNOS</button>
          <button onClick={() => updateSalida("retornos",true)}  style={{ padding:"10px", background: carriles.c4.retornos?"#f9731622":"#0a1628",  border:`1px solid ${carriles.c4.retornos?"#f97316":"#1e3a5f"}`,  borderRadius:"8px", color: carriles.c4.retornos?"#f97316":"#64748b",  fontFamily:MN, fontSize:"11px", cursor:"pointer", fontWeight: carriles.c4.retornos?"700":"400"  }}>↩ CON RETORNOS</button>
        </div>
      </div>

      <ToastBox toast={toast} />
    </div>
  );
}

// ─── TAB: CARRILES (expo/impo por acceso) ────────────────────────────────────
function CarrilesTab() {
  const [estado,  setEstado]  = useState(mkCarrilesState);
  const [accView, setAccView] = useState("pezvela");
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
    <div style={{ padding:"16px", paddingBottom:"80px" }}>
      <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:MN, letterSpacing:"2px", marginBottom:"4px" }}>CARRILES — PUERTO MANZANILLO</div>
        <div style={{ color:"#94a3b8", fontSize:"12px" }}>Estado de carriles de exportación e importación por acceso.</div>
      </div>

      {/* Resumen general */}
      <div style={{ background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"12px", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:"#64748b", fontFamily:MN, letterSpacing:"1px", marginBottom:"10px" }}>RESUMEN GENERAL</div>
        {ACCESOS_CARRILES.map(acc => {
          const total    = acc.carriles.length;
          const abiertos = acc.carriles.filter(c => estado[c.id]?.abierto !== false).length;
          const pct      = Math.round((abiertos / total) * 100);
          return (
            <div key={acc.id} style={{ marginBottom:"8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                <span style={{ fontSize:"11px", color:acc.color, fontFamily:MN, fontWeight:"700" }}>{acc.label}</span>
                <span style={{ fontSize:"10px", color:"#64748b", fontFamily:MN }}>{abiertos}/{total} abiertos</span>
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
              <span style={{ fontSize:"8px", color:"#64748b", fontFamily:MN }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selector acceso */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {ACCESOS_CARRILES.map(acc => (
          <button key={acc.id} onClick={() => setAccView(acc.id)} style={{
            flex:1, padding:"9px 4px",
            background: accView===acc.id ? acc.color+"22" : "#0a1628",
            border:`1px solid ${accView===acc.id ? acc.color : "#1e3a5f"}`,
            borderRadius:"8px", color: accView===acc.id ? acc.color : "#475569",
            fontFamily:MN, fontSize:"9px", fontWeight: accView===acc.id?"700":"400",
            cursor:"pointer", transition:"all 0.15s", textAlign:"center",
          }}>
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
              <span style={{ color:currentAcc.color, fontFamily:MN, fontWeight:"700", fontSize:"14px" }}>{currentAcc.label}</span>
              <Badge color={currentAcc.zona==="Norte"?"#38bdf8":"#a78bfa"} small>ZONA {currentAcc.zona.toUpperCase()}</Badge>
            </div>
            <NormalBtn onClick={() => resetAcceso(currentAcc)} label="TODO ABIERTO" />
          </div>

          {/* Exportación */}
          {expoCarriles.length > 0 && (
            <>
              <div style={{ fontSize:"10px", color:EXPO_COLOR, fontFamily:MN, letterSpacing:"2px", marginBottom:"10px" }}>📤 EXPORTACIÓN</div>
              <div style={{ display:"grid", gridTemplateColumns: expoCarriles.length===1?"1fr":"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
                {expoCarriles.map(carril => {
                  const st = estado[carril.id] || {};
                  return (
                    <div key={carril.id} style={{ background:"#0d1b2e", border:`2px solid ${st.abierto?EXPO_COLOR+"88":"#6b728055"}`, borderRadius:"12px", padding:"14px", textAlign:"center", opacity: st.abierto?1:0.65, transition:"all 0.2s" }}>
                      <div style={{ fontSize:"11px", color:"#94a3b8", fontFamily:MN, marginBottom:"3px" }}>{carril.label}</div>
                      <div style={{ fontSize:"20px", marginBottom:"6px" }}>📤</div>
                      <div style={{ fontSize:"10px", color:EXPO_COLOR, fontFamily:MN, fontWeight:"700", marginBottom:"12px" }}>EXPORTACIÓN</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"8px" }}>
                        <button onClick={() => toggle(carril.id, true)}  style={{ padding:"7px 4px", background: st.abierto?"#22c55e22":"#0a1628", border:`1px solid ${st.abierto?"#22c55e":"#1e3a5f"}`, borderRadius:"6px", color: st.abierto?"#22c55e":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: st.abierto?"700":"400" }}>✓ ABIERTO</button>
                        <button onClick={() => toggle(carril.id, false)} style={{ padding:"7px 4px", background: !st.abierto?"#6b728022":"#0a1628", border:`1px solid ${!st.abierto?"#6b7280":"#1e3a5f"}`, borderRadius:"6px", color: !st.abierto?"#9ca3af":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: !st.abierto?"700":"400" }}>⛔ CERRADO</button>
                      </div>
                      <div style={{ padding:"5px", background: st.abierto?"#22c55e15":"#6b728015", borderRadius:"6px", fontSize:"10px", color: st.abierto?"#22c55e":"#6b7280", fontFamily:MN, fontWeight:"700" }}>{st.abierto?"● OPERANDO":"● CERRADO"}</div>
                      <div style={{ fontSize:"9px", color:"#334155", fontFamily:MN, marginTop:"5px" }}>{timeAgo(st.lastUpdate)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Importación */}
          {impoCarriles.length > 0 && (
            <>
              <div style={{ fontSize:"10px", color:IMPO_COLOR, fontFamily:MN, letterSpacing:"2px", marginBottom:"10px" }}>📥 IMPORTACIÓN</div>
              <div style={{ display:"grid", gridTemplateColumns: impoCarriles.length===1?"1fr":"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
                {impoCarriles.map(carril => {
                  const st = estado[carril.id] || {};
                  return (
                    <div key={carril.id} style={{ background:"#0d1b2e", border:`2px solid ${st.abierto?IMPO_COLOR+"88":"#6b728055"}`, borderRadius:"12px", padding:"14px", textAlign:"center", opacity: st.abierto?1:0.65, transition:"all 0.2s" }}>
                      <div style={{ fontSize:"11px", color:"#94a3b8", fontFamily:MN, marginBottom:"3px" }}>{carril.label}</div>
                      <div style={{ fontSize:"20px", marginBottom:"6px" }}>📥</div>
                      <div style={{ fontSize:"10px", color:IMPO_COLOR, fontFamily:MN, fontWeight:"700", marginBottom:"12px" }}>IMPORTACIÓN</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px", marginBottom:"8px" }}>
                        <button onClick={() => toggle(carril.id, true)}  style={{ padding:"7px 4px", background: st.abierto?"#22c55e22":"#0a1628", border:`1px solid ${st.abierto?"#22c55e":"#1e3a5f"}`, borderRadius:"6px", color: st.abierto?"#22c55e":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: st.abierto?"700":"400" }}>✓ ABIERTO</button>
                        <button onClick={() => toggle(carril.id, false)} style={{ padding:"7px 4px", background: !st.abierto?"#6b728022":"#0a1628", border:`1px solid ${!st.abierto?"#6b7280":"#1e3a5f"}`, borderRadius:"6px", color: !st.abierto?"#9ca3af":"#475569", fontFamily:MN, fontSize:"10px", cursor:"pointer", fontWeight: !st.abierto?"700":"400" }}>⛔ CERRADO</button>
                      </div>
                      <div style={{ padding:"5px", background: st.abierto?"#22c55e15":"#6b728015", borderRadius:"6px", fontSize:"10px", color: st.abierto?"#22c55e":"#6b7280", fontFamily:MN, fontWeight:"700" }}>{st.abierto?"● OPERANDO":"● CERRADO"}</div>
                      <div style={{ fontSize:"9px", color:"#334155", fontFamily:MN, marginTop:"5px" }}>{timeAgo(st.lastUpdate)}</div>
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


// ─── TAB: DONATIVOS ───────────────────────────────────────────────────────────
function DonativosTab() {
  const [copied, setCopied] = useState(false);
  const CLABE = "042180010045965913";
  const copyClabe = () => {
    navigator.clipboard.writeText(CLABE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  return (
    <div style={{ padding:"20px 16px", maxWidth:"480px" }}>
      {/* Hero emotivo */}
      <div style={{ textAlign:"center", marginBottom:"28px" }}>
        <div style={{ fontSize:"48px", marginBottom:"12px" }}>⚓</div>
        <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"16px", letterSpacing:"2px", color:"#e2e8f0", marginBottom:"8px" }}>JUNTOS SOMOS MÁS FUERTES</div>
        <div style={{ width:"48px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"0 auto 16px" }} />
      </div>

      {/* Mensaje emotivo */}
      <div style={{ background:"linear-gradient(135deg,#0d1b2e,#0a1628)", border:"1px solid #1e3a5f", borderRadius:"16px", padding:"20px", marginBottom:"20px" }}>
        <div style={{ fontSize:"22px", textAlign:"center", marginBottom:"14px" }}>💙🚛💙</div>
        <p style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"#94a3b8", lineHeight:"1.9", marginBottom:"12px" }}>
          Puerto Tráfico nació de la comunidad y <span style={{ color:"#38bdf8", fontWeight:"700" }}>para la comunidad</span>. Cada operador, transportista y trabajador portuario que comparte información en tiempo real hace que este sistema funcione.
        </p>
        <p style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"#94a3b8", lineHeight:"1.9", marginBottom:"12px" }}>
          Mantener esta plataforma activa tiene costos reales: servidores, desarrollo y mejoras constantes. Si Puerto Tráfico te ha ahorrado tiempo en la cola, te ha ayudado a tomar una mejor ruta o simplemente te ha dado <span style={{ color:"#22c55e", fontWeight:"700" }}>tranquilidad en tu jornada</span>... considera apoyar con lo que puedas.
        </p>
        <p style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"#94a3b8", lineHeight:"1.9" }}>
          No importa el monto — cada aportación es un <span style={{ color:"#a78bfa", fontWeight:"700" }}>voto de confianza</span> en que podemos construir algo mejor, juntos, para el Puerto de Manzanillo y todos los que lo mueven día a día. 🙏
        </p>
      </div>

      {/* Corazones / separador visual */}
      <div style={{ textAlign:"center", fontSize:"13px", color:"#1e3a5f", marginBottom:"20px", letterSpacing:"6px" }}>♥ ♥ ♥</div>

      {/* Datos bancarios */}
      <div style={{ background:"#0d1b2e", border:"2px solid #38bdf855", borderRadius:"16px", padding:"20px", marginBottom:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
          <div style={{ width:"8px", height:"8px", background:"#38bdf8", borderRadius:"50%", boxShadow:"0 0 8px #38bdf8" }} />
          <span style={{ fontFamily:MN, fontWeight:"700", fontSize:"12px", letterSpacing:"2px", color:"#38bdf8" }}>DATOS PARA DONATIVO</span>
        </div>

        <div style={{ marginBottom:"14px" }}>
          <div style={{ fontSize:"9px", color:"#475569", fontFamily:MN, letterSpacing:"1px", marginBottom:"5px" }}>BANCO</div>
          <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"16px", color:"#e2e8f0", letterSpacing:"2px" }}>MIFEL</div>
        </div>

        <div style={{ marginBottom:"18px" }}>
          <div style={{ fontSize:"9px", color:"#475569", fontFamily:MN, letterSpacing:"1px", marginBottom:"7px" }}>CUENTA CLABE</div>
          <div style={{ background:"#060e1a", border:"1px solid #1e3a5f", borderRadius:"10px", padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:MN, fontWeight:"700", fontSize:"14px", color:"#38bdf8", letterSpacing:"2px" }}>{CLABE}</span>
            <button onClick={copyClabe} style={{
              padding:"6px 12px", background: copied ? "#22c55e22" : "#38bdf822",
              border:`1px solid ${copied ? "#22c55e" : "#38bdf855"}`,
              borderRadius:"7px", color: copied ? "#22c55e" : "#38bdf8",
              fontFamily:MN, fontSize:"10px", fontWeight:"700", cursor:"pointer", transition:"all 0.2s", flexShrink:0, marginLeft:"10px",
            }}>
              {copied ? "✓ COPIADO" : "📋 COPIAR"}
            </button>
          </div>
        </div>

        <div style={{ background:"#22c55e11", border:"1px solid #22c55e33", borderRadius:"10px", padding:"12px", textAlign:"center" }}>
          <div style={{ fontSize:"20px", marginBottom:"4px" }}>🙏</div>
          <div style={{ fontFamily:MN, fontSize:"10px", color:"#22c55e", fontWeight:"700" }}>GRACIAS POR MANTENER VIVA LA COMUNIDAD</div>
        </div>
      </div>

      {/* Frase final */}
      <div style={{ textAlign:"center", padding:"12px" }}>
        <div style={{ fontFamily:MN, fontSize:"10px", color:"#334155", letterSpacing:"1px" }}>
          Hecho con ❤️ por y para los que mueven el puerto
        </div>
      </div>
    </div>
  );
}

// ─── TAB: TUTORIAL ────────────────────────────────────────────────────────────
function TutorialTab({ setActive }) {
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen(prev => prev === id ? null : id);

  const sections = [
    {
      id: "trafico",
      icon: "🗺️",
      color: "#38bdf8",
      title: "TRÁFICO",
      subtitle: "Mapa en vivo + Accesos + Incidentes",
      items: [
        { label: "Mapa en vivo", desc: "Muestra visualmente los accesos principales (Pez Vela y Zona Norte) con su estatus actual, además de los pins de incidentes activos reportados por la comunidad. El botón VER EN MAPS abre Google Maps en la zona portuaria." },
        { label: "Accesos Principales", desc: "Cada acceso (Pez Vela y Zona Norte) muestra su estatus en tiempo real. Puedes votar el estado actual: Libre/Fluido, Tráfico Lento, Saturado o Cerrado. Si hay unidad en los votos de la comunidad, el estatus se actualiza automáticamente." },
        { label: "Tipo de Retorno", desc: "Debajo del estatus, puedes indicar si hay retornos activos: Sin Retornos (flujo normal), Retorno Terminal (unidades regresan desde la terminal) o Retorno ASIPONA (retorno desde el punto de control de ASIPONA)." },
        { label: "Incidentes Pendientes", desc: "Reportes que aún no tienen 3 votos de confirmación. Puedes confirmar que el incidente es real (✓ Confirmar) o marcarlo como falso (✗ Falso) para ayudar a filtrar información incorrecta." },
        { label: "Incidentes Activos", desc: "Reportes verificados por la comunidad (3+ votos). Muestran tipo, ubicación, descripción y tiempo transcurrido. Puedes votar para marcarlos como resueltos cuando el problema se haya solucionado." },
      ],
    },
    {
      id: "reporte",
      icon: "📍",
      color: "#f97316",
      title: "REPORTAR",
      subtitle: "Envía un nuevo incidente al mapa",
      items: [
        { label: "Tipo de Incidente", desc: "Elige entre cuatro categorías: Accidente 🚨 (colisión o volcadura), Tráfico Pesado 🚦 (congestión inusual), Bloqueo / Corte 🚧 (vía interrumpida por manifestación u objeto) y Obra / Desvío 🏗️ (trabajos viales con cambio de carril)." },
        { label: "Ubicación", desc: "Escribe el punto exacto del problema: nombre de la calle, kilómetro, acceso o referencia conocida. Sé específico para que otros conductores puedan identificarlo fácilmente." },
        { label: "Descripción (opcional)", desc: "Añade detalles extra: cuántos carriles afecta, si hay servicios de emergencia, tiempo estimado, etc. Entre más información, más útil para la comunidad." },
        { label: "Enviar Reporte", desc: "Al enviar, tu reporte aparece como PENDIENTE y necesita 3 votos de confirmación de otros usuarios para volverse visible en el mapa. Esto evita reportes falsos o erróneos." },
      ],
    },
    {
      id: "terminales",
      icon: "⚓",
      color: "#a78bfa",
      title: "TERMINALES",
      subtitle: "Estatus de las 9 terminales del puerto",
      items: [
        { label: "Zona Norte — CONTECON y HAZESA", desc: "Muestra el estatus de las dos terminales de la zona norte. Cada una puede estar: Terminal Libre ✓ (acepta unidades), Terminal Llena ✗ (no acepta por capacidad), Retorno Terminal ↩ (te regresan desde la pluma) o Retorno ASIPONA ⚓ (te regresan desde el control de ASIPONA)." },
        { label: "Zona Sur — 7 terminales", desc: "TIMSA, SSA, OCUPA, MULTIMODAL, FRIMAN, LA JUNTA y CEMEX. Mismos estados que Zona Norte. El color del borde indica el estatus: verde=libre, rojo=llena, naranja=retorno terminal, morado=retorno ASIPONA." },
        { label: "Actualizar estatus", desc: "Toca el estatus deseado en la terminal correspondiente. El cambio aplica de inmediato y queda registrado con la hora de actualización. Usa el botón TODO NORMAL para restablecer todas las terminales a Libre de una sola vez." },
        { label: "Tiempo de actualización", desc: "Cada tarjeta muestra cuándo fue la última vez que se actualizó el estatus ('hace X min'). Esto te ayuda a saber qué tan reciente es la información." },
      ],
    },
    {
      id: "segundo",
      icon: "🛣️",
      color: "#34d399",
      title: "2DO ACCESO",
      subtitle: "Carriles de ingreso con terminal asignada",
      items: [
        { label: "Accesos disponibles", desc: "Muestra los accesos de entrada al segundo acceso portuario: Acceso Pez Vela (Zona Sur, 4 carriles de ingreso), Puerta 15 (Zona Sur) y Acceso Zona Norte. Selecciona el acceso que te corresponde con los botones superiores." },
        { label: "Carriles de Ingreso (C1–C4)", desc: "Cada carril tiene asignada una terminal de destino por defecto. Puedes cambiar a qué terminal está dirigiendo ese carril, indicar si está saturado (cola larga) y si hay retornos activos en ese carril específico." },
        { label: "Carril Salida (C4)", desc: "El Carril 4 del Acceso Pez Vela es exclusivo de salida. Solo muestra si está saturado o con retornos, sin asignación de terminal." },
        { label: "TODO ABIERTO", desc: "Botón para restablecer todos los carriles del acceso seleccionado a su configuración normal: terminal por defecto, sin saturación y sin retornos." },
      ],
    },
    {
      id: "carriles",
      icon: "🚦",
      color: "#eab308",
      title: "CARRILES",
      subtitle: "Carriles de Exportación e Importación",
      items: [
        { label: "Selección de acceso", desc: "Elige entre Acceso Pez Vela (Zona Sur, 4 carriles expo/impo), Puerta 15 (Zona Sur, 3 carriles) y Zona Norte (3 carriles). Los botones muestran el ícono de zona para diferenciarlos fácilmente." },
        { label: "Carriles de Exportación 📤", desc: "Carriles destinados a camiones que llevan carga al barco (expo). Cada carril puede marcarse como ABIERTO ✓ (operando con normalidad) o CERRADO ⛔ (no recibe unidades). El estado se refleja en el color del borde." },
        { label: "Carriles de Importación 📥", desc: "Carriles para camiones que retiran mercancía del buque (impo). Misma lógica que exportación: ABIERTO o CERRADO. Un carril cerrado aparece con opacidad reducida para identificarlo de un vistazo." },
        { label: "TODO ABIERTO", desc: "Restablece todos los carriles del acceso seleccionado a estado ABIERTO/OPERANDO de una sola vez. Útil al inicio del turno o cuando se normaliza la operación." },
      ],
    },
    {
      id: "donativos",
      icon: "💙",
      color: "#ec4899",
      title: "DONATIVOS",
      subtitle: "Apoya el proyecto de la comunidad",
      items: [
        { label: "¿Para qué sirven los donativos?", desc: "Puerto Tráfico es una plataforma gratuita mantenida por la comunidad. Los donativos cubren costos de servidor, desarrollo de nuevas funciones y mejoras continuas para que la app siga funcionando sin interrupciones." },
        { label: "Cómo donar", desc: "Realiza una transferencia SPEI al banco MIFEL usando la cuenta CLABE que aparece en la sección. El botón COPIAR facilita guardar el número sin errores de escritura." },
        { label: "Cualquier monto ayuda", desc: "No hay monto mínimo ni máximo. Cada aportación, grande o pequeña, contribuye a mantener viva la herramienta que toda la comunidad portuaria usa diariamente." },
      ],
    },
  ];

  return (
    <div style={{ padding:"20px 16px" }}>
      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:"24px" }}>
        <div style={{ fontSize:"36px", marginBottom:"10px" }}>📖</div>
        <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"14px", letterSpacing:"2px", color:"#e2e8f0", marginBottom:"6px" }}>GUÍA DE USO</div>
        <div style={{ fontFamily:MN, fontSize:"10px", color:"#475569", letterSpacing:"1px" }}>PUERTO TRÁFICO · MANZANILLO</div>
        <div style={{ width:"40px", height:"2px", background:"linear-gradient(90deg,#38bdf8,#a78bfa)", margin:"12px auto 0" }} />
      </div>

      {/* Intro */}
      <div style={{ background:"#0d1b2e", border:"1px solid #1e3a5f", borderRadius:"12px", padding:"14px", marginBottom:"20px" }}>
        <p style={{ fontFamily:MN, fontSize:"11px", color:"#64748b", lineHeight:"1.8" }}>
          Toca cualquier sección para ver la explicación detallada de cada función. Esta guía cubre todas las pestañas y opciones de la aplicación.
        </p>
      </div>

      {/* Accordion */}
      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom:"10px" }}>
          <button onClick={() => toggle(sec.id)} style={{
            width:"100%", background: open===sec.id ? sec.color+"22" : "#0d1b2e",
            border:`1px solid ${open===sec.id ? sec.color+"88" : "#1e3a5f"}`,
            borderRadius: open===sec.id ? "12px 12px 0 0" : "12px",
            padding:"14px 16px", display:"flex", alignItems:"center", gap:"10px",
            cursor:"pointer", transition:"all 0.2s", textAlign:"left",
          }}>
            <span style={{ fontSize:"20px" }}>{sec.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:MN, fontWeight:"700", fontSize:"12px", color: open===sec.id ? sec.color : "#e2e8f0", letterSpacing:"1px" }}>{sec.title}</div>
              <div style={{ fontFamily:MN, fontSize:"9px", color:"#475569", marginTop:"2px" }}>{sec.subtitle}</div>
            </div>
            <span style={{ color: open===sec.id ? sec.color : "#334155", fontSize:"14px", transition:"transform 0.2s", transform: open===sec.id ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </button>

          {open === sec.id && (
            <div style={{ background:"#060e1a", border:`1px solid ${sec.color}44`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:"14px 16px" }}>
              {sec.items.map((item, i) => (
                <div key={i} style={{ marginBottom: i < sec.items.length-1 ? "14px" : "0", paddingBottom: i < sec.items.length-1 ? "14px" : "0", borderBottom: i < sec.items.length-1 ? "1px solid #0d1b2e" : "none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"5px" }}>
                    <div style={{ width:"5px", height:"5px", background:sec.color, borderRadius:"50%", flexShrink:0 }} />
                    <span style={{ fontFamily:MN, fontWeight:"700", fontSize:"11px", color:sec.color }}>{item.label}</span>
                  </div>
                  <p style={{ fontFamily:MN, fontSize:"10px", color:"#64748b", lineHeight:"1.8", paddingLeft:"11px" }}>{item.desc}</p>
                </div>
              ))}

              {/* Botón ir a la sección */}
              {sec.id !== "donativos" && (
                <button onClick={() => setActive(sec.id)} style={{
                  width:"100%", marginTop:"14px", padding:"10px",
                  background:`${sec.color}22`, border:`1px solid ${sec.color}55`,
                  borderRadius:"8px", color:sec.color, fontFamily:MN, fontSize:"10px",
                  fontWeight:"700", cursor:"pointer", letterSpacing:"1px",
                }}>
                  IR A {sec.title} →
                </button>
              )}
              {sec.id === "donativos" && (
                <button onClick={() => setActive("donativos")} style={{
                  width:"100%", marginTop:"14px", padding:"10px",
                  background:"#ec489922", border:"1px solid #ec489955",
                  borderRadius:"8px", color:"#ec4899", fontFamily:MN, fontSize:"10px",
                  fontWeight:"700", cursor:"pointer", letterSpacing:"1px",
                }}>
                  IR A DONATIVOS 💙 →
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Footer */}
      <div style={{ textAlign:"center", marginTop:"24px", padding:"14px", background:"#0d1b2e", borderRadius:"12px", border:"1px solid #1e3a5f" }}>
        <div style={{ fontSize:"20px", marginBottom:"6px" }}>⚓</div>
        <div style={{ fontFamily:MN, fontSize:"10px", color:"#334155", lineHeight:"1.8" }}>
          Puerto Tráfico es una herramienta colaborativa.<br/>
          <span style={{ color:"#38bdf8" }}>Tu información hace la diferencia.</span>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [active,    setActive]    = useState("trafico");
  // ID permanente por dispositivo — sobrevive recargas
  const [myId] = useState(() => {
    const stored = localStorage.getItem("puerto_trafico_uid");
    if (stored) return stored;
    const newId = uid();
    localStorage.setItem("puerto_trafico_uid", newId);
    return newId;
  });
  const [incidents, setIncidents] = useState([]);
  const [dbReady,   setDbReady]   = useState(false);

  // ── Cargar incidentes desde Supabase al iniciar ──
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

    // Suscripción en tiempo real
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
    <div style={{ minHeight:"100vh", background:"#060e1a", color:"#e2e8f0", maxWidth:"480px", margin:"0 auto" }}>
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
      <div style={{ background:"linear-gradient(135deg,#0a0f1e,#0d1b2e)", padding:"14px 16px", borderBottom:"1px solid #1e3a5f", display:"flex", alignItems:"center", gap:"12px" }}>
        <div style={{ width:"36px", height:"36px", background:"linear-gradient(135deg,#0369a1,#0ea5e9)", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>⚓</div>
        <div>
          <div style={{ fontFamily:"'Space Mono',monospace", fontWeight:"700", fontSize:"14px", letterSpacing:"2px", color:"#e2e8f0" }}>PUERTO TRÁFICO</div>
          <div style={{ fontSize:"10px", color:"#38bdf8", fontFamily:"'Space Mono',monospace", letterSpacing:"1px" }}>MANZANILLO · COMUNIDAD EN VIVO</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
          <div style={{ width:"6px", height:"6px", background:"#22c55e", borderRadius:"50%", animation:"pulse 2s infinite" }} />
          <span style={{ fontSize:"10px", color:"#22c55e", fontFamily:"'Space Mono',monospace" }}>EN VIVO</span>
        </div>
      </div>

      <NavBar active={active} set={setActive} />

      {active === "trafico"    && <TraficoTab    myId={myId} incidents={incidents} setIncidents={setIncidents} />}
      {active === "reporte"    && <ReporteTab    myId={myId} incidents={incidents} setIncidents={setIncidents} setActiveTab={setActive} />}
      {active === "terminales" && <TerminalesTab myId={myId} />}
      {active === "segundo"    && <SegundoAccesoTab />}
      {active === "carriles"   && <CarrilesTab />}
      {active === "donativos"  && <DonativosTab />}
      {active === "tutorial"   && <TutorialTab setActive={setActive} />}
    </div>
  );
}