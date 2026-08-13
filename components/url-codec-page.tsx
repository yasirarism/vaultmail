'use client';

import { useState } from 'react';
import { Code2 } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';
import { Button } from '@/components/ui/button';

export function UrlCodecPage() {
  return (
    <AppShell contentClassName="max-w-4xl">
      <UrlCodecContent />
    </AppShell>
  );
}

function UrlCodecContent() {
  const { t } = useAppChrome();
  const [inputValue, setInputValue] = useState('');
  const [outputValue, setOutputValue] = useState('');
  const [error, setError] = useState('');

  const handleEncode = () => {
    setError('');
    setOutputValue(encodeURIComponent(inputValue));
  };

  const handleDecode = () => {
    try {
      const decoded = decodeURIComponent(inputValue);
      setOutputValue(decoded);
      setError('');
    } catch {
      setError(t.urlCodecInvalid);
      setOutputValue('');
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white">
          <Code2 className="h-5 w-5 text-blue-300" />
          <h1 className="text-2xl font-semibold">{t.urlCodecTitle}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">{t.urlCodecSubtitle}</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          {t.urlCodecInputLabel}
        </label>
        <textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={t.urlCodecInputPlaceholder}
          className="w-full min-h-[120px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleEncode}>{t.urlCodecEncode}</Button>
          <Button variant="secondary" onClick={handleDecode}>
            {t.urlCodecDecode}
          </Button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          {t.urlCodecResultLabel}
        </p>
        <textarea
          value={outputValue}
          readOnly
          className="w-full min-h-[120px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        />
      </div>
    </div>
  );
}
