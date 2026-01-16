import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2, Plus, Globe, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { DEFAULT_DOMAINS } from '@/lib/config';
import { Translations } from '@/lib/i18n';

const SYSTEM_DOMAINS = DEFAULT_DOMAINS;

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    savedDomains: string[];
    onUpdateDomains: (domains: string[]) => void;
    translations: Translations;
}

export function SettingsDialog({ open, onOpenChange, savedDomains, onUpdateDomains, translations }: SettingsDialogProps) {
    const t = translations;
    const [newDomain, setNewDomain] = useState('');

    const handleAddDomain = (e: React.FormEvent) => {
        e.preventDefault();
        const domain = newDomain.trim();
        if (domain && !savedDomains.includes(domain) && !SYSTEM_DOMAINS.includes(domain)) {
            onUpdateDomains([...savedDomains, domain]);
            setNewDomain('');
            toast.success(t.toastDomainAdded);
        }
    };

    const handleDeleteDomain = (domain: string) => {
        onUpdateDomains(savedDomains.filter(d => d !== domain));
        toast.success(t.toastDomainRemoved);
    };

    const customDomains = savedDomains.filter(d => !SYSTEM_DOMAINS.includes(d));

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Dialog Container - Fixed Flex Centering */}
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-lg z-10"
                        >
                            <div className="rounded-2xl shadow-2xl border border-white/10 bg-zinc-900 flex flex-col max-h-[85vh] overflow-hidden">
                                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-zinc-900/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                            <Settings2 className="h-5 w-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white leading-none">{t.dialogTitle}</h3>
                                            <p className="text-xs text-muted-foreground mt-1">{t.dialogSubtitle}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 hover:bg-white/10 rounded-full">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                
                                <div className="flex p-2 gap-2 bg-zinc-950/30 border-b border-white/5">
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
                                        <Globe className="w-4 h-4" />
                                        {t.domainsTab}
                                    </div>
                                </div>

                                <div className="p-6 overflow-y-auto custom-scrollbar bg-zinc-900">
                                    <div className="space-y-6">
                                        {/* System Domains */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">{t.systemDomainsTitle}</h4>
                                            <div className="grid gap-2">
                                                {SYSTEM_DOMAINS.map(domain => (
                                                    <div key={domain} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                                        <span className="font-mono text-sm text-gray-300">{domain}</span>
                                                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">{t.defaultBadge}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Domains */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">{t.customDomainsTitle}</h4>
                                            
                                            <form onSubmit={handleAddDomain} className="flex gap-2">
                                                <Input 
                                                    placeholder={t.customDomainPlaceholder}
                                                    value={newDomain}
                                                    onChange={(e) => setNewDomain(e.target.value)}
                                                    className="bg-black/20 border-white/10 focus-visible:ring-blue-500/50"
                                                />
                                                <Button type="submit" size="icon" disabled={!newDomain.trim()} className="shrink-0 bg-blue-600 hover:bg-blue-500">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </form>

                                            <div className="grid gap-2">
                                                {customDomains.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-4 italic">{t.customDomainEmpty}</p>
                                                ) : (
                                                    customDomains.map(domain => (
                                                        <div key={domain} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors">
                                                            <span className="font-mono text-sm text-gray-300">{domain}</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleDeleteDomain(domain)}
                                                                className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
