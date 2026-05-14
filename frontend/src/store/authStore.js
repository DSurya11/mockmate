'use client';
import { create } from 'zustand';
import api from '@/lib/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const data = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  register: async (name, email, password, role) => {
    const data = await api.post('/auth/register', { name, email, password, role });
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    set({ user: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
