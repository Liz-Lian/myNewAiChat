'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeProviderProps = {
  children: ReactNode;
  attribute?: 'class';
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * 根据主题设置计算最终应用到 html 的 class。
 *
 * @param theme 用户选择的主题。
 * @param enableSystem 是否允许跟随系统。
 * @returns 最终浅色或深色主题。
 */
function resolveTheme(theme: Theme, enableSystem: boolean) {
  if (theme !== 'system' || !enableSystem) {
    return theme === 'dark' ? 'dark' : 'light';
  }

  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * 临时禁用主题切换过渡，避免颜色切换时闪动。
 *
 * @returns 清理函数。
 */
function disableTransitions() {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none!important}'),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  const applyTheme = useCallback(
    (nextTheme: Theme) => {
      const cleanup = disableTransitionOnChange ? disableTransitions() : null;
      const resolvedTheme = resolveTheme(nextTheme, enableSystem);

      document.documentElement.classList.toggle(
        'dark',
        resolvedTheme === 'dark',
      );
      document.documentElement.style.colorScheme = resolvedTheme;
      cleanup?.();
    },
    [disableTransitionOnChange, enableSystem],
  );

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      applyTheme(nextTheme);
    },
    [applyTheme],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(
        THEME_STORAGE_KEY,
      ) as Theme | null;
      const nextTheme = storedTheme || defaultTheme;

      setThemeState(nextTheme);
      applyTheme(nextTheme);
    });

    return () => cancelAnimationFrame(frame);
  }, [applyTheme, defaultTheme]);

  useEffect(() => {
    if (!enableSystem || theme !== 'system') {
      return;
    }

    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => applyTheme('system');

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [applyTheme, enableSystem, theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
