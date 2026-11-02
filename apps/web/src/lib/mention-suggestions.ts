export interface MentionCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  role?: string | null;
  isBroadcast?: boolean;
}

export interface MentionMatch {
  isOpen: boolean;
  query: string;
  startIndex: number;
}

/**
 * Checks if the cursor is positioned directly after a mention trigger '@...'.
 * Requirements:
 * - '@' must be at start of string or preceded by whitespace
 * - Cursor must be after '@'
 * - Query must not contain newlines or excessive spaces
 */
export function getMentionQuery(text: string, cursorPosition: number): MentionMatch {
  if (cursorPosition < 0 || cursorPosition > text.length) {
    return { isOpen: false, query: '', startIndex: -1 };
  }

  const textBeforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    return { isOpen: false, query: '', startIndex: -1 };
  }

  // Check if preceded by whitespace or start of string
  const prevChar = textBeforeCursor[lastAtIndex - 1] ?? '';
  if (lastAtIndex > 0 && !/\s/.test(prevChar)) {
    return { isOpen: false, query: '', startIndex: -1 };
  }

  const query = textBeforeCursor.slice(lastAtIndex + 1);

  // If query has newlines, or more than 1 space, or is too long, don't trigger
  if (/[\r\n\t]/.test(query) || query.length > 30) {
    return { isOpen: false, query: '', startIndex: -1 };
  }

  // Avoid triggering if there are 2 or more spaces in the query
  const spaceCount = (query.match(/\s/g) || []).length;
  if (spaceCount > 1) {
    return { isOpen: false, query: '', startIndex: -1 };
  }

  return {
    isOpen: true,
    query,
    startIndex: lastAtIndex,
  };
}

/**
 * Filters and ranks candidates based on the mention query.
 */
export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
  maxResults: number = 8
): MentionCandidate[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return candidates.slice(0, maxResults);
  }

  const exactMatches: MentionCandidate[] = [];
  const startsWithMatches: MentionCandidate[] = [];
  const containsMatches: MentionCandidate[] = [];

  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase();
    const subtitle = (candidate.subtitle || '').toLowerCase();
    const role = (candidate.role || '').toLowerCase();

    if (name === trimmed) {
      exactMatches.push(candidate);
    } else if (name.startsWith(trimmed) || name.split(/\s+/).some((p) => p.startsWith(trimmed))) {
      startsWithMatches.push(candidate);
    } else if (name.includes(trimmed) || subtitle.includes(trimmed) || role.includes(trimmed)) {
      containsMatches.push(candidate);
    }
  }

  return [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, maxResults);
}

/**
 * Inserts the selected candidate into the text at the mention location.
 * Returns the new text and the new cursor position.
 */
export function insertMention(
  originalText: string,
  startIndex: number,
  cursorPosition: number,
  candidate: MentionCandidate
): { text: string; newCursorPosition: number } {
  const mentionText = candidate.isBroadcast
    ? `@${candidate.name} `
    : `@{${candidate.name}} `;

  const before = originalText.slice(0, startIndex);
  const after = originalText.slice(cursorPosition);
  const newText = `${before}${mentionText}${after}`;
  const newCursorPosition = before.length + mentionText.length;

  return { text: newText, newCursorPosition };
}
