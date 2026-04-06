'use client';

import { useState } from 'react';
import type { Profile, Equipo } from '@/types';
import { rolColor, equipoColor } from '@/lib/utils';
import { UserCog, Search, Mail, Phone } from 'lucide-react';

interface Props {
  miembros: Profile[];
}

const EQUIPOS: (Equipo | 'todos')[] = ['todos', 'soporte', 'financiero', 'administrativo'];

const avatarColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(nombre: string, apellido: string): string {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

export default function EquipoClient({ miembros }: Props) {
  const [search, setSearch] = useState('');
  const [equipoFilter, setEquipoFilter] = useState<Equipo | 'todos'>('todos');

  const filtered = miembros.filter((m) => {
    const matchEquipo = equipoFilter === 'todos' || m.equipo === equipoFilter;
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      m.nombre.toLowerCase().includes(term) ||
      m.apellido.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term);
    return matchEquipo && matchSearch;
  });

  // Group by equipo
  const grouped = filtered.reduce<Record<string, Profile[]>>((acc, m) => {
    const key = m.equipo ?? 'sin_equipo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const equipoLabels: Record<string, string> = {
    soporte: 'Soporte',
    financiero: 'Financiero',
    administrativo: 'Administrativo',
    sin_equipo: 'Sin Equipo',
  };

  const countByEquipo = (equipo: Equipo | 'todos') =>
    equipo === 'todos' ? miembros.length : miembros.filter((m) => m.equipo === equipo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserCog className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Equipo</h1>
          <p className="text-sm text-gray-400">{miembros.length} miembros del equipo</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {EQUIPOS.map((equipo) => (
            <button
              key={equipo}
              onClick={() => setEquipoFilter(equipo)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                equipoFilter === equipo
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1C2333] text-gray-400 hover:text-gray-200'
              }`}
            >
              {equipo === 'todos' ? 'Todos' : equipo.charAt(0).toUpperCase() + equipo.slice(1)}{' '}
              <span className="ml-1 text-xs opacity-70">({countByEquipo(equipo)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grouped cards */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          No se encontraron miembros del equipo
        </div>
      ) : (
        Object.entries(grouped).map(([equipo, members]) => (
          <div key={equipo} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  equipo === 'soporte'
                    ? 'bg-blue-400'
                    : equipo === 'financiero'
                      ? 'bg-emerald-400'
                      : equipo === 'administrativo'
                        ? 'bg-yellow-400'
                        : 'bg-gray-400'
                }`}
              />
              {equipoLabels[equipo] ?? equipo}
              <span className="text-sm text-gray-500 font-normal">({members.length})</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="card p-4 hover:bg-[#1C2333]/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(m.nombre + m.apellido)}`}
                    >
                      {getInitials(m.nombre, m.apellido)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-100 truncate">
                          {m.nombre} {m.apellido}
                        </h3>
                        {/* Activo status */}
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            m.activo ? 'bg-emerald-400' : 'bg-gray-500'
                          }`}
                          title={m.activo ? 'Activo' : 'Inactivo'}
                        />
                      </div>

                      {/* Email */}
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{m.email}</span>
                      </div>

                      {/* Telefono */}
                      {m.telefono && (
                        <div className="flex items-center gap-1 mt-0.5 text-sm text-gray-400">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span>{m.telefono}</span>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`badge text-xs ${rolColor(m.rol)}`}>{m.rol}</span>
                        {m.equipo && (
                          <span className={`badge text-xs ${equipoColor(m.equipo)}`}>
                            {m.equipo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
