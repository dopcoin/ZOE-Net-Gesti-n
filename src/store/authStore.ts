'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      loading: true,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      logout: () => set({ user: null, profile: null, loading: false }),
    }),
    {
      name: 'zoe-auth',
      partialize: (state) => ({ user: state.user, profile: state.profile }),
    }
  )
);
