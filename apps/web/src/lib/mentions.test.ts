import { describe, it, expect } from 'vitest';
import { isUserMentioned, highlightMentionsHtml } from './mentions';

describe('isUserMentioned', () => {
  const user = {
    id: 'user-123',
    fullName: 'Harsh Mevada',
    email: 'harsh@example.com',
  };

  it('detects bracketed full name mention @{Harsh Mevada}', () => {
    expect(isUserMentioned('Hello @{Harsh Mevada} please check this task', user)).toBe(true);
  });

  it('detects unbracketed full name mention @Harsh Mevada', () => {
    expect(isUserMentioned('Hello @Harsh Mevada please check this task', user)).toBe(true);
  });

  it('detects first name mention @Harsh or @{Harsh}', () => {
    expect(isUserMentioned('Hey @Harsh can you review?', user)).toBe(true);
    expect(isUserMentioned('Hey @{Harsh} can you review?', user)).toBe(true);
  });

  it('detects email prefix mention @harsh', () => {
    expect(isUserMentioned('Hey @harsh check the logs', user)).toBe(true);
  });

  it('detects broadcast mentions @all and @everyone', () => {
    expect(isUserMentioned('Important update for @all team members', user)).toBe(true);
    expect(isUserMentioned('Attention @everyone meeting starts now', user)).toBe(true);
  });

  it('returns false when another person is mentioned', () => {
    expect(isUserMentioned('Hello @Suresh please review this', user)).toBe(false);
    expect(isUserMentioned('Hello @{Suresh Kumar} please review this', user)).toBe(false);
  });

  it('returns false when no mention exists', () => {
    expect(isUserMentioned('Just a general comment with no mentions', user)).toBe(false);
  });
});

describe('highlightMentionsHtml', () => {
  it('highlights current user mention with amber style', () => {
    const html = highlightMentionsHtml('Hello @Harsh please check', 'Harsh Mevada');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('@Harsh');
  });

  it('highlights bracketed current user mention', () => {
    const html = highlightMentionsHtml('Hello @{Harsh Mevada} please check', 'Harsh Mevada');
    expect(html).toContain('bg-amber-100');
    expect(html).toContain('@{Harsh Mevada}');
  });

  it('highlights other user mention with primary style', () => {
    const html = highlightMentionsHtml('Hello @Suresh please check', 'Harsh Mevada');
    expect(html).toContain('bg-primary/10');
    expect(html).toContain('@Suresh');
  });
});
