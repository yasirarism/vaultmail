'use client';

import { InboxInterface } from "@/components/inbox-interface";
import { Menu, Zap, Shield, Globe, Code2, Mail, Sun, Moon, Github } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  DEFAULT_LOCALE,
  getRetentionOptions,
  getTranslations,
  Locale,
  SUPPORTED_LOCALES,
} from "@/lib/i18n";
import { DEFAULT_APP_NAME } from "@/lib/branding";
import { useVisualTheme } from "@/components/theme-provider";
import { VISUAL_THEMES, type VisualTheme } from "@/lib/theme";
import { ThemePicker } from "@/components/theme-picker";
import Link from "next/link";

interface HomePageProps {
  initialAddress?: string;
}

const STORAGE_KEY = 'vaultmail_locale';

export function HomePage({ initialAddress }: HomePageProps) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [showMenu, setShowMenu] = useState(false);
  const [retentionSeconds, setRetentionSeconds] = useState(86400);
  const [customAppName, setCustomAppName] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState('Temp Mail');
  const [heroDescription, setHeroDescription] = useState('Spin up secure temporary inboxes in seconds. Bring your own domain or use the default.');
  const { theme, setTheme } = useVisualTheme();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      setLocale(stored as Locale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const t = useMemo(() => getTranslations(locale), [locale]);
  const retentionOptions = useMemo(() => getRetentionOptions(locale), [locale]);
  const resolvedAppName = customAppName || t.appName;
  const retentionLabel =
    retentionOptions.find((option) => option.value === retentionSeconds)
      ?.label || retentionOptions[2]?.label || "24 Hours";

  useEffect(() => {
    const loadRetention = async () => {
      try {
        const response = await fetch("/api/retention");
        if (!response.ok) return;
        const data = (await response.json()) as { seconds?: number };
        if (data?.seconds) {
          setRetentionSeconds(data.seconds);
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadRetention();
  }, []);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch("/api/branding");
        if (!response.ok) return;
        const data = (await response.json()) as { appName?: string; headerTitle?: string; headerDescription?: string };
        const value = data?.appName?.trim();
        setCustomAppName(value || DEFAULT_APP_NAME);
        if (data?.headerTitle?.trim()) setHeroTitle(data.headerTitle.trim());
        if (data?.headerDescription?.trim()) setHeroDescription(data.headerDescription.trim());
      } catch (error) {
        console.error(error);
      }
    };
    loadBranding();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t.greetingMorning;
    if (hour >= 12 && hour < 15) return t.greetingAfternoon;
    if (hour >= 15 && hour < 19) return t.greetingEvening;
    return t.greetingNight;
  }, [t]);

  const hasShownGreeting = useRef(false);

  useEffect(() => {
    if (hasShownGreeting.current) return;
    const timer = setTimeout(() => {
      toast.info(greeting);
      hasShownGreeting.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, [greeting]);

  const cycleTheme = () => {
    const idx = VISUAL_THEMES.indexOf(theme);
    const next = VISUAL_THEMES[(idx + 1) % VISUAL_THEMES.length];
    setTheme(next);
  };

  // Split hero title for two-tone: last word in accent
  const heroTitleParts = useMemo(() => {
    const words = heroTitle.trim().split(' ');
    if (words.length <= 1) return { first: '', last: heroTitle };
    const last = words.pop()!;
    return { first: words.join(' '), last };
  }, [heroTitle]);

  // Tick text
  const tickerText = heroDescription || t.heroSubtitle;

  return (
    <main className="min-h-screen relative flex flex-col" style={{ background: 'var(--brutal-bg)', color: 'var(--text-primary)' }}>
      {/* ========== NAVBAR ========== */}
      <header className="sticky top-0 z-50" style={{ background: 'var(--brutal-accent)', borderBottom: '2px solid var(--ink)' }}>
        <div className="max-w-6xl mx-auto px-4 h-[62px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ color: 'var(--ink)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              <Mail className="h-5 w-5" style={{ color: 'var(--brutal-accent)' }} />
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.03em' }}>{resolvedAppName}</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="language-toggle" style={{ display: 'flex', border: '2px solid var(--ink)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--brutal-shadow-sm)', background: 'var(--surface)' }}>
              <button
                onClick={() => setLocale('en')}
                style={{
                  padding: '5px 11px',
                  border: 'none',
                  borderRight: '2px solid var(--ink)',
                  background: locale === 'en' ? 'var(--brutal-accent-2)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  transition: 'background 0.15s',
                }}
              >EN</button>
              <button
                onClick={() => setLocale('id')}
                style={{
                  padding: '5px 11px',
                  border: 'none',
                  background: locale === 'id' ? 'var(--brutal-accent-2)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  transition: 'background 0.15s',
                }}
              >ID</button>
            </div>

            {/* Theme Cycle Button */}
            <button
              onClick={cycleTheme}
              title={t.themeLabel}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '2px solid var(--ink)',
                background: 'var(--surface)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink)',
                boxShadow: 'var(--brutal-shadow-sm)',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
            >
              {theme === 'brutal' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* API Doc */}
            <Link
              href="/api-access"
              className="navbar-apidoc-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'var(--surface)',
                color: 'var(--ink)',
                borderRadius: 8,
                border: '2px solid var(--ink)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: 'var(--brutal-shadow-sm)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                letterSpacing: '0.01em',
              }}
            >
              <Code2 className="h-3.5 w-3.5" />
              API Doc
            </Link>

            {/* Tools */}
            <Link
              href="/tools"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: 'var(--surface)',
                color: 'var(--ink)',
                borderRadius: 8,
                border: '2px solid var(--ink)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: 'var(--brutal-shadow-sm)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                letterSpacing: '0.01em',
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              Tools
            </Link>

            {/* Admin */}
            <Link
              href="/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                background: 'var(--brutal-accent)',
                color: 'var(--ink)',
                borderRadius: 8,
                border: '2px solid var(--ink)',
                fontSize: '0.82rem',
                fontWeight: 800,
                textDecoration: 'none',
                letterSpacing: '0.01em',
                boxShadow: 'var(--brutal-shadow-sm)',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </Link>

            {/* Hamburger menu for extras */}
            <div className="relative">
              <button
                onClick={() => setShowMenu((prev) => !prev)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '2px solid var(--ink)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink)',
                  boxShadow: 'var(--brutal-shadow-sm)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
              >
                <Menu className="h-4 w-4" />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        zIndex: 50,
                        marginTop: 8,
                        width: 240,
                        borderRadius: 14,
                        border: '2px solid var(--ink)',
                        background: 'var(--surface)',
                        boxShadow: 'var(--brutal-shadow-lg)',
                        overflow: 'hidden',
                      }}
                    >
                      <div className="p-2 space-y-1">
                        <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
                          Menu
                        </div>
                        <ThemePicker t={t} compact />
                        <a
                          href="https://github.com/yasirarism"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowMenu(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Github className="h-4 w-4" />
                          GitHub
                        </a>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ========== TICKER MARQUEE ========== */}
      <div style={{ background: 'var(--brutal-accent)', borderBottom: '2px solid var(--ink)', overflow: 'hidden', height: 28, display: 'flex', alignItems: 'center', position: 'sticky', top: 62, zIndex: 49 }}>
        <div className="brutal-marquee-track">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--ink)', padding: '0 60px', letterSpacing: '0.01em', fontFamily: 'var(--font-mono)' }}>
              {tickerText}
            </span>
          ))}
        </div>
      </div>

      {/* ========== HERO + EMAIL CARD ========== */}
      <section style={{ paddingTop: 48, paddingBottom: 0, textAlign: 'center', position: 'relative' }}>
        <div className="hero-grid" />
        <div className="max-w-6xl mx-auto px-4" style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 4.8rem)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
            {heroTitleParts.first && <span style={{ color: 'var(--text-primary)' }}>{heroTitleParts.first} </span>}
            <span style={{ color: 'var(--brutal-accent)' }}>{heroTitleParts.last}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 36, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            {heroDescription}
          </p>
        </div>
      </section>

      {/* ========== INBOX INTERFACE ========== */}
      <InboxInterface
        initialAddress={initialAddress}
        locale={locale}
        retentionLabel={retentionLabel}
      />

      {/* ========== FEATURES ========== */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          <Feature
            icon={<Zap className="h-6 w-6" />}
            title={t.featureInstantTitle}
            desc={t.featureInstantDesc}
          />
          <Feature
            icon={<Shield className="h-6 w-6" />}
            title={t.featurePrivacyTitle}
            desc={t.featurePrivacyDesc}
          />
          <Feature
            icon={<Globe className="h-6 w-6" />}
            title={t.featureCustomTitle}
            desc={t.featureCustomDesc}
          />
        </div>
      </section>

      {/* ========== HOW TO USE ========== */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8, letterSpacing: '-0.03em' }}>
          {t.howToTitle}
        </h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 40, fontSize: '0.95rem' }}>
          {t.howToSubtitle}
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <HowToStep num="01" title={t.howToStep1Title} desc={t.howToStep1Desc} />
          <HowToStep num="02" title={t.howToStep2Title} desc={t.howToStep2Desc} />
          <HowToStep num="03" title={t.howToStep3Title} desc={t.howToStep3Desc} />
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer style={{ borderTop: '2px solid var(--ink)', background: 'var(--brutal-accent)', padding: '20px 0', textAlign: 'center' }}>
        <div className="max-w-6xl mx-auto px-4">
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            © 2026 {resolvedAppName}. modified by Yasir
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.78rem' }}>
            <a href="/api-access" className="brutal-link" style={{ color: 'var(--ink)' }}>API Doc</a>
            <a href="/admin" className="brutal-link" style={{ color: 'var(--ink)' }}>Admin</a>
            <a href="https://github.com/yasirarism" target="_blank" rel="noopener noreferrer" className="brutal-link" style={{ color: 'var(--ink)' }}>GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="brutal-card-lg" style={{ padding: '28px 24px', background: 'var(--surface)', textAlign: 'left' }}>
      <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'var(--brutal-bg)', border: '2px solid var(--ink)', display: 'inline-flex', color: 'var(--ink)' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.88rem' }}>{desc}</p>
    </div>
  );
}

function HowToStep({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="brutal-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--brutal-accent)', marginBottom: 8, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
        {num}
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}