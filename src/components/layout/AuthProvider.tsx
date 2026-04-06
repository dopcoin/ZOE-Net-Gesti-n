'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthProviderProps {
  user: User;
  profile: Profile;
  children: React.ReactNode;
}

export default function AuthProvider({ user, profile, children }: AuthProviderProps) {
  const { setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    setUser(user);
    setProfile(profile);
    setLoading(false);
  }, [user, profile, setUser, setProfile, setLoading]);

  return <>{children}</>;
}
