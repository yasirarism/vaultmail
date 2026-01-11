import { InboxInterface } from "@/components/inbox-interface";
import { Shield, Zap, Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/i18n";

export default async function Page({
    params,
  }: {
    params: Promise<{ address: string }>
  }) {
  const t = getTranslations();
  const address = (await params).address;

  // Simple validation
  const decoded = decodeURIComponent(address);
  if (!decoded.includes('@')) {
      redirect('/');
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/50 relative overflow-hidden flex flex-col">
      {/* Background Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <header className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                </div>
                <span>{t.appName}</span>
            </a>
          <a
            href="https://github.com/yasirarism"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
          >
            {t.github}
          </a>
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

         <InboxInterface initialAddress={decodeURIComponent(address)} />

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
