export const SUPPORTED_LOCALES = ['en', 'id'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE = (() => {
  const envLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim().toLowerCase();
  if (envLocale && SUPPORTED_LOCALES.includes(envLocale as Locale)) {
    return envLocale as Locale;
  }
  return 'en';
})();

const translations = {
  en: {
    appName: 'YS Mail',
    github: 'GitHub',
    heroTitle: 'Disposable Email',
    heroTitleSuffix: 'for Developers',
    heroSubtitle:
      'Secure, serverless temporary email service. Bring your own domain or use the default.',
    featureInstantTitle: 'Instant & Real-time',
    featureInstantDesc:
      'Emails arrive instantly via Webhooks. The inbox auto-refreshes in real-time.',
    featurePrivacyTitle: 'Privacy First',
    featurePrivacyDesc:
      'No tracking. Emails traverse your infrastructure and are stored in Redis with configurable TTL.',
    featureCustomTitle: 'Custom Domains',
    featureCustomDesc:
      "Point your domain's MX records to your Cloudflare/Mailgun and route emails here.",
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    greetingNight: 'Good night',
    footerSuffix: 'Open Source.',
    footerRetentionPrefix: 'Retention',
    inboxTitle: 'Your Temporary Inbox',
    inboxHintPrefix: 'Waiting for emails at this address.',
    inboxHintSuffix: 'Messages auto-delete after',
    syncing: 'Syncing...',
    live: 'Live',
    usernamePlaceholder: 'username',
    settingsTitle: 'Settings',
    languageLabel: 'Language',
    languageEnglish: 'English',
    languageIndonesian: 'Indonesian',
    historyTitle: 'History',
    historyClearAll: 'Clear All',
    historyEmpty: 'No recent addresses',
    historyActive: 'Active',
    historyRestore: 'Click to restore',
    copy: 'Copy',
    newAlias: 'New',
    inboxLabel: 'Inbox',
    waitingForIncoming: 'Waiting for incoming mail...',
    selectEmail: 'Select an email to read',
    toLabel: 'to',
    dialogTitle: 'Settings',
    dialogSubtitle: 'Manage preferences & domains',
    retentionTab: 'Retention',
    domainsTab: 'Domains',
    retentionHeading: 'Inbox Lifespan',
    retentionDesc:
      "Configure how long emails persist in this inbox. Setting a shorter duration improves privacy, while a longer duration ensures you don't miss important mails.",
    retentionDurationLabel: 'Duration Selection',
    retentionActive: 'ACTIVE',
    systemDomainsTitle: 'System Domains',
    defaultBadge: 'Default',
    customDomainsTitle: 'Custom Domains',
    customDomainPlaceholder: 'Enter new domain...',
    customDomainEmpty: 'No custom domains added.',
    retentionOptions: {
      minutes30: '30 Minutes',
      hour1: '1 Hour',
      hours24: '24 Hours',
      days3: '3 Days',
      week1: '1 Week',
    },
    toastNewAlias: 'New alias created',
    toastCopied: 'Address copied to clipboard',
    toastDomainAdded: 'Domain added',
    toastDomainRemoved: 'Domain removed',
    toastRetentionUpdated: 'Retention updated',
    toastRetentionFailed: 'Failed to save settings',
  },
  id: {
    appName: 'YS Mail',
    github: 'GitHub',
    heroTitle: 'Email Sementara',
    heroTitleSuffix: 'untuk Developer',
    heroSubtitle:
      'Layanan email sementara yang aman dan serverless. Gunakan domain sendiri atau domain bawaan.',
    featureInstantTitle: 'Instan & Real-time',
    featureInstantDesc:
      'Email masuk secara instan via webhook. Inbox auto-refresh secara real-time.',
    featurePrivacyTitle: 'Privasi Utama',
    featurePrivacyDesc:
      'Tanpa pelacakan. Email diproses di infrastruktur Anda dan disimpan di Redis dengan TTL yang bisa diatur.',
    featureCustomTitle: 'Domain Kustom',
    featureCustomDesc:
      'Arahkan MX record domain Anda ke Cloudflare/Mailgun dan rute email ke sini.',
    greetingMorning: 'Selamat pagi',
    greetingAfternoon: 'Selamat siang',
    greetingEvening: 'Selamat sore',
    greetingNight: 'Selamat malam',
    footerSuffix: 'Open Source.',
    footerRetentionPrefix: 'Retensi',
    inboxTitle: 'Inbox Sementara Anda',
    inboxHintPrefix: 'Menunggu email di alamat ini.',
    inboxHintSuffix: 'Pesan otomatis terhapus setelah',
    syncing: 'Sinkron...',
    live: 'Live',
    usernamePlaceholder: 'username',
    settingsTitle: 'Pengaturan',
    languageLabel: 'Bahasa',
    languageEnglish: 'Inggris',
    languageIndonesian: 'Indonesia',
    historyTitle: 'Riwayat',
    historyClearAll: 'Hapus Semua',
    historyEmpty: 'Belum ada alamat',
    historyActive: 'Aktif',
    historyRestore: 'Klik untuk pulihkan',
    copy: 'Salin',
    newAlias: 'Baru',
    inboxLabel: 'Inbox',
    waitingForIncoming: 'Menunggu email masuk...',
    selectEmail: 'Pilih email untuk dibaca',
    toLabel: 'ke',
    dialogTitle: 'Pengaturan',
    dialogSubtitle: 'Atur preferensi & domain',
    retentionTab: 'Retensi',
    domainsTab: 'Domain',
    retentionHeading: 'Masa Simpan Inbox',
    retentionDesc:
      'Atur berapa lama email tersimpan di inbox ini. Durasi lebih singkat meningkatkan privasi, sementara durasi lebih lama mencegah Anda melewatkan email penting.',
    retentionDurationLabel: 'Pilih Durasi',
    retentionActive: 'AKTIF',
    systemDomainsTitle: 'Domain Sistem',
    defaultBadge: 'Default',
    customDomainsTitle: 'Domain Kustom',
    customDomainPlaceholder: 'Masukkan domain baru...',
    customDomainEmpty: 'Belum ada domain kustom.',
    retentionOptions: {
      minutes30: '30 Menit',
      hour1: '1 Jam',
      hours24: '24 Jam',
      days3: '3 Hari',
      week1: '1 Minggu',
    },
    toastNewAlias: 'Alias baru dibuat',
    toastCopied: 'Alamat disalin',
    toastDomainAdded: 'Domain ditambahkan',
    toastDomainRemoved: 'Domain dihapus',
    toastRetentionUpdated: 'Retensi diperbarui',
    toastRetentionFailed: 'Gagal menyimpan pengaturan',
  },
} as const;

export type Translations = (typeof translations)[Locale];

export const getTranslations = (locale: Locale = DEFAULT_LOCALE) =>
  translations[locale] ?? translations.en;

export const getRetentionOptions = (locale: Locale = DEFAULT_LOCALE) => {
  const t = getTranslations(locale);
  return [
    { label: t.retentionOptions.minutes30, value: 1800 },
    { label: t.retentionOptions.hour1, value: 3600 },
    { label: t.retentionOptions.hours24, value: 86400 },
    { label: t.retentionOptions.days3, value: 259200 },
    { label: t.retentionOptions.week1, value: 604800 },
  ];
};
