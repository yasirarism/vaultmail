'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

export function DayCounterPage() {
  return (
    <AppShell contentClassName="max-w-4xl">
      <DayCounterContent />
    </AppShell>
  );
}

function DayCounterContent() {
  const { t } = useAppChrome();
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-white">
          <Calendar className="h-5 w-5 text-blue-300" />
          <h1 className="text-2xl font-semibold">{t.dayCounterTitle}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">{t.dayCounterSubtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.dayCounterStart}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.dayCounterEnd}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          {t.dayCounterResultLabel}
        </p>
        <p className="mt-3 text-3xl font-bold text-white">
          {Number.isNaN(days) ? '--' : t.dayCounterResult.replace('{days}', `${days}`)}
        </p>
      </div>
    </div>
  );
}
