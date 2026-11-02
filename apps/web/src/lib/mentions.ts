import React from 'react';

export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface UserMentionTarget {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
}

/**
 * Checks if a specific user is mentioned in a text message.
 * Supports:
 * - @{Full Name} or @{Username}
 * - @FullName or @FirstName
 * - @email_prefix
 * - @all, @everyone, @here, @channel
 */
export function isUserMentioned(content?: string | null, user?: UserMentionTarget | null): boolean {
  if (!content || !user) return false;
  const text = content.toLowerCase();

  // 1. Broadcast mentions
  if (/@(all|everyone|here|channel)\b/i.test(text)) {
    return true;
  }

  const namesToCheck: string[] = [];
  if (user.fullName) {
    const full = user.fullName.trim().toLowerCase();
    if (full) {
      namesToCheck.push(full);
      const parts = full.split(/\s+/);
      if (parts[0] && parts[0].length > 1) {
        namesToCheck.push(parts[0]); // first name
      }
    }
  }

  if (user.email) {
    const emailPrefix = user.email.split('@')[0]?.toLowerCase();
    if (emailPrefix && emailPrefix.length > 1 && !namesToCheck.includes(emailPrefix)) {
      namesToCheck.push(emailPrefix);
    }
  }

  for (const name of namesToCheck) {
    const esc = escapeRegex(name);
    // Matches @{name} or @name
    const regexBracket = new RegExp(`@\\{${esc}\\}`, 'i');
    const regexSimple = new RegExp(`@${esc}(\\b|[^a-zA-Z0-9_]|$)`, 'i');
    if (regexBracket.test(text) || regexSimple.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses message content and highlights mentions like @{Name} or @Name.
 * If the mention references the current user, it gets extra visual prominence.
 */
export function renderMessageWithMentions(
  content: string,
  currentUserName?: string | null
): React.ReactNode {
  if (!content) return content;

  // Regex to match either @{...} or @[a-zA-Z0-9_.-]+
  const mentionRegex = /(@\{[^}]+\}|@[a-zA-Z0-9_.-]+)/g;
  const parts = content.split(mentionRegex);

  if (parts.length <= 1) {
    return content;
  }

  const normalizedCurrentUser = currentUserName ? currentUserName.trim().toLowerCase() : null;
  const currentFirstName = normalizedCurrentUser ? normalizedCurrentUser.split(/\s+/)[0] : null;

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('@')) {
      let rawMention = part.slice(1);
      if (rawMention.startsWith('{') && rawMention.endsWith('}')) {
        rawMention = rawMention.slice(1, -1);
      }
      const normalizedMention = rawMention.trim().toLowerCase();

      const isSelf =
        Boolean(
          normalizedCurrentUser &&
            (normalizedMention === normalizedCurrentUser ||
              (currentFirstName && normalizedMention === currentFirstName) ||
              ['all', 'everyone', 'here', 'channel'].includes(normalizedMention))
        );

      return React.createElement(
        'span',
        {
          key: index,
          className: `inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-semibold mx-0.5 transition-colors ${
            isSelf
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs'
              : 'bg-primary/10 text-primary border border-primary/20'
          }`,
        },
        part
      );
    }

    return part;
  });
}

/**
 * Parses HTML/string content and returns HTML string with styled mention badges.
 * Suitable for use with DOMPurify.sanitize(highlightMentionsHtml(content, user)).
 */
export function highlightMentionsHtml(
  content: string,
  currentUserName?: string | null
): string {
  if (!content) return content;

  const normalizedCurrentUser = currentUserName ? currentUserName.trim().toLowerCase() : null;
  const currentFirstName = normalizedCurrentUser ? normalizedCurrentUser.split(/\s+/)[0] : null;

  return content.replace(/(@\{[^}]+\}|@[a-zA-Z0-9_.-]+)/g, (match) => {
    let rawMention = match.slice(1);
    if (rawMention.startsWith('{') && rawMention.endsWith('}')) {
      rawMention = rawMention.slice(1, -1);
    }
    const normalizedMention = rawMention.trim().toLowerCase();
    const isSelf = Boolean(
      normalizedCurrentUser &&
        (normalizedMention === normalizedCurrentUser ||
          (currentFirstName && normalizedMention === currentFirstName) ||
          ['all', 'everyone', 'here', 'channel'].includes(normalizedMention))
    );

    const cls = isSelf
      ? 'inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 mx-0.5 shadow-2xs'
      : 'inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 mx-0.5';

    return `<span class="${cls}">${match}</span>`;
  });
}
