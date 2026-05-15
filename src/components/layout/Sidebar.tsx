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
  CheckSquare, UserCog, BarChart3, PiggyBank, Receipt, History,
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
      // Soporte y financiero pueden ver (read-only). Admin/administrativo editan.
      { href: '/inventario', label: 'Inventario', icon: Package, roles: ['admin', 'administrativo', 'soporte', 'financiero'] },
      { href: '/conciliacion', label: 'Conciliación', icon: ClipboardCheck, roles: ['admin', 'administrativo'] },
    ],
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    items: [
      { href: '/libro-diario', label: 'Libro Diario', icon: BookOpen, roles: ['admin', 'financiero'] },
      { href: '/gastos', label: 'Gastos', icon: Receipt, roles: ['admin', 'financiero', 'administrativo'] },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { href: '/equipo', label: 'Equipo', icon: UserCog, roles: ['admin', 'administrativo'] },
      { href: '/historial', label: 'Historial', icon: History, roles: ['admin'] },
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
        className={`fixed top-0 left-0 h-full z-50 transition-all duration-300 flex flex-col backdrop-blur-xl
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
          w-[85vw] max-w-[320px] lg:w-64
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(11, 15, 25, 0.75)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: sidebarOpen ? '0 0 40px rgba(168, 85, 247, 0.15)' : 'none',
        }}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl holo-logo flex items-center justify-center">
                <span className="text-white font-bold text-base">Z</span>
              </div>
              <div>
                <div className="text-sm font-bold leading-tight">
                  <span className="text-gradient-iri animate-gradient font-extrabold">ZOE</span>
                  <span className="text-white"> Net</span>
                </div>
                <div className="text-[9px] text-gray-500 leading-none uppercase tracking-widest">Gestión</div>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/dashboard" className="w-9 h-9 rounded-xl holo-logo flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-base">Z</span>
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
                <div className="px-3 pb-1 pt-1 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3))' }} />
                  {group.label}
                  <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.3), transparent)' }} />
                </div>
              )}
              {sidebarCollapsed && (
                <div className="h-px mx-2 my-2 hidden lg:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)' }} />
              )}
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
                      <span
                        className="absolute -left-px top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{
                          background: 'linear-gradient(180deg, #60A5FA, #A855F7)',
                          boxShadow: '0 0 12px rgba(168, 85, 247, 0.6)',
                        }}
                      />
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
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #A855F7)',
                    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 16px rgba(168, 85, 247, 0.3)',
                  }}
                >
                  {profile?.nombre?.[0]}{profile?.apellido?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-200 truncate font-semibold">
                    {profile?.nombre} {profile?.apellido}
                  </div>
                  <div className="text-[10px] text-gray-500 capitalize">{profile?.rol}</div>
                </div>
              </div>
              <div className="px-3 py-2 flex items-center justify-between border-t border-white/[0.05]">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded badge-neon">v{APP_VERSION}</span>
                <span className="text-[9px] text-gray-600 uppercase tracking-widest">© ZOE Net</span>
              </div>
            </>
          )}
          {sidebarCollapsed && (
            <div className="py-2 text-center">
              <span className="text-[9px] text-purple-300/70 font-mono">v{APP_VERSION}</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
