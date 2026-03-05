import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// Create a context for dark mode to share across components
interface DarkModeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const DarkModeContext = createContext<DarkModeContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
});

export const useDarkMode = () => useContext(DarkModeContext);

export default function App({ Component, pageProps }: AppProps) {
  const [darkMode, setDarkModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Apply dark mode to document
  const applyDarkMode = useCallback((isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Check system preference and saved preference
    const savedMode = localStorage.getItem('darkMode');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const isDark = savedMode !== null ? savedMode === 'true' : systemPrefersDark;
    setDarkModeState(isDark);
    applyDarkMode(isDark);
  }, [applyDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const savedMode = localStorage.getItem('darkMode');
      // Only auto-switch if user hasn't manually set preference
      if (savedMode === null) {
        setDarkModeState(e.matches);
        applyDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyDarkMode]);

  // Listen for dark mode changes from other components/tabs
  useEffect(() => {
    const handleDarkModeChange = () => {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkModeState(isDark);
      applyDarkMode(isDark);
    };

    window.addEventListener('darkModeChanged', handleDarkModeChange);
    window.addEventListener('storage', (e) => {
      if (e.key === 'darkMode') {
        handleDarkModeChange();
      }
    });
    
    return () => {
      window.removeEventListener('darkModeChanged', handleDarkModeChange);
      window.removeEventListener('storage', handleDarkModeChange);
    };
  }, [applyDarkMode]);

  const toggleDarkMode = useCallback(() => {
    const newMode = !darkMode;
    setDarkModeState(newMode);
    localStorage.setItem('darkMode', String(newMode));
    applyDarkMode(newMode);
    // Notify other components and tabs
    window.dispatchEvent(new CustomEvent('darkModeChanged', { detail: newMode }));
  }, [darkMode, applyDarkMode]);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    localStorage.setItem('darkMode', String(value));
    applyDarkMode(value);
    window.dispatchEvent(new CustomEvent('darkModeChanged', { detail: value }));
  }, [applyDarkMode]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        <Component {...pageProps} />
      </div>
    );
  }

  
  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
      <Component {...pageProps} />
    </DarkModeContext.Provider>
  );
}