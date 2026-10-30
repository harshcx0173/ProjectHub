import { describe, it, expect } from 'vitest';
import { buildInvitationEmailTemplate } from './smtp';

describe('SMTP Invitation Email Template Builder', () => {
  it('generates compliant plain text and HTML templates with all required details', () => {
    const { plainText, html } = buildInvitationEmailTemplate({
      recipientEmail: 'newemployee@example.com',
      recipientName: 'Alex Employee',
      inviterName: 'Harsh Mevada',
      inviterRole: 'Admin',
      orgName: 'Acme Global',
      inviteLink: 'http://localhost:4321/invite/accept?token=sample123',
      expiresAt: new Date('2026-11-06T12:00:00Z'),
      isExistingUser: false,
    });

    // Check plain text content
    expect(plainText).toContain('Harsh Mevada (Admin)');
    expect(plainText).toContain('Acme Global');
    expect(plainText).toContain('http://localhost:4321/invite/accept?token=sample123');
    expect(plainText).toContain('Two-Factor Authentication');

    // Check HTML content
    expect(html).toContain('Join Acme Global');
    expect(html).toContain('Harsh Mevada');
    expect(html).toContain('Accept Invitation');
    expect(html).toContain('http://localhost:4321/invite/accept?token=sample123');
    expect(html).toContain('Inter');

    // Zero emojis check
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(plainText)).toBe(false);
    expect(emojiRegex.test(html)).toBe(false);
  });

  it('adjusts security instructions when recipient is an existing user', () => {
    const { plainText, html } = buildInvitationEmailTemplate({
      recipientEmail: 'existing@example.com',
      inviterName: 'Harsh Mevada',
      inviterRole: 'Admin',
      orgName: 'Acme Global',
      inviteLink: 'http://localhost:4321/invite/accept?token=existing123',
      expiresAt: new Date('2026-11-06T12:00:00Z'),
      isExistingUser: true,
    });

    expect(plainText).toContain('Since you already have an account');
    expect(html).toContain('Sign in with your existing account credentials');
  });
});
