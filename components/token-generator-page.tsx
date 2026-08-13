'use client';

import { useState } from 'react';
import { Copy, Key } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~',
};

export function TokenGeneratorPage() {
  return (
    <AppShell contentClassName="max-w-4xl">
      <TokenGeneratorContent />
    </AppShell>
  );
}

function TokenGeneratorContent() {
  const { t } = useAppChrome();
  const [length, setLength] = useState('32');
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(false);
  const [token, setToken] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const generateToken = () => {
    const size = Math.max(Number(length) || 0, 1);
    let pool = '';
    if (useUpper) pool += CHARSETS.upper;
    if (useLower) pool += CHARSETS.lower;
    if (useNumbers) pool += CHARSETS.numbers;
    if (useSymbols) pool += CHARSETS.symbols;
    if (!pool) {
      setToken('');
      return;
    }
    let result = '';
    for (let i = 0; i < size; i += 1) {
      result += pool[Math.floor(Math.random() * pool.length)];
    }
    setToken(result);
    setCopyStatus('idle');
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1200);
    } catch {
      setCopyStatus('idle');
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white">
          <Key className="h-5 w-5 text-purple-300" />
          <h1 className="text-2xl font-semibold">{t.tokenTitle}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">{t.tokenSubtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.tokenLengthLabel}
          </label>
          <Input
            value={length}
            onChange={(event) => setLength(event.target.value)}
            type="number"
            min="1"
            className="bg-black/40 border-white/10 text-sm"
          />
          <div className="grid gap-2 text-sm text-white/80">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useUpper}
                onChange={(event) => setUseUpper(event.target.checked)}
                className="accent-blue-500"
              />
              {t.tokenUppercase}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useLower}
                onChange={(event) => setUseLower(event.target.checked)}
                className="accent-blue-500"
              />
              {t.tokenLowercase}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useNumbers}
                onChange={(event) => setUseNumbers(event.target.checked)}
                className="accent-blue-500"
              />
              {t.tokenNumbers}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useSymbols}
                onChange={(event) => setUseSymbols(event.target.checked)}
                className="accent-blue-500"
              />
              {t.tokenSymbols}
            </label>
          </div>
          <Button onClick={generateToken} className="w-full">
            {t.tokenGenerate}
          </Button>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.tokenResultLabel}
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 font-mono text-sm text-white/80 break-all min-h-[96px]">
            {token || t.tokenEmpty}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!token}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold',
              token ? 'bg-white/10 text-white/80' : 'bg-white/5 text-white/40'
            )}
          >
            <Copy className="h-3 w-3" />
            {copyStatus === 'copied' ? t.tokenCopied : t.tokenCopy}
          </button>
        </div>
      </div>
    </div>
  );
}
