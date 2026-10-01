export const THEME_STORAGE_KEY = 'vaultmail_theme';
export const THEME_VERSION_KEY = 'vaultmail_theme_version';
export const THEME_VERSION_ATTR = 'data-theme-version';
export const THEME_EVENT = 'vaultmail-theme-change';
export const VISUAL_THEMES = ['brutal', 'glass', 'neomorph', 'candy'] as const;

export type VisualTheme = (typeof VISUAL_THEMES)[number];
export const DEFAULT_THEME: VisualTheme = 'brutal';

export const isVisualTheme = (value: string | null): value is VisualTheme =>
  value === 'brutal' || value === 'glass' || value === 'neomorph' || value === 'candy';

export const applyTheme = (theme: VisualTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
};

/** Versi tema dari admin yang sedang berlaku, ditulis server ke atribut <html>. */
export const getDomThemeVersion = (): string | null => {
  if (typeof document === 'undefined') return null;
  const value = document.documentElement.getAttribute(THEME_VERSION_ATTR);
  return value && value.length > 0 ? value : null;
};

const readDomTheme = (): VisualTheme | null => {
  if (typeof document === 'undefined') return null;
  const current = document.documentElement.getAttribute('data-theme');
  return isVisualTheme(current) ? current : null;
};

export const readStoredTheme = (): VisualTheme => {
  try {
    const version = getDomThemeVersion();
    const storedVersion = localStorage.getItem(THEME_VERSION_KEY);
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    // Admin mengganti tema -> versi server naik. Preferensi lama milik pengunjung
    // (dari versi sebelumnya) tidak dipakai lagi supaya semua orang ikut berpindah.
    if (version && storedVersion !== version) {
      return readDomTheme() ?? DEFAULT_THEME;
    }

    if (isVisualTheme(stored)) return stored;
  } catch {
    // Ignore unavailable storage.
  }

  // Fall back to whatever the bootstrap script resolved for this visitor
  // (the admin-configured site default) before touching localStorage again.
  return readDomTheme() ?? DEFAULT_THEME;
};

export const setStoredTheme = (theme: VisualTheme, version: string | null = getDomThemeVersion()) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (version) localStorage.setItem(THEME_VERSION_KEY, version);
  } catch {
    // Ignore unavailable storage.
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
};

/**
 * Terapkan tema terbaru dari admin ke browser ini, sekaligus menandai versinya
 * supaya perubahan admin berikutnya kembali menimpa preferensi ini.
 */
export const applyServerTheme = (theme: VisualTheme, version: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(THEME_VERSION_ATTR, version);
  setStoredTheme(theme, version);
};

export const subscribeTheme = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
};

export const buildThemeBootstrapScript = (fallback: VisualTheme, version = '') =>
  `(function(){try{var d=document.documentElement;` +
  `var v=${JSON.stringify(version)};var k='${THEME_STORAGE_KEY}',kv='${THEME_VERSION_KEY}';` +
  `var ok=function(t){return t==='candy'||t==='neomorph'||t==='glass'||t==='brutal';};` +
  `var t=localStorage.getItem(k);var sv=localStorage.getItem(kv);` +
  `if(v&&sv!==v){d.setAttribute('data-theme','${fallback}');localStorage.setItem(k,'${fallback}');localStorage.setItem(kv,v);}` +
  `else{d.setAttribute('data-theme',ok(t)?t:'${fallback}');if(!ok(t)){localStorage.setItem(k,'${fallback}');}if(v){localStorage.setItem(kv,v);}}` +
  `}catch(e){document.documentElement.setAttribute('data-theme','${fallback}');}})();`;

export const THEME_BOOTSTRAP_SCRIPT = buildThemeBootstrapScript(DEFAULT_THEME);
