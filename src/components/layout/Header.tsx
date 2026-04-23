'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { createClient } from '@/lib/supabase/client';
import { Menu, LogOut, Bell } from 'lucide-react';
import { toast } from 'sonner';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/cobros': 'Cobros',
  '/inventario': 'Inventario',
  '/revendedores': 'Revendedores',
  '/instalaciones': 'Instalaciones',
  '/ventas': 'Ventas',
  '/conciliacion': 'Conciliación',
  '/facturas': 'Facturas',
  '/libro-diario': 'Libro Diario',
  '/finanzas': 'Finanzas',
  '/tareas': 'Tareas',
  '/equipo': 'Equipo',
  '/reportes': 'Reportes',
};

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, logout } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed } = useAppStore();

  const pageTitle = routeTitles[pathname] || 'ZOE Net';

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
          {/* Mobile: page title; Desktop: brand */}
          <h1 className="lg:hidden text-base font-bold text-white truncate">
            {pageTitle}
          </h1>
          <span className="hidden lg:block text-sm text-gray-400">
            ZOE Net Gestión
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
