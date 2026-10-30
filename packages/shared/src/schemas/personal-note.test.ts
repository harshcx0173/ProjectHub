import { describe, it, expect } from 'vitest';
import {
  createPersonalNoteSchema,
  updatePersonalNoteSchema,
  convertNoteToTaskSchema,
  NOTE_COLORS,
  PersonalNotesLimits,
} from './personal-note';

describe('Personal Note Schemas', () => {
  it('validates default note creation', () => {
    const result = createPersonalNoteSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('');
      expect(result.data.contentType).toBe('text');
      expect(result.data.color).toBe('#FEF08A');
      expect(result.data.isPinned).toBe(false);
      expect(result.data.checklistItems).toEqual([]);
    }
  });

  it('validates note with checklist items', () => {
    const result = createPersonalNoteSchema.safeParse({
      title: 'Grocery list',
      contentType: 'checklist',
      checklistItems: [
        { id: 'item-1', text: 'Milk', completed: false },
        { id: 'item-2', text: 'Bread', completed: true },
      ],
      color: '#D1FAE5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checklistItems).toHaveLength(2);
      expect(result.data.checklistItems?.[1]?.completed).toBe(true);
    }
  });

  it('rejects character limit overflow', () => {
    const hugeText = 'a'.repeat(PersonalNotesLimits.DEFAULT_MAX_CHAR_LENGTH + 1);
    const result = createPersonalNoteSchema.safeParse({
      content: hugeText,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid color format', () => {
    const result = createPersonalNoteSchema.safeParse({
      color: 'red', // Not a hex code
    });
    expect(result.success).toBe(false);
  });

  it('validates partial updates', () => {
    const result = updatePersonalNoteSchema.safeParse({
      isPinned: true,
      color: '#EDE9FE',
      version: 2,
    });
    expect(result.success).toBe(true);
  });

  it('validates convert to task input', () => {
    const result = convertNoteToTaskSchema.safeParse({
      projectId: 'd278dc82-fb39-4c51-9aff-ecf900830256',
      priority: 'high',
      assigneeIds: ['11111111-1111-1111-1111-111111111111'],
    });
    expect(result.success).toBe(true);
  });

  it('includes 6 pastel color options', () => {
    expect(NOTE_COLORS).toHaveLength(6);
    expect(NOTE_COLORS.map((c) => c.id)).toEqual(['yellow', 'green', 'purple', 'orange', 'blue', 'rose']);
  });
});
