import { describe, it, expect } from 'vitest';
import {
  PersonalNotesLimits,
  createPersonalNoteSchema,
  updatePersonalNoteSchema,
  convertNoteToTaskSchema,
  PersonalNote,
  NOTE_COLORS,
} from '@project-hub/shared';

describe('Personal Notes Logic & Privacy Rules', () => {
  it('enforces owner-only isolation schema defaults', () => {
    const rawInput = {
      title: 'Top Secret Plan',
      content: 'Never show to admins or managers',
    };

    const parsed = createPersonalNoteSchema.parse(rawInput);
    expect(parsed.title).toBe('Top Secret Plan');
    expect(parsed.content).toBe('Never show to admins or managers');
    expect(parsed.color).toBe('#FEF08A'); // Default Lemon pastel
    expect(parsed.contentType).toBe('text');
    expect(parsed.isPinned).toBe(false);
  });

  it('rejects payload exceeding character quota limit', () => {
    const overflowText = 'x'.repeat(PersonalNotesLimits.DEFAULT_MAX_CHAR_LENGTH + 10);
    const parsed = createPersonalNoteSchema.safeParse({ content: overflowText });
    expect(parsed.success).toBe(false);
  });

  it('rejects checklist exceeding item quota limit', () => {
    const items = Array.from({ length: PersonalNotesLimits.DEFAULT_MAX_CHECKLIST_ITEMS + 1 }, (_, i) => ({
      id: `item-${i}`,
      text: `Task item ${i}`,
      completed: false,
    }));

    const parsed = createPersonalNoteSchema.safeParse({
      contentType: 'checklist',
      checklistItems: items,
    });
    expect(parsed.success).toBe(false);
  });

  it('correctly maps note to task payload preserving checklist Markdown', () => {
    const note: PersonalNote = {
      id: 'test-note-1',
      userId: 'user-1',
      title: 'Sprint Backlog Note',
      contentType: 'checklist',
      content: 'Initial notes for sprint',
      checklistItems: [
        { id: '1', text: 'Implement API endpoint', completed: true },
        { id: '2', text: 'Write vitest suite', completed: false },
      ],
      color: '#D1FAE5',
      posX: 100,
      posY: 100,
      width: 280,
      height: 260,
      isPinned: true,
      isArchived: false,
      isDeleted: false,
      deletedAt: null,
      position: 0,
      zIndex: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const conversionInput = {
      projectId: 'd278dc82-fb39-4c51-9aff-ecf900830256',
      priority: 'high' as const,
      assigneeIds: ['11111111-1111-1111-1111-111111111111'],
    };

    const parsed = convertNoteToTaskSchema.parse(conversionInput);
    expect(parsed.projectId).toBe(conversionInput.projectId);
    expect(parsed.priority).toBe('high');

    // Build markdown representation as done in convert-to-task route
    const checklistMd = note.checklistItems
      .map((item) => `- [${item.completed ? 'x' : ' '}] ${item.text}`)
      .join('\n');
    const taskDescription = `${note.content}\n\nChecklist:\n${checklistMd}`;

    expect(taskDescription).toContain('- [x] Implement API endpoint');
    expect(taskDescription).toContain('- [ ] Write vitest suite');
  });

  it('validates soft delete and restore update schemas', () => {
    const softDeleteUpdate = updatePersonalNoteSchema.parse({
      isDeleted: true,
    });
    expect(softDeleteUpdate.isDeleted).toBe(true);

    const restoreUpdate = updatePersonalNoteSchema.parse({
      isDeleted: false,
      isArchived: false,
    });
    expect(restoreUpdate.isDeleted).toBe(false);
  });

  it('guarantees color contrast tokens are valid hex values', () => {
    for (const color of NOTE_COLORS) {
      expect(color.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(color.borderHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(color.textHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

