'use client';
import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Writes the active theme's color tokens as CSS custom properties
 * on <html> and sets data-theme attribute for selector-based overrides.
 */
export default function ThemeApplier() {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    root.style.setProperty('--bg',            theme.background);
    root.style.setProperty('--surface',       theme.surface);
    root.style.setProperty('--surface-el',    theme.surfaceElevated);
    root.style.setProperty('--text',          theme.text);
    root.style.setProperty('--subtext',       theme.subtext);
    root.style.setProperty('--primary',       theme.primary);
    root.style.setProperty('--primary-light', theme.primaryLight);
    root.style.setProperty('--border',        theme.border);
    root.style.setProperty('--card',          theme.card);
    root.style.setProperty('--accent',        theme.accent);
    root.style.setProperty('--gradient1',     theme.gradient1);
    root.style.setProperty('--gradient2',     theme.gradient2);
    root.style.setProperty('--success',       theme.success);
    root.style.setProperty('--warning',       theme.warning);
    root.style.setProperty('--danger',        theme.danger);
  }, [theme, isDark]);

  return null;
}
