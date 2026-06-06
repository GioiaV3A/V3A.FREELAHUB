'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { updateThemePreferenceAction } from '@/app/actions/admin';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme, skipDbUpdate?: boolean) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from localStorage on mount
  useEffect(() => {
    const localTheme = localStorage.getItem('freela_hub_theme') as Theme | null;
    if (localTheme) {
      setThemeState(localTheme);
      applyTheme(localTheme);
    } else {
      setThemeState('dark');
      applyTheme('dark');
    }
  }, []);

  const applyTheme = (targetTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let resolved: 'dark' | 'light' = 'dark';
    if (targetTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = systemDark ? 'dark' : 'light';
    } else {
      resolved = targetTheme;
    }

    root.classList.add(resolved);
    root.setAttribute('data-theme', resolved);
    setResolvedTheme(resolved);
  };

  const setTheme = async (newTheme: Theme, skipDbUpdate = false) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('freela_hub_theme', newTheme);

    if (skipDbUpdate) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const res = await updateThemePreferenceAction(token, newTheme);
        if (!res.success) {
          console.warn('DB theme update warning:', res.error);
        }
      }
    } catch (err) {
      console.error('Failed to sync theme preference to DB:', err);
    }
  };

  // Listen for system theme preference updates
  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      applyTheme('system');
    };

    media.addEventListener('change', handleSystemThemeChange);
    return () => media.removeEventListener('change', handleSystemThemeChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
