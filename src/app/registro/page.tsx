'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Wifi, Eye, EyeOff, CheckCircle, UserPlus, ArrowLeft } from 'lucide-react';

export default function RegistroPage() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    telefono: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Nombre, email y contraseña son obligatorios');
      return;
    }
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al registrarse');
      }

      setSuccess(true);
      toast.success('Solicitud enviada exitosamente');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-4">
            <Wifi className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            <span className="text-blue-500">ZOE</span> Net Gestión
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de gestión empresarial</p>
        </div>

        {success ? (
          /* Success state */
          <div className="card p-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Solicitud Enviada</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tu solicitud de acceso ha sido registrada exitosamente.
                Un administrador revisará tu cuenta y la activará.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-sm text-blue-300">
                  Recibirás acceso una vez el administrador active tu cuenta.
                  Podrás iniciar sesión con el email y contraseña que registraste.
                </p>
              </div>
              <Link
                href="/login"
                className="btn-primary w-full inline-flex items-center justify-center gap-2 mt-2"
              >
                <ArrowLeft size={16} />
                Ir al Inicio de Sesión
              </Link>
            </div>
          </div>
        ) : (
          /* Registration form */
          <>
            <div className="card p-6">
              <div className="text-center mb-5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10 mx-auto mb-3">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Obtener Acceso</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Completa tus datos para solicitar acceso al sistema.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nombre *</label>
                    <input
                      name="nombre"
                      type="text"
                      value={form.nombre}
                      onChange={handleChange}
                      className="input"
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Apellido</label>
                    <input
                      name="apellido"
                      type="text"
                      value={form.apellido}
                      onChange={handleChange}
                      className="input"
                      placeholder="Tu apellido"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className="input"
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="label">Contraseña *</label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
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
                  <label className="label">Teléfono <span className="text-gray-600">(opcional)</span></label>
                  <input
                    name="telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={handleChange}
                    className="input"
                    placeholder="809-000-0000"
                  />
                </div>

                <div className="bg-[#1C2333] rounded-lg p-3 text-xs text-gray-400 leading-relaxed">
                  Tu cuenta quedará pendiente de activación por un administrador.
                  Una vez activada, podrás iniciar sesión con estas credenciales.
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Enviando...' : 'Solicitar Acceso'}
                </button>
              </form>
            </div>

            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mt-4 transition-colors"
            >
              <ArrowLeft size={14} />
              Ya tengo cuenta — Iniciar Sesión
            </Link>
          </>
        )}

        <p className="text-center text-xs text-gray-600 mt-4">
          ZOE Net Gestión v1.0
        </p>
      </div>
    </div>
  );
}
