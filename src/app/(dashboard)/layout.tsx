import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import AuthProvider from '@/components/layout/AuthProvider';
import type { Profile } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  return (
    <AuthProvider user={user} profile={profile as Profile}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <main
          className="lg:ml-64 transition-all duration-300 px-3 py-4 sm:p-4 lg:p-6 pb-24 lg:pb-6"
          style={{
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </AuthProvider>
  );
}
