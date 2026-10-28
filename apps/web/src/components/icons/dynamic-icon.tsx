import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Folder } from 'lucide-react';

export const AVAILABLE_PROJECT_ICONS = [
  'Folder',
  'Briefcase',
  'Rocket',
  'Zap',
  'Shield',
  'Terminal',
  'Globe',
  'Cloud',
  'Database',
  'Layout',
  'Code2',
  'Cpu',
  'Layers',
  'Target',
  'Boxes',
  'Sparkles',
] as const;

export type AvailableProjectIcon = (typeof AVAILABLE_PROJECT_ICONS)[number];

export const AVAILABLE_PROJECT_COLORS = [
  '#2563EB', // Blue
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#0891B2', // Cyan
  '#475569', // Slate
] as const;

interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className = 'h-4 w-4' }: DynamicIconProps) {
  const IconComponent = (LucideIcons as Record<string, any>)[name] || Folder;
  return <IconComponent className={className} />;
}
