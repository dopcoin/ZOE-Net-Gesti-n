'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Wifi, Eye, EyeOff, CheckCircle, KeyRound, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    const supabase = createClient();

    async function verifyToken() {
      // Method 1: We have a token from our recovery flow
      if (token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });

        if (verifyError) {
          console.error('verifyOtp error:', verifyError.message);
          // Try with email if token_hash fails
          if (email) {
            const { error: err2 } = await supabase.auth.verifyOtp({
              email,
              token,
              type: 'recovery',
            });
            if (!err2) {
              setSessionReady(true);
              setVerifying(false);
              return;
            }
            console.error('verifyOtp with email error:', err2.message);
          }
          setError('El enlace ha expirado o es inválido. Solicita uno nuevo.');
          setVerifying(false);
          return;
        }

        setSessionReady(true);
        setVerifying(false);
        return;
      }

      // Method 2: Check for hash fragments (Supabase implicit redirect)
      if (window.location.hash) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            setSessionReady(true);
            setVerifying(false);
          }
        });

        // Give it a moment to process the hash
        setTimeout(() => {
          if (!sessionReady) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                setSessionReady(true);
              }
              setVerifying(false);
            });
          }
        }, 2000);

        return () => subscription.unsubscribe();
      }

      // Method 3: Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      }
      setVerifying(false);
    }

    verifyToken();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        toast.error('Error al cambiar la contraseña');
      } else {
        setSuccess(true);
        toast.success('Contraseña actualizada exitosamente');
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 2000);
      }
    } catch {
      setError('Error inesperado al cambiar la contraseña');
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
        </div>

        <div className="card p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Contraseña Actualizada</h2>
              <p className="text-sm text-gray-400">
                Tu contraseña ha sido cambiada exitosamente. Redirigiendo al dashboard...
              </p>
            </div>
          ) : verifying ? (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <h2 className="text-lg font-semibold text-white">Verificando enlace...</h2>
              <p className="text-sm text-gray-400">Un momento por favor.</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto">
                <KeyRound className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Enlace Inválido</h2>
              <p className="text-sm text-gray-400">
                {error || 'Este enlace ha expirado o es inválido. Solicita uno nuevo desde la página de inicio de sesión.'}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="btn-primary text-sm"
              >
                Ir al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Nueva Contraseña</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Ingresa tu nueva contraseña.
                </p>
              </div>

              <div>
                <label className="label">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
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

              <div>
                <label className="label">Confirmar Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Repite la contraseña"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          ZOE Net Gestión v1.0
        </p>
      </div>
    </div>
  );
}
