import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Globe } from 'lucide-react';
import { ADMIN_TRANSLATIONS, type AdminDictionary } from './admin';

/**
 * Dashboard localisation.
 *
 * The public portfolio keeps language in local component state because it is
 * a single page. The Command Center spans five modules, so the choice lives
 * in a context and persists across reloads — an operator who works in Arabic
 * should not re-pick the language every session.
 *
 * Direction is applied to <html> rather than to a wrapper so that native UI
 * (scrollbars, text selection, form controls, autofill dropdowns) flips with
 * the content instead of fighting it.
 */

export type Language = 'en' | 'ar';

const STORAGE_KEY = 'shadow-matrix:lang';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggle: () => void;
  t: AdminDictionary;
  isRtl: boolean;
  dir: 'rtl' | 'ltr';
  /** Pick the matching member of a bilingual pair inline. */
  pick: <T>(en: T, ar: T) => T;
  /** Format a number in the active locale (Arabic keeps Latin digits). */
  num: (value: number, digits?: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // Private browsing can throw on access; the default is fine.
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is a convenience, not a requirement.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousDir = root.dir;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    return () => {
      // Restore on unmount so the public portfolio, which manages its own
      // direction, is never left with the dashboard's setting.
      root.lang = previousLang;
      root.dir = previousDir;
    };
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const isRtl = lang === 'ar';
    return {
      lang,
      setLang,
      toggle: () => setLang(lang === 'ar' ? 'en' : 'ar'),
      t: ADMIN_TRANSLATIONS[lang],
      isRtl,
      dir: isRtl ? 'rtl' : 'ltr',
      pick: <T,>(en: T, ar: T) => (isRtl ? ar : en),
      // Latin digits in both languages: these sit beside model ids, HTTP
      // codes and scores, and mixing numeral systems makes them harder to
      // compare at a glance.
      num: (v: number, digits = 0) =>
        new Intl.NumberFormat('en-US', {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(v),
    };
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside a LanguageProvider.');
  }
  return context;
}

/**
 * The switcher, styled to match the gold toggle on the public portfolio so
 * the two halves of the site read as one product.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, toggle, isRtl } = useLanguage();
  return (
    <button
      id="admin-language-switcher"
      type="button"
      onClick={toggle}
      title={isRtl ? 'Switch to English' : 'تغيير إلى اللغة العربية'}
      aria-label={isRtl ? 'Switch to English' : 'Switch to Arabic'}
      className={`px-2.5 py-1.5 rounded-lg border border-amber-500/20 bg-zinc-900/60 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 text-[10px] sm:text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 cursor-pointer transition-all duration-300 ${className}`}
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'العربية'}</span>
      <span className="inline sm:hidden">{lang === 'ar' ? 'EN' : 'AR'}</span>
    </button>
  );
}

export type { AdminDictionary };
