import React, { useState, useEffect, useRef, useMemo } from "react";

// ============================================================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================================================

const COOKIE_KEY   = "cookie_consent";
const ADMIN_USER   = "conectmzo";
const ADMIN_PASS   = "35841912";
const ADMIN_KEY    = "cm_admin_session";
const USER_KEY     = "cm_user_session";

// Validadores de seguridad
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+?[\d\s()-]{10,}$/.test(phone);
const isValidPassword = (pass) => {
  return pass.length >= 10 &&
         /[A-Z]/.test(pass) &&
         /[0-9]/.test(pass) &&
         /[!@#$%^&*(),.?":{}|<>]/.test(pass);
};
const isTemporaryEmail = (email) => {
  const tempDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com'];
  return tempDomains.some(domain => email.toLowerCase().includes(domain));
};
const getPasswordStrength = (pass) => {
  let strength = 0;
  if (pass.length >= 10) strength++;
  if (pass.length >= 14) strength++;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++;
  if (/[0-9]/.test(pass)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) strength++;
  return strength;
};

// Base de datos simulada de usuarios
const USERS_DB = {
  users: [],
  phones: new Set(),
  ips: {},
  devices: new Set()
};

const ACCESOS = [
  { id: "pv",  nombre: "Acceso Pez Vela",    icon: "🐟" },
  { id: "p15", nombre: "Puerta 15",          icon: "🚪" },
  { id: "zn",  nombre: "Zona Norte",         icon: "🧭" },
];

const ACCESO_RETORNOS = [
  { id: "directo", nombre: "Directo", icon: "➡️", color: "#10b981" },
  { id: "lateral", nombre: "Lateral", icon: "↗️", color: "#f59e0b" },
  { id: "fila",    nombre: "Fila",    icon: "⏸️", color: "#ef4444" },
];

const ESTATUS_CONFIG = {
  fluido:   { emoji: "🟢", label: "Fluido",   color: "#10b981" },
  lento:    { emoji: "🟡", label: "Lento",    color: "#f59e0b" },
  saturado: { emoji: "🟠", label: "Saturado", color: "#fb923c" },
  cerrado:  { emoji: "🔴", label: "Cerrado",  color: "#ef4444" },
};

// ============================================================================
// SISTEMA DE AUTENTICACIÓN - AUTH MODAL
// ============================================================================

function AuthModal({ onClose, onLogin }) {
  const [view, setView] = useState('menu');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    loginUsername: '', loginPassword: '', nombre: '', apellidos: '', username: '',
    fechaNacimiento: '', pais: 'México', ciudad: '', telefono: '', codigoSMS: '',
    generatedCode: '', email: '', confirmarEmail: '', password: '',
    confirmarPassword: '', direccion: '', codigoPostal: '', captchaAnswer: '',
    captchaQuestion: null, aceptaTerminos: false, aceptaPrivacidad: false, forgotEmail: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view === 'register' && step === 6) {
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      setFormData(prev => ({ ...prev, captchaQuestion: { num1, num2, answer: num1 + num2 }}));
    }
  }, [view, step]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleLogin = async () => {
    setError('');
    const { loginUsername, loginPassword } = formData;
    if (!loginUsername || !loginPassword) {
      setError('Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    if (loginUsername === ADMIN_USER && loginPassword === ADMIN_PASS) {
      const adminUser = { username: ADMIN_USER, role: 'admin', nombre: 'Administrador', apellidos: 'Sistema' };
      try { localStorage.setItem(USER_KEY, JSON.stringify(adminUser)); } catch {}
      onLogin(adminUser);
      setLoading(false);
      onClose();
      return;
    }
    const user = USERS_DB.users.find(u => u.username === loginUsername && u.password === loginPassword);
    if (user) {
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
      onLogin(user);
      onClose();
    } else {
      setError('Usuario o contraseña incorrectos');
    }
    setLoading(false);
  };

  const handleRegisterStep1 = () => {
    const { nombre, apellidos, username, fechaNacimiento, ciudad } = formData;
    if (!nombre || !apellidos || !username || !fechaNacimiento || !ciudad) {
      setError('Por favor completa todos los campos');
      return;
    }
    if (username.length < 4) {
      setError('El nombre de usuario debe tener al menos 4 caracteres');
      return;
    }
    if (USERS_DB.users.some(u => u.username === username)) {
      setError('Este nombre de usuario ya está en uso');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSendSMS = () => {
    const { telefono } = formData;
    if (!telefono) {
      setError('Por favor ingresa tu número de teléfono');
      return;
    }
    if (!isValidPhone(telefono)) {
      setError('Formato de teléfono inválido');
      return;
    }
    if (USERS_DB.phones.has(telefono)) {
      setError('Este número de teléfono ya está registrado');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData(prev => ({ ...prev, generatedCode: code }));
    setSuccess(`Código enviado: ${code} (simulado)`);
    setError('');
  };

  const handleVerifySMS = () => {
    const { codigoSMS, generatedCode } = formData;
    if (!codigoSMS) {
      setError('Por favor ingresa el código SMS');
      return;
    }
    if (codigoSMS !== generatedCode) {
      setError('Código incorrecto');
      return;
    }
    setError('');
    setSuccess('');
    setStep(3);
  };

  const handleRegisterStep3 = () => {
    const { email, confirmarEmail } = formData;
    if (!email || !confirmarEmail) {
      setError('Por favor completa ambos campos de email');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Formato de email inválido');
      return;
    }
    if (isTemporaryEmail(email)) {
      setError('No se permiten correos temporales');
      return;
    }
    if (email !== confirmarEmail) {
      setError('Los correos no coinciden');
      return;
    }
    setError('');
    setStep(4);
  };

  const handleRegisterStep4 = () => {
    const { password, confirmarPassword } = formData;
    if (!password || !confirmarPassword) {
      setError('Por favor completa ambos campos de contraseña');
      return;
    }
    if (!isValidPassword(password)) {
      setError('La contraseña debe tener mínimo 10 caracteres, 1 mayúscula, 1 número y 1 símbolo');
      return;
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError('');
    setStep(5);
  };

  const handleRegisterStep5 = () => {
    const { direccion, codigoPostal } = formData;
    if (!direccion || !codigoPostal) {
      setError('Por favor completa la dirección y código postal');
      return;
    }
    if (codigoPostal.length < 5) {
      setError('Código postal inválido');
      return;
    }
    setError('');
    setStep(6);
  };

  const handleRegisterComplete = async () => {
    const { captchaAnswer, captchaQuestion, aceptaTerminos, aceptaPrivacidad } = formData;
    if (!captchaAnswer) {
      setError('Por favor responde la pregunta de seguridad');
      return;
    }
    if (parseInt(captchaAnswer) !== captchaQuestion.answer) {
      setError('Respuesta incorrecta');
      return;
    }
    if (!aceptaTerminos || !aceptaPrivacidad) {
      setError('Debes aceptar los términos y condiciones y la política de privacidad');
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newUser = {
      username: formData.username, password: formData.password, nombre: formData.nombre,
      apellidos: formData.apellidos, email: formData.email, telefono: formData.telefono,
      fechaNacimiento: formData.fechaNacimiento, pais: formData.pais, ciudad: formData.ciudad,
      direccion: formData.direccion, codigoPostal: formData.codigoPostal,
      role: 'user', createdAt: new Date().toISOString()
    };
    USERS_DB.users.push(newUser);
    USERS_DB.phones.add(formData.telefono);
    setSuccess('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión');
    setLoading(false);
    setTimeout(() => {
      setView('login');
      setStep(1);
      setSuccess('');
    }, 2000);
  };

  const handleForgotPassword = async () => {
    const { forgotEmail } = formData;
    if (!forgotEmail) {
      setError('Por favor ingresa tu correo electrónico');
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setError('Formato de email inválido');
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSuccess('Se ha enviado un enlace de recuperación a tu correo (simulado)');
    setLoading(false);
    setTimeout(() => {
      setView('login');
      setSuccess('');
    }, 3000);
  };

  const renderMenu = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'64px',marginBottom:'20px'}}>🔐</div>
      <h2 style={{margin:0,fontSize:'28px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'10px'}}>
        Bienvenido
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.6)',fontSize:'14px',marginBottom:'30px'}}>
        Sistema de autenticación seguro
      </p>
      <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
        <button onClick={()=>setView('login')} style={{
          background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',border:'none',borderRadius:'12px',
          padding:'16px',color:'#fff',fontSize:'16px',fontWeight:'600',cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif",transition:'transform 0.2s ease,box-shadow 0.2s ease',
          boxShadow:'0 4px 15px rgba(102,126,234,0.4)'
        }} onMouseEnter={e=>{e.target.style.transform='translateY(-2px)';e.target.style.boxShadow='0 6px 20px rgba(102,126,234,0.5)';}}
           onMouseLeave={e=>{e.target.style.transform='translateY(0)';e.target.style.boxShadow='0 4px 15px rgba(102,126,234,0.4)';}}>
          🔑 Iniciar Sesión
        </button>
        <button onClick={()=>{setView('register');setStep(1);}} style={{
          background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'12px',
          padding:'16px',color:'#fff',fontSize:'16px',fontWeight:'600',cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif",transition:'all 0.2s ease'
        }} onMouseEnter={e=>{e.target.style.background='rgba(255,255,255,0.15)';}}
           onMouseLeave={e=>{e.target.style.background='rgba(255,255,255,0.1)';}}>
          ✨ Crear Cuenta Nueva
        </button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>🔑</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'30px'}}>
        Iniciar Sesión
      </h2>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      {success && <div style={{background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#6ee7b7',fontSize:'14px',textAlign:'center'}}>{success}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
        <div>
          <label style={{display:'block',marginBottom:'8px',color:'rgba(255,255,255,0.8)',fontSize:'14px',fontWeight:'500'}}>Usuario</label>
          <input type="text" value={formData.loginUsername} onChange={e=>handleInputChange('loginUsername',e.target.value)} placeholder="Nombre de usuario"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'#fff',fontSize:'14px',outline:'none',transition:'border-color 0.2s ease'}}
            onFocus={e=>e.target.style.borderColor='rgba(102,126,234,0.5)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'} />
        </div>
        <div>
          <label style={{display:'block',marginBottom:'8px',color:'rgba(255,255,255,0.8)',fontSize:'14px',fontWeight:'500'}}>Contraseña</label>
          <input type="password" value={formData.loginPassword} onChange={e=>handleInputChange('loginPassword',e.target.value)} placeholder="Tu contraseña"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'#fff',fontSize:'14px',outline:'none',transition:'border-color 0.2s ease'}}
            onFocus={e=>e.target.style.borderColor='rgba(102,126,234,0.5)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}
            onKeyPress={e=>e.key==='Enter'&&handleLogin()} />
        </div>
        <button onClick={()=>setView('forgot')} style={{background:'none',border:'none',color:'#a78bfa',fontSize:'13px',cursor:'pointer',textAlign:'right',padding:0}}>
          ¿Olvidaste tu contraseña?
        </button>
        <button onClick={handleLogin} disabled={loading} style={{
          background:loading?'rgba(102,126,234,0.5)':'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
          border:'none',borderRadius:'12px',padding:'14px',color:'#fff',fontSize:'16px',fontWeight:'600',
          cursor:loading?'not-allowed':'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:'10px'
        }}>
          {loading ? '⏳ Ingresando...' : '🚀 Ingresar'}
        </button>
        <button onClick={()=>setView('menu')} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>
          ← Volver
        </button>
      </div>
    </div>
  );

  const renderRegisterStep1 = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>📝</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Información Básica
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 1 de 6</p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Nombre(s) *</label>
          <input type="text" value={formData.nombre} onChange={e=>handleInputChange('nombre',e.target.value)} placeholder="Tu nombre"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Apellidos *</label>
          <input type="text" value={formData.apellidos} onChange={e=>handleInputChange('apellidos',e.target.value)} placeholder="Tus apellidos"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Usuario *</label>
          <input type="text" value={formData.username} onChange={e=>handleInputChange('username',e.target.value)} placeholder="Nombre de usuario (mín. 4 caracteres)"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Fecha de Nacimiento *</label>
          <input type="date" value={formData.fechaNacimiento} onChange={e=>handleInputChange('fechaNacimiento',e.target.value)}
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>País *</label>
          <select value={formData.pais} onChange={e=>handleInputChange('pais',e.target.value)}
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}}>
            <option value="México">México</option><option value="USA">Estados Unidos</option><option value="Otro">Otro</option>
          </select></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Ciudad *</label>
          <input type="text" value={formData.ciudad} onChange={e=>handleInputChange('ciudad',e.target.value)} placeholder="Tu ciudad"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
          <button onClick={()=>{setView('menu');setStep(1);}} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>← Cancelar</button>
          <button onClick={handleRegisterStep1} style={{flex:2,background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>Siguiente →</button>
        </div>
      </div>
    </div>
  );

  const renderRegisterStep2 = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>📱</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Verificación Telefónica
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 2 de 6</p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      {success && <div style={{background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#6ee7b7',fontSize:'14px',textAlign:'center'}}>{success}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Número de Teléfono *</label>
          <input type="tel" value={formData.telefono} onChange={e=>handleInputChange('telefono',e.target.value)} placeholder="+52 123 456 7890"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} />
          <button onClick={handleSendSMS} style={{marginTop:'10px',width:'100%',background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:'8px',padding:'10px',color:'#6ee7b7',fontSize:'14px',cursor:'pointer'}}>📤 Enviar Código SMS</button>
        </div>
        {formData.generatedCode && (
          <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Código de Verificación *</label>
            <input type="text" value={formData.codigoSMS} onChange={e=>handleInputChange('codigoSMS',e.target.value)} placeholder="Ingresa el código de 6 dígitos"
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} />
          </div>
        )}
        <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
          <button onClick={()=>setStep(1)} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>← Atrás</button>
          <button onClick={handleVerifySMS} disabled={!formData.generatedCode} style={{flex:2,background:formData.generatedCode?'linear-gradient(135deg,#667eea 0%,#764ba2 100%)':'rgba(102,126,234,0.3)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:formData.generatedCode?'pointer':'not-allowed'}}>Verificar →</button>
        </div>
      </div>
    </div>
  );

  const renderRegisterStep3 = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>📧</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Correo Electrónico
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 3 de 6</p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Correo Electrónico *</label>
          <input type="email" value={formData.email} onChange={e=>handleInputChange('email',e.target.value)} placeholder="tu@email.com"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Confirmar Correo *</label>
          <input type="email" value={formData.confirmarEmail} onChange={e=>handleInputChange('confirmarEmail',e.target.value)} placeholder="Confirma tu email"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'8px',padding:'12px',fontSize:'12px',color:'rgba(147,197,253,0.9)'}}>
          ℹ️ No se permiten correos temporales
        </div>
        <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
          <button onClick={()=>setStep(2)} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>← Atrás</button>
          <button onClick={handleRegisterStep3} style={{flex:2,background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>Siguiente →</button>
        </div>
      </div>
    </div>
  );

  const renderRegisterStep4 = () => {
    const strength = getPasswordStrength(formData.password);
    const strengthColors = ['#ef4444','#f59e0b','#f59e0b','#10b981','#10b981'];
    const strengthLabels = ['Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'];
    return (
      <div style={{padding:'40px 30px'}}>
        <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>🔒</div>
        <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
          Contraseña Segura
        </h2>
        <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 4 de 6</p>
        {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Contraseña *</label>
            <input type="password" value={formData.password} onChange={e=>handleInputChange('password',e.target.value)} placeholder="Mínimo 10 caracteres"
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} />
            {formData.password && (
              <div style={{marginTop:'8px'}}>
                <div style={{display:'flex',gap:'4px',marginBottom:'6px'}}>
                  {[0,1,2,3,4].map(i=><div key={i} style={{flex:1,height:'4px',borderRadius:'2px',background:i<strength?strengthColors[strength-1]:'rgba(255,255,255,0.1)'}}/>)}
                </div>
                <p style={{fontSize:'12px',color:strengthColors[strength-1],margin:0}}>Seguridad: {strengthLabels[strength-1]}</p>
              </div>
            )}
          </div>
          <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Confirmar Contraseña *</label>
            <input type="password" value={formData.confirmarPassword} onChange={e=>handleInputChange('confirmarPassword',e.target.value)} placeholder="Confirma tu contraseña"
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
          <div style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'8px',padding:'10px',fontSize:'11px',color:'rgba(147,197,253,0.8)'}}>
            ✓ Mín. 10 caracteres<br/>✓ 1 mayúscula<br/>✓ 1 número<br/>✓ 1 símbolo (!@#$...)
          </div>
          <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
            <button onClick={()=>setStep(3)} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>← Atrás</button>
            <button onClick={handleRegisterStep4} style={{flex:2,background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>Siguiente →</button>
          </div>
        </div>
      </div>
    );
  };

  const renderRegisterStep5 = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>🏠</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Dirección
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 5 de 6</p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Dirección Completa *</label>
          <textarea value={formData.direccion} onChange={e=>handleInputChange('direccion',e.target.value)} placeholder="Calle, número, colonia..."
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none',minHeight:'80px',resize:'vertical',fontFamily:'inherit'}} /></div>
        <div><label style={{display:'block',marginBottom:'6px',color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Código Postal *</label>
          <input type="text" value={formData.codigoPostal} onChange={e=>handleInputChange('codigoPostal',e.target.value)} placeholder="28200"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
          <button onClick={()=>setStep(4)} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>← Atrás</button>
          <button onClick={handleRegisterStep5} style={{flex:2,background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:'pointer'}}>Siguiente →</button>
        </div>
      </div>
    </div>
  );

  const renderRegisterStep6 = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>✅</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Finalizar Registro
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.5)',fontSize:'13px',marginBottom:'25px'}}>Paso 6 de 6</p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      {success && <div style={{background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#6ee7b7',fontSize:'14px',textAlign:'center'}}>{success}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
        {formData.captchaQuestion && (
          <div style={{background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'8px',padding:'16px'}}>
            <label style={{display:'block',marginBottom:'10px',color:'rgba(147,197,253,0.9)',fontSize:'14px',fontWeight:'500'}}>
              Pregunta de seguridad: ¿Cuánto es {formData.captchaQuestion.num1} + {formData.captchaQuestion.num2}?
            </label>
            <input type="number" value={formData.captchaAnswer} onChange={e=>handleInputChange('captchaAnswer',e.target.value)} placeholder="Tu respuesta"
              style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'8px',padding:'10px',color:'#fff',fontSize:'14px',outline:'none'}} />
          </div>
        )}
        <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'12px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.1)'}}>
          <input type="checkbox" checked={formData.aceptaTerminos} onChange={e=>handleInputChange('aceptaTerminos',e.target.checked)}
            style={{width:'18px',height:'18px',cursor:'pointer'}} />
          <span style={{color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Acepto los términos y condiciones</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',padding:'12px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.1)'}}>
          <input type="checkbox" checked={formData.aceptaPrivacidad} onChange={e=>handleInputChange('aceptaPrivacidad',e.target.checked)}
            style={{width:'18px',height:'18px',cursor:'pointer'}} />
          <span style={{color:'rgba(255,255,255,0.8)',fontSize:'13px'}}>Acepto la política de privacidad</span>
        </label>
        <div style={{display:'flex',gap:'10px',marginTop:'15px'}}>
          <button onClick={()=>setStep(5)} disabled={loading} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:loading?'not-allowed':'pointer'}}>← Atrás</button>
          <button onClick={handleRegisterComplete} disabled={loading} style={{flex:2,background:loading?'rgba(16,185,129,0.5)':'linear-gradient(135deg,#10b981 0%,#059669 100%)',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontSize:'15px',fontWeight:'600',cursor:loading?'not-allowed':'pointer'}}>
            {loading ? '⏳ Creando cuenta...' : '🎉 Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderForgot = () => (
    <div style={{padding:'40px 30px'}}>
      <div style={{textAlign:'center',fontSize:'48px',marginBottom:'15px'}}>🔓</div>
      <h2 style={{margin:0,fontSize:'24px',fontWeight:'700',color:'#fff',fontFamily:"'DM Sans',sans-serif",textAlign:'center',marginBottom:'8px'}}>
        Recuperar Contraseña
      </h2>
      <p style={{textAlign:'center',color:'rgba(255,255,255,0.6)',fontSize:'13px',marginBottom:'25px'}}>
        Ingresa tu correo electrónico
      </p>
      {error && <div style={{background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#fca5a5',fontSize:'14px',textAlign:'center'}}>{error}</div>}
      {success && <div style={{background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:'8px',padding:'12px',marginBottom:'20px',color:'#6ee7b7',fontSize:'14px',textAlign:'center'}}>{success}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
        <div><label style={{display:'block',marginBottom:'8px',color:'rgba(255,255,255,0.8)',fontSize:'14px'}}>Correo Electrónico</label>
          <input type="email" value={formData.forgotEmail} onChange={e=>handleInputChange('forgotEmail',e.target.value)} placeholder="tu@email.com"
            style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'#fff',fontSize:'14px',outline:'none'}} /></div>
        <button onClick={handleForgotPassword} disabled={loading} style={{
          background:loading?'rgba(102,126,234,0.5)':'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
          border:'none',borderRadius:'12px',padding:'14px',color:'#fff',fontSize:'16px',fontWeight:'600',
          cursor:loading?'not-allowed':'pointer',marginTop:'10px'
        }}>
          {loading ? '⏳ Enviando...' : '📧 Enviar Enlace'}
        </button>
        <button onClick={()=>setView('login')} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'12px',color:'rgba(255,255,255,0.7)',fontSize:'14px',cursor:'pointer'}}>
          ← Volver al Login
        </button>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',
      backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:10000,padding:'20px'
    }}>
      <div onClick={(e)=>e.stopPropagation()} style={{
        background:'linear-gradient(145deg,rgba(30,30,30,0.98) 0%,rgba(20,20,20,0.98) 100%)',
        borderRadius:'20px',maxWidth:'500px',width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
        border:'1px solid rgba(255,255,255,0.1)',position:'relative',
        maxHeight:'90vh',overflowY:'auto'
      }}>
        <button onClick={onClose} style={{
          position:'absolute',top:'16px',right:'16px',background:'rgba(255,255,255,0.1)',
          border:'none',borderRadius:'50%',width:'36px',height:'36px',cursor:'pointer',
          color:'rgba(255,255,255,0.7)',fontSize:'20px',display:'flex',
          alignItems:'center',justifyContent:'center',transition:'all 0.2s ease',zIndex:1
        }} onMouseEnter={e=>{e.target.style.background='rgba(239,68,68,0.3)';e.target.style.color='#fff';}}
           onMouseLeave={e=>{e.target.style.background='rgba(255,255,255,0.1)';e.target.style.color='rgba(255,255,255,0.7)';}}>×</button>
        {view === 'menu' && renderMenu()}
        {view === 'login' && renderLogin()}
        {view === 'register' && step === 1 && renderRegisterStep1()}
        {view === 'register' && step === 2 && renderRegisterStep2()}
        {view === 'register' && step === 3 && renderRegisterStep3()}
        {view === 'register' && step === 4 && renderRegisterStep4()}
        {view === 'register' && step === 5 && renderRegisterStep5()}
        {view === 'register' && step === 6 && renderRegisterStep6()}
        {view === 'forgot' && renderForgot()}
      </div>
    </div>
  );
}

