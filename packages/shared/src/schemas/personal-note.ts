import { z } from 'zod';

export const NOTE_COLORS = [
  { id: 'yellow', hex: '#FEF08A', borderHex: '#FDE047', textHex: '#713F12', name: 'Lemon' },
  { id: 'green', hex: '#D1FAE5', borderHex: '#A7F3D0', textHex: '#065F46', name: 'Mint' },
  { id: 'purple', hex: '#EDE9FE', borderHex: '#DDD6FE', textHex: '#5B21B6', name: 'Lavender' },
  { id: 'orange', hex: '#FFEDD5', borderHex: '#FED7AA', textHex: '#9A3412', name: 'Peach' },
  { id: 'blue', hex: '#E0F2FE', borderHex: '#BAE6FD', textHex: '#075985', name: 'Sky' },
  { id: 'rose', hex: '#FFE4E6', borderHex: '#FECDD3', textHex: '#9F1239', name: 'Rose' },
] as const;

export type NoteColorId = typeof NOTE_COLORS[number]['id'];

export const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(500),
  completed: z.boolean().default(false),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const PersonalNotesLimits = {
  DEFAULT_MAX_NOTES: 100,
  DEFAULT_MAX_CHAR_LENGTH: 5000,
  DEFAULT_MAX_CHECKLIST_ITEMS: 50,
  DEFAULT_TRASH_RETENTION_DAYS: 30,
};

export const createPersonalNoteSchema = z.object({
  title: z.string().max(255).default(''),
  contentType: z.enum(['text', 'checklist']).default('text'),
  content: z.string().max(PersonalNotesLimits.DEFAULT_MAX_CHAR_LENGTH).default(''),
  checklistItems: z.array(ChecklistItemSchema).max(PersonalNotesLimits.DEFAULT_MAX_CHECKLIST_ITEMS).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FEF08A'),
  posX: z.number().int().default(100),
  posY: z.number().int().default(100),
  width: z.number().int().min(200).max(800).default(280),
  height: z.number().int().min(150).max(1000).default(260),
  isPinned: z.boolean().default(false),
  position: z.number().int().default(0),
  zIndex: z.number().int().default(1),
});

export type CreatePersonalNoteInput = z.infer<typeof createPersonalNoteSchema>;

export const updatePersonalNoteSchema = z.object({
  title: z.string().max(255).optional(),
  contentType: z.enum(['text', 'checklist']).optional(),
  content: z.string().max(PersonalNotesLimits.DEFAULT_MAX_CHAR_LENGTH).optional(),
  checklistItems: z.array(ChecklistItemSchema).max(PersonalNotesLimits.DEFAULT_MAX_CHECKLIST_ITEMS).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  posX: z.number().int().optional(),
  posY: z.number().int().optional(),
  width: z.number().int().min(200).max(800).optional(),
  height: z.number().int().min(150).max(1000).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  position: z.number().int().optional(),
  zIndex: z.number().int().optional(),
  version: z.number().int().optional(),
});

export type UpdatePersonalNoteInput = z.infer<typeof updatePersonalNoteSchema>;

export const convertNoteToTaskSchema = z.object({
  projectId: z.string().uuid(),
  columnId: z.string().uuid().optional(),
  status: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

export type ConvertNoteToTaskInput = z.infer<typeof convertNoteToTaskSchema>;

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  contentType: 'text' | 'checklist';
  content: string;
  checklistItems: ChecklistItem[];
  color: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  position: number;
  zIndex: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

