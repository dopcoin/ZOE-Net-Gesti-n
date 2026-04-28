'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { createClient } from '@/lib/supabase/client';
import { APP_VERSION } from '@/lib/version';
import { Menu, LogOut, Bell } from 'lucide-react';
import { toast } from 'sonner';

const routeMeta: Record<string, { title: string; group?: string }> = {
  '/dashboard':      { title: 'Dashboard',    group: 'Resumen' },
  '/finanzas':       { title: 'Finanzas',     group: 'Resumen' },
  '/reportes':       { title: 'Reportes',     group: 'Resumen' },
  '/clientes':       { title: 'Clientes',     group: 'Operaciones' },
  '/instalaciones':  { title: 'Instalaciones', group: 'Operaciones' },
  '/tareas':         { title: 'Tareas',       group: 'Operaciones' },
  '/cobros':         { title: 'Cobros',       group: 'Ventas & Cobros' },
  '/facturas':       { title: 'Facturas',     group: 'Ventas & Cobros' },
  '/ventas':         { title: 'Ventas',       group: 'Ventas & Cobros' },
  '/revendedores':   { title: 'Revendedores', group: 'Ventas & Cobros' },
  '/inventario':     { title: 'Inventario',   group: 'Inventario' },
  '/conciliacion':   { title: 'Conciliación', group: 'Inventario' },
  '/libro-diario':   { title: 'Libro Diario', group: 'Contabilidad' },
  '/gastos':         { title: 'Gastos',       group: 'Contabilidad' },
  '/equipo':         { title: 'Equipo',       group: 'Sistema' },
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, logout } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed } = useAppStore();

  const meta = routeMeta[pathname] || { title: 'ZOE Net', group: undefined };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push('/login');
    toast.success('Sesión cerrada');
  };

  return (
    <header
      className={`sticky top-0 z-30 bg-[#111827]/90 backdrop-blur-lg border-b border-[#1F2937] transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 h-14">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#1C2333] text-gray-400 active:scale-95 transition-transform"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          {/* Mobile: page title + group breadcrumb */}
          <div className="lg:hidden min-w-0">
            {meta.group && (
              <div className="text-[10px] text-gray-500 uppercase tracking-widest leading-tight truncate">
                {meta.group}
              </div>
            )}
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {meta.title}
            </h1>
          </div>
          {/* Desktop: breadcrumb with group → title */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            {meta.group && (
              <>
                <span className="text-gray-500">{meta.group}</span>
                <span className="text-gray-700">/</span>
              </>
            )}
            <span className="text-white font-semibold">{meta.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Version badge — visible en desktop */}
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-[#1C2333] border border-[#1F2937] text-[10px] font-mono text-gray-500">
            v{APP_VERSION}
          </span>

          <button
            className="p-2 rounded-lg hover:bg-[#1C2333] text-gray-400 active:scale-95 transition-transform"
            aria-label="Notificaciones"
          >
            <Bell size={18} />
          </button>

          <div className="w-px h-6 bg-[#1F2937] mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
              {profile?.nombre?.[0]}{profile?.apellido?.[0]}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 active:scale-95 transition-all"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
