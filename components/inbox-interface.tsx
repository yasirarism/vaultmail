'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { RefreshCw, Copy, Mail, Loader2, ArrowRight, Trash2, Shield, Globe, History, ChevronDown, X, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { DEFAULT_DOMAINS, DEFAULT_EMAIL, getDefaultEmailDomain } from '@/lib/config';
import { getRetentionOptions, getTranslations, Locale } from '@/lib/i18n';

// Types
interface Email {
  id: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  receivedAt: string;
  to: string;
}

import { SettingsDialog } from './settings-dialog';

interface InboxInterfaceProps {
    initialAddress?: string;
    locale?: Locale;
}

export function InboxInterface({ initialAddress, locale }: InboxInterfaceProps) {
  const t = getTranslations(locale);
  const retentionOptions = getRetentionOptions(locale);
  const [address, setAddress] = useState<string>(initialAddress || '');
  const [domain, setDomain] = useState<string>(getDefaultEmailDomain());
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [savedDomains, setSavedDomains] = useState<string[]>(DEFAULT_DOMAINS);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [retention, setRetention] = useState<number>(86400);
  const [showDomainMenu, setShowDomainMenu] = useState(false);

  const stripEmailStyles = useCallback((html: string) => {
    if (!html) return '';

    if (typeof window === 'undefined') {
      return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<link[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '');
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, script, link[rel="stylesheet"]').forEach((node) => node.remove());
    return doc.body.innerHTML || '';
  }, []);

  // Load saved data
  useEffect(() => {
    const savedDoms = localStorage.getItem('dispo_domains');
    const savedHist = localStorage.getItem('dispo_history');
    const savedRet = localStorage.getItem('dispo_default_retention');
    
    if (savedDoms) {
        setSavedDomains(JSON.parse(savedDoms));
    } else {
        // Ensure defaults are set if nothing saved
        localStorage.setItem('dispo_domains', JSON.stringify(DEFAULT_DOMAINS));
    }

    if (savedHist) setHistory(JSON.parse(savedHist));
    if (savedRet) setRetention(parseInt(savedRet));

    if (!initialAddress) {
        const saved = localStorage.getItem('dispo_address');
        if (saved) {
            setAddress(saved);
            const parts = saved.split('@');
            if (parts.length > 1) setDomain(parts[1]);
        } else if (DEFAULT_EMAIL) {
            setAddress(DEFAULT_EMAIL);
            localStorage.setItem('dispo_address', DEFAULT_EMAIL);
            const parts = DEFAULT_EMAIL.split('@');
            if (parts.length > 1) setDomain(parts[1]);
        } else {
            generateAddress();
        }
    } else {
         const parts = initialAddress.split('@');
         if (parts.length > 1) setDomain(parts[1]);
    }
  }, [initialAddress]);

  // Sync Address to URL (without reloading)
  useEffect(() => {
      if (address && address.includes('@')) {
          window.history.replaceState(null, '', `/${address}`);
      }
  }, [address]);

  const addToHistory = (addr: string) => {
      if (!addr.includes('@')) return;
      
      setHistory(prev => {
          // Prevent duplicates and limit to 10
          if (prev.includes(addr)) {
               // Move to top if exists
               return [addr, ...prev.filter(a => a !== addr)];
          }
          const newHist = [addr, ...prev].slice(0, 10);
          localStorage.setItem('dispo_history', JSON.stringify(newHist));
          return newHist;
      });
  };

  const generateAddress = () => {
    // Generate pronounceable random string (e.g. weidipoffeutre)
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    let name = '';
    const length = Math.floor(Math.random() * 5) + 8; // 8-12 chars

    for (let i = 0; i < length; i++) {
        const isVowel = i % 2 === 1; // Start with consonant usually
        const set = isVowel ? vowels : consonants;
        name += set[Math.floor(Math.random() * set.length)];
    }

    const num = Math.floor(Math.random() * 9000) + 1000; // 4 digit number
    const newAddress = `${name}-${num}@${domain}`;
    
    setAddress(newAddress);
    localStorage.setItem('dispo_address', newAddress);
    setEmails([]);
    setSelectedEmail(null);
    toast.success(t.toastNewAlias);
    addToHistory(newAddress);
  };



  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success(t.toastCopied);
  };

  const fetchEmails = useCallback(async () => {
    if (!address) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/inbox?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.emails) {
        // Only update if changes to avoid jitter, or just replace for now
        // De-dupe could be handled here
        setEmails(data.emails);
        localStorage.setItem('dispo_email_count', data.emails.length.toString());
        localStorage.setItem('dispo_last_sync', new Date().toISOString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Initial fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEmails]);

  useEffect(() => {
    const handleRetentionUpdate = () => {
      const savedRet = localStorage.getItem('dispo_default_retention');
      if (savedRet) setRetention(parseInt(savedRet));
    };

    window.addEventListener('vaultmail-retention-updated', handleRetentionUpdate);
    return () => window.removeEventListener('vaultmail-retention-updated', handleRetentionUpdate);
  }, []);
  
  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header / Controls */}
      <div className="glass-card rounded-2xl p-6 md:p-8 space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              {t.inboxTitle}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t.inboxHintPrefix} {t.inboxHintSuffix} <span className="text-purple-400 font-medium">{retentionOptions.find(o => o.value === retention)?.label || t.retentionOptions.hours24}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                {loading ? t.syncing : t.live}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
                <Input 
                    value={address.split('@')[0]}
                    onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                        const currentDomain = address.split('@')[1] || domain;
                        setAddress(`${val}@${currentDomain}`);
                        localStorage.setItem('dispo_address', `${val}@${currentDomain}`);
                    }}
                    onBlur={() => addToHistory(address)}
                    className="pr-4 font-mono text-lg bg-black/20 border-white/10 h-12"
                    placeholder={t.usernamePlaceholder}
                />
            </div>
            <div className="relative flex items-center">
                 <span className="text-muted-foreground text-lg px-2">@</span>
            </div>
            <div className="relative flex-1 max-w-[250px] flex gap-2">
                 {/* Domain Selection Logic */}
                 <div className="relative w-full">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowDomainMenu((prev) => !prev)}
                        className={cn(
                          "w-full h-12 pl-3 pr-8 justify-start rounded-md border border-white/10 bg-white/5 text-sm font-mono hover:bg-white/10 glass",
                          showDomainMenu && "bg-white/10"
                        )}
                    >
                        {domain}
                        <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 rotate-90" />
                    </Button>

                    <AnimatePresence>
                        {showDomainMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDomainMenu(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                    className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl glass overflow-hidden"
                                >
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        {savedDomains.map((d) => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => {
                                                    setDomain(d);
                                                    const currentUser = address.split('@')[0];
                                                    const newAddr = `${currentUser}@${d}`;
                                                    setAddress(newAddr);
                                                    localStorage.setItem('dispo_address', newAddr);
                                                    addToHistory(newAddr);
                                                    setShowDomainMenu(false);
                                                }}
                                                className={cn(
                                                  "w-full text-left px-3 py-2 rounded-lg font-mono text-sm transition-colors",
                                                  d === domain
                                                    ? "bg-white/15 text-white"
                                                    : "text-gray-200 hover:bg-white/10"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                 </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Settings Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAddDomainOpen(true)}
                className="h-12 w-12 border border-white/10 hover:bg-white/5 text-purple-400 hover:text-purple-300"
                title={t.settingsTitle}
            >
                <Settings2 className="h-5 w-5" />
            </Button>

            <div className="relative">
                <Button 
                    onClick={() => setShowHistory(!showHistory)} 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-12 w-12 border border-white/10 hover:bg-white/5 relative", showHistory && "bg-white/10 ring-2 ring-white/10")}
                    title={t.historyTitle}
                >
                    <History className="h-5 w-5" />
                    {history.length > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    )}
                </Button>
                
                <AnimatePresence>
                    {showHistory && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute right-0 top-14 w-80 rounded-xl p-0 z-50 border border-white/10 shadow-2xl overflow-hidden bg-zinc-900"
                            >
                                <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-zinc-800/50">
                                    <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground">{t.historyTitle}</span>
                                    {history.length > 0 && (
                                        <button 
                                            onClick={() => {
                                                setHistory([]);
                                                localStorage.removeItem('dispo_history');
                                            }}
                                            className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            {t.historyClearAll}
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    {history.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                                            <History className="h-8 w-8 opacity-20" />
                                            <p className="text-sm">{t.historyEmpty}</p>
                                        </div>
                                    ) : (
                                        history.map((histAddr) => (
                                            <div key={histAddr} className="flex group items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5">
                                                <div 
                                                    className="flex-1 min-w-0"
                                                    onClick={() => {
                                                        setAddress(histAddr);
                                                        const parts = histAddr.split('@');
                                                        if(parts[1]) setDomain(parts[1]);
                                                        localStorage.setItem('dispo_address', histAddr);
                                                        setShowHistory(false);
                                                    }}
                                                >
                                                    <p className="font-mono text-sm truncate text-gray-200">{histAddr}</p>
                                                    <p className="textxs text-muted-foreground truncate opacity-50 text-[10px]">
                                                        {emails.length > 0 && address === histAddr ? t.historyActive : t.historyRestore}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newHist = history.filter(h => h !== histAddr);
                                                        setHistory(newHist);
                                                        localStorage.setItem('dispo_history', JSON.stringify(newHist));
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
            <Button onClick={copyAddress} variant="secondary" size="lg" className="h-12 w-full md:w-auto">
              <Copy className="mr-2 h-4 w-4" /> {t.copy}
            </Button>
            <Button onClick={generateAddress} variant="outline" size="lg" className="h-12 border-white/10 hover:bg-white/5 w-full md:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" /> {t.newAlias}
            </Button>
          </div>
        </div>

        <SettingsDialog
            open={isAddDomainOpen}
            onOpenChange={setIsAddDomainOpen}
            savedDomains={savedDomains}
            translations={t}
            onUpdateDomains={(newDomains) => {
                const combined = [...new Set([...DEFAULT_DOMAINS, ...newDomains])];
                setSavedDomains(combined);
                localStorage.setItem('dispo_domains', JSON.stringify(combined));
            }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[80vh]">
        {/* Email List */}
        <div className="md:col-span-1 glass-card rounded-2xl overflow-hidden flex flex-col min-h-[45vh] md:min-h-0">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-400" /> {t.inboxLabel}
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-muted-foreground">{emails.length}</span>
                </h3>
                <Button variant="ghost" size="icon" onClick={() => fetchEmails()} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {emails.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground space-y-2 opacity-50"
                        >
                            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                            <p>{t.waitingForIncoming}</p>
                        </motion.div>
                    ) : (
                        emails.map((email) => (
                            <motion.div
                                key={email.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onClick={() => setSelectedEmail(email)}
                                className={cn(
                                    "p-4 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-white/5",
                                    selectedEmail?.id === email.id ? "bg-white/10 border-blue-500/30" : "bg-black/20"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium truncate max-w-[150px] text-sm">{email.from}</span>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold truncate text-blue-100">{email.subject}</h4>
                                <p className="text-xs text-muted-foreground truncate mt-1">{email.text.slice(0, 50)}...</p>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>

        {/* Email Content */}
        <div className="md:col-span-2 glass-card rounded-2xl overflow-hidden flex flex-col h-full min-h-[55vh] md:min-h-0 bg-black/40">
            {selectedEmail ? (
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 space-y-4 bg-black/20">
                        <div className="flex justify-between items-start">
                            <h1 className="text-xl font-bold text-white">{selectedEmail.subject}</h1>
                            <span className="text-xs text-muted-foreground border border-white/10 px-2 py-1 rounded-md">
                                {new Date(selectedEmail.receivedAt).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                                {selectedEmail.from.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-medium text-white">{selectedEmail.from}</span>
                                <span className="text-muted-foreground text-xs">{t.toLabel} {selectedEmail.to || address}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white">
                         <div 
                            className="prose prose-base md:prose-lg max-w-none text-black"
                            dangerouslySetInnerHTML={{
                              __html: stripEmailStyles(
                                selectedEmail.html || `<p>${selectedEmail.text}</p>`
                              ),
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 text-base md:text-lg font-semibold">
                    <div className="p-4 rounded-full bg-white/5 border border-white/5">
                        <Mail className="h-8 w-8 opacity-50" />
                    </div>
                    <p>{t.selectEmail}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
