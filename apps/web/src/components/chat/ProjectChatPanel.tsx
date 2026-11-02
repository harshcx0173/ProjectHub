'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Search,
  Pin,
  CornerUpLeft,
  Edit3,
  Trash2,
  Bold,
  Italic,
  Code,
  List,
  Link as LinkIcon,
  X,
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
  const width = 380;
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Member');
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Thread Replying
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  // Inline Message Editing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgContent, setEditMsgContent] = useState('');

  // Typing Indicator
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeChannelRef = useRef<any>(null);

  const collapsedRef = useRef(collapsed);
  const currentUserIdRef = useRef<string | null>(currentUserId);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    collapsedRef.current = collapsed;
    if (!collapsed && channelId) {
      setUnreadCount(0);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`project_chat_read_${channelId}`, new Date().toISOString());
      }
    }
  }, [collapsed, channelId]);

  const supabase = useMemo(() => createClient(), []);
  const currentUserNameRef = useRef(currentUserName);
  useEffect(() => {
    currentUserNameRef.current = currentUserName;
  }, [currentUserName]);

  // 1. Fetch channel & Current User
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.full_name) setCurrentUserName(profile.full_name);
          });
      }
    });

    fetch(`/api/v1/projects/${projectId}/channels`)
      .then((res) => res.json())
      .then((data) => {
        if (data.channels && data.channels.length > 0) {
          setChannelId(data.channels[0].id);
        }
      })
      .catch(console.error);
  }, [projectId, supabase]);

  // 2. Fetch messages & Subscribe to Realtime (changes + typing broadcasts)
  useEffect(() => {
    if (!channelId) return;

    const loadMessages = () => {
      fetch(`/api/v1/channels/${channelId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) {
            setMessages((prev) => {
              const pending = prev.filter(
                (m) => String(m.id).startsWith('temp-') && !data.messages.some((s: any) => s.content === m.content)
              );
              return [...data.messages, ...pending];
            });

            // If panel is currently collapsed, calculate unread messages since last read
            if (collapsedRef.current && typeof window !== 'undefined') {
              const lastRead = localStorage.getItem(`project_chat_read_${channelId}`);
              const unreads = data.messages.filter(
                (m: any) =>
                  m.userId !== currentUserIdRef.current &&
                  (!lastRead || new Date(m.createdAt) > new Date(lastRead))
              );
              setUnreadCount(unreads.length);
            }

            scrollToBottom();
          }
        })
        .catch(console.error);
    };

    loadMessages();

    // Fallback sync polling every 5 seconds
    const interval = setInterval(loadMessages, 5000);

    // Realtime channel
    const channel = supabase
      .channel(`chat_room_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg && newMsg.user_id !== currentUserIdRef.current) {
            if (collapsedRef.current) {
              setUnreadCount((prev) => prev + 1);
            }
          }
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
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typingName = payload.payload?.userName;
        if (typingName && typingName !== currentUserNameRef.current) {
          setTypingUsers((prev) => Array.from(new Set([...prev, typingName])));
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers([]);
          }, 2500);
        }
      })
      .subscribe();

    activeChannelRef.current = channel;

    return () => {
      clearInterval(interval);
      activeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [channelId, supabase]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (!channelId || !activeChannelRef.current) return;

    // Broadcast typing event (throttled)
    activeChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userName: currentUserName },
    });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !channelId) return;

    const parentId = replyingTo ? replyingTo.id : null;
    setInputText('');
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const optimisticMessage = {
      id: tempId,
      projectId,
      channelId,
      userId: currentUserId,
      parentId,
      content: text,
      isPinned: false,
      isEdited: false,
      createdAt: new Date().toISOString(),
      author: {
        id: currentUserId,
        full_name: currentUserName,
        avatar_url: null,
      },
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/v1/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, parentId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? data.message : m))
          );
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (messageId: string, currentPinned: boolean) => {
    try {
      await fetch(`/api/v1/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !currentPinned } : m))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editMsgContent.trim()) return;

    try {
      const res = await fetch(`/api/v1/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editMsgContent.trim() }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: editMsgContent.trim(), isEdited: true } : m
          )
        );
        setEditingMsgId(null);
        setEditMsgContent('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const res = await fetch(`/api/v1/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: 'This message was deleted.', isDeleted: true } : m
          )
        );
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

      const res = await fetch(`/api/v1/channels/${channelId}/messages`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  };

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

  // Composer Format Shortcuts
  const applyFormat = (syntax: 'bold' | 'italic' | 'code' | 'list' | 'link') => {
    switch (syntax) {
      case 'bold':
        setInputText((prev) => `${prev}**bold text**`);
        break;
      case 'italic':
        setInputText((prev) => `${prev}*italic text*`);
        break;
      case 'code':
        setInputText((prev) => `${prev}\`code\``);
        break;
      case 'list':
        setInputText((prev) => `${prev}\n- List item`);
        break;
      case 'link':
        const url = prompt('Enter destination URL:');
        if (url) setInputText((prev) => `${prev}[Link Title](${url})`);
        break;
    }
    inputRef.current?.focus();
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

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const displayedMessages = messages.filter((m) => {
    if (!searchQuery) return true;
    return m.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (collapsed) {
    const hasUnread = unreadCount > 0;
    return (
      <div
        className={`hidden lg:flex flex-col items-center py-4 rounded-xl shadow-subtle shrink-0 w-12 justify-between transition-colors border ${
          hasUnread
            ? 'bg-blue-50/70 border-primary ring-1 ring-primary/25'
            : 'bg-white border-border'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            setUnreadCount(0);
          }}
          className={`p-2 rounded-lg transition-colors relative ${
            hasUnread
              ? 'bg-primary text-white hover:bg-primary/90 shadow-xs'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title={
            hasUnread
              ? `Open Project Chat (${unreadCount} new message${unreadCount > 1 ? 's' : ''})`
              : 'Open Project Chat'
          }
          aria-label="Open Project Chat"
        >
          <ChevronLeft className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </button>

        <div className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold flex items-center gap-2">
          <div className="relative">
            <MessageSquare
              className={`h-4 w-4 ${hasUnread ? 'text-primary fill-primary/30' : 'text-primary'}`}
            />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-ping" />
            )}
          </div>
          <span className={hasUnread ? 'text-primary font-bold' : 'text-gray-500'}>
            Project Chat
          </span>
          {hasUnread && (
            <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-bold shadow-xs [writing-mode:horizontal-tb]">
              {unreadCount}
            </span>
          )}
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
      <div className="p-3 border-b border-border bg-white shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-bold text-gray-900">#general</h2>
            <span className="text-[10px] text-gray-400 font-medium">Realtime</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1 rounded-lg transition-colors ${
                showSearch ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Search in chat"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
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

        {/* In-Chat Search Bar */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search in this channel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1 text-xs rounded-lg border border-border bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Pinned Messages Header Banner */}
        {pinnedMessages.length > 0 && !showSearch && (
          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900">
            <Pin className="h-3 w-3 text-amber-600 shrink-0 fill-amber-500" />
            <span className="font-semibold truncate flex-1">
              Pinned: {pinnedMessages[pinnedMessages.length - 1].content.slice(0, 45)}...
            </span>
            <span className="text-[10px] text-amber-700 font-bold shrink-0">
              ({pinnedMessages.length})
            </span>
          </div>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3 space-y-3.5 overflow-y-auto bg-gray-50/40">
        {displayedMessages.map((m) => {
          const isOwner = currentUserId === m.userId;
          const sanitizedContent = DOMPurify.sanitize(m.content);
          const parentMsg = m.parentId ? messages.find((p) => p.id === m.parentId) : null;

          return (
            <div
              key={m.id}
              className={`group relative flex items-start gap-2.5 text-xs ${
                m.isPinned ? 'bg-amber-50/40 p-2 rounded-xl border border-amber-200/50' : ''
              }`}
            >
              {/* Avatar */}
              <div className="h-6 w-6 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center shrink-0 uppercase mt-0.5 shadow-2xs">
                {m.author?.full_name ? m.author.full_name.charAt(0) : 'U'}
              </div>

              <div className="flex-1 min-w-0">
                {/* Replying context badge */}
                {parentMsg && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                    <CornerUpLeft className="h-2.5 w-2.5" />
                    <span className="italic truncate">
                      Replying to {parentMsg.author?.full_name || 'Member'}: {parentMsg.content.slice(0, 30)}...
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 text-[11px]">
                      {m.author?.full_name || 'Member'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {format(new Date(m.createdAt), 'h:mm a')}
                    </span>
                    {m.isEdited && (
                      <span className="text-[9px] text-gray-400 font-medium">(edited)</span>
                    )}
                    {m.isPinned && (
                      <Pin className="h-2.5 w-2.5 text-amber-600 fill-amber-500" />
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    {/* Reply in thread */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(m);
                        inputRef.current?.focus();
                      }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800"
                      title="Reply"
                    >
                      <CornerUpLeft className="h-3 w-3" />
                    </button>

                    {/* Toggle Pin */}
                    <button
                      type="button"
                      onClick={() => handleTogglePin(m.id, !!m.isPinned)}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        m.isPinned ? 'text-amber-600' : 'text-gray-500 hover:text-gray-800'
                      }`}
                      title={m.isPinned ? 'Unpin message' : 'Pin message'}
                    >
                      <Pin className="h-3 w-3" />
                    </button>

                    {/* Convert to task */}
                    <button
                      type="button"
                      onClick={() => handleConvertToTask(m)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800"
                      title="Convert to Task"
                    >
                      <CheckSquare className="h-3 w-3" />
                    </button>

                    {/* Add reaction */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)
                      }
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800"
                      title="React"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>

                    {/* Edit own message */}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(m.id);
                          setEditMsgContent(m.content);
                        }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800"
                        title="Edit message"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                    )}

                    {/* Delete own or moderate */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(m.id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
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

                {/* Message Body or Inline Edit */}
                {editingMsgId === m.id ? (
                  <div className="mt-1 space-y-1.5">
                    <input
                      type="text"
                      value={editMsgContent}
                      onChange={(e) => setEditMsgContent(e.target.value)}
                      className="w-full text-xs p-1.5 border border-primary rounded-lg focus:outline-none"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingMsgId(null)}
                        className="px-2 py-0.5 rounded text-[10px] border border-border text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(m.id)}
                        className="px-2 py-0.5 rounded text-[10px] bg-primary text-white font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`text-gray-800 text-xs mt-0.5 leading-relaxed break-words ${
                      m.content === 'This message was deleted.' ? 'italic text-gray-400' : ''
                    }`}
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />
                )}

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

        {displayedMessages.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-400">
            {searchQuery ? 'No messages match your search.' : 'No messages yet in #general. Say hello!'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      {typingUsers.length > 0 && (
        <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500 italic">
          {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
        </div>
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="px-3 py-1.5 bg-primary/5 border-t border-primary/20 flex items-center justify-between text-xs text-primary">
          <div className="flex items-center gap-1.5 truncate">
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="font-semibold text-[11px]">
              Replying to {replyingTo.author?.full_name || 'Member'}:
            </span>
            <span className="text-[11px] text-gray-600 truncate">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-0.5 text-gray-400 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Composer Toolbar & Input */}
      <div className="p-3 border-t border-border bg-white shrink-0 space-y-2">
        {/* Formatting Shortcuts */}
        <div className="flex items-center gap-1 text-gray-400 border-b border-gray-100 pb-1.5">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Bold"
          >
            <Bold className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('italic')}
            className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Italic"
          >
            <Italic className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('code')}
            className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Code block"
          >
            <Code className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('list')}
            className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
            title="List"
          >
            <List className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat('link')}
            className="p-1 hover:text-gray-700 rounded hover:bg-gray-100"
            title="Insert link"
          >
            <LinkIcon className="h-3 w-3" />
          </button>
        </div>

        <form onSubmit={handleSendMessage} className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Write a message in #general..."
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
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
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
