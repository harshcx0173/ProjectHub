'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MentionCandidate,
  getMentionQuery,
  filterMentionCandidates,
  insertMention,
} from '@/lib/mention-suggestions';
import { AtSign, Users } from 'lucide-react';

export interface MentionSuggestionsProps {
  candidates: MentionCandidate[];
  text: string;
  setText: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onKeyDownIntercept?: (e: React.KeyboardEvent) => boolean;
}

export function useMentionSuggestions({
  candidates,
  text,
  setText,
  inputRef,
}: {
  candidates: MentionCandidate[];
  text: string;
  setText: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [startIndex, setStartIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Check mention match whenever text changes or input cursor moves
  const checkMention = useCallback(() => {
    if (!inputRef.current) return;
    const currentPos = inputRef.current.selectionStart ?? text.length;
    setCursorPos(currentPos);
    const match = getMentionQuery(text, currentPos);

    if (match.isOpen) {
      setIsOpen(true);
      setQuery(match.query);
      setStartIndex(match.startIndex);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
      setQuery('');
      setStartIndex(-1);
    }
  }, [text, inputRef]);

  useEffect(() => {
    checkMention();
  }, [checkMention]);

  const filteredCandidates = filterMentionCandidates(candidates, query);

  const selectCandidate = useCallback(
    (candidate: MentionCandidate) => {
      if (startIndex === -1) return;
      const { text: newText, newCursorPosition } = insertMention(
        text,
        startIndex,
        cursorPos,
        candidate
      );

      setText(newText);
      setIsOpen(false);
      setQuery('');
      setStartIndex(-1);

      // Restore focus and cursor position
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 10);
    },
    [text, startIndex, cursorPos, setText, inputRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || filteredCandidates.length === 0) {
        if (isOpen && e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
          return true;
        }
        return false;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCandidates.length);
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCandidates.length) % filteredCandidates.length);
        return true;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredCandidates[selectedIndex];
        if (selected) {
          selectCandidate(selected);
          return true;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return true;
      }

      return false;
    },
    [isOpen, filteredCandidates, selectedIndex, selectCandidate]
  );

  return {
    isOpen,
    query,
    selectedIndex,
    setSelectedIndex,
    filteredCandidates,
    selectCandidate,
    handleKeyDown,
    close: () => setIsOpen(false),
  };
}

export function MentionSuggestionsDropdown({
  isOpen,
  query,
  selectedIndex,
  setSelectedIndex,
  filteredCandidates,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  filteredCandidates: MentionCandidate[];
  onSelect: (candidate: MentionCandidate) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 max-w-[calc(100vw-32px)] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-left"
    >
      {/* Microsoft Teams-style Header */}
      <div className="px-3.5 py-2 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <div className="flex items-center gap-1.5 text-primary">
          <AtSign className="h-3.5 w-3.5" />
          <span className="font-bold text-gray-800">Suggestions</span>
        </div>
        <span className="text-[10px] text-gray-400 font-normal">↵ or Tab to select</span>
      </div>

      {/* Candidates List */}
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 py-1">
        {filteredCandidates.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">
            No members found matching &ldquo;{query}&rdquo;
          </div>
        ) : (
          filteredCandidates.map((c, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(c);
                }}
                className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 text-blue-950 border-l-3 border-primary'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                {/* Avatar / Broadcast icon */}
                {c.isBroadcast ? (
                  <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200">
                    <Users className="h-3.5 w-3.5 text-amber-700" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 uppercase overflow-hidden">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      c.name.charAt(0)
                    )}
                  </div>
                )}

                {/* Candidate Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs truncate ${
                        isSelected ? 'font-bold text-gray-950' : 'font-semibold text-gray-900'
                      }`}
                    >
                      {c.name}
                    </span>
                    {c.role && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 shrink-0 font-medium">
                        {c.role}
                      </span>
                    )}
                  </div>
                  {c.subtitle && (
                    <p className="text-[10px] text-gray-500 truncate">
                      {c.subtitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
