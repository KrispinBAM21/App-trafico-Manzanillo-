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
const ADMIN_USER   = "conectmzo";        // Usuario admin
const ADMIN_PASS   = "35841912";         // Contraseña admin
const ADMIN_KEY    = "cm_admin_session";
const USER_KEY     = "cm_user_session";

const getCookieConsent = () => {
  try { return localStorage.getItem(COOKIE_KEY); } catch { return null; }
};
const saveCookieConsent = (val) => {
  try { localStorage.setItem(COOKIE_KEY, val); } catch {}
};

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
  const tempDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email', 'mailinator.com', 'maildrop.cc'];
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

// Simulación de base de datos de usuarios (en producción, usa Supabase)
const USERS_DB = {
  users: [],
  phones: new Set(),
  ips: {},
  devices: new Set()
};

// ─── FLOATING AUTH BUTTON ────────────────────────────────────────────────────
function FloatingAuthButton({ onOpenAuth, isLoggedIn, user, onLogout }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef(null);

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    const handleActivity = () => resetTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: isVisible ? '20px' : '-80px',
        zIndex: 9999,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: isVisible ? 1 : 0
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        resetTimer();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isLoggedIn ? (
        <button
          onClick={() => {
            resetTimer();
            onOpenAuth();
          }}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            cursor: 'pointer',
            boxShadow: isHovered 
              ? '0 8px 32px rgba(102, 126, 234, 0.5)' 
              : '0 4px 16px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            transition: 'all 0.3s ease',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          👤
        </button>
      ) : (
        <div style={{
          background: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minWidth: '220px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: user?.role === 'admin' 
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}>
              {user?.role === 'admin' ? '👑' : '👤'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: '700', 
                color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: '2px'
              }}>
                {user?.username || 'Usuario'}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: user?.role === 'admin' ? '#f093fb' : '#4facfe',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: '600',
                letterSpacing: '0.5px'
              }}>
                {user?.role === 'admin' ? '⭐ ADMINISTRADOR' : '✓ Usuario'}
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '10px',
              color: '#ff6b6b',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.2s ease',
              letterSpacing: '0.3px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.25)';
              e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.15)';
              e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AUTH MODAL ──────────────────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [view, setView] = useState('menu'); // menu, login, register, forgot
  const [step, setStep] = useState(1); // Para el proceso de registro
  const [formData, setFormData] = useState({
    // Login
    loginUsername: '',
    loginPassword: '',
    // Registro - Paso 1: Información básica
    nombre: '',
    apellidos: '',
    username: '',
    fechaNacimiento: '',
    pais: 'México',
    ciudad: '',
    // Paso 2: Verificación teléfono
    telefono: '',
    codigoSMS: '',
    generatedCode: '',
    // Paso 3: Email
    email: '',
    confirmarEmail: '',
    // Paso 4: Contraseña
    password: '',
    confirmarPassword: '',
    // Paso 5: Información adicional
    direccion: '',
    codigoPostal: '',
    // Paso 6: Captcha y términos
    captchaAnswer: '',
    captchaQuestion: null,
    aceptaTerminos: false,
    aceptaPrivacidad: false,
    // Forgot password
    forgotEmail: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Generar pregunta de captcha
  useEffect(() => {
    if (view === 'register' && step === 6) {
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      setFormData(prev => ({
        ...prev,
        captchaQuestion: { num1, num2, answer: num1 + num2 }
      }));
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

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 800));

    // Verificar admin
    if (loginUsername === ADMIN_USER && loginPassword === ADMIN_PASS) {
      const adminUser = {
        username: ADMIN_USER,
        role: 'admin',
        nombre: 'Administrador',
        apellidos: 'Sistema'
      };
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
      } catch {}
      onLogin(adminUser);
      setLoading(false);
      onClose();
      return;
    }

    // Verificar usuario regular (simulado)
    const user = USERS_DB.users.find(u => 
      u.username === loginUsername && u.password === loginPassword
    );

    if (user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {}
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

    // Verificar si el usuario ya existe
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

    // Verificar si el teléfono ya está registrado
    if (USERS_DB.phones.has(telefono)) {
      setError('Este número de teléfono ya está registrado');
      return;
    }

    // Generar código de 6 dígitos
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

    // Crear usuario
    const newUser = {
      username: formData.username,
      password: formData.password,
      nombre: formData.nombre,
      apellidos: formData.apellidos,
      email: formData.email,
      telefono: formData.telefono,
      fechaNacimiento: formData.fechaNacimiento,
      pais: formData.pais,
      ciudad: formData.ciudad,
      direccion: formData.direccion,
      codigoPostal: formData.codigoPostal,
      role: 'user',
      createdAt: new Date().toISOString()
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
    <div style={{ padding: '20px' }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '10px'
        }}>🔐</div>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Acceso al Sistema
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Conect Manzanillo
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => setView('login')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }}
        >
          <span style={{ fontSize: '20px' }}>🔑</span>
          Iniciar Sesión
        </button>

        <button
          onClick={() => setView('register')}
          style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(240, 147, 251, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(240, 147, 251, 0.3)';
          }}
        >
          <span style={{ fontSize: '20px' }}>✨</span>
          Crear Cuenta
        </button>

        <button
          onClick={() => setView('forgot')}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '16px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.05)';
            e.target.style.color = '#fff';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          <span style={{ fontSize: '18px' }}>🔓</span>
          Olvidé mi Contraseña
        </button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div style={{ padding: '20px' }}>
      <button
        onClick={() => setView('menu')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '8px',
          marginBottom: '10px'
        }}
      >
        ←
      </button>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔑</div>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Iniciar Sesión
        </h2>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          padding: '12px',
          color: '#ff6b6b',
          fontSize: '14px',
          marginBottom: '20px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Usuario
        </label>
        <input
          type="text"
          value={formData.loginUsername}
          onChange={(e) => handleInputChange('loginUsername', e.target.value)}
          placeholder="Tu nombre de usuario"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
            transition: 'all 0.3s ease'
          }}
          onFocus={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.08)';
            e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)';
          }}
          onBlur={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.05)';
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Contraseña
        </label>
        <input
          type="password"
          value={formData.loginPassword}
          onChange={(e) => handleInputChange('loginPassword', e.target.value)}
          placeholder="Tu contraseña"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
            transition: 'all 0.3s ease'
          }}
          onFocus={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.08)';
            e.target.style.borderColor = 'rgba(102, 126, 234, 0.5)';
          }}
          onBlur={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.05)';
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
        />
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: '100%',
          background: loading 
            ? 'rgba(102, 126, 234, 0.5)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '14px',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
          transition: 'all 0.3s ease'
        }}
      >
        {loading ? '⏳ Iniciando...' : '🚀 Entrar'}
      </button>
    </div>
  );

  const renderRegisterStep1 = () => (
    <div>
      <div style={{
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '6px'
        }}>
          Paso 1 de 6
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          👤 Información Básica
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Nombre *
          </label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleInputChange('nombre', e.target.value)}
            placeholder="Tu nombre"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Apellidos *
          </label>
          <input
            type="text"
            value={formData.apellidos}
            onChange={(e) => handleInputChange('apellidos', e.target.value)}
            placeholder="Tus apellidos"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Nombre de Usuario * (único)
          </label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="usuario123"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Fecha de Nacimiento *
          </label>
          <input
            type="date"
            value={formData.fechaNacimiento}
            onChange={(e) => handleInputChange('fechaNacimiento', e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            País *
          </label>
          <select
            value={formData.pais}
            onChange={(e) => handleInputChange('pais', e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          >
            <option value="México">México</option>
            <option value="Estados Unidos">Estados Unidos</option>
            <option value="Colombia">Colombia</option>
            <option value="Argentina">Argentina</option>
            <option value="España">España</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Ciudad *
          </label>
          <input
            type="text"
            value={formData.ciudad}
            onChange={(e) => handleInputChange('ciudad', e.target.value)}
            placeholder="Tu ciudad"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#ff6b6b',
          fontSize: '13px',
          marginTop: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleRegisterStep1}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          border: 'none',
          borderRadius: '10px',
          padding: '12px',
          color: '#fff',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginTop: '20px'
        }}
      >
        Continuar →
      </button>
    </div>
  );

  const renderRegisterStep2 = () => (
    <div>
      <div style={{
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '6px'
        }}>
          Paso 2 de 6
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          📱 Verificación de Teléfono
        </div>
      </div>

      <div style={{
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        fontSize: '13px',
        color: 'rgba(255,255,255,0.8)',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        💡 Este paso evita cuentas falsas y bots
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Número de Teléfono *
        </label>
        <input
          type="tel"
          value={formData.telefono}
          onChange={(e) => handleInputChange('telefono', e.target.value)}
          placeholder="+52 314 123 4567"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      <button
        onClick={handleSendSMS}
        style={{
          width: '100%',
          background: 'rgba(34, 197, 94, 0.2)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: '8px',
          padding: '10px',
          color: '#4ade80',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '16px'
        }}
      >
        📨 Enviar Código SMS
      </button>

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#4ade80',
          fontSize: '13px',
          marginBottom: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ✓ {success}
        </div>
      )}

      {formData.generatedCode && (
        <>
          <div style={{ marginBottom: '14px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: "'DM Sans', sans-serif"
            }}>
              Código de Verificación *
            </label>
            <input
              type="text"
              value={formData.codigoSMS}
              onChange={(e) => handleInputChange('codigoSMS', e.target.value)}
              placeholder="123456"
              maxLength={6}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '18px',
                fontFamily: "'DM Sans', sans-serif",
                outline: 'none',
                letterSpacing: '4px',
                textAlign: 'center'
              }}
            />
          </div>

          <button
            onClick={handleVerifySMS}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Verificar Código →
          </button>
        </>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#ff6b6b',
          fontSize: '13px',
          marginTop: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={() => setStep(1)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '10px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginTop: '12px'
        }}
      >
        ← Volver
      </button>
    </div>
  );

  const renderRegisterStep3 = () => (
    <div>
      <div style={{
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '6px'
        }}>
          Paso 3 de 6
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          📧 Correo Electrónico
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Email *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="tu@email.com"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Confirmar Email *
        </label>
        <input
          type="email"
          value={formData.confirmarEmail}
          onChange={(e) => handleInputChange('confirmarEmail', e.target.value)}
          placeholder="tu@email.com"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '20px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.7)',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        💡 No se permiten correos temporales
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#ff6b6b',
          fontSize: '13px',
          marginBottom: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleRegisterStep3}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          border: 'none',
          borderRadius: '10px',
          padding: '12px',
          color: '#fff',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif"
        }}
      >
        Continuar →
      </button>

      <button
        onClick={() => setStep(2)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '10px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginTop: '12px'
        }}
      >
        ← Volver
      </button>
    </div>
  );

  const renderRegisterStep4 = () => {
    const strength = getPasswordStrength(formData.password);
    const strengthColors = ['#ef4444', '#f97316', '#eab308', '#4ade80', '#22c55e'];
    const strengthLabels = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte'];

    return (
      <div>
        <div style={{
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: '6px'
          }}>
            Paso 4 de 6
          </div>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#fff',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            🔑 Contraseña Segura
          </div>
        </div>

        <div style={{
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          marginBottom: '16px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: '1.6'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '6px' }}>
            📋 Requisitos:
          </div>
          <div>✓ Mínimo 10 caracteres</div>
          <div>✓ Al menos 1 mayúscula</div>
          <div>✓ Al menos 1 número</div>
          <div>✓ Al menos 1 símbolo (!@#$%...)</div>
          <div style={{ marginTop: '6px', fontSize: '11px', opacity: '0.7' }}>
            Ejemplo: Micuenta#2026
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Contraseña *
          </label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Tu contraseña segura"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
          
          {formData.password && (
            <div style={{ marginTop: '8px' }}>
              <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(strength / 5) * 100}%`,
                  background: strengthColors[strength],
                  transition: 'all 0.3s ease'
                }} />
              </div>
              <div style={{
                fontSize: '11px',
                color: strengthColors[strength],
                marginTop: '4px',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: '600'
              }}>
                {strengthLabels[strength]}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Confirmar Contraseña *
          </label>
          <input
            type="password"
            value={formData.confirmarPassword}
            onChange={(e) => handleInputChange('confirmarPassword', e.target.value)}
            placeholder="Repite tu contraseña"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none'
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px',
            color: '#ff6b6b',
            fontSize: '13px',
            marginBottom: '14px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleRegisterStep4}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            border: 'none',
            borderRadius: '10px',
            padding: '12px',
            color: '#fff',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          Continuar →
        </button>

        <button
          onClick={() => setStep(3)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '10px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            marginTop: '12px'
          }}
        >
          ← Volver
        </button>
      </div>
    );
  };

  const renderRegisterStep5 = () => (
    <div>
      <div style={{
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '6px'
        }}>
          Paso 5 de 6
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          📍 Información Adicional
        </div>
      </div>

      <div style={{
        background: 'rgba(168, 85, 247, 0.1)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '16px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.8)',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        🛡️ Ayuda a prevenir registros masivos falsos
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Dirección *
        </label>
        <input
          type="text"
          value={formData.direccion}
          onChange={(e) => handleInputChange('direccion', e.target.value)}
          placeholder="Calle, número, colonia"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Código Postal *
        </label>
        <input
          type="text"
          value={formData.codigoPostal}
          onChange={(e) => handleInputChange('codigoPostal', e.target.value)}
          placeholder="28200"
          maxLength={5}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#ff6b6b',
          fontSize: '13px',
          marginBottom: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleRegisterStep5}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          border: 'none',
          borderRadius: '10px',
          padding: '12px',
          color: '#fff',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif"
        }}
      >
        Continuar →
      </button>

      <button
        onClick={() => setStep(4)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '10px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginTop: '12px'
        }}
      >
        ← Volver
      </button>
    </div>
  );

  const renderRegisterStep6 = () => (
    <div>
      <div style={{
        background: 'rgba(102, 126, 234, 0.1)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: '6px'
        }}>
          Paso 6 de 6
        </div>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          🤖 Verificación Final
        </div>
      </div>

      {formData.captchaQuestion && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Pregunta de Seguridad:
          </label>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '10px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif"
            }}>
              ¿Cuánto es {formData.captchaQuestion.num1} + {formData.captchaQuestion.num2}?
            </div>
          </div>
          <input
            type="number"
            value={formData.captchaAnswer}
            onChange={(e) => handleInputChange('captchaAnswer', e.target.value)}
            placeholder="Tu respuesta"
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '18px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              textAlign: 'center',
              fontWeight: '700'
            }}
          />
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <input
            type="checkbox"
            checked={formData.aceptaTerminos}
            onChange={(e) => handleInputChange('aceptaTerminos', e.target.checked)}
            style={{
              marginTop: '2px',
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <label style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: '1.5',
            cursor: 'pointer'
          }} onClick={() => handleInputChange('aceptaTerminos', !formData.aceptaTerminos)}>
            Acepto los <span style={{ color: '#667eea', fontWeight: '600' }}>Términos y Condiciones</span> del servicio
          </label>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <input
            type="checkbox"
            checked={formData.aceptaPrivacidad}
            onChange={(e) => handleInputChange('aceptaPrivacidad', e.target.checked)}
            style={{
              marginTop: '2px',
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <label style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.8)',
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: '1.5',
            cursor: 'pointer'
          }} onClick={() => handleInputChange('aceptaPrivacidad', !formData.aceptaPrivacidad)}>
            Acepto la <span style={{ color: '#f093fb', fontWeight: '600' }}>Política de Privacidad</span>
          </label>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '10px',
          color: '#ff6b6b',
          fontSize: '13px',
          marginBottom: '14px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          color: '#4ade80',
          fontSize: '14px',
          marginBottom: '14px',
          fontFamily: "'DM Sans', sans-serif",
          textAlign: 'center',
          fontWeight: '600'
        }}>
          ✓ {success}
        </div>
      )}

      <button
        onClick={handleRegisterComplete}
        disabled={loading}
        style={{
          width: '100%',
          background: loading 
            ? 'rgba(240, 147, 251, 0.5)'
            : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          border: 'none',
          borderRadius: '10px',
          padding: '14px',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '700',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)'
        }}
      >
        {loading ? '⏳ Creando cuenta...' : '🎉 Crear Mi Cuenta'}
      </button>

      <button
        onClick={() => setStep(5)}
        disabled={loading}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '10px',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          marginTop: '12px'
        }}
      >
        ← Volver
      </button>
    </div>
  );

  const renderRegister = () => {
    const steps = {
      1: renderRegisterStep1(),
      2: renderRegisterStep2(),
      3: renderRegisterStep3(),
      4: renderRegisterStep4(),
      5: renderRegisterStep5(),
      6: renderRegisterStep6()
    };

    return (
      <div style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
        <button
          onClick={() => {
            setView('menu');
            setStep(1);
            setError('');
            setSuccess('');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            marginBottom: '10px'
          }}
        >
          ←
        </button>

        {steps[step]}
      </div>
    );
  };

  const renderForgot = () => (
    <div style={{ padding: '20px' }}>
      <button
        onClick={() => setView('menu')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '8px',
          marginBottom: '10px'
        }}
      >
        ←
      </button>

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔓</div>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '700',
          color: '#fff',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Recuperar Contraseña
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Te enviaremos un enlace a tu correo
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          padding: '12px',
          color: '#ff6b6b',
          fontSize: '14px',
          marginBottom: '20px',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '10px',
          padding: '12px',
          color: '#4ade80',
          fontSize: '14px',
          marginBottom: '20px',
          fontFamily: "'DM Sans', sans-serif",
          textAlign: 'center'
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: "'DM Sans', sans-serif"
        }}>
          Correo Electrónico
        </label>
        <input
          type="email"
          value={formData.forgotEmail}
          onChange={(e) => handleInputChange('forgotEmail', e.target.value)}
          placeholder="tu@email.com"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '15px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none'
          }}
        />
      </div>

      <button
        onClick={handleForgotPassword}
        disabled={loading}
        style={{
          width: '100%',
          background: loading 
            ? 'rgba(102, 126, 234, 0.5)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '14px',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}
      >
        {loading ? '⏳ Enviando...' : '📧 Enviar Enlace'}
      </button>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(145deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
          borderRadius: '20px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 1
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(239, 68, 68, 0.2)';
            e.target.style.color = '#ff6b6b';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            e.target.style.color = 'rgba(255,255,255,0.7)';
          }}
        >
          ×
        </button>

        {view === 'menu' && renderMenu()}
        {view === 'login' && renderLogin()}
        {view === 'register' && renderRegister()}
        {view === 'forgot' && renderForgot()}
      </div>
    </div>
  );
}

// Nota: Este es solo el componente de autenticación.
// Para integrarlo completamente, necesitarías:
// 1. Agregar el estado de autenticación en el componente App principal
// 2. Integrar FloatingAuthButton en el JSX principal
// 3. Mostrar AuthModal cuando sea necesario
// 4. Conectar con Supabase para persistencia real de usuarios

export default function AuthComponents() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Verificar si hay sesión guardada
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    } catch {}
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <FloatingAuthButton
        onOpenAuth={() => setIsAuthOpen(true)}
        isLoggedIn={isLoggedIn}
        user={currentUser}
        onLogout={handleLogout}
      />

      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onLogin={handleLogin}
        />
      )}

      {/* Tu contenido principal aquí */}
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#fff',
        fontFamily: "'DM Sans', sans-serif"
      }}>
        <h1>Sistema de Autenticación Seguro</h1>
        <p>Haz clic en el botón flotante para acceder</p>
        {isLoggedIn && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <h2>¡Bienvenido, {currentUser?.nombre}!</h2>
            <p>Rol: {currentUser?.role === 'admin' ? '👑 Administrador' : '👤 Usuario'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