// ============================================================================
// SISTEMA DE AUTENTICACIÓN - BOTÓN FLOTANTE
// ============================================================================

function FloatingAuthButton({ onOpenAuth, isLoggedIn, user, onLogout }) {
  const [visible, setVisible] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const timeoutRef = useRef(null);

  const resetTimer = () => {
    setVisible(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 5000);
  };

  useEffect(() => {
    resetTimer();
    const handleActivity = () => resetTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    return () => {
      clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, []);

  if (!isLoggedIn) {
    return (
      <button onClick={onOpenAuth} style={{
        position:'fixed',top:'20px',right:'20px',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
        border:'none',borderRadius:'50%',width:'56px',height:'56px',cursor:'pointer',
        boxShadow:'0 4px 20px rgba(102,126,234,0.4)',display:'flex',alignItems:'center',
        justifyContent:'center',fontSize:'24px',zIndex:9999,
        transform:visible?'scale(1)':'scale(0)',
        opacity:visible?1:0,
        transition:'all 0.3s cubic-bezier(0.68,-0.55,0.265,1.55)'
      }} onMouseEnter={e=>e.target.style.transform='scale(1.1)'}
         onMouseLeave={e=>e.target.style.transform=visible?'scale(1)':'scale(0)'}>
        🔐
      </button>
    );
  }

  return (
    <div style={{position:'fixed',top:'20px',right:'20px',zIndex:9999,
      transform:visible?'translateY(0)':'translateY(-100px)',
      opacity:visible?1:0,
      transition:'all 0.3s ease'}}>
      <div onClick={()=>setShowMenu(!showMenu)} style={{
        background:'linear-gradient(135deg,#10b981 0%,#059669 100%)',
        borderRadius:'12px',padding:'10px 16px',cursor:'pointer',
        boxShadow:'0 4px 20px rgba(16,185,129,0.3)',display:'flex',alignItems:'center',gap:'10px',
        border:'1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>
          {user?.role === 'admin' ? '👑' : '👤'}
        </div>
        <div style={{color:'#fff',fontSize:'14px',fontWeight:'600',fontFamily:"'DM Sans',sans-serif"}}>
          {user?.nombre || user?.username}
        </div>
      </div>
      {showMenu && (
        <div style={{marginTop:'10px',background:'rgba(30,30,30,0.98)',borderRadius:'12px',padding:'8px',boxShadow:'0 8px 30px rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.1)'}}>
          <button onClick={onLogout} style={{
            width:'100%',background:'rgba(239,68,68,0.2)',border:'1px solid rgba(239,68,68,0.4)',
            borderRadius:'8px',padding:'10px',color:'#fca5a5',fontSize:'14px',fontWeight:'500',
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'
          }}>
            🚪 Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESTO DE TU CÓDIGO ORIGINAL (NavBar, AccesoCard, etc.)
// ============================================================================

function NavBar({ active, setActive, isAdmin, onLogoTap }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'linear-gradient(180deg, rgba(13,13,13,0.98) 0%, rgba(13,13,13,0.92) 100%)',
      backdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 30px rgba(0,0,0,0.4)'
    }}>
      <div style={{
        maxWidth: '480px', margin: '0 auto', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '16px'
      }}>
        <div onClick={onLogoTap} style={{
          display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
          userSelect: 'none', WebkitTapHighlightColor: 'transparent'
        }}>
          <img
            src="https://i.postimg.cc/pdy5jmY3/conectmanzanillologo.png"
            alt="Logo Conect Manzanillo"
            style={{
              width: '38px', height: '38px', borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          />
          <div>
            <div style={{
              fontSize: '18px', fontWeight: '700', color: '#fff',
              fontFamily: "'Space Mono', monospace", letterSpacing: '0.5px',
              lineHeight: '1.2'
            }}>
              Conect Manzanillo
            </div>
            <div style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Space Mono', monospace", marginTop: '2px'
            }}>
              Puerto en tiempo real
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)'
      }}>
        {[
          { id: 'trafico', label: 'Tráfico', icon: '🚦' },
          { id: 'reportar', label: 'Reportar', icon: '📝' },
          { id: 'carriles', label: 'Carriles', icon: '🛣️' },
          { id: 'noticias', label: 'Noticias', icon: '📰' },
          { id: 'info', label: 'Info', icon: 'ℹ️' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              flex: 1, padding: '12px 8px', background: 'transparent',
              border: 'none', cursor: 'pointer',
              borderBottom: active === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
              color: active === tab.id ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '11px', fontWeight: '600',
              fontFamily: "'Space Mono', monospace",
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function useVoteCount(accesoId, retornoId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data, error } = await window.supabase
          .from("votes")
          .select("id", { count: "exact" })
          .eq("acceso_id", accesoId)
          .eq("retorno_id", retornoId)
          .gte("created_at", new Date(Date.now() - 3600000).toISOString());
        if (!error) setCount(data?.length || 0);
      } catch {}
    };

    fetchCount();
    const subscription = window.supabase
      .channel(`votes-${accesoId}-${retornoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `acceso_id=eq.${accesoId},retorno_id=eq.${retornoId}`,
        },
        fetchCount
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [accesoId, retornoId]);

  return count;
}

function useActiveAccesoStatus() {
  const directoCount = useVoteCount("pv", "directo");
  const lateralCount = useVoteCount("pv", "lateral");
  const filaCount = useVoteCount("pv", "fila");

  const p15DirectoCount = useVoteCount("p15", "directo");
  const p15LateralCount = useVoteCount("p15", "lateral");
  const p15FilaCount = useVoteCount("p15", "fila");

  const znDirectoCount = useVoteCount("zn", "directo");
  const znLateralCount = useVoteCount("zn", "lateral");
  const znFilaCount = useVoteCount("zn", "fila");

  const getWinner = (a, b, c) => {
    const max = Math.max(a, b, c);
    if (a === max) return "directo";
    if (b === max) return "lateral";
    return "fila";
  };

  return {
    pv: getWinner(directoCount, lateralCount, filaCount),
    p15: getWinner(p15DirectoCount, p15LateralCount, p15FilaCount),
    zn: getWinner(znDirectoCount, znLateralCount, znFilaCount),
  };
}

function AccesoCard({
  acceso,
  retornos,
  estatusConfig,
  onVote,
  isAdmin,
  adminStatus,
  onAdminStatusChange,
}) {
  const activeStatus = useActiveAccesoStatus();
  const directoCount = useVoteCount(acceso.id, "directo");
  const lateralCount = useVoteCount(acceso.id, "lateral");
  const filaCount = useVoteCount(acceso.id, "fila");

  const counts = {
    directo: directoCount,
    lateral: lateralCount,
    fila: filaCount,
  };

  const winner = activeStatus[acceso.id];
  const winnerRetorno = retornos.find((r) => r.id === winner);
  const maxVotes = Math.max(directoCount, lateralCount, filaCount);
  const isConfirmed = maxVotes >= 50;

  const displayStatus = isConfirmed ? winner : adminStatus || winner;
  const displayConfig = estatusConfig[displayStatus] || winnerRetorno;
  const displayColor = isConfirmed ? "#a855f7" : displayConfig?.color || "#6b7280";

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)',
      borderRadius: '20px', padding: '20px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
        background: `linear-gradient(90deg, ${displayColor}, transparent)`,
        opacity: 0.6
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>{acceso.icon}</span>
          <div>
            <h3 style={{
              margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff',
              fontFamily: "'Space Mono', monospace"
            }}>
              {acceso.nombre}
            </h3>
            <div style={{
              fontSize: '11px', color: 'rgba(255,255,255,0.5)',
              fontFamily: "'Space Mono', monospace", marginTop: '4px'
            }}>
              {isConfirmed ? '🟣 Confirmado' : '📊 Votación activa'}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '28px', padding: '8px 12px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: `2px solid ${displayColor}`,
          boxShadow: `0 0 20px ${displayColor}40`
        }}>
          {displayConfig?.emoji || displayConfig?.icon}
        </div>
      </div>

      {isAdmin && (
        <div style={{
          marginBottom: '16px', padding: '12px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '12px'
        }}>
          <div style={{
            fontSize: '11px', color: 'rgba(147,197,253,0.9)',
            marginBottom: '8px', fontWeight: '600'
          }}>
            👑 Control Admin
          </div>
          <select
            value={adminStatus || ""}
            onChange={(e) => onAdminStatusChange(acceso.id, e.target.value)}
            style={{
              width: '100%', padding: '8px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: '13px',
              fontFamily: "'Space Mono', monospace"
            }}
          >
            <option value="">Auto (Votación)</option>
            {Object.entries(estatusConfig).map(([key, val]) => (
              <option key={key} value={key}>
                {val.emoji} {val.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
        padding: '12px', marginBottom: '16px'
      }}>
        <div style={{
          fontSize: '13px', color: 'rgba(255,255,255,0.6)',
          marginBottom: '10px', fontWeight: '600'
        }}>
          Votos por retorno (última hora):
        </div>
        {retornos.map((retorno) => {
          const voteCount = counts[retorno.id] || 0;
          const isWinning = retorno.id === winner;
          const percentage = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

          return (
            <div key={retorno.id} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '13px',
                  color: isWinning ? retorno.color : 'rgba(255,255,255,0.6)',
                  fontWeight: isWinning ? '700' : '500',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  {retorno.icon} {retorno.nombre}
                </span>
                <span style={{
                  fontSize: '13px', fontWeight: '700',
                  color: isWinning ? retorno.color : 'rgba(255,255,255,0.6)'
                }}>
                  {voteCount}
                </span>
              </div>
              <div style={{
                height: '6px', background: 'rgba(255,255,255,0.05)',
                borderRadius: '3px', overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', width: `${percentage}%`,
                  background: isWinning
                    ? `linear-gradient(90deg, ${retorno.color}, ${retorno.color}dd)`
                    : 'rgba(255,255,255,0.1)',
                  transition: 'width 0.5s ease',
                  boxShadow: isWinning ? `0 0 8px ${retorno.color}80` : 'none'
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
      }}>
        {retornos.map((retorno) => {
          const voteCount = counts[retorno.id] || 0;
          const isWinning = retorno.id === winner;

          return (
            <button
              key={retorno.id}
              onClick={() => onVote(acceso.id, retorno.id)}
              style={{
                padding: '10px', borderRadius: '10px',
                border: isWinning
                  ? `2px solid ${retorno.color}`
                  : '2px solid rgba(255,255,255,0.1)',
                background: isWinning
                  ? `${retorno.color}20`
                  : 'rgba(255,255,255,0.03)',
                color: isWinning ? retorno.color : 'rgba(255,255,255,0.7)',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: "'Space Mono', monospace",
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '4px',
                boxShadow: isWinning ? `0 4px 12px ${retorno.color}40` : 'none'
              }}
            >
              <span style={{ fontSize: '18px' }}>{retorno.icon}</span>
              <span>{retorno.nombre}</span>
              <span style={{
                fontSize: '11px',
                color: isWinning ? retorno.color : 'rgba(255,255,255,0.5)'
              }}>
                {voteCount} votos
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useAdminMode() {
  const [tapCount, setTapCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const tapTimerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY);
    if (saved === "true") setIsAdmin(true);
  }, []);

  const handleLogoTap = () => {
    setTapCount((prev) => prev + 1);
    clearTimeout(tapTimerRef.current);

    if (tapCount + 1 >= 5) {
      setShowModal(true);
      setTapCount(0);
    } else {
      tapTimerRef.current = setTimeout(() => setTapCount(0), 2000);
    }
  };

  const handleLogin = () => {
    if (password === ADMIN_PASS) {
      setIsAdmin(true);
      localStorage.setItem(ADMIN_KEY, "true");
      setShowModal(false);
      setPassword("");
      setError("");
    } else {
      setError("Contraseña incorrecta");
    }
  };

  const logout = () => {
    setIsAdmin(false);
    localStorage.removeItem(ADMIN_KEY);
  };

  const Modal = showModal ? (
    <div
      onClick={() => setShowModal(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(145deg, rgba(30,30,30,0.98) 0%, rgba(20,20,20,0.98) 100%)",
          borderRadius: "20px",
          padding: "32px",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>👑</div>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "700",
              color: "#fff",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Modo Admin
          </h2>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "13px",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Ingresa la contraseña
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.2)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "20px",
              color: "#fca5a5",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          onKeyPress={(e) => e.key === "Enter" && handleLogin()}
          placeholder="Contraseña admin"
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            fontSize: "15px",
            fontFamily: "'Space Mono', monospace",
            marginBottom: "16px",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => {
              setShowModal(false);
              setPassword("");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.7)",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleLogin}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "#fff",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Ingresar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { isAdmin, handleLogoTap, logout, Modal };
}

// ... (continúa con el resto de componentes: TerminalesStatus, LaneStatus, etc.)

function TerminalesStatus() {
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const { data, error } = await window.supabase
          .from("terminals")
          .select("*")
          .order("nombre");
        if (!error) setTerminals(data || []);
      } catch {}
      setLoading(false);
    };

    fetchTerminals();

    const subscription = window.supabase
      .channel("terminals-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "terminals" },
        fetchTerminals
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div
          style={{
            fontSize: "48px",
            marginBottom: "16px",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          ⏳
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
          Cargando terminales...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px" }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: "24px",
          padding: "20px",
          background:
            "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏢</div>
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "700",
            color: "#fff",
            fontFamily: "'Space Mono', monospace",
            marginBottom: "8px",
          }}
        >
          Estado de Terminales
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Información en tiempo real
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {terminals.map((terminal) => {
          const statusConfig = ESTATUS_CONFIG[terminal.estado] || {
            emoji: "⚪",
            label: "Desconocido",
            color: "#6b7280",
          };

          return (
            <div
              key={terminal.id}
              style={{
                background:
                  "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "4px",
                  background: `linear-gradient(90deg, ${statusConfig.color}, transparent)`,
                  opacity: 0.6,
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: "700",
                      color: "#fff",
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {terminal.nombre}
                  </h3>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.5)",
                      marginTop: "4px",
                    }}
                  >
                    {terminal.ubicacion}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    padding: "8px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)",
                    border: `2px solid ${statusConfig.color}`,
                    boxShadow: `0 0 20px ${statusConfig.color}40`,
                  }}
                >
                  {statusConfig.emoji}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: statusConfig.color,
                    fontWeight: "700",
                    marginBottom: "8px",
                  }}
                >
                  {statusConfig.label}
                </div>
                {terminal.observaciones && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: "1.5",
                    }}
                  >
                    {terminal.observaciones}
                  </div>
                )}
              </div>

              {terminal.ultima_actualizacion && (
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.4)",
                    textAlign: "right",
                  }}
                >
                  Última actualización:{" "}
                  {new Date(terminal.ultima_actualizacion).toLocaleString(
                    "es-MX"
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {terminals.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <p>No hay terminales registradas</p>
        </div>
      )}
    </div>
  );
}

function LaneStatus() {
  const [lanes, setLanes] = useState({
    pv: { exportacion: null, importacion: null },
    p15: { exportacion: null, importacion: null },
    zn: { exportacion: null, importacion: null },
  });

  useEffect(() => {
    const fetchLanes = async () => {
      try {
        const { data } = await window.supabase.from("lane_assignments").select("*");
        if (data) {
          const grouped = { pv: {}, p15: {}, zn: {} };
          data.forEach((lane) => {
            grouped[lane.acceso_id] = grouped[lane.acceso_id] || {};
            grouped[lane.acceso_id][lane.tipo] = lane.carril;
          });
          setLanes(grouped);
        }
      } catch {}
    };

    fetchLanes();
    const sub = window.supabase
      .channel("lanes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lane_assignments" }, fetchLanes)
      .subscribe();

    return () => sub.unsubscribe();
  }, []);

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{
        textAlign: "center", marginBottom: "24px", padding: "20px",
        background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
        borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛣️</div>
        <h2 style={{
          margin: 0, fontSize: "24px", fontWeight: "700", color: "#fff",
          fontFamily: "'Space Mono', monospace", marginBottom: "8px"
        }}>
          Estado de Carriles
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
          Asignación actual por acceso
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {ACCESOS.map((acceso) => (
          <div key={acceso.id} style={{
            background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
            borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ fontSize: "28px" }}>{acceso.icon}</span>
              <h3 style={{
                margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff",
                fontFamily: "'Space Mono', monospace"
              }}>
                {acceso.nombre}
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: "12px", padding: "14px"
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span style={{ fontSize: "13px", color: "rgba(16,185,129,0.9)", fontWeight: "600" }}>
                    📤 Exportación
                  </span>
                  <span style={{
                    fontSize: "18px", fontWeight: "700", color: "#10b981",
                    fontFamily: "'Space Mono', monospace"
                  }}>
                    {lanes[acceso.id]?.exportacion || "Sin asignar"}
                  </span>
                </div>
              </div>

              <div style={{
                background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "12px", padding: "14px"
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span style={{ fontSize: "13px", color: "rgba(59,130,246,0.9)", fontWeight: "600" }}>
                    📥 Importación
                  </span>
                  <span style={{
                    fontSize: "18px", fontWeight: "700", color: "#3b82f6",
                    fontFamily: "'Space Mono', monospace"
                  }}>
                    {lanes[acceso.id]?.importacion || "Sin asignar"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Noticias() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data } = await window.supabase
          .from("noticias")
          .select("*")
          .order("fecha_publicacion", { ascending: false })
          .limit(20);
        if (data) setNews(data);
      } catch {}
      setLoading(false);
    };

    fetchNews();
    const sub = window.supabase
      .channel("news")
      .on("postgres_changes", { event: "*", schema: "public", table: "noticias" }, fetchNews)
      .subscribe();

    return () => sub.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
          Cargando noticias...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{
        textAlign: "center", marginBottom: "24px", padding: "20px",
        background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
        borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📰</div>
        <h2 style={{
          margin: 0, fontSize: "24px", fontWeight: "700", color: "#fff",
          fontFamily: "'Space Mono', monospace", marginBottom: "8px"
        }}>
          Noticias del Puerto
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
          Última información actualizada
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {news.map((item) => (
          <div key={item.id} style={{
            background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
            borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              marginBottom: "12px"
            }}>
              <h3 style={{
                margin: 0, fontSize: "16px", fontWeight: "700", color: "#fff",
                fontFamily: "'Space Mono', monospace", flex: 1
              }}>
                {item.titulo}
              </h3>
              <span style={{
                fontSize: "24px", marginLeft: "12px", flexShrink: 0
              }}>
                {item.icono || "📌"}
              </span>
            </div>

            <p style={{
              margin: "0 0 12px 0", fontSize: "14px", color: "rgba(255,255,255,0.7)",
              lineHeight: "1.6"
            }}>
              {item.contenido}
            </p>

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)"
            }}>
              <span style={{
                fontSize: "11px", color: "rgba(255,255,255,0.4)",
                fontFamily: "'Space Mono', monospace"
              }}>
                {new Date(item.fecha_publicacion).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {item.prioridad === "alta" && (
                <span style={{
                  background: "rgba(239,68,68,0.2)", color: "#fca5a5",
                  padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
                  fontWeight: "600"
                }}>
                  ⚠️ Importante
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {news.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.5)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <p>No hay noticias disponibles</p>
        </div>
      )}
    </div>
  );
}

function InfoTab() {
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{
        textAlign: "center", marginBottom: "24px", padding: "24px",
        background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
        borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>ℹ️</div>
        <h2 style={{
          margin: 0, fontSize: "24px", fontWeight: "700", color: "#fff",
          fontFamily: "'Space Mono', monospace", marginBottom: "12px"
        }}>
          Acerca de Conect Manzanillo
        </h2>
        <p style={{
          margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.6)",
          lineHeight: "1.6", maxWidth: "400px", margin: "0 auto"
        }}>
          Plataforma comunitaria para monitoreo en tiempo real del tráfico
          portuario de Manzanillo, Colima
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{
          background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
          borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px"
          }}>
            <span style={{ fontSize: "28px" }}>🎯</span>
            <h3 style={{
              margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff",
              fontFamily: "'Space Mono', monospace"
            }}>
              Nuestra Misión
            </h3>
          </div>
          <p style={{
            margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)",
            lineHeight: "1.6"
          }}>
            Facilitar el acceso a información en tiempo real sobre el estado del
            tráfico en los accesos al Puerto de Manzanillo, ayudando a la
            comunidad a tomar mejores decisiones sobre rutas y horarios.
          </p>
        </div>

        <div style={{
          background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
          borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px"
          }}>
            <span style={{ fontSize: "28px" }}>✨</span>
            <h3 style={{
              margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff",
              fontFamily: "'Space Mono', monospace"
            }}>
              Características
            </h3>
          </div>
          <ul style={{
            margin: 0, padding: "0 0 0 20px", fontSize: "14px",
            color: "rgba(255,255,255,0.7)", lineHeight: "1.8"
          }}>
            <li>Votación comunitaria en tiempo real</li>
            <li>Múltiples puntos de acceso monitoreados</li>
            <li>Estado de terminales portuarias</li>
            <li>Asignación de carriles exportación/importación</li>
            <li>Sistema de noticias y alertas</li>
            <li>Interfaz responsive y rápida</li>
          </ul>
        </div>

        <div style={{
          background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
          borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px"
          }}>
            <span style={{ fontSize: "28px" }}>🤝</span>
            <h3 style={{
              margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff",
              fontFamily: "'Space Mono', monospace"
            }}>
              Comunidad
            </h3>
          </div>
          <p style={{
            margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.7)",
            lineHeight: "1.6"
          }}>
            Construido por y para la comunidad de Manzanillo. Tu participación
            con votos y reportes ayuda a mantener la información actualizada
            para todos.
          </p>
        </div>

        <div style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(37,99,235,0.2) 100%)",
          border: "1px solid rgba(59,130,246,0.3)", borderRadius: "16px",
          padding: "20px", textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📱</div>
          <p style={{
            margin: 0, fontSize: "13px", color: "rgba(147,197,253,0.9)",
            fontWeight: "600"
          }}>
            Versión 1.0.0 • Desarrollado con ❤️ para Manzanillo
          </p>
        </div>
      </div>
    </div>
  );
}

function CookieBanner({ onAccept }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setShow(true);
  }, []);

  if (!show) return null;

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, "true");
    setShow(false);
    onAccept?.();
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9998,
      background: "linear-gradient(180deg, rgba(13,13,13,0) 0%, rgba(13,13,13,0.98) 20%, rgba(13,13,13,0.98) 100%)",
      backdropFilter: "blur(20px)", padding: "20px 16px",
      borderTop: "1px solid rgba(255,255,255,0.1)"
    }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <div style={{
          background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
          borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)"
        }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "32px", flexShrink: 0 }}>🍪</span>
            <div style={{ flex: 1 }}>
              <h3 style={{
                margin: "0 0 8px 0", fontSize: "16px", fontWeight: "700",
                color: "#fff", fontFamily: "'Space Mono', monospace"
              }}>
                Aviso de Cookies
              </h3>
              <p style={{
                margin: "0 0 16px 0", fontSize: "13px",
                color: "rgba(255,255,255,0.7)", lineHeight: "1.5"
              }}>
                Usamos cookies esenciales para mejorar tu experiencia en la
                plataforma. Al continuar navegando, aceptas su uso.
              </p>
              <button onClick={handleAccept} style={{
                width: "100%", padding: "12px", borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                color: "#fff", fontSize: "14px", fontWeight: "600",
                cursor: "pointer", fontFamily: "'Space Mono', monospace"
              }}>
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonateBanner({ active }) {
  if (active !== "info") return null;

  return (
    <div style={{
      position: "fixed", bottom: "20px", left: "50%",
      transform: "translateX(-50%)", maxWidth: "440px", width: "calc(100% - 32px)",
      zIndex: 1000
    }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.15) 100%)",
        border: "1px solid rgba(16,185,129,0.3)", borderRadius: "16px",
        padding: "20px", backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
      }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span style={{ fontSize: "40px", flexShrink: 0 }}>💚</span>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700",
              color: "#10b981", fontFamily: "'Space Mono', monospace"
            }}>
              ¿Te ha sido útil?
            </h3>
            <p style={{
              margin: "0 0 12px 0", fontSize: "13px",
              color: "rgba(16,185,129,0.9)", lineHeight: "1.4"
            }}>
              Ayúdanos a mantener la plataforma activa
            </p>
            
              href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block", padding: "10px 20px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff", fontSize: "14px", fontWeight: "600",
                textDecoration: "none", fontFamily: "'Space Mono', monospace"
              }}
            >
              ☕ Invítanos un café
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentReportForm() {
  const [formData, setFormData] = useState({
    acceso_id: "",
    tipo: "",
    descripcion: "",
    severidad: "media",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.acceso_id || !formData.tipo || !formData.descripcion) {
      alert("Por favor completa todos los campos requeridos");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await window.supabase.from("incidents").insert([
        {
          acceso_id: formData.acceso_id,
          tipo: formData.tipo,
          descripcion: formData.descripcion,
          severidad: formData.severidad,
          reportado_en: new Date().toISOString(),
        },
      ]);

      if (!error) {
        setSuccess(true);
        setFormData({
          acceso_id: "",
          tipo: "",
          descripcion: "",
          severidad: "media",
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{
        textAlign: "center", marginBottom: "24px", padding: "20px",
        background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
        borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "12px" }}>📝</div>
        <h2 style={{
          margin: 0, fontSize: "24px", fontWeight: "700", color: "#fff",
          fontFamily: "'Space Mono', monospace", marginBottom: "8px"
        }}>
          Reportar Incidente
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
          Ayuda a la comunidad reportando situaciones
        </p>
      </div>

      {success && (
        <div style={{
          background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
          borderRadius: "12px", padding: "16px", marginBottom: "20px",
          color: "#6ee7b7", textAlign: "center", fontSize: "14px"
        }}>
          ✅ Reporte enviado exitosamente
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
        borderRadius: "16px", padding: "24px", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block", marginBottom: "8px", color: "rgba(255,255,255,0.8)",
            fontSize: "14px", fontWeight: "600"
          }}>
            Acceso *
          </label>
          <select
            value={formData.acceso_id}
            onChange={(e) => setFormData({ ...formData, acceso_id: e.target.value })}
            required
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
              fontSize: "14px", fontFamily: "'Space Mono', monospace"
            }}
          >
            <option value="">Selecciona un acceso</option>
            {ACCESOS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block", marginBottom: "8px", color: "rgba(255,255,255,0.8)",
            fontSize: "14px", fontWeight: "600"
          }}>
            Tipo de Incidente *
          </label>
          <select
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            required
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
              fontSize: "14px", fontFamily: "'Space Mono', monospace"
            }}
          >
            <option value="">Selecciona un tipo</option>
            <option value="accidente">🚗 Accidente</option>
            <option value="congestion">🚦 Congestión</option>
            <option value="cierre">🚧 Cierre de vía</option>
            <option value="otro">📌 Otro</option>
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block", marginBottom: "8px", color: "rgba(255,255,255,0.8)",
            fontSize: "14px", fontWeight: "600"
          }}>
            Severidad
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            {["baja", "media", "alta"].map((sev) => (
              <label
                key={sev}
                style={{
                  flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
                  background:
                    formData.severidad === sev
                      ? "rgba(59,130,246,0.2)"
                      : "rgba(255,255,255,0.03)",
                  border:
                    formData.severidad === sev
                      ? "2px solid #3b82f6"
                      : "2px solid rgba(255,255,255,0.1)",
                  color: formData.severidad === sev ? "#3b82f6" : "rgba(255,255,255,0.7)",
                  fontSize: "13px", fontWeight: "600", textAlign: "center",
                  transition: "all 0.2s ease"
                }}
              >
                <input
                  type="radio"
                  name="severidad"
                  value={sev}
                  checked={formData.severidad === sev}
                  onChange={(e) => setFormData({ ...formData, severidad: e.target.value })}
                  style={{ display: "none" }}
                />
                {sev === "baja" && "🟢"}
                {sev === "media" && "🟡"}
                {sev === "alta" && "🔴"}{" "}
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{
            display: "block", marginBottom: "8px", color: "rgba(255,255,255,0.8)",
            fontSize: "14px", fontWeight: "600"
          }}>
            Descripción *
          </label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            required
            placeholder="Describe la situación brevemente..."
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
              fontSize: "14px", fontFamily: "'Space Mono', monospace",
              minHeight: "100px", resize: "vertical"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%", padding: "14px", borderRadius: "12px",
            border: "none",
            background: submitting
              ? "rgba(59,130,246,0.5)"
              : "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            color: "#fff", fontSize: "16px", fontWeight: "600",
            cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "'Space Mono', monospace"
          }}
        >
          {submitting ? "⏳ Enviando..." : "📤 Enviar Reporte"}
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL APP
// ============================================================================

function App() {
  const { isAdmin, handleLogoTap, logout, Modal } = useAdminMode();
  const [active, setActive] = useState("trafico");
  const [adminStatuses, setAdminStatuses] = useState({});

  // Estados de autenticación
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        const user = JSON.parse(saved);
        setCurrentUser(user);
        setIsUserLoggedIn(true);
      }
    } catch {}
  }, []);

  const handleUserLogin = (user) => {
    setCurrentUser(user);
    setIsUserLoggedIn(true);
  };

  const handleUserLogout = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setCurrentUser(null);
    setIsUserLoggedIn(false);
  };

  const handleVote = async (accesoId, retornoId) => {
    try {
      await window.supabase.from("votes").insert([
        {
          acceso_id: accesoId,
          retorno_id: retornoId,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Error voting:", err);
    }
  };

  const handleAdminStatusChange = (accesoId, status) => {
    setAdminStatuses((prev) => ({
      ...prev,
      [accesoId]: status || undefined,
    }));
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0d",
      color: "#fff", fontFamily: "'Space Mono', monospace",
      paddingBottom: active === "info" ? "120px" : "20px"
    }}>
      <NavBar
        active={active}
        setActive={setActive}
        isAdmin={isAdmin}
        onLogoTap={handleLogoTap}
      />

      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        {active === "trafico" && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{
              textAlign: "center", marginBottom: "24px", padding: "20px",
              background: "linear-gradient(145deg, rgba(23,23,23,0.95) 0%, rgba(15,15,15,0.95) 100%)",
              borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🚦</div>
              <h2 style={{
                margin: 0, fontSize: "24px", fontWeight: "700", color: "#fff",
                marginBottom: "8px"
              }}>
                Accesos Principales
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
                Vota en tiempo real • Actualización automática
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {ACCESOS.map((acceso) => (
                <AccesoCard
                  key={acceso.id}
                  acceso={acceso}
                  retornos={ACCESO_RETORNOS}
                  estatusConfig={ESTATUS_CONFIG}
                  onVote={handleVote}
                  isAdmin={isAdmin}
                  adminStatus={adminStatuses[acceso.id]}
                  onAdminStatusChange={handleAdminStatusChange}
                />
              ))}
            </div>

            <TerminalesStatus />
          </div>
        )}

        {active === "reportar" && <IncidentReportForm />}
        {active === "carriles" && <LaneStatus />}
        {active === "noticias" && <Noticias />}
        {active === "info" && <InfoTab />}

        <CookieBanner />
        <DonateBanner active={active} />

        {/* Sistema de Autenticación */}
        <FloatingAuthButton
          onOpenAuth={() => setAuthOpen(true)}
          isLoggedIn={isUserLoggedIn}
          user={currentUser}
          onLogout={handleUserLogout}
        />

        {authOpen && (
          <AuthModal
            onClose={() => setAuthOpen(false)}
            onLogin={handleUserLogin}
          />
        )}
      </div>

      {Modal}
    </div>
  );
}

export default App;
