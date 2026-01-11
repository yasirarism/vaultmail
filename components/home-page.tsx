'use client';

import { InboxInterface } from "@/components/inbox-interface";
import { Shield, Zap, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_LOCALE, getTranslations, Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

interface HomePageProps {
  initialAddress?: string;
}

const STORAGE_KEY = 'vaultmail_locale';

export function HomePage({ initialAddress }: HomePageProps) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/50 relative overflow-hidden flex flex-col">
      {/* Background Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <header className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span>{t.appName}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowLanguageMenu((prev) => !prev)}
                className={cn(
                  "h-10 px-3 gap-2 rounded-full border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white glass",
                  showLanguageMenu && "bg-white/10"
                )}
              >
                <Globe className="h-4 w-4 text-blue-300" />
                {locale === 'id' ? t.languageIndonesian : t.languageEnglish}
              </Button>

              <AnimatePresence>
                {showLanguageMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLanguageMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl glass overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        {(['en', 'id'] as Locale[]).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              setLocale(lang);
                              setShowLanguageMenu(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                              locale === lang
                                ? "bg-white/15 text-white"
                                : "text-gray-200 hover:bg-white/10"
                            )}
                          >
                            {lang === 'en' ? t.languageEnglish : t.languageIndonesian}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <a
              href="https://github.com/yasirarism"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              {t.github}
            </a>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="flex-1 py-12">
         <div className="text-center max-w-2xl mx-auto px-4 mb-12 space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/50">
              {t.heroTitle} <br/> {t.heroTitleSuffix}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t.heroSubtitle}
            </p>
         </div>

         <InboxInterface initialAddress={initialAddress} locale={locale} />

         {/* Features Grid */}
         <div className="max-w-6xl mx-auto px-4 mt-24 grid md:grid-cols-3 gap-8">
            <Feature 
                icon={<Zap className="h-6 w-6 text-yellow-400" />}
                title={t.featureInstantTitle}
                desc={t.featureInstantDesc}
            />
            <Feature 
                icon={<Shield className="h-6 w-6 text-green-400" />}
                title={t.featurePrivacyTitle}
                desc={t.featurePrivacyDesc}
            />
            <Feature 
                icon={<Globe className="h-6 w-6 text-blue-400" />}
                title={t.featureCustomTitle}
                desc={t.featureCustomDesc}
            />
         </div>
      </div>

      <footer className="border-t border-white/5 py-8 mt-12 text-center text-muted-foreground text-sm">
        <p>© {new Date().getFullYear()} {t.appName}. {t.footerSuffix}</p>
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <div className="mb-4 p-3 rounded-full bg-white/5 w-fit">
                {icon}
            </div>
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{desc}</p>
        </div>
    )
}
