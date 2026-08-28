'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Copy, Mail, Loader2, Trash2, History, ChevronDown, X, Settings2, Download, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn, getSenderInfo } from '@/lib/utils';
import { DEFAULT_DOMAIN_FALLBACK, DEFAULT_EMAIL, getDefaultEmailDomain } from '@/lib/config';
import { getTranslations, Locale } from '@/lib/i18n';
import { buildGmailPreviewDocument } from '@/lib/email-preview';
import type { ParsedAttachment } from '@/lib/email-mime';

// Types
interface Email {
  id: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments?: ParsedAttachment[];
  receivedAt: string;
  to: string;
}

import { SettingsDialog } from './settings-dialog';

// Extract an OTP / verification code from subject + body (mirrors ruangmail).
function extractOtp(subject: string, body: string): string | null {
  const text = `${subject || ''} ${body || ''}`;
  const patterns = [
    /(?:verification\s+code|auth(?:entication)?\s+code|security\s+code|access\s+code|login\s+code|sign[- ]in\s+code)\s*(?:is|:|\s)\s*(\d{4,8})/i,
    /\b(?:otp|pin|code|token|passcode)\s*[:\-–]?\s*(\d{4,8})\b/i,
    /\b(\d{4,8})\s+(?:is\s+(?:your\s+)?)?(?:the\s+)?(?:verification\s+)?(?:code|otp|pin)\b/i,
    /\bcode\s+is\s+(\d{4,8})\b/i,
    /(?:kode\s+verifikasi|kode\s+otp|kode\s+keamanan|kode\s+akses|kode\s+masuk|kode\s+konfirmasi)\s*(?:anda|kamu|mu|nya)?\s*(?:adalah|ialah|:|-|–)?\s*(\d{4,8})/i,
    /\b(?:kode|sandi|nomor\s+rahasia)\s*[:\-–]?\s*(\d{4,8})\b/i,
    /\b(\d{4,8})\s+(?:adalah|ialah|merupakan)\s+(?:kode|otp|pin)(?:\s+verifikasi)?/i
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) return match[1];
  }
  return null;
}

interface InboxInterfaceProps {
    initialAddress?: string;
    locale?: Locale;
    retentionLabel?: string;
}

