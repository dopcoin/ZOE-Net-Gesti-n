'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { createClient } from '@/lib/supabase/client';
import { Menu, LogOut, Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function Header() {
  const router = useRouter();
  const { profile, logout } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed } = useAppStore();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push('/login');
    toast.success('Sesión cerrada');
  };

  return (
    <header className={`sticky top-0 z-30 bg-[#111827]/80 backdrop-blur border-b border-[#1F2937] transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 rounded hover:bg-[#1C2333] text-gray-400"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm text-gray-400 hidden sm:block">
            ZOE Net Gestión
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded hover:bg-[#1C2333] text-gray-400 relative">
            <Bell size={18} />
          </button>

          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
              {profile?.nombre?.[0]}{profile?.apellido?.[0]}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded hover:bg-[#1C2333] text-gray-400 hover:text-red-400"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
