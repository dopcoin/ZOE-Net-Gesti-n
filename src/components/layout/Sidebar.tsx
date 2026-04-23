'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { APP_VERSION } from '@/lib/version';
import {
  LayoutDashboard, Users, CreditCard, Package, Repeat2,
  Wrench, ShoppingCart, ClipboardCheck, FileText, BookOpen,
  CheckSquare, UserCog, BarChart3, PiggyBank,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Rol } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Rol[];
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'resumen',
    label: 'Resumen',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'soporte', 'financiero', 'administrativo'] },
      { href: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['admin', 'financiero'] },
      { href: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'financiero'] },
    ],
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'soporte'] },
      { href: '/instalaciones', label: 'Instalaciones', icon: Wrench, roles: ['admin', 'soporte'] },
      { href: '/tareas', label: 'Tareas', icon: CheckSquare, roles: ['admin', 'soporte', 'financiero', 'administrativo'] },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas & Cobros',
    items: [
      { href: '/cobros', label: 'Cobros', icon: CreditCard, roles: ['admin', 'financiero'] },
      { href: '/facturas', label: 'Facturas', icon: FileText, roles: ['admin', 'financiero'] },
      { href: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'financiero'] },
      { href: '/revendedores', label: 'Revendedores', icon: Repeat2, roles: ['admin', 'administrativo'] },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    items: [
      { href: '/inventario', label: 'Inventario', icon: Package, roles: ['admin', 'administrativo'] },
      { href: '/conciliacion', label: 'Conciliación', icon: ClipboardCheck, roles: ['admin', 'administrativo'] },
    ],
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    items: [
      { href: '/libro-diario', label: 'Libro Diario', icon: BookOpen, roles: ['admin', 'financiero'] },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { href: '/equipo', label: 'Equipo', icon: UserCog, roles: ['admin', 'administrativo'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, toggleCollapsed, setSidebarOpen } = useAppStore();
  const rol = profile?.rol || 'admin';
  const [isMobile, setIsMobile] = useState(false);
  const [tareasBadge, setTareasBadge] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    const fetchCount = async () => {
      const { createClient: getClient } = await import('@/lib/supabase/client');
      const supabase = getClient();
      const { count } = await supabase
        .from('tareas')
        .select('id', { count: 'exact', head: true })
        .eq('asignado_a', profile.id)
        .eq('completada', false);
      if (!cancelled) setTareasBadge(count ?? 0);
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [profile?.id]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile, setSidebarOpen]);

  // Filter groups by role; drop empty groups
  const filteredGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(rol)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-[#111827] border-r border-[#1F2937] z-50 transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
          w-[85vw] max-w-[320px] lg:w-64
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between p-4 border-b border-[#1F2937] flex-shrink-0">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">
                  <span className="text-blue-400">ZOE</span> Net
                </div>
                <div className="text-[9px] text-gray-500 leading-none uppercase tracking-widest">Gestión</div>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20 mx-auto">
              <span className="text-white font-bold text-sm">Z</span>
            </Link>
          )}
          <button
            onClick={() => {
              if (isMobile) setSidebarOpen(false);
              else toggleCollapsed();
            }}
            className="p-1.5 rounded-lg hover:bg-[#1C2333] text-gray-400 active:scale-95 transition-transform"
          >
            {sidebarOpen && isMobile ? <X size={18} /> : sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation grouped */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="space-y-0.5">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 pt-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              {sidebarCollapsed && <div className="h-px bg-[#1F2937] mx-2 my-2 hidden lg:block" />}
              {group.items.map((item) => {
                const active = pathname === item.href;
                const isTareas = item.href === '/tareas';
                const badge = isTareas && tareasBadge > 0 ? tareasBadge : 0;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98]
                      ${active
                        ? 'bg-blue-500/10 text-blue-400 shadow-sm'
                        : 'text-gray-400 hover:bg-[#1C2333] hover:text-gray-200'
                      }
                      ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {active && !sidebarCollapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-r-full" />
                    )}
                    <span className="relative flex-shrink-0">
                      <Icon size={18} />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-purple-600 text-white rounded-full">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </span>
                    <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — user info + version */}
        <div className="border-t border-[#1F2937] flex-shrink-0">
          {!sidebarCollapsed && (
            <>
              <div className="p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {profile?.nombre?.[0]}{profile?.apellido?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-300 truncate">
                    {profile?.nombre} {profile?.apellido}
                  </div>
                  <div className="text-[10px] text-gray-500 capitalize">{profile?.rol}</div>
                </div>
              </div>
              <div className="px-3 py-2 border-t border-[#1F2937] flex items-center justify-between">
                <span className="text-[10px] text-gray-600 font-mono">v{APP_VERSION}</span>
                <span className="text-[10px] text-gray-600">© ZOE Net</span>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <div className="py-2 text-center">
              <span className="text-[9px] text-gray-600 font-mono">v{APP_VERSION}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
