import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Logo Base64 (codificado en miniatura para evitar archivos externos)
const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDEgNzkuMTQ2Mjg5OSwgMjAyMy8wNi8yNS0yMDowMTo1NSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI1LjEgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyNC0wMi0yMVQxNjozMDowMC0wNjowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjQtMDItMjFUMTY6MzA6MzAtMDY6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDItMjFUMTY6MzA6MzAtMDY6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmQ3ZTU2YTU2LWE5YjMtNGY0Zi1iNGE3LTJlYjhjZjE2YzI3ZiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpkN2U1NmE1Ni1hOWIzLTRmNGYtYjRhNy0yZWI4Y2YxNmMyN2YiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDpkN2U1NmE1Ni1hOWIzLTRmNGYtYjRhNy0yZWI4Y2YxNmMyN2YiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmQ3ZTU2YTU2LWE5YjMtNGY0Zi1iNGE3LTJlYjhjZjE2YzI3ZiIgc3RFdnQ6d2hlbj0iMjAyNC0wMi0yMVQxNjozMDowMC0wNjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI1LjEgKFdpbmRvd3MpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv6FxT8AAANTSURBVHic7Z07aBRBGMd/l0QwKoJiIWIhFoKNYCFYiI1gIViIjWAhWAgWgoVgIViIjWAhWAgWgoVgIViIjWAhWAgWgoVgITaCRUQEwUKwECwEC8FCsBAsBAvBQrAQLAQLwUKwECwEC8FCsBAsBAvBQrAQLAQLwUKwECwEC8FCsBAsBAvBQrAQLAQLwUKwECwEC8Fi/6YPwDAMwzAMwzAMwzCMv8+/oQvYBGwFtgE7gN3AXuAAsA84CBwCDgNHgKPAMeA4cAI4CZwCTgNngLPAOeA8cAG4CFwCLgNXgKvANeA6cAO4CdwCbgN3gLvAPeA+8AB4CDwCHgNPgKfAM+A58AJ4CbwCXgNvgLfAO+A98AH4CHwCPgNfgK/AN+A78AP4CfwCfgN/gL/AP8LMJmATsBnYAmwFtgHbgR3ATmAXsBvYA+wF9gH7gQPAQeAQcBg4AhwFjgHHgRPASZqGnAJOA2eAs8A54DxwAbgIXAIuA1eAq8A14DpwA7gJ3AJuA3eAu8A94D7wAHgIPAIeA0+Ap8Az4DnwAngJvAJeA2+At8A74D3wAfgIfAI+A1+Ar8A34DvwA/gJ/AJ+A3+Af0CTkE3AZmALsBXYBmwHdgA7gV3AbmAPsBfYB+wHDgAHgUPAYeAIcBQ4BhwHTgAngZPAKeA0cAY4C5wDzgMXgIvAJeAycAW4ClwDrgM3gJvALeA2cAe4C9wD7gMPgIfAI+Ax8AR4CjwDngMvgJfAK+A18AZ4C7wD3gMfgI/AJ+Az8AX4CnwDvgM/gJ/AL+A38Af4BzQJ2QRsBrYAW4FtwHZgB7AT2AXsBvYAe4F9wH7gAHAQOAQcBo4AR4FjwHHgBHASOAWcBs4AZ4FzwHngAnARuARcBq4AV4FrwHXgBnATuAXcBu4Ad4F7wH3gAfAQeAQ8Bp4AT4FnwHPgBfASeAW8Bt4Ab4F3wHvgA/AR+AR8Br4AX4FvwHfgB/AT+AX8Bv4A/4AmIZuAzcAWYCuwDdgO7AB2AruA3cAeYC+wD9gPHAAOAoeAw8AR4ChwDDgOnABOAqeA08AZ4CxwDjgPXAAuApeAy8AV4CpwDbgO3ABuAreA28Ad4C5wD7gPPAAeAo+Ax8AT4CnwDHgOvABeAq+A18Ab4C3wDngPfAA+Ap+Az8AX4CvwDfgO/AB+Ar+A38Af4B/wH1bFYmZK7qH+AAAAAElFTkSuQmCC";

// Función sanitizadora XSS
function sanitize(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  return str.replace(reg, (match)=>(map[match]));
}

// Rate limiter
const rateLimiter = (() => {
  const limits = new Map();
  return (key, maxCalls, timeWindow) => {
    const now = Date.now();
    if (!limits.has(key)) {
      limits.set(key, []);
    }
    const calls = limits.get(key).filter(t => now - t < timeWindow);
    if (calls.length >= maxCalls) {
      return false;
    }
    calls.push(now);
    limits.set(key, calls);
    return true;
  };
})();

