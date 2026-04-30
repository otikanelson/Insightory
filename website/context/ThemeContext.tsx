'use client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// ── Exact token values from the app's constants/Colors.ts ──
export const Colors = {
  light: {
    background:       '#f0f0f0',
    tabSurface:       '#FFFFFF',
    surface:          '#FFFFFF',
    surfaceElevated:  '#F7F8FF',
    text:             '#0D0F1A',
    subtext:          '#4d4d4d',
    primary:          '#5B4FE8',
    primaryLight:     '#EEF0FF',
    secondary:        '#10B981',
    border:           '#E8EAFF',
    card:             '#FFFFFF',
    accent:           '#F3F4FF',
    notification:     '#EF4444',
    header:           '#5B4FE8',
    gradient1:        '#5B4FE8',
    gradient2:        '#8B5CF6',
    success:          '#10B981',
    warning:          '#F59E0B',
    danger:           '#EF4444',
  },
  dark: {
    background:       '#080B18',
    tabSurface:       '#0F1221',
    surface:          '#111527',
    surfaceElevated:  '#161A30',
    text:             '#F0F2FF',
    subtext:          '#8892B0',
    primary:          '#7C6FF7',
    primaryLight:     '#1A1B3A',
    secondary:        '#34D399',
    border:           '#1E2240',
    card:             '#111527',
    accent:           '#1A1B3A',
    notification:     '#F87171',
    header:           '#0F1221',
    gradient1:        '#7C6FF7',
    gradient2:        '#A78BFA',
    success:          '#34D399',
    warning:          '#FBBF24',
    danger:           '#F87171',
  },
} as const;

export type Theme = typeof Colors.light;

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start light — load saved preference on mount
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('insightory-theme');
      if (saved) {
        setIsDark(saved === 'dark');
      }
      // No system-preference fallback — always start light unless user saved dark
    } catch {}
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem('insightory-theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
