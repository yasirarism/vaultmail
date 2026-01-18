import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractEmail(text: string): string | null {
  const match = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  return match ? match[1].toLowerCase() : null;
}

type SenderInfo = {
  name: string;
  email: string | null;
  label: string;
};

export function getSenderInfo(from: string): SenderInfo {
  const email = extractEmail(from);
  const trimmed = from.trim();
  const angleIndex = trimmed.indexOf('<');
  const rawName = angleIndex !== -1 ? trimmed.slice(0, angleIndex).trim() : '';
  const cleanedName = rawName.replace(/^["']|["']$/g, '').trim();
  const fallback = trimmed.replace(/^["']|["']$/g, '').trim();
  const name = cleanedName || fallback || email || from;
  const label =
    email && cleanedName && cleanedName !== email
      ? `${cleanedName} <${email}>`
      : email && !cleanedName && fallback && fallback !== email
        ? `${fallback} <${email}>`
        : name;
  return {
    name,
    email,
    label
  };
}
