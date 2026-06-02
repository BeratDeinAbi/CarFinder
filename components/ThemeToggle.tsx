'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

// Dark-/Light-Mode-Umschalter. Speichert die Wahl in localStorage und setzt
// data-theme auf <html>. Respektiert beim ersten Besuch die System-Einstellung.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem('theme') as Theme | null) ?? null;
    // Standard ist Dark (monochromes Layout); ohne gespeicherte Wahl -> dark.
    const initial: Theme = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  // Vor dem Mount nichts Abweichendes rendern (vermeidet Hydration-Flackern).
  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="Theme wechseln" type="button">
        <span style={{ opacity: 0 }}>🌙</span>
      </button>
    );
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      type="button"
      aria-label={theme === 'dark' ? 'Zu hellem Modus wechseln' : 'Zu dunklem Modus wechseln'}
      title={theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
