'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Folder, User, X, Loader2, ArrowRight } from 'lucide-react';
import { SearchResult } from '@project-hub/shared';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex].url);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-white shadow-elevated overflow-hidden text-foreground"
        onKeyDown={handleListKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border h-12 gap-3">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
            placeholder="Search projects, tasks, or people... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="p-6 text-center text-xs text-gray-400">
              Type at least 2 characters to search across projects and team members...
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="p-6 text-center text-xs text-gray-500">
              No matching records found for &quot;{query}&quot;.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => (
                <div
                  key={`${item.resultType}-${item.id}`}
                  onClick={() => handleSelect(item.url)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    idx === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-gray-100 text-gray-600 shrink-0">
                      {item.resultType === 'project' ? (
                        <Folder className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-xs truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-60 shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keyboard hints footer */}
        <div className="px-4 py-2 border-t border-border bg-gray-50 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-[10px]">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-[10px]">Enter</kbd> Select
            </span>
          </div>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-white border border-gray-200 text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