// SQL cleanup function
async function limpiarVotosExpirados() {
  try {
    const { error } = await supabase.rpc('limpiar_votos_expirados');
    if (error) console.error('Error limpiando votos:', error);
  } catch (err) {
    console.error('Error en limpieza:', err);
  }
}



export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [accesos, setAccesos] = useState({});
  const [terminales, setTerminales] = useState({});
  const [patios, setPatios] = useState({});
  const [carriles, setCarriles] = useState({});
  const [incidentes, setIncidentes] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [votosLocales, setVotosLocales] = useState({});
  const [cookieConsent, setCookieConsent] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [logoTaps, setLogoTaps] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    setCookieConsent(consent);
  }, []);

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setCookieConsent('accepted');
  };

  const handleRejectCookies = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    setCookieConsent('rejected');
  };

  useEffect(() => {
    fetchData();
    limpiarVotosExpirados();
    const interval = setInterval(() => {
      limpiarVotosExpirados();
    }, 60000);

    const channel = supabase
      .channel('cambios-publicos')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'accesos' }, 
        () => fetchAccesos()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'terminales' }, 
        () => fetchTerminales()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'patios' }, 
        () => fetchPatios()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'carriles' }, 
        () => fetchCarriles()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'incidentes' }, 
        () => fetchIncidentes()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'noticias' }, 
        () => fetchNoticias()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    await Promise.all([
      fetchAccesos(),
      fetchTerminales(),
      fetchPatios(),
      fetchCarriles(),
      fetchIncidentes(),
      fetchNoticias()
    ]);
  }

  async function fetchAccesos() {
    const { data, error } = await supabase.from('accesos').select('*');
    if (!error && data) {
      const map = {};
      data.forEach(a => { map[a.nombre] = a.estado; });
      setAccesos(map);
    }
  }

  async function fetchTerminales() {
    const { data, error } = await supabase.from('terminales').select('*');
    if (!error && data) {
      const map = {};
      data.forEach(t => { map[t.nombre] = t.estado; });
      setTerminales(map);
    }
  }

  async function fetchPatios() {
    const { data, error } = await supabase.from('patios').select('*');
    if (!error && data) {
      const map = {};
      data.forEach(p => { map[p.nombre] = p.estado; });
      setPatios(map);
    }
  }

  async function fetchCarriles() {
    const { data, error } = await supabase.from('carriles').select('*');
    if (!error && data) {
      const map = {};
      data.forEach(c => { map[c.nombre] = c.estado; });
      setCarriles(map);
    }
  }

  async function fetchIncidentes() {
    const { data, error } = await supabase
      .from('incidentes')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setIncidentes(data);
    }
  }

  async function fetchNoticias() {
    const { data, error } = await supabase
      .from('noticias')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setNoticias(data);
    }
  }

  async function contarVotos(tabla, nombre) {
    const { data, error } = await supabase
      .from('votos')
      .select('nuevo_estado')
      .eq('tabla', tabla)
      .eq('nombre', nombre)
      .gte('created_at', new Date(Date.now() - 15*60000).toISOString());

    if (error) return {};
    const conteo = {};
    data.forEach(v => {
      conteo[v.nuevo_estado] = (conteo[v.nuevo_estado] || 0) + 1;
    });
    return conteo;
  }

  async function votar(tabla, nombre, nuevoEstado) {
    const key = `${tabla}-${nombre}`;
    if (!rateLimiter(key, 1, 60000)) {
      alert('Por favor espera un minuto antes de votar nuevamente.');
      return;
    }

    const { error: votoError } = await supabase
      .from('votos')
      .insert([{ tabla, nombre, nuevo_estado: nuevoEstado }]);

    if (votoError) {
      console.error('Error al registrar voto:', votoError);
      return;
    }

    setVotosLocales(prev => ({
      ...prev,
      [key]: nuevoEstado
    }));

    const conteo = await contarVotos(tabla, nombre);
    let ganador = null;
    let maxVotos = (tabla === 'incidentes') ? 15 : 50;

    for (const [estado, votos] of Object.entries(conteo)) {
      if (votos >= maxVotos) {
        ganador = estado;
        break;
      }
    }

    if (ganador) {
      const { error: updateError } = await supabase
        .from(tabla)
        .update({ estado: ganador })
        .eq('nombre', nombre);

      if (!updateError) {
        await supabase.from('votos').delete().eq('tabla', tabla).eq('nombre', nombre);
        
        await supabase.from('noticias').insert([{
          tipo: tabla,
          nombre: nombre,
          estado_anterior: tabla === 'accesos' ? accesos[nombre] :
                          tabla === 'terminales' ? terminales[nombre] :
                          tabla === 'patios' ? patios[nombre] :
                          carriles[nombre],
          estado_nuevo: ganador
        }]);
      }
    }
  }

  async function reportarIncidente(descripcion) {
    const sanitized = sanitize(descripcion);
    if (!sanitized.trim()) return;

    const { error } = await supabase
      .from('incidentes')
      .insert([{ descripcion: sanitized, estado: 'reportado' }]);

    if (error) {
      console.error('Error al reportar incidente:', error);
    }
  }

  function handleLogoClick() {
    const now = Date.now();
    if (now - lastTap < 500) {
      const newTaps = logoTaps + 1;
      setLogoTaps(newTaps);
      if (newTaps >= 5) {
        const password = prompt('Ingresa la contraseña de administrador:');
        if (password === 'admin123') {
          setAdminMode(true);
          setLogoTaps(0);
        } else {
          alert('Contraseña incorrecta');
          setLogoTaps(0);
        }
      }
    } else {
      setLogoTaps(1);
    }
    setLastTap(now);
  }

  async function cambiarEstadoDirecto(tabla, nombre, nuevoEstado) {
    const { error } = await supabase
      .from(tabla)
      .update({ estado: nuevoEstado })
      .eq('nombre', nombre);

    if (!error) {
      await supabase.from('noticias').insert([{
        tipo: tabla,
        nombre: nombre,
        estado_anterior: tabla === 'accesos' ? accesos[nombre] :
                        tabla === 'terminales' ? terminales[nombre] :
                        tabla === 'patios' ? patios[nombre] :
                        carriles[nombre],
        estado_nuevo: nuevoEstado
      }]);
    }
  }

  const SocialBar = () => (
    <div style={{
      display: 'flex',
      gap: '1rem',
      marginTop: '1.5rem',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }}>
      <a
        href="https://chat.whatsapp.com/DqCSKMt72Yk14YBdHiGqIN"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 15px rgba(37, 211, 102, 0.3)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 211, 102, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 211, 102, 0.3)';
        }}
      >
        📱 Canal WhatsApp
      </a>
      <a
        href="https://www.facebook.com/groups/890481009408210"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'linear-gradient(135deg, #1877F2 0%, #0C63D4 100%)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 15px rgba(24, 119, 242, 0.3)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(24, 119, 242, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(24, 119, 242, 0.3)';
        }}
      >
        👥 Grupo Facebook
      </a>
      <a
        href="https://www.facebook.com/profile.php?id=61566998788336"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'linear-gradient(135deg, #1877F2 0%, #0C63D4 100%)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '12px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 15px rgba(24, 119, 242, 0.3)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(24, 119, 242, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(24, 119, 242, 0.3)';
        }}
      >
        📘 Página Facebook
      </a>
    </div>
  );

  const StatusCard = ({ title, status, onVote, showVoting = true, isAdmin = false, onAdminChange, tabla, nombre }) => {
    const colors = {
      fluido: '#10b981',
      lento: '#f59e0b',
      detenido: '#ef4444',
      reportado: '#ef4444',
      cerrado: '#6b7280'
    };

    const key = `${tabla}-${nombre}`;
    const votoLocal = votosLocales[key];

    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}>
        <h3 style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: '1.3rem',
          marginBottom: '1rem',
          color: '#ffffff'
        }}>{title}</h3>
        <div style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          background: colors[status] || '#6b7280',
          color: 'white',
          fontWeight: '600',
          marginBottom: showVoting ? '1rem' : '0'
        }}>
          {status.toUpperCase()}
        </div>
        {votoLocal && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#60a5fa'
          }}>
            ✓ Votaste por: {votoLocal.toUpperCase()}
          </div>
        )}
        {showVoting && !isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              onClick={() => onVote('fluido')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Fluido
            </button>
            <button
              onClick={() => onVote('lento')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#f59e0b',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Lento
            </button>
            <button
              onClick={() => onVote('detenido')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Detenido
            </button>
          </div>
        )}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              onClick={() => onAdminChange('fluido')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '2px solid #10b981',
                background: status === 'fluido' ? '#10b981' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Fluido
            </button>
            <button
              onClick={() => onAdminChange('lento')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '2px solid #f59e0b',
                background: status === 'lento' ? '#f59e0b' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Lento
            </button>
            <button
              onClick={() => onAdminChange('detenido')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '2px solid #ef4444',
                background: status === 'detenido' ? '#ef4444' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Detenido
            </button>
          </div>
        )}
      </div>
    );
  };

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '0.75rem 1.5rem',
        border: 'none',
        background: activeTab === id 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        borderRadius: '12px',
        cursor: 'pointer',
        fontWeight: activeTab === id ? '700' : '500',
        fontSize: '0.95rem',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        boxShadow: activeTab === id 
          ? '0 4px 15px rgba(102, 126, 234, 0.4)'
          : 'none',
        fontFamily: '"DM Sans", sans-serif'
      }}
      onMouseOver={(e) => {
        if (activeTab !== id) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        }
      }}
      onMouseOut={(e) => {
        if (activeTab !== id) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0f172a, #1e293b)',
      backgroundImage: 'url("https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=2070")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(2px)'
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '1.5rem 2rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img 
                src={logoBase64} 
                alt="Logo" 
                onClick={handleLogoClick}
                style={{ 
                  width: '50px', 
                  height: '50px',
                  cursor: 'pointer',
                  filter: 'drop-shadow(0 0 10px rgba(102, 126, 234, 0.5))'
                }} 
              />
              <div>
                <h1 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '1.8rem',
                  margin: 0,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: '700'
                }}>
                  Conect Manzanillo
                </h1>
                <p style={{
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '0.9rem',
                  margin: 0,
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Tráfico en Tiempo Real
                </p>
              </div>
            </div>
            {adminMode && (
              <div style={{
                padding: '0.5rem 1rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                color: '#ef4444',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}>
                🔐 MODO ADMIN
              </div>
            )}
          </div>
        </header>

        {/* Navigation */}
        <nav style={{
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(10px)',
          padding: '1rem 2rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          overflowX: 'auto'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <TabButton id="inicio" label="Inicio" icon="🏠" />
            <TabButton id="trafico" label="Tráfico" icon="🚛" />
            <TabButton id="patio" label="Patio" icon="📦" />
            <TabButton id="noticias" label="Noticias" icon="📰" />
            <TabButton id="redes" label="Redes" icon="🌐" />
          </div>
        </nav>

        {/* Main Content */}
        <main style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem'
        }}>
          {activeTab === 'inicio' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '3rem 2rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              textAlign: 'center',
              animation: 'fadeIn 0.8s ease-in'
            }}>
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '2.5rem',
                marginBottom: '1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Bienvenido a Conect Manzanillo
              </h2>
              <p style={{
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '1.2rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.8',
                maxWidth: '800px',
                margin: '0 auto 2rem'
              }}>
                Plataforma comunitaria para monitorear el tráfico del Puerto de Manzanillo en tiempo real.
                La información se actualiza mediante votación democrática de la comunidad.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginTop: '2rem'
              }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚛</div>
                  <h3 style={{
                    fontFamily: '"Playfair Display", serif',
                    color: '#10b981',
                    marginBottom: '0.5rem'
                  }}>Tráfico en Vivo</h3>
                  <p style={{
                    fontFamily: '"DM Sans", sans-serif',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.95rem'
                  }}>
                    Estado actual de accesos y terminales
                  </p>
                </div>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗳️</div>
                  <h3 style={{
                    fontFamily: '"Playfair Display", serif',
                    color: '#f59e0b',
                    marginBottom: '0.5rem'
                  }}>Votación Comunitaria</h3>
                  <p style={{
                    fontFamily: '"DM Sans", sans-serif',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.95rem'
                  }}>
                    La comunidad actualiza los estados
                  </p>
                </div>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📱</div>
                  <h3 style={{
                    fontFamily: '"Playfair Display", serif',
                    color: '#3b82f6',
                    marginBottom: '0.5rem'
                  }}>Acceso Directo</h3>
                  <p style={{
                    fontFamily: '"DM Sans", sans-serif',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.95rem'
                  }}>
                    Sin descargas, desde tu navegador
                  </p>
                </div>
              </div>
              <SocialBar />
            </div>
          )}

          {activeTab === 'trafico' && (
            <div>
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '2rem',
                marginBottom: '2rem',
                color: '#ffffff',
                textAlign: 'center'
              }}>
                Estado del Tráfico
              </h2>

              {/* Mapa de Google Maps */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '1.5rem',
                  color: '#ffffff',
                  marginBottom: '1rem'
                }}>
                  Mapa del Puerto
                </h3>

                <div style={{
                  height: '500px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14922.856789!2d-104.33!3d19.054!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDAzJzE1LjUiTiAxMDTCsDE5JzU3LjUiVw!5e0!3m2!1ses!2smx!4v1234567890"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>

              {/* Accesos y Terminales */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '1.5rem',
                  marginBottom: '1.5rem',
                  color: '#ffffff'
                }}>
                  Accesos y Terminales
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  <StatusCard 
                    title="Segundo Acceso" 
                    status={accesos['segundo_acceso'] || 'fluido'}
                    onVote={(estado) => votar('accesos', 'segundo_acceso', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('accesos', 'segundo_acceso', estado)}
                    tabla="accesos"
                    nombre="segundo_acceso"
                  />
                  <StatusCard 
                    title="Vialidad Confinada" 
                    status={accesos['vialidad_confinada'] || 'fluido'}
                    onVote={(estado) => votar('accesos', 'vialidad_confinada', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('accesos', 'vialidad_confinada', estado)}
                    tabla="accesos"
                    nombre="vialidad_confinada"
                  />
                  <StatusCard 
                    title="TPO" 
                    status={terminales['tpo'] || 'fluido'}
                    onVote={(estado) => votar('terminales', 'tpo', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('terminales', 'tpo', estado)}
                    tabla="terminales"
                    nombre="tpo"
                  />
                  <StatusCard 
                    title="TIMSA" 
                    status={terminales['timsa'] || 'fluido'}
                    onVote={(estado) => votar('terminales', 'timsa', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('terminales', 'timsa', estado)}
                    tabla="terminales"
                    nombre="timsa"
                  />
                  <StatusCard 
                    title="OCUPA" 
                    status={terminales['ocupa'] || 'fluido'}
                    onVote={(estado) => votar('terminales', 'ocupa', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('terminales', 'ocupa', estado)}
                    tabla="terminales"
                    nombre="ocupa"
                  />
                  <StatusCard 
                    title="MAERSK" 
                    status={terminales['maersk'] || 'fluido'}
                    onVote={(estado) => votar('terminales', 'maersk', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('terminales', 'maersk', estado)}
                    tabla="terminales"
                    nombre="maersk"
                  />
                  <StatusCard 
                    title="SSP" 
                    status={terminales['ssp'] || 'fluido'}
                    onVote={(estado) => votar('terminales', 'ssp', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('terminales', 'ssp', estado)}
                    tabla="terminales"
                    nombre="ssp"
                  />
                </div>
              </div>

              <SocialBar />
            </div>
          )}

          {activeTab === 'patio' && (
            <div>
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '2rem',
                marginBottom: '2rem',
                color: '#ffffff',
                textAlign: 'center'
              }}>
                Estado de Patios y Vialidades
              </h2>

              {/* Patios Regulados */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '1.5rem',
                  marginBottom: '1.5rem',
                  color: '#ffffff'
                }}>
                  Patios Regulados
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  <StatusCard 
                    title="Patio Fiscal Exportación" 
                    status={patios['patio_fiscal_exportacion'] || 'fluido'}
                    onVote={(estado) => votar('patios', 'patio_fiscal_exportacion', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('patios', 'patio_fiscal_exportacion', estado)}
                    tabla="patios"
                    nombre="patio_fiscal_exportacion"
                  />
                  <StatusCard 
                    title="Patio Fiscal Importación" 
                    status={patios['patio_fiscal_importacion'] || 'fluido'}
                    onVote={(estado) => votar('patios', 'patio_fiscal_importacion', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('patios', 'patio_fiscal_importacion', estado)}
                    tabla="patios"
                    nombre="patio_fiscal_importacion"
                  />
                </div>
              </div>

              {/* Vialidades */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: '1.5rem',
                  marginBottom: '1.5rem',
                  color: '#ffffff'
                }}>
                  Estado de Carriles
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  <StatusCard 
                    title="Carril Izquierdo" 
                    status={carriles['carril_izquierdo'] || 'fluido'}
                    onVote={(estado) => votar('carriles', 'carril_izquierdo', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('carriles', 'carril_izquierdo', estado)}
                    tabla="carriles"
                    nombre="carril_izquierdo"
                  />
                  <StatusCard 
                    title="Carril Central" 
                    status={carriles['carril_central'] || 'fluido'}
                    onVote={(estado) => votar('carriles', 'carril_central', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('carriles', 'carril_central', estado)}
                    tabla="carriles"
                    nombre="carril_central"
                  />
                  <StatusCard 
                    title="Carril Derecho" 
                    status={carriles['carril_derecho'] || 'fluido'}
                    onVote={(estado) => votar('carriles', 'carril_derecho', estado)}
                    isAdmin={adminMode}
                    onAdminChange={(estado) => cambiarEstadoDirecto('carriles', 'carril_derecho', estado)}
                    tabla="carriles"
                    nombre="carril_derecho"
                  />
                </div>
              </div>

              <SocialBar />
            </div>
          )}

          {activeTab === 'noticias' && (
            <div>
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '2rem',
                marginBottom: '2rem',
                color: '#ffffff',
                textAlign: 'center'
              }}>
                Feed de Noticias
              </h2>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
              }}>
                {noticias.length === 0 ? (
                  <p style={{
                    fontFamily: '"DM Sans", sans-serif',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textAlign: 'center',
                    padding: '2rem'
                  }}>
                    No hay cambios recientes registrados.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {noticias.map((noticia, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '1rem',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        <div style={{
                          fontFamily: '"DM Sans", sans-serif',
                          fontSize: '0.9rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginBottom: '0.5rem'
                        }}>
                          {new Date(noticia.created_at).toLocaleString('es-MX')}
                        </div>
                        <div style={{
                          fontFamily: '"DM Sans", sans-serif',
                          color: '#ffffff',
                          fontSize: '1rem'
                        }}>
                          <strong style={{ color: '#667eea' }}>{noticia.tipo.toUpperCase()}</strong>
                          {' - '}
                          <strong>{noticia.nombre.replace(/_/g, ' ').toUpperCase()}</strong>
                          {' cambió de '}
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            background: noticia.estado_anterior === 'fluido' ? '#10b981' :
                                       noticia.estado_anterior === 'lento' ? '#f59e0b' : '#ef4444',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}>
                            {noticia.estado_anterior?.toUpperCase()}
                          </span>
                          {' a '}
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            background: noticia.estado_nuevo === 'fluido' ? '#10b981' :
                                       noticia.estado_nuevo === 'lento' ? '#f59e0b' : '#ef4444',
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}>
                            {noticia.estado_nuevo?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <SocialBar />
            </div>
          )}

          {activeTab === 'redes' && (
            <div>
              <h2 style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '2rem',
                marginBottom: '2rem',
                color: '#ffffff',
                textAlign: 'center'
              }}>
                Redes Sociales
              </h2>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                textAlign: 'center'
              }}>
                <p style={{
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '1.1rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '2rem',
                  lineHeight: '1.6'
                }}>
                  Únete a nuestra comunidad en las redes sociales para estar al tanto de las últimas actualizaciones
                  y compartir información sobre el tráfico en el puerto.
                </p>
                <SocialBar />
                <div style={{
                  marginTop: '3rem',
                  padding: '1.5rem',
                  background: 'rgba(102, 126, 234, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <h3 style={{
                    fontFamily: '"Playfair Display", serif',
                    color: '#667eea',
                    marginBottom: '1rem'
                  }}>
                    📱 Síguenos en Instagram
                  </h3>
                  <a
                    href="https://www.instagram.com/conectmanzanillo"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontWeight: '600',
                      fontSize: '1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(131, 58, 180, 0.3)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(131, 58, 180, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(131, 58, 180, 0.3)';
                    }}
                  >
                    📸 @conectmanzanillo
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '2rem',
          marginTop: '4rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <p style={{
            fontFamily: '"DM Sans", sans-serif',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.9rem',
            margin: 0
          }}>
            © 2024 Conect Manzanillo - Plataforma Comunitaria de Tráfico
          </p>
          <p style={{
            fontFamily: '"DM Sans", sans-serif',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.85rem',
            marginTop: '0.5rem'
          }}>
            Información actualizada por la comunidad en tiempo real
          </p>
        </footer>

        {/* Cookie Consent Banner */}
        {cookieConsent === null && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(10px)',
            padding: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 -4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <p style={{
                fontFamily: '"DM Sans", sans-serif',
                color: 'rgba(255, 255, 255, 0.8)',
                margin: 0,
                flex: '1',
                minWidth: '250px'
              }}>
                Usamos cookies para mejorar tu experiencia. Al continuar navegando, aceptas nuestra política de cookies.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleAcceptCookies}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}
                >
                  Aceptar
                </button>
                <button
                  onClick={handleRejectCookies}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
