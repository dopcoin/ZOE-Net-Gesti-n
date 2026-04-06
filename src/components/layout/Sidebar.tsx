'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import {
  LayoutDashboard, Users, CreditCard, Package, Repeat2,
  Wrench, ShoppingCart, ClipboardCheck, FileText, BookOpen,
  CheckSquare, UserCog, BarChart3, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import type { Rol } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: Rol[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'soporte', 'financiero', 'administrativo'] },
  { href: '/clientes', label: 'Clientes', icon: <Users size={20} />, roles: ['admin', 'soporte'] },
  { href: '/cobros', label: 'Cobros', icon: <CreditCard size={20} />, roles: ['admin', 'financiero'] },
  { href: '/inventario', label: 'Inventario', icon: <Package size={20} />, roles: ['admin', 'administrativo'] },
  { href: '/revendedores', label: 'Revendedores', icon: <Repeat2 size={20} />, roles: ['admin', 'administrativo'] },
  { href: '/instalaciones', label: 'Instalaciones', icon: <Wrench size={20} />, roles: ['admin', 'soporte'] },
  { href: '/ventas', label: 'Ventas', icon: <ShoppingCart size={20} />, roles: ['admin', 'financiero'] },
  { href: '/conciliacion', label: 'Conciliación', icon: <ClipboardCheck size={20} />, roles: ['admin', 'administrativo'] },
  { href: '/facturas', label: 'Facturas', icon: <FileText size={20} />, roles: ['admin', 'financiero'] },
  { href: '/libro-diario', label: 'Libro Diario', icon: <BookOpen size={20} />, roles: ['admin', 'financiero'] },
  { href: '/tareas', label: 'Tareas', icon: <CheckSquare size={20} />, roles: ['admin', 'soporte', 'financiero', 'administrativo'] },
  { href: '/equipo', label: 'Equipo', icon: <UserCog size={20} />, roles: ['admin', 'administrativo'] },
  { href: '/reportes', label: 'Reportes', icon: <BarChart3 size={20} />, roles: ['admin', 'financiero'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, toggleCollapsed, setSidebarOpen } = useAppStore();
  const rol = profile?.rol || 'admin';

  const filtered = navItems.filter((item) => item.roles.includes(rol));

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full bg-[#111827] border-r border-[#1F2937] z-50 transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1F2937]">
          {!sidebarCollapsed && (
            <h1 className="text-lg font-bold text-white">
              <span className="text-blue-500">ZOE</span> Net
            </h1>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setSidebarOpen(false);
              } else {
                toggleCollapsed();
              }
            }}
            className="p-1 rounded hover:bg-[#1C2333] text-gray-400"
          >
            {sidebarOpen && window.innerWidth < 1024 ? (
              <X size={20} />
            ) : sidebarCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {filtered.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-gray-400 hover:bg-[#1C2333] hover:text-gray-200'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-[#1F2937]">
            <div className="text-xs text-gray-500">
              {profile?.nombre} {profile?.apellido}
            </div>
            <div className="text-xs text-gray-600">{profile?.rol}</div>
          </div>
        )}
      </aside>
    </>
  );
}
