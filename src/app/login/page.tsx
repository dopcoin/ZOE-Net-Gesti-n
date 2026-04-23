'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Wifi, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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

        <div className="flex justify-center mt-4">
          <Link
            href="/registro"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Obtener Acceso
          </Link>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          ZOE Net Gestión v1.0
        </p>
      </div>
    </div>
  );
}
