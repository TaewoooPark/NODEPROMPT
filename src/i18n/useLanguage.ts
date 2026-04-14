import { create } from 'zustand';
import type { Lang, TranslationKey } from './translations';
import { getTranslation } from './translations';
import type { NodeType } from '../types';

const STORAGE_KEY = 'nodeprompt-lang';

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ko') return saved;
  } catch { /* noop */ }
  return 'ko';
}

interface LanguageState {
  lang: Lang;
  toggleLang: () => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: loadLang(),
  toggleLang: () =>
    set((state) => {
      const next: Lang = state.lang === 'ko' ? 'en' : 'ko';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      return { lang: next };
    }),
}));

/** Returns a translation function `t(key)` for the current language. */
export function useT() {
  const lang = useLanguageStore((s) => s.lang);
  return (key: TranslationKey) => getTranslation(key, lang);
}

/** Returns the type label map for the current language. */
export function useTypeLabels(): Record<NodeType, string> {
  const lang = useLanguageStore((s) => s.lang);
  return {
    ens:     getTranslation('type.ens', lang),
    res:     getTranslation('type.res', lang),
    unum:    getTranslation('type.unum', lang),
    aliquid: getTranslation('type.aliquid', lang),
    verum:   getTranslation('type.verum', lang),
    bonum:   getTranslation('type.bonum', lang),
  };
}
