'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Wifi, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState('');
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'link' | ''>('');
  const [inactiveMsg, setInactiveMsg] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('inactive') === '1') {
      setInactiveMsg(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error('Credenciales incorrectas');
      setLoading(false);
      return;
    }

    toast.success('Bienvenido a ZOE Net Gestión');
    router.push('/dashboard');
    router.refresh();
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Ingresa tu email');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/send-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || 'Error al enviar email');
      } else {
        setRecoverySent(true);
        setRecoveryLink(result.recoveryLink || '');
        setRecoveryMethod(result.method || 'email');
        if (result.method === 'email') {
          toast.success('Email de recuperación enviado');
        } else {
          toast.success('Enlace de recuperación generado');
        }
      }
    } catch {
      toast.error('Error al enviar email de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-4">
            <Wifi className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            <span className="text-blue-500">ZOE</span> Net Gestión
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de gestión empresarial</p>
        </div>

        {mode === 'login' ? (
          <>
            {inactiveMsg && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 text-sm text-yellow-300 text-center">
                Tu cuenta aún no ha sido activada por un administrador. Contacta al administrador para obtener acceso.
              </div>
            )}
            <form onSubmit={handleLogin} className="card p-6 space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <div className="flex flex-col items-center gap-2 mt-4">
              <button
                onClick={() => { setMode('recovery'); setRecoverySent(false); }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
              <Link
                href="/registro"
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Obtener Acceso
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="card p-6 space-y-4">
              {recoverySent ? (
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mx-auto">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  {recoveryMethod === 'email' ? (
                    <>
                      <h2 className="text-lg font-semibold text-white">Email Enviado</h2>
                      <p className="text-sm text-gray-400">
                        Hemos enviado un enlace de recuperación a <span className="text-white font-medium">{email}</span>.
                      </p>
                      <p className="text-xs text-gray-500">
                        Revisa tu bandeja de entrada y la carpeta de spam. El enlace expira en 24 horas.
                      </p>
                    </>
                  ) : recoveryLink ? (
                    <>
                      <h2 className="text-lg font-semibold text-white">Enlace Generado</h2>
                      <p className="text-sm text-gray-400">
                        No se pudo enviar el email. Usa este enlace directo:
                      </p>
                      <a
                        href={recoveryLink}
                        className="block w-full text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Restablecer Contraseña
                      </a>
                      <p className="text-xs text-gray-500">
                        Este enlace expira en 24 horas.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold text-white">Solicitud Enviada</h2>
                      <p className="text-sm text-gray-400">
                        Si el email existe, recibirás un enlace de recuperación en <span className="text-white font-medium">{email}</span>.
                      </p>
                      <p className="text-xs text-gray-500">
                        Si no lo ves, revisa la carpeta de spam.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRecovery} className="space-y-4">
                  <div className="text-center">
                    <h2 className="text-lg font-semibold text-white">Recuperar Contraseña</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
                  </button>
                </form>
              )}
            </div>

            <button
              onClick={() => { setMode('login'); setRecoverySent(false); }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mt-4 transition-colors"
            >
              <ArrowLeft size={14} />
              Volver al inicio de sesión
            </button>
          </>
        )}

        <p className="text-center text-xs text-gray-600 mt-4">
          ZOE Net Gestión v1.0
        </p>
      </div>
    </div>
  );
}
