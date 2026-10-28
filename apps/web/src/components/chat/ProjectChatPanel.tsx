'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Send,
  Paperclip,
  Mic,
  Square,
  ThumbsUp,
  Check,
  Heart,
  Flag,
  Eye,
  CheckSquare,
  LucideIcon,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

interface ProjectChatPanelProps {
  projectId: string;
}

const REACTION_ICONS: Record<string, LucideIcon> = {
  'thumbs-up': ThumbsUp,
  check: Check,
  heart: Heart,
  flag: Flag,
  eye: Eye,
};

export function ProjectChatPanel({ projectId }: ProjectChatPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const width = 360;
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const supabase = createClient();

  // 1. Fetch channel
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/channels`)
      .then((res) => res.json())
      .then((data) => {
        if (data.channels && data.channels.length > 0) {
          setChannelId(data.channels[0].id);
        }
      })
      .catch(console.error);
  }, [projectId]);

  // 2. Fetch messages for channel and subscribe to Realtime
  useEffect(() => {
    if (!channelId) return;

    const loadMessages = () => {
      fetch(`/api/v1/channels/${channelId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) {
            setMessages(data.messages);
            scrollToBottom();
          }
        })
        .catch(console.error);
    };

    loadMessages();

    // Realtime channel subscription
    const channel = supabase
      .channel(`project_chat_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !channelId) return;

    const text = inputText;
    setInputText('');

    try {
      const res = await fetch(`/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleReaction = async (messageId: string, iconName: string) => {
    setActiveReactionMsgId(null);
    try {
      await fetch(`/api/v1/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iconName }),
      });

      // Refresh messages
      const res = await fetch(`/api/v1/channels/${channelId}/messages`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  // Convert chat message to project task with 1-click
  const handleConvertToTask = async (message: any) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: message.content.slice(0, 120),
          description: `Converted from chat message by ${message.author?.full_name || 'Member'}:\n\n${message.content}`,
          priority: 'medium',
        }),
      });

      if (res.ok) {
        alert('Task created successfully from this message!');
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to convert message to task');
      }
    } catch {
      alert('Error converting message to task');
    }
  };

  // Voice note recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleDirectAudioUpload(audioBlob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    }
  };

  const handleDirectAudioUpload = async (blob: Blob) => {
    setUploading(true);
    try {
      const presignRes = await fetch('/api/v1/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          originalName: `Voice_Note_${Date.now()}.webm`,
          contentType: 'audio/webm',
          sizeBytes: blob.size,
        }),
      });

      if (!presignRes.ok) throw new Error('Failed to get presigned upload URL');
      const { uploadUrl } = await presignRes.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      });

      // Send chat message with audio link
      await fetch(`/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `[Voice Note] (audio/webm)` }),
      });
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // File upload trigger
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;

    setUploading(true);
    try {
      const presignRes = await fetch('/api/v1/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to prepare upload');
      }

      const { uploadUrl } = await presignRes.json();

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      // Post message with file announcement
      await fetch(`/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Uploaded file: **${file.name}**` }),
      });
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 bg-white border border-border rounded-xl shadow-subtle shrink-0 w-12 justify-between">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Open Project Chat"
          aria-label="Open Project Chat"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold text-gray-500 flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span>Project Chat</span>
        </div>
        <div />
      </div>
    );
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="hidden lg:flex flex-col rounded-xl border border-border bg-white shadow-subtle overflow-hidden shrink-0 transition-all duration-150"
    >
      {/* Panel Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold text-gray-900">#general</h2>
          <span className="text-[10px] text-gray-400 font-medium">Realtime</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Collapse chat"
            aria-label="Collapse chat"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3 space-y-3.5 overflow-y-auto bg-gray-50/40">
        {messages.map((m) => {
          const sanitizedContent = DOMPurify.sanitize(m.content);

          return (
            <div key={m.id} className="group relative flex items-start gap-2.5 text-xs">
              {/* Avatar */}
              <div className="h-6 w-6 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center shrink-0 uppercase mt-0.5 shadow-2xs">
                {m.author?.full_name ? m.author.full_name.charAt(0) : 'U'}
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 text-[11px]">
                      {m.author?.full_name || 'Member'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {format(new Date(m.createdAt), 'h:mm a')}
                    </span>
                  </div>

                  {/* Actions (Convert to task, Add reaction) */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleConvertToTask(m)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                      title="Convert to Task"
                      aria-label="Convert message to task"
                    >
                      <CheckSquare className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                      }
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                      title="Add reaction"
                      aria-label="Add reaction"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Reaction Picker Popover */}
                {activeReactionMsgId === m.id && (
                  <div className="flex items-center gap-1.5 p-1 bg-white border border-border shadow-md rounded-lg my-1">
                    {(['thumbs-up', 'check', 'heart', 'flag', 'eye'] as const).map((icon) => {
                      const IconComp = REACTION_ICONS[icon] ?? ThumbsUp;
                      return (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => handleToggleReaction(m.id, icon)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-primary transition-colors"
                        >
                          <IconComp className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Message Body */}
                <div
                  className="text-gray-800 text-xs mt-0.5 leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />

                {/* Reactions list */}
                {m.reactions && m.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.reactions.map((r: any) => {
                      const IconComp = REACTION_ICONS[r.icon_name] ?? ThumbsUp;
                      return (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[10px] text-gray-600 shadow-2xs"
                        >
                          <IconComp className="h-3 w-3 text-primary" />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-400">
            No messages yet in #general. Say hello!
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Toolbar & Input */}
      <div className="p-3 border-t border-border bg-white shrink-0">
        <form onSubmit={handleSendMessage} className="space-y-2">
          <input
            type="text"
            placeholder="Write a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* File Attachment */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Attach file"
                aria-label="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>

              {/* Voice Note Recorder */}
              {recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold animate-pulse"
                >
                  <Square className="h-3 w-3" /> Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploading}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Record voice note"
                  aria-label="Record voice note"
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              )}

              {uploading && (
                <span className="text-[10px] text-gray-400 animate-pulse">Uploading...</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
