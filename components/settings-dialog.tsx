import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2, Plus, Globe, Clock, Settings2, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    savedDomains: string[];
    onUpdateDomains: (domains: string[]) => void;
    currentAddress: string;
}

const SYSTEM_DOMAINS = ['ysweb.biz.id', 'ysweb.id', 'ysdev.net'];

export const RETENTION_OPTIONS = [
    { label: '30 Minutes', value: 1800 },
    { label: '1 Hour', value: 3600 },
    { label: '24 Hours', value: 86400 },
    { label: '3 Days', value: 259200 },
    { label: '1 Week', value: 604800 },
];

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    savedDomains: string[];
    onUpdateDomains: (domains: string[]) => void;
    currentAddress: string;
    onRetentionChange?: (seconds: number) => void;
}

export function SettingsDialog({ open, onOpenChange, savedDomains, onUpdateDomains, currentAddress, onRetentionChange }: SettingsDialogProps) {
    const [activeTab, setActiveTab] = useState<'domains' | 'retention'>('retention');
    const [newDomain, setNewDomain] = useState('');
    const [retention, setRetention] = useState<number>(86400);
    const [saving, setSaving] = useState(false);
    const [forwardTo, setForwardTo] = useState('');
    const [forwardSaving, setForwardSaving] = useState(false);

    const handleAddDomain = (e: React.FormEvent) => {
        e.preventDefault();
        const domain = newDomain.trim();
        if (domain && !savedDomains.includes(domain) && !SYSTEM_DOMAINS.includes(domain)) {
            onUpdateDomains([...savedDomains, domain]);
            setNewDomain('');
            toast.success('Domain added');
        }
    };

    const handleDeleteDomain = (domain: string) => {
        onUpdateDomains(savedDomains.filter(d => d !== domain));
        toast.success('Domain removed');
    };

    const handleRetentionSave = async (seconds: number) => {
        setRetention(seconds);
        setSaving(true);
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    address: currentAddress,
                    retentionSeconds: seconds 
                })
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to save settings');
            }
            // Also save to LOCAL storage so we remember user preference for FUTURE addresses
            localStorage.setItem('dispo_default_retention', seconds.toString());
            toast.success('Retention updated');
            if (onRetentionChange) onRetentionChange(seconds);
        } catch (e) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleForwardSave = async () => {
        if (!currentAddress) return;
        setForwardSaving(true);
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    address: currentAddress,
                    forwardTo
                })
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to save forwarding');
            }
            if (forwardTo.trim()) {
                toast.success('Forwarding updated');
            } else {
                toast.success('Forwarding cleared');
            }
        } catch (e) {
            toast.error('Failed to save forwarding');
        } finally {
            setForwardSaving(false);
        }
    };

    const loadSettings = async () => {
        if (!currentAddress) return;
        try {
            const res = await fetch(`/api/settings?address=${encodeURIComponent(currentAddress)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data?.settings?.retentionSeconds) {
                setRetention(data.settings.retentionSeconds);
            }
            if (typeof data?.settings?.forwardTo === 'string') {
                setForwardTo(data.settings.forwardTo);
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    // Load initial preference on mount
    useEffect(() => {
        const saved = localStorage.getItem('dispo_default_retention');
        if (saved) setRetention(parseInt(saved));
    }, []);

    useEffect(() => {
        if (!open) return;
        loadSettings();
    }, [open, currentAddress]);

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
                                            <h3 className="text-lg font-bold text-white leading-none">Settings</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Manage preferences & domains</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 hover:bg-white/10 rounded-full">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                
                                <div className="flex p-2 gap-2 bg-zinc-950/30 border-b border-white/5">
                                    <button 
                                        onClick={() => setActiveTab('retention')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                            activeTab === 'retention' 
                                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm' 
                                            : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <Clock className="w-4 h-4" />
                                        Retention
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('domains')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all ${
                                            activeTab === 'domains' 
                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm' 
                                            : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        <Globe className="w-4 h-4" />
                                        Domains
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto custom-scrollbar bg-zinc-900">
                                    {activeTab === 'retention' ? (
                                        <div className="space-y-6">
                                            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-5 border border-white/5">
                                                <h4 className="text-sm font-semibold text-white mb-2">Inbox Lifespan</h4>
                                                <p className="text-xs text-gray-400 leading-relaxed">
                                                    Configure how long emails persist in this inbox. 
                                                    Setting a shorter duration improves privacy, while a longer duration ensures you don't miss important mails.
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Duration Selection</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {RETENTION_OPTIONS.map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => handleRetentionSave(opt.value)}
                                                            disabled={saving}
                                                            className={`group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                                                                retention === opt.value 
                                                                ? 'bg-purple-500/10 border-purple-500/50 text-white shadow-lg' 
                                                                : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                                    retention === opt.value ? 'border-purple-400' : 'border-white/20 group-hover:border-white/40'
                                                                }`}>
                                                                    {retention === opt.value && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                                                                </div>
                                                                <span className="font-medium">{opt.label}</span>
                                                            </div>
                                                            {retention === opt.value && (
                                                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 text-purple-300">ACTIVE</span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                                                    <Mail className="h-4 w-4 text-purple-300" />
                                                    Forwarding
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-400">
                                                        Forward incoming emails from this inbox to another address. Leave empty to disable.
                                                    </p>
                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            placeholder="you@yourdomain.com"
                                                            value={forwardTo}
                                                            onChange={(e) => setForwardTo(e.target.value)}
                                                            className="bg-black/20 border-white/10 focus-visible:ring-purple-500/40"
                                                        />
                                                        <Button
                                                            onClick={handleForwardSave}
                                                            disabled={forwardSaving}
                                                            className="w-full bg-purple-600 hover:bg-purple-500"
                                                        >
                                                            {forwardSaving ? 'Saving...' : 'Save Forwarding'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* System Domains */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">System Domains</h4>
                                                <div className="grid gap-2">
                                                    {SYSTEM_DOMAINS.map(domain => (
                                                        <div key={domain} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                                            <span className="font-mono text-sm text-gray-300">{domain}</span>
                                                            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">Default</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Custom Domains */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Custom Domains</h4>
                                                
                                                <form onSubmit={handleAddDomain} className="flex gap-2">
                                                    <Input 
                                                        placeholder="Enter new domain..." 
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
                                                        <p className="text-sm text-muted-foreground text-center py-4 italic">No custom domains added.</p>
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
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
