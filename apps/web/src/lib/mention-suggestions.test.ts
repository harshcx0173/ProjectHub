import { describe, it, expect } from 'vitest';
import {
  getMentionQuery,
  filterMentionCandidates,
  insertMention,
  MentionCandidate,
} from './mention-suggestions';

describe('mention-suggestions', () => {
  describe('getMentionQuery', () => {
    it('detects trigger @ at start of input', () => {
      const match = getMentionQuery('@', 1);
      expect(match.isOpen).toBe(true);
      expect(match.query).toBe('');
      expect(match.startIndex).toBe(0);
    });

    it('detects trigger with query @harsh', () => {
      const match = getMentionQuery('@harsh', 6);
      expect(match.isOpen).toBe(true);
      expect(match.query).toBe('harsh');
      expect(match.startIndex).toBe(0);
    });

    it('detects trigger preceded by space', () => {
      const match = getMentionQuery('Hello @john', 11);
      expect(match.isOpen).toBe(true);
      expect(match.query).toBe('john');
      expect(match.startIndex).toBe(6);
    });

    it('detects trigger with space for full name query @Harsh M', () => {
      const match = getMentionQuery('Hey @Harsh M', 12);
      expect(match.isOpen).toBe(true);
      expect(match.query).toBe('Harsh M');
      expect(match.startIndex).toBe(4);
    });

    it('ignores @ inside an email address', () => {
      const match = getMentionQuery('test@example.com', 16);
      expect(match.isOpen).toBe(false);
    });

    it('ignores if cursor is before @', () => {
      const match = getMentionQuery('Hello @john', 4);
      expect(match.isOpen).toBe(false);
    });

    it('ignores if query contains multiple spaces (sentence)', () => {
      const match = getMentionQuery('@one two three four', 19);
      expect(match.isOpen).toBe(false);
    });
  });

  describe('filterMentionCandidates', () => {
    const candidates: MentionCandidate[] = [
      { id: '1', name: 'Harsh Mevada', subtitle: 'Developer', role: 'Admin' },
      { id: '2', name: 'Suresh Kumar', subtitle: 'Designer', role: 'Member' },
      { id: '3', name: 'everyone', subtitle: 'Notify all members', isBroadcast: true },
      { id: '4', name: 'Harry Potter', subtitle: 'Magician', role: 'Member' },
    ];

    it('returns all candidates when query is empty', () => {
      const results = filterMentionCandidates(candidates, '');
      expect(results.length).toBe(4);
    });

    it('filters by name start', () => {
      const results = filterMentionCandidates(candidates, 'har');
      expect(results.length).toBe(2);
      expect(results.map((c) => c.name)).toContain('Harsh Mevada');
      expect(results.map((c) => c.name)).toContain('Harry Potter');
    });

    it('filters by last name / split word start', () => {
      const results = filterMentionCandidates(candidates, 'kumar');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Suresh Kumar');
    });

    it('filters by role or subtitle', () => {
      const results = filterMentionCandidates(candidates, 'designer');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('Suresh Kumar');
    });

    it('filters broadcast mention', () => {
      const results = filterMentionCandidates(candidates, 'every');
      expect(results.length).toBe(1);
      expect(results[0]?.name).toBe('everyone');
    });
  });

  describe('insertMention', () => {
    it('inserts bracketed mention for users', () => {
      const candidate: MentionCandidate = { id: '1', name: 'Harsh Mevada' };
      const res = insertMention('Hello @ha please check', 6, 9, candidate);
      expect(res.text).toBe('Hello @{Harsh Mevada}  please check');
      expect(res.newCursorPosition).toBe(6 + '@{Harsh Mevada} '.length);
    });

    it('inserts broadcast mention without brackets', () => {
      const candidate: MentionCandidate = { id: 'broadcast', name: 'everyone', isBroadcast: true };
      const res = insertMention('Attention @ev team', 10, 13, candidate);
      expect(res.text).toBe('Attention @everyone  team');
      expect(res.newCursorPosition).toBe(10 + '@everyone '.length);
    });
  });
});