export function InboxInterface({ initialAddress, locale, retentionLabel }: InboxInterfaceProps) {
  const t = getTranslations(locale);
  const normalizeDomains = useCallback(
    (domains: string[]) =>
      [...new Set(domains.map((entry) => entry.toLowerCase().trim()).filter(Boolean))],
    []
  );
  const [address, setAddress] = useState<string>(initialAddress || '');
  const [domain, setDomain] = useState<string>(getDefaultEmailDomain());
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [systemDomains, setSystemDomains] = useState<string[]>([]);
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [showDomainMenu, setShowDomainMenu] = useState(false);
  const [domainExpiration, setDomainExpiration] = useState<string | null>(null);
  const [domainStatusLoading, setDomainStatusLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [readEmailIds, setReadEmailIds] = useState<Set<string>>(new Set());
  const [deletingEmailId, setDeletingEmailId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const previousEmailIds = useRef<Set<string>>(new Set());
  const hasLoadedEmails = useRef(false);
  const fetchInFlight = useRef(false);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [previewHeight, setPreviewHeight] = useState(420);

  const selectedSender = selectedEmail ? getSenderInfo(selectedEmail.from) : null;
  const domainExpirationDate = domainExpiration ? new Date(domainExpiration) : null;
  const isDomainExpired = domainExpirationDate ? domainExpirationDate.getTime() < Date.now() : false;

  const downloadEmail = useCallback(() => {
    if (!selectedEmail) return;
    const download = async () => {
      try {
        const response = await fetch(
          `/api/download?address=${encodeURIComponent(address)}&emailId=${encodeURIComponent(
            selectedEmail.id
          )}&type=email`
        );
        if (!response.ok) {
          throw new Error('Download failed');
        }
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        const fileName = match?.[1] || 'email.eml';
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengunduh email.');
      }
    };
    download();
  }, [address, selectedEmail]);

  const downloadAttachment = useCallback(
    (index: number) => {
      if (!selectedEmail) return;
      const download = async () => {
        try {
          const response = await fetch(
            `/api/download?address=${encodeURIComponent(
              address
            )}&emailId=${encodeURIComponent(selectedEmail.id)}&type=attachment&index=${index}`
          );
          if (!response.ok) {
            throw new Error('Download failed');
          }
          const blob = await response.blob();
          const disposition = response.headers.get('content-disposition') || '';
          const match = disposition.match(/filename="([^"]+)"/);
          const fileName = match?.[1] || 'attachment';
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error(error);
          toast.error('Gagal mengunduh attachment.');
        }
      };
      download();
    },
    [address, selectedEmail]
  );

  const previewSrcDoc = useMemo(() => {
    if (!selectedEmail) return '';
    return buildGmailPreviewDocument(
      selectedEmail.html,
      selectedEmail.text,
      selectedEmail.attachments || []
    );
  }, [selectedEmail]);

  const getListPreviewText = useCallback((email: Email) => {
    const source = (email.text && email.text.trim()) || email.html || '';
    const plain = (() => {
      if (typeof window === 'undefined') {
        return source.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
      }
      const doc = new DOMParser().parseFromString(source, 'text/html');
      doc.querySelectorAll('script, style').forEach((n) => n.remove());
      return doc.body.textContent || '';
    })();
    const cleaned = plain
      .split('\n')
      .filter((line) => !/^(delivered-to|from|to|cc|subject|date|message-id):/i.test(line.trim()))
      .join(' ')
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_m, hex: string) => {
        try {
          return String.fromCharCode(parseInt(hex, 16));
        } catch {
          return '';
        }
      })
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || '(No preview available)';
  }, []);

  const handlePreviewLoad = useCallback(() => {
    const frame = previewFrameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    const resize = () => {
      const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0, 320);
      setPreviewHeight(height + 8);
    };
    resize();
    doc.querySelectorAll('img').forEach((image) => {
      image.addEventListener('load', resize);
    });
    doc.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const code = target?.closest('[data-copy-code]')?.getAttribute('data-copy-code');
      if (!code) return;
      navigator.clipboard.writeText(code);
      toast.success(`OTP copied: ${code}`);
    });
  }, []);

  useEffect(() => {
    if (!domain) return;
    let active = true;
    const fetchExpiration = async () => {
      setDomainStatusLoading(true);
      try {
        const response = await fetch(
          `/api/domain-expiration?domain=${encodeURIComponent(domain)}`
        );
        if (!response.ok) {
          throw new Error('Failed to load domain expiration');
        }
        const data = (await response.json()) as {
          expiresAt: string | null;
          checkedAt: string;
        };
        if (active) {
          setDomainExpiration(data.expiresAt ?? null);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setDomainExpiration(null);
        }
      } finally {
        if (active) {
          setDomainStatusLoading(false);
        }
      }
    };
    fetchExpiration();
    return () => {
      active = false;
    };
  }, [domain]);

  // Load saved data
  useEffect(() => {
    const savedHist = localStorage.getItem('dispo_history');

    if (savedHist) setHistory(JSON.parse(savedHist));
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

  useEffect(() => {
    let active = true;
    const loadDomains = async () => {
      try {
        const response = await fetch('/api/domains');
        if (!response.ok) {
          throw new Error('Failed to load domains');
        }
        const data = (await response.json()) as { domains?: string[] };
        const normalized = normalizeDomains(data.domains || []);
        if (active) {
          setSystemDomains(normalized.length > 0 ? normalized : [DEFAULT_DOMAIN_FALLBACK]);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setSystemDomains([DEFAULT_DOMAIN_FALLBACK]);
        }
      }
    };
    loadDomains();
    return () => {
      active = false;
    };
  }, [normalizeDomains]);

  useEffect(() => {
    if (systemDomains.length === 0) return;
    const savedRaw = localStorage.getItem('dispo_domains');
    const savedList = savedRaw ? JSON.parse(savedRaw) : [];
    const customDomains = Array.isArray(savedList)
      ? savedList.filter((item) => !systemDomains.includes(item))
      : [];
    const combined = normalizeDomains([...systemDomains, ...customDomains]);
    setSavedDomains(combined);
    localStorage.setItem('dispo_domains', JSON.stringify(customDomains));
  }, [normalizeDomains, systemDomains]);

  useEffect(() => {
    if (savedDomains.length === 0) return;
    if (!savedDomains.includes(domain)) {
      setDomain(savedDomains[0]);
    }
  }, [domain, savedDomains]);

  useEffect(() => {
    if (!address) return;
    const [localPart, currentDomain] = address.split('@');
    if (!localPart || currentDomain === domain) return;
    const nextAddress = `${localPart}@${domain}`;
    setAddress(nextAddress);
    localStorage.setItem('dispo_address', nextAddress);
  }, [address, domain]);

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
    // Generate pronounceable random string without numbers (e.g. weidipoffeutre)
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    let name = '';
    const length = Math.floor(Math.random() * 5) + 8; // 8-12 chars

    for (let i = 0; i < length; i++) {
        const isVowel = i % 2 === 1; // Start with consonant usually
        const set = isVowel ? vowels : consonants;
        name += set[Math.floor(Math.random() * set.length)];
    }

    const newAddress = `${name}@${domain}`;

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

  const fetchEmails = useCallback(async (forceResync = false) => {
    if (!address) return;
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      setLoading(true);
      const res = await fetch(`/api/inbox?address=${encodeURIComponent(address)}&t=${Date.now()}${forceResync ? '&resync=1' : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (forceResync) {
        toast.info('IMAP resync dijalankan, mengambil ulang email dari server.');
      }
      if (data?.imapDebug) {
        console.info('[IMAP_SYNC_DEBUG]', { address, ...data.imapDebug });
      }
      if (data?.imapError) {
        toast.error(`IMAP sync error: ${data.imapMessage || 'Unknown error'}`);
        console.warn('[IMAP_SYNC_ERROR]', {
          address,
          checkedAt: data.checkedAt,
          message: data.imapMessage || 'Unknown error'
        });
      }
      if (data.emails) {
        // Only update if changes to avoid jitter, or just replace for now
        // De-dupe could be handled here
        const incoming = data.emails as Email[];
        const nextIds = new Set(incoming.map((email) => email.id));
        previousEmailIds.current = nextIds;
        hasLoadedEmails.current = true;
        setEmails(incoming);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      fetchInFlight.current = false;
    }
  }, [address]);

  // Initial fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    previousEmailIds.current = new Set();
    hasLoadedEmails.current = false;
  }, [address]);

  useEffect(() => {
    if (!address) return;
    const storageKey = `dispo_read_${address}`;
    const savedReadIds = localStorage.getItem(storageKey);
    if (!savedReadIds) {
      setReadEmailIds(new Set());
      return;
    }
    try {
      const parsed = JSON.parse(savedReadIds);
      if (Array.isArray(parsed)) {
        setReadEmailIds(new Set(parsed));
      } else {
        setReadEmailIds(new Set());
      }
    } catch {
      setReadEmailIds(new Set());
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    const storageKey = `dispo_read_${address}`;
    localStorage.setItem(storageKey, JSON.stringify(Array.from(readEmailIds)));
  }, [address, readEmailIds]);

  // Polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEmails]);

  const filteredEmails = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return emails;
    return emails.filter((email) => {
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.text.toLowerCase().includes(query)
      );
    });
  }, [emails, filterQuery]);



  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredEmails.length / pageSize));
  const paginatedEmails = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmails.slice(start, start + pageSize);
  }, [currentPage, filteredEmails]);

  useEffect(() => {
    setCurrentPage(1);
  }, [address, filterQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const emailCount = filterQuery ? filteredEmails.length : emails.length;
  const unreadCount = emails.filter((email) => !readEmailIds.has(email.id)).length;

  const openEmail = (email: Email) => {
    setPreviewHeight(420);
    setSelectedEmail(email);
    setReadEmailIds((prev) => {
      if (prev.has(email.id)) return prev;
      const next = new Set(prev);
      next.add(email.id);
      return next;
    });
  };

  // Lock body scroll while the email reader modal is open (like ruangmail).
  useEffect(() => {
    if (selectedEmail) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [selectedEmail]);

  const deleteEmail = useCallback(
    async (emailId: string) => {
      if (!address) return;
      setDeletingEmailId(emailId);
      try {
        const response = await fetch(
          `/api/inbox?address=${encodeURIComponent(address)}&emailId=${encodeURIComponent(
            emailId
          )}`,
          { method: 'DELETE' }
        );
        if (!response.ok) {
          throw new Error('Delete failed');
        }
        setEmails((prev) => prev.filter((item) => item.id !== emailId));
        setReadEmailIds((prev) => {
          if (!prev.has(emailId)) return prev;
          const next = new Set(prev);
          next.delete(emailId);
          return next;
        });
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
        toast.success('Pesan berhasil dihapus.');
      } catch (error) {
        console.error(error);
        toast.error('Gagal menghapus pesan.');
      } finally {
        setDeletingEmailId(null);
      }
    },
    [address, selectedEmail?.id]
  );

  useEffect(() => {
    if (filterQuery) {
      setShowFilter(true);
    }
  }, [filterQuery]);
  
  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-8 space-y-10">
      {/* ===== EMAIL GENERATION CARD (ruangmail style) ===== */}
      <div className="brutal-card-lg max-w-xl mx-auto" style={{ padding: '28px 24px 24px', textAlign: 'left' }}>
        {/* Label + settings row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)' }}>
            <Mail className="h-3 w-3" style={{ color: 'var(--brutal-accent)' }} />
            {t.yourTemporaryEmail}
          </p>
          <button
            type="button"
            onClick={() => setIsAddDomainOpen(true)}
            className="brutal-btn brutal-btn-white"
            style={{ padding: '6px 12px', fontSize: '0.78rem', fontFamily: 'var(--font-sans)' }}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t.settingsTitle}
          </button>
        </div>

        {/* Address input row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '2px solid var(--ink)', borderRadius: 12, minWidth: 0, boxShadow: 'var(--brutal-shadow-sm)' }}>
            <input
              type="text"
              value={address.split('@')[0]}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                const currentDomain = address.split('@')[1] || domain;
                setAddress(`${val}@${currentDomain}`);
                localStorage.setItem('dispo_address', `${val}@${currentDomain}`);
              }}
              onBlur={() => addToHistory(address)}
              placeholder={t.usernamePlaceholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '13px 4px 13px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', minWidth: 0 }}
            />
            <span style={{ padding: '0 2px', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--brutal-accent)', flexShrink: 0, userSelect: 'none' }}>
              @
            </span>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowDomainMenu((prev) => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 10px 13px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
              >
                {domain}
                <ChevronDown className="h-3 w-3" style={{ transition: 'transform 0.15s', transform: showDomainMenu ? 'rotate(180deg)' : 'none' }} />
              </button>

              <AnimatePresence>
                {showDomainMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDomainMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      style={{ position: 'absolute', zIndex: 50, right: 0, top: '100%', marginTop: 6, width: 250, borderRadius: 12, border: '2px solid var(--ink)', background: 'var(--surface)', boxShadow: 'var(--brutal-shadow-lg)', overflow: 'hidden' }}
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
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: 'none',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              background: d === domain ? 'var(--brutal-accent)' : 'transparent',
                              color: d === domain ? 'var(--brutal-on-accent)' : 'var(--text-primary)',
                              transition: 'background 0.12s',
                            }}
                            onMouseEnter={(e) => { if (d !== domain) e.currentTarget.style.background = 'var(--brutal-surface-2)'; }}
                            onMouseLeave={(e) => { if (d !== domain) e.currentTarget.style.background = 'transparent'; }}
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

          {/* Copy button */}
          <button
            type="button"
            onClick={copyAddress}
            title={t.copy}
            style={{ flexShrink: 0, width: 48, background: 'var(--brutal-accent-2)', border: '2px solid var(--ink)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brutal-on-accent)', boxShadow: 'var(--brutal-shadow-sm)', transition: 'transform 0.15s, box-shadow 0.15s' }}
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {/* Domain status line */}
        {domainExpirationDate && isDomainExpired ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(217,48,37,0.08)',
              border: '2px solid #d93025',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#d93025',
              textAlign: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            {t.domainStatusExpired}
          </div>
        ) : (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 14, textAlign: 'center' }}>
            {domainStatusLoading ? (
              <span>{t.domainStatusChecking}</span>
            ) : domainExpirationDate ? (
              <span>
                📅 <strong style={{ color: 'var(--text-primary)' }}>{domain}</strong> &middot; {t.domainStatusEndsOn}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{domainExpirationDate.toLocaleDateString()}</strong>
              </span>
            ) : (
              <span>{t.domainStatusUnavailable}</span>
            )}
          </p>
        )}

        {/* Generate new email */}
        <button
          type="button"
          onClick={generateAddress}
          style={{
            width: '100%',
            padding: 14,
            background: 'var(--brutal-accent)',
            color: 'var(--brutal-on-accent)',
            border: '2px solid var(--ink)',
            borderRadius: 12,
            fontSize: '0.95rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: 'var(--brutal-shadow), 0 0 12px rgba(250,174,42,0.35)',
            letterSpacing: '-0.01em',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {t.generateNewEmail}
        </button>
      </div>

      {/* ===== STATS CARDS (ruangmail stat-card style) ===== */}
      <div className="max-w-3xl mx-auto w-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <BrutalStat icon="📧" value={emails.length} label={t.statsEmailsReceived} />
        <BrutalStat icon="🌐" value={savedDomains.length} label={t.statsActiveDomains} />
        <BrutalStat icon="🔐" value={t.statsInstant} label={t.statsOtp} />
      </div>

      {/* ===== INBOX SECTION ===== */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {t.inboxLabel}
            </h2>
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? 'var(--brutal-accent-2)' : 'var(--brutal-success)', border: '1.5px solid var(--ink)', flexShrink: 0, transition: 'background 0.3s' }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'inline-block', minWidth: 96, whiteSpace: 'nowrap' }}>
              {loading ? t.syncing : t.live}
            </span>
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              title={t.historyTitle}
              style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, border: '2px solid var(--ink)', background: showHistory ? 'var(--brutal-accent)' : 'var(--surface)', color: showHistory ? 'var(--brutal-on-accent)' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--brutal-shadow-sm)', transition: 'transform 0.12s, box-shadow 0.12s, background 0.12s' }}
            >
              <History className="h-4 w-4" />
              {history.length > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999, background: 'var(--brutal-accent-2)', border: '2px solid var(--ink)', color: 'var(--brutal-on-accent)', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {history.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => fetchEmails(true)}
              disabled={loading}
              className="brutal-btn brutal-btn-white"
              style={{ padding: '8px 16px', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {t.refresh}
            </button>
          </div>
        </div>

        {/* Search/filter */}
        {(showFilter || filterQuery) && (
          <div className="max-w-3xl mx-auto" style={{ marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder={t.inboxFilterPlaceholder}
                className="brutal-input"
                style={{ width: '100%', padding: '10px 12px 10px 34px', fontSize: '0.85rem', outline: 'none', fontFamily: 'var(--font-sans)', boxShadow: 'var(--brutal-shadow-sm)' }}
              />
            </div>
          </div>
        )}

        {/* Email list (ruangmail email-card style) */}
        <div className="max-w-3xl mx-auto" style={{ background: 'var(--surface)', border: '2px solid var(--ink)', borderRadius: 14, boxShadow: 'var(--brutal-shadow-sm)', overflow: 'hidden' }}>
          <div className="flex items-center justify-between gap-2" style={{ padding: '12px 16px', borderBottom: '2px solid var(--ink)', background: 'var(--brutal-bg)' }}>
            <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <Mail className="h-4 w-4" style={{ color: 'var(--brutal-accent)' }} />
              {t.inboxLabel}
              <span className="brutal-chip" style={{ fontSize: '0.68rem' }}>
                {t.inboxCountTotal}: {emailCount}
              </span>
              {unreadCount > 0 && (
                <span className="brutal-chip" style={{ fontSize: '0.68rem', background: 'var(--brutal-accent)', color: 'var(--brutal-on-accent)' }}>
                  {t.inboxCountUnread}: {unreadCount}
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={() => setShowFilter((prev) => !prev)}
              aria-pressed={showFilter}
              aria-label={t.inboxFilterPlaceholder}
              title={t.inboxFilterPlaceholder}
              style={{ width: 34, height: 34, borderRadius: 8, border: '2px solid var(--ink)', background: showFilter ? 'var(--brutal-accent)' : 'var(--surface)', color: showFilter ? 'var(--brutal-on-accent)' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--brutal-shadow-sm)', transition: 'transform 0.12s, box-shadow 0.12s' }}
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {filteredEmails.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 16px', gap: 8 }}
              >
                <div style={{ border: '3px dashed var(--ink)', borderRadius: 'var(--brutal-radius)', padding: '32px 40px', opacity: 0.55, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brutal-accent)' }} />
                  ) : (
                    <Mail className="h-10 w-10" style={{ color: 'var(--brutal-accent)' }} />
                  )}
                  <p style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {filterQuery ? t.inboxFilterEmpty : t.emptyInbox}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {filterQuery ? t.inboxFilterEmpty : t.waitingForIncoming}
                  </p>
                </div>
              </motion.div>
            ) : (
              paginatedEmails.map((email) => {
                const sender = getSenderInfo(email.from);
                const isUnread = !readEmailIds.has(email.id);
                const otp = extractOtp(email.subject, email.text || email.html);
                return (
                  <motion.div
                    key={email.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={() => openEmail(email)}
                    style={{
                      position: 'relative',
                      opacity: isUnread ? 1 : 0.75,
                      background: 'var(--surface)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderLeft: '4px solid transparent',
                      borderBottom: '1px solid var(--brutal-divider)',
                      transition: 'background 0.1s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--brutal-accent-light)';
                      e.currentTarget.style.borderLeftColor = 'var(--brutal-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)';
                      e.currentTarget.style.borderLeftColor = 'transparent';
                    }}
                  >
                    {isUnread && (
                      <span style={{ position: 'absolute', top: 12, right: 14, background: '#1a1a1a', color: '#faae2a', fontSize: '0.58rem', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--brutal-radius-full)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                        {t.unreadBadge}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--brutal-accent)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, color: 'var(--brutal-on-accent)', fontWeight: 800 }}>
                          {sender.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sender.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                        {new Date(email.receivedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, paddingLeft: 38, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject || '(Tanpa Subjek)'}
                    </p>
                    <div style={{ paddingLeft: 38, minHeight: '1.2em', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {otp ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard.writeText(otp);
                            toast.success(`${t.toastCopied}: ${otp}`);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 14px',
                            background: 'var(--brutal-accent)',
                            color: 'var(--brutal-on-accent)',
                            border: '1.5px solid var(--ink)',
                            borderRadius: 6,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            letterSpacing: '0.12em',
                            transition: 'all 0.15s',
                            boxShadow: '2px 2px 0 var(--ink)',
                          }}
                        >
                          {otp}
                        </button>
                      ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, maxWidth: '100%' }}>
                          {getListPreviewText(email).slice(0, 90)}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteEmail(email.id);
                        }}
                        disabled={deletingEmailId === email.id}
                        title="Delete"
                        style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.12s, background 0.12s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#d93025'; e.currentTarget.style.background = 'rgba(217,48,37,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface)'; }}
                      >
                        {deletingEmailId === email.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>

          {filteredEmails.length > pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid var(--ink)', padding: '10px 12px', fontSize: '0.75rem', marginTop: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Page {currentPage}/{totalPages}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="brutal-btn brutal-btn-white"
                  style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="brutal-btn brutal-btn-white"
                  style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== EMAIL READER MODAL (ruangmail style popup) ===== */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)', WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setSelectedEmail(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              style={{ background: 'var(--surface)', border: '2px solid var(--ink)', boxShadow: 'var(--brutal-shadow-xl)', borderRadius: 'var(--brutal-radius-2xl)', width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Modal header */}
              <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--ink)', background: 'var(--brutal-bg)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                    {selectedEmail.subject || '(Tanpa Subjek)'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedEmail(null)}
                    aria-label="Close"
                    style={{ width: 32, height: 32, borderRadius: 'var(--brutal-radius-full)', border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brutal-surface-2)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brutal-accent)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--brutal-on-accent)', fontSize: '0.85rem', flexShrink: 0 }}>
                    {selectedSender?.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedSender?.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {t.toLabel} {selectedEmail.to || address} &middot; {new Date(selectedEmail.receivedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedEmail.attachments.map((attachment, index) => (
                        <button
                          key={`${attachment.filename || 'attachment'}-${index}`}
                          type="button"
                          onClick={() => downloadAttachment(index)}
                          className="brutal-btn brutal-btn-accent"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {attachment.filename || `Attachment ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal body */}
              <div style={{ overflowY: 'auto', overflowX: 'hidden', background: '#fff' }} className="custom-scrollbar">
                <iframe
                  ref={previewFrameRef}
                  title="email-preview"
                  className="w-full border-0 bg-white"
                  style={{ height: previewHeight, minHeight: 320 }}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  srcDoc={previewSrcDoc}
                  onLoad={handlePreviewLoad}
                />
              </div>

              {/* Modal footer actions */}
              <div style={{ padding: '12px 20px', borderTop: '2px solid var(--ink)', background: 'var(--brutal-bg)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => deleteEmail(selectedEmail.id)}
                  disabled={deletingEmailId === selectedEmail.id}
                  className="brutal-btn brutal-btn-white"
                  style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                >
                  {deletingEmailId === selectedEmail.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={downloadEmail}
                  className="brutal-btn brutal-btn-white"
                  style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SETTINGS DIALOG ===== */}
      <SettingsDialog
        open={isAddDomainOpen}
        onOpenChange={setIsAddDomainOpen}
        systemDomains={systemDomains}
        savedDomains={savedDomains}
        translations={t}
        onUpdateDomains={(newDomains) => {
          const customDomains = newDomains.filter(
            (item) => !systemDomains.includes(item)
          );
          const combined = normalizeDomains([...systemDomains, ...customDomains]);
          setSavedDomains(combined);
          localStorage.setItem('dispo_domains', JSON.stringify(customDomains));
        }}
      />

      {/* ===== HISTORY POPUP ===== */}
      <AnimatePresence>
        {showHistory && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setShowHistory(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              style={{ position: 'fixed', zIndex: 100, top: 80, right: 24 }}
            >
              <div style={{ width: 'min(22rem, calc(100vw - 48px))', borderRadius: 14, border: '2px solid var(--ink)', background: 'var(--surface)', boxShadow: 'var(--brutal-shadow-lg)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: '2px solid var(--ink)', background: 'var(--brutal-bg)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History className="h-4 w-4" style={{ color: 'var(--brutal-accent)' }} />
                    {t.historyTitle}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistory([]);
                          localStorage.removeItem('dispo_history');
                        }}
                        style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#d93025', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {t.historyClearAll}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowHistory(false)}
                      aria-label="Close history"
                      style={{ width: 28, height: 28, borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {history.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', textAlign: 'center', gap: 8, color: 'var(--text-muted)' }}>
                      <History className="h-8 w-8" style={{ opacity: 0.3 }} />
                      <p style={{ fontSize: '0.85rem' }}>{t.historyEmpty}</p>
                    </div>
                  ) : (
                    history.map((histAddr) => (
                      <div key={histAddr} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '2px solid transparent' }}>
                        <button
                          type="button"
                          style={{ flex: 1, minWidth: 0, borderRadius: 10, padding: '10px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
                          onClick={() => {
                            setAddress(histAddr);
                            const parts = histAddr.split('@');
                            if (parts[1]) setDomain(parts[1]);
                            localStorage.setItem('dispo_address', histAddr);
                            setShowHistory(false);
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brutal-surface-2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {histAddr}
                          </p>
                          <p style={{ fontSize: '0.68rem', marginTop: 2, color: 'var(--brutal-accent)' }}>
                            {emails.length > 0 && address === histAddr ? t.historyActive : t.historyRestore}
                          </p>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${histAddr}`}
                          onClick={() => {
                            const newHist = history.filter((h) => h !== histAddr);
                            setHistory(newHist);
                            localStorage.setItem('dispo_history', JSON.stringify(newHist));
                          }}
                          style={{ marginRight: 6, width: 28, height: 28, borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.7, transition: 'color 0.12s, opacity 0.12s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#d93025'; e.currentTarget.style.opacity = '1'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.7'; }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrutalStat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="brutal-card" style={{ padding: '18px 14px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid var(--ink)', background: 'var(--brutal-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '1.15rem' }}>
        {icon}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 6, fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  );
}