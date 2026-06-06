import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export function generateRoomCode(): string {
  return nanoid();
}

export function generatePlayerId(): string {
  return customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16)();
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const AVATAR_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
] as const;

export const ROLE_CONFIG = {
  mafia: { label: 'Mafia', color: '#ef4444', bg: '#7f1d1d', description: 'Eliminate villagers each night. Win when Mafia outnumbers the village.' },
  doctor: { label: 'Doctor', color: '#22c55e', bg: '#14532d', description: 'Save one player each night from elimination. You can protect yourself.' },
  investigator: { label: 'Investigator', color: '#3b82f6', bg: '#1e3a8a', description: 'Investigate one player each night to learn if they are Mafia.' },
  villager: { label: 'Villager', color: '#9ca3af', bg: '#1f2937', description: 'Discuss and vote to eliminate Mafia members during the day.' },
} as const;
