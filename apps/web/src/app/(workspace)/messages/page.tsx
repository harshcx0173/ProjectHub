'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Users,
  User,
  Send,
  Check,
  CheckCheck,
  X,
  Loader2,
  Phone,
  Video,
  UserPlus,
  Paperclip,
  Smile,
  ThumbsUp,
  Heart,
  Copy,
  AtSign,
  Bold,
  Italic,
  Code,
  FileText,
  Download,
  CornerUpLeft,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { renderMessageWithMentions, isUserMentioned } from '@/lib/mentions';
import { MentionCandidate } from '@/lib/mention-suggestions';
import { MentionSuggestionsDropdown, useMentionSuggestions } from '@/components/chat/MentionSuggestionsDropdown';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  rawName: string | null;
  avatarUrl: string | null;
  subtitle: string;
  membersCount: number;
  members: any[];
  unreadCount?: number;
  hasUnreadMention?: boolean;
  latestMessage: {
    id: string;
    content: string;
    senderName: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderRole: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isSelf: boolean;
}

interface UserOption {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  designation: string | null;
  orgRole: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string; email?: string } | null>(null);

  // Teams Chat tabs & interaction state
  const [activeHeaderTab, setActiveHeaderTab] = useState<'chat' | 'files'>('chat');
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, number>>>({});
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [sharedFiles, setSharedFiles] = useState<
    { id: string; name: string; size: string; type: string; date: string; author: string }[]
  >([
    {
      id: 'f1',
      name: 'Sprint_Kickoff_Specs.pdf',
      size: '2.4 MB',
      type: 'pdf',
      date: 'Today at 10:30 AM',
      author: 'Harsh Mevada',
    },
    {
      id: 'f2',
      name: 'Teams_Architecture_Diagram.png',
      size: '840 KB',
      type: 'image',
      date: 'Yesterday at 4:15 PM',
      author: 'Test Member User',
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New Chat Modal state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'direct' | 'group'>('direct');
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const selectedConvIdRef = useRef<string | null>(selectedConvId);
  const conversationsRef = useRef<Conversation[]>(conversations);
  const currentUserIdRef = useRef<string | null>(currentUserId);
  const currentUserRef = useRef<{ id: string; fullName: string; email?: string } | null>(null);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
  }, [selectedConvId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const supabase = useMemo(() => createClient(), []);

  // Fetch current user
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
            setCurrentUser({
              id: data.user.id,
              fullName: profile?.full_name || '',
              email: data.user.email || '',
            });
          });
      }
    });
  }, [supabase]);

  // Fetch Conversations
  const fetchConversations = useCallback(async (selectIdAfter?: string) => {
    try {
      const res = await fetch('/api/v1/messages/conversations');
      if (!res.ok) return;
      const data = await res.json();
      const list: Conversation[] = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list);

      if (selectIdAfter) {
        setSelectedConvId(selectIdAfter);
      } else if (!selectedConvId && list.length > 0 && list[0]?.id) {
        setSelectedConvId(list[0].id);
      }
    } catch {} finally {
      setLoadingConversations(false);
    }
  }, [selectedConvId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch Messages for Selected Conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/v1/messages/conversations/${convId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const serverMsgs: MessageItem[] = Array.isArray(data.messages) ? data.messages : [];
      setMessages((prev) => {
        // Retain any pending optimistic messages that haven't finalized yet
        const pendingOptimistic = prev.filter((m) => m.id.startsWith('temp-') && !serverMsgs.some((s) => s.content === m.content));
        return [...serverMsgs, ...pendingOptimistic];
      });
    } catch {} finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    fetchMessages(selectedConvId);

    // Fallback sync polling every 5 seconds
    const interval = setInterval(() => {
      fetchMessages(selectedConvId);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConvId, fetchMessages]);

  // Realtime subscription for instant message delivery
  useEffect(() => {
    const channel = supabase
      .channel('realtime_conversation_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          const activeId = selectedConvIdRef.current;
          const uid = currentUserIdRef.current;
          const convList = conversationsRef.current;

          // 1. If currently in this conversation, append or replace optimistic message instantly
          if (newMsg.conversation_id === activeId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }

              const isSelf = Boolean(uid && newMsg.sender_id === uid);
              const tempIndex = prev.findIndex(
                (m) => m.id.startsWith('temp-') && m.content === newMsg.content && m.isSelf
              );

              let senderName = isSelf ? 'You' : 'Member';
              let senderAvatar: string | null = null;
              let senderRole = 'Member';

              const activeConv = convList.find((c) => c.id === newMsg.conversation_id);
              if (activeConv?.members) {
                const mem = activeConv.members.find((m: any) => m.id === newMsg.sender_id);
                if (mem) {
                  senderName = mem.full_name || mem.fullName || 'Member';
                  senderAvatar = mem.avatar_url || mem.avatarUrl || null;
                  senderRole = mem.org_role || mem.orgRole || 'Member';
                }
              }

              const formattedItem: MessageItem = {
                id: newMsg.id,
                conversationId: newMsg.conversation_id,
                senderId: newMsg.sender_id,
                senderName,
                senderAvatar,
                senderRole,
                content: newMsg.content,
                createdAt: newMsg.created_at,
                updatedAt: newMsg.updated_at || newMsg.created_at,
                isSelf,
              };

              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = formattedItem;
                return updated;
              }

              return [...prev, formattedItem];
            });
          }

          // 2. Update conversation list preview and move active chat to top
          setConversations((prev) => {
            const convIndex = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (convIndex === -1) {
              fetchConversations();
              return prev;
            }

            const existingConv = prev[convIndex];
            if (!existingConv) return prev;

            const targetConv: Conversation = { ...existingConv };
            let senderName = 'Member';
            const mem = targetConv.members?.find((m: any) => m.id === newMsg.sender_id);
            if (mem) {
              senderName = mem.full_name || mem.fullName || 'Member';
            }

            targetConv.latestMessage = {
              id: newMsg.id,
              content: newMsg.content,
              senderName,
              createdAt: newMsg.created_at,
            };
            targetConv.updatedAt = newMsg.created_at;

            const isCurrentlySelected = activeId === newMsg.conversation_id;
            const isFromSelf = Boolean(uid && newMsg.sender_id === uid);
            const isMentioned = currentUserRef.current
              ? isUserMentioned(newMsg.content, currentUserRef.current)
              : false;

            if (!isCurrentlySelected && !isFromSelf) {
              targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;
              if (isMentioned) {
                targetConv.hasUnreadMention = true;
              }
            } else if (isCurrentlySelected) {
              targetConv.unreadCount = 0;
              targetConv.hasUnreadMention = false;
            }

            const remaining = prev.filter((_, idx) => idx !== convIndex);
            return [targetConv, ...remaining];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchConversations]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-load available users for mentions and new chat
  useEffect(() => {
    fetch('/api/v1/users')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.users)) {
          setAvailableUsers(
            data.users.map((u: any) => ({
              id: u.id,
              fullName: u.full_name || 'Member',
              avatarUrl: u.avatar_url || null,
              designation: u.designation || null,
              orgRole: u.org_role || 'Member',
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Fetch available users when new chat modal opens
  useEffect(() => {
    if (!isNewChatOpen) return;
    setLoadingUsers(true);
    setModalError(null);
    fetch('/api/v1/users')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.message || 'Failed to load team members');
        }
        return data;
      })
      .then((data) => {
        const users = Array.isArray(data.users)
          ? data.users.map((u: any) => ({
              id: u.id,
              fullName: u.fullName || u.full_name || 'Member',
              avatarUrl: u.avatarUrl || u.avatar_url || null,
              designation: u.designation || null,
              orgRole: u.orgRole || u.org_role || 'Member',
            }))
          : [];
        setAvailableUsers(users);
      })
      .catch((err) => setModalError(err.message))
      .finally(() => setLoadingUsers(false));
  }, [isNewChatOpen]);

  // Realtime typing indicator channel
  useEffect(() => {
    if (!selectedConvId) return;
    const channel = supabase
      .channel(`realtime_typing_${selectedConvId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName } = (payload.payload || {}) as any;
        if (userId && userId !== currentUserIdRef.current) {
          setTypingUsers((prev) => {
            if (prev.some((u) => u.id === userId)) return prev;
            return [...prev, { id: userId, name: userName || 'Colleague' }];
          });
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, supabase]);

  // Format date grouping divider (Teams style)
  const formatTeamsDateDivider = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      if (isToday(d)) return 'Today';
      if (isYesterday(d)) return 'Yesterday';
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Broadcast typing event debounced
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (selectedConvId && currentUserIdRef.current && currentUserRef.current?.fullName) {
      if (!typingTimeoutRef.current) {
        const channel = supabase.channel(`realtime_typing_${selectedConvId}`);
        channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: currentUserIdRef.current,
            userName: currentUserRef.current.fullName,
          },
        });
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = null;
        }, 2500);
      }
    }
  };

  // Teams Composer Formatting Tools
  const handleFormatBold = () => {
    setInputMessage((prev) => `${prev}**bold text** `);
    chatInputRef.current?.focus();
  };

  const handleFormatItalic = () => {
    setInputMessage((prev) => `${prev}*italic text* `);
    chatInputRef.current?.focus();
  };

  const handleFormatCode = () => {
    setInputMessage((prev) => `${prev}\`code snippet\` `);
    chatInputRef.current?.focus();
  };

  const handleTriggerMention = () => {
    setInputMessage((prev) => (prev.endsWith(' ') || prev === '' ? `${prev}@` : `${prev} @`));
    chatInputRef.current?.focus();
  };

  // Teams Quick Reaction Toggler
  const handleToggleReaction = (msgId: string, reaction: 'thumbsUp' | 'heart' | 'smile') => {
    setMessageReactions((prev) => {
      const existing = prev[msgId] || {};
      const count = existing[reaction] || 0;
      return {
        ...prev,
        [msgId]: {
          ...existing,
          [reaction]: count > 0 ? 0 : 1,
        },
      };
    });
  };

  // Copy message to clipboard with visual feedback
  const handleCopyMessage = (msg: MessageItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg.content);
      setCopiedMsgId(msg.id);
      setTimeout(() => {
        setCopiedMsgId((curr) => (curr === msg.id ? null : curr));
      }, 2000);
    }
  };

  // File upload simulation for Teams Files tab
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newFile = {
      id: `file-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: file.type.includes('image') ? 'image' : 'document',
      date: 'Just now',
      author: currentUser?.fullName || 'You',
    };

    setSharedFiles((prev) => [newFile, ...prev]);
    // Notify in chat about the shared file
    setInputMessage((prev) => `${prev} [Attachment: ${file.name}] `);
    e.target.value = '';
  };

  // Send Message with instant optimistic UI update
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let content = inputMessage.trim();
    if (!content || !selectedConvId) return;

    if (replyingTo) {
      content = `> Replying to ${replyingTo.senderName}: "${replyingTo.content.slice(0, 60)}..."\n\n${content}`;
      setReplyingTo(null);
    }

    // Reset input immediately so user can type next message without blocking
    setInputMessage('');
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Optimistic message
    const tempMsg: MessageItem = {
      id: tempId,
      conversationId: selectedConvId,
      senderId: currentUserId || 'self',
      senderName: 'You',
      senderAvatar: null,
      senderRole: 'Member',
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSelf: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    // Optimistically update conversation sidebar preview
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedConvId);
      if (idx === -1) return prev;
      const existingConv = prev[idx];
      if (!existingConv) return prev;

      const target: Conversation = { ...existingConv };
      target.latestMessage = {
        id: tempId,
        content,
        senderName: 'You',
        createdAt: tempMsg.createdAt,
      };
      target.updatedAt = tempMsg.createdAt;
      const remaining = prev.filter((_, i) => i !== idx);
      return [target, ...remaining];
    });

    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const data = await res.json();
      if (data?.message) {
        const realMsg = data.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...realMsg, isSelf: true } : m))
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  latestMessage: {
                    id: realMsg.id,
                    content: realMsg.content,
                    senderName: 'You',
                    createdAt: realMsg.createdAt,
                  },
                }
              : c
          )
        );
      }
    } catch {
      // Retain optimistic message
    }
  };

  // Start 1v1 Direct Message
  const handleStartDirectMessage = async (targetUserId: string) => {
    if (startingChatUserId) return;
    setStartingChatUserId(targetUserId);
    try {
      const res = await fetch('/api/v1/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', targetUserId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start chat');

      setIsNewChatOpen(false);
      fetchConversations(data.conversationId);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setStartingChatUserId(null);
    }
  };

  // Create Teams-style Group Chat
  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMemberIds.length === 0 || isCreatingGroup) {
      setModalError('Please provide a group name and select at least one member.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const res = await fetch('/api/v1/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'group',
          name: newGroupName.trim(),
          memberIds: selectedMemberIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create group');

      setIsNewChatOpen(false);
      setNewGroupName('');
      setSelectedMemberIds([]);
      fetchConversations(data.conversationId);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Filtered Conversations
  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'direct' && c.type !== 'direct') return false;
    if (activeTab === 'group' && c.type !== 'group') return false;
    if (searchQuery.trim()) {
      return (
        c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        c.subtitle.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
    }
    return true;
  });

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  const mentionCandidates: MentionCandidate[] = useMemo(() => {
    const list: MentionCandidate[] = [];
    if (selectedConversation?.type === 'group') {
      list.push({
        id: 'broadcast-everyone',
        name: 'everyone',
        subtitle: 'Notify everyone in this channel',
        isBroadcast: true,
      });
      list.push({
        id: 'broadcast-all',
        name: 'all',
        subtitle: 'Notify all group members',
        isBroadcast: true,
      });
    }

    const convMembers = (selectedConversation?.members || [])
      .filter((m: any) => m && m.id !== currentUserId)
      .map((m: any) => ({
        id: m.id,
        name: m.full_name || m.fullName || 'Member',
        avatarUrl: m.avatar_url || m.avatarUrl || null,
        subtitle: m.designation || m.org_role || m.orgRole || 'Member',
        role: m.org_role || m.orgRole || null,
      }));

    list.push(...convMembers);

    const otherUsers = availableUsers
      .filter((u) => u.id !== currentUserId && !list.some((existing) => existing.id === u.id))
      .map((u) => ({
        id: u.id,
        name: u.fullName,
        avatarUrl: u.avatarUrl,
        subtitle: u.designation || u.orgRole || 'Member',
        role: u.orgRole,
      }));

    list.push(...otherUsers);
    return list;
  }, [selectedConversation, currentUserId, availableUsers]);

  const mention = useMentionSuggestions({
    candidates: mentionCandidates,
    text: inputMessage,
    setText: setInputMessage,
    inputRef: chatInputRef,
  });

  return (
    <div className="flex-1 flex h-full bg-[#FAF9F6] overflow-hidden select-none">
      {/* Left Sidebar: Conversations List */}
      <div className="w-80 border-r border-border bg-white flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 tracking-tight">Messages</h1>
              <p className="text-[11px] text-gray-500">1v1 DMs & Group Channels</p>
            </div>
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
            title="Start new direct or group chat"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="p-3 space-y-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-gray-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100/70 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 rounded-md transition-colors text-center text-[11px] ${
                activeTab === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-1 rounded-md transition-colors text-center text-[11px] ${
                activeTab === 'direct' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`flex-1 py-1 rounded-md transition-colors text-center text-[11px] ${
                activeTab === 'group' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loadingConversations ? (
            <div className="p-8 text-center text-xs text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-gray-300" />
              <span>Loading messages...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">No conversations</p>
              <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                Start a 1v1 direct message or create a group chat.
              </p>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
              >
                + Start First Chat
              </button>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = c.id === selectedConvId;
              const hasUnread = Boolean(c.unreadCount && c.unreadCount > 0 && !isSelected);

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedConvId(c.id);
                    // Mark as read locally immediately
                    setConversations((prev) =>
                      prev.map((item) => (item.id === c.id ? { ...item, unreadCount: 0, hasUnreadMention: false } : item))
                    );
                  }}
                  className={`w-full p-3 text-left flex items-start gap-3 transition-colors relative ${
                    isSelected
                      ? 'bg-primary/10 border-l-3 border-primary'
                      : hasUnread
                      ? 'bg-blue-50/70 hover:bg-blue-50 border-l-3 border-primary'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div className="relative shrink-0">
                    {c.type === 'group' ? (
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs border ${
                          hasUnread
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-purple-100 text-purple-700 border-purple-200'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                      </div>
                    ) : (
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs border ${
                          hasUnread
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}
                      >
                        {c.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />
                    )}
                  </div>

                  {/* Content snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs truncate ${
                          hasUnread ? 'font-bold text-gray-950' : 'font-semibold text-gray-900'
                        }`}
                      >
                        {c.name}
                      </p>
                      {c.latestMessage && (
                        <span
                          className={`text-[10px] shrink-0 ${
                            hasUnread ? 'text-primary font-bold' : 'text-gray-400'
                          }`}
                        >
                          {format(new Date(c.latestMessage.createdAt), 'h:mm a')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <p
                        className={`text-[11px] truncate ${
                          hasUnread ? 'font-semibold text-gray-900' : 'text-gray-500'
                        }`}
                      >
                        {c.latestMessage
                          ? `${c.latestMessage.senderName}: ${c.latestMessage.content}`
                          : c.subtitle}
                      </p>
                      {hasUnread && (
                        <div className="flex items-center gap-1 shrink-0">
                          {c.hasUnreadMention && (
                            <span
                              className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold shadow-xs animate-pulse"
                              title="You were mentioned in an unread message"
                            >
                              @
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px] font-bold shadow-xs">
                            {c.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat View */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedConversation ? (
          <>
            {/* Teams Active Header */}
            <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {selectedConversation.type === 'group' ? (
                    <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200">
                      <Users className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                      {selectedConversation.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  {selectedConversation.type === 'direct' && (
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                      title="Available"
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-gray-900 leading-tight">
                      {selectedConversation.name}
                    </h2>
                    {selectedConversation.type === 'group' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        Group
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1.5 leading-tight mt-0.5">
                    {selectedConversation.type === 'direct' ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Available • Teams Chat</span>
                      </>
                    ) : (
                      <span>{selectedConversation.membersCount} participants • Teams Group</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Teams Header Tabs: Chat & Files */}
              <div className="flex items-center gap-1 self-stretch pt-2">
                <button
                  type="button"
                  onClick={() => setActiveHeaderTab('chat')}
                  className={`h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                    activeHeaderTab === 'chat'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHeaderTab('files')}
                  className={`h-full px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                    activeHeaderTab === 'files'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Files ({sharedFiles.length})</span>
                </button>
              </div>

              {/* Teams Header Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => alert('Starting video call...')}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Start video call"
                  aria-label="Start video call"
                >
                  <Video className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => alert('Starting audio call...')}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Start audio call"
                  aria-label="Start audio call"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(true)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Add members or start new chat"
                  aria-label="Add members"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* View Mode: Files Tab or Chat Stream */}
            {activeHeaderTab === 'files' ? (
              <div className="flex-1 overflow-y-auto p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Shared Files</h3>
                    <p className="text-xs text-gray-500">
                      Documents, images, and attachments shared in this conversation
                    </p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle transition-colors"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>Share File</span>
                    </button>
                  </div>
                </div>

                {sharedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                    <FileText className="h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-700">No files shared yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">
                      Files uploaded or sent in this chat will automatically appear here for easy access.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-gray-100">
                    {sharedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-900">{f.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {f.size} • Shared by {f.author} • {f.date}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert(`Downloading ${f.name}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors"
                          title="Download file"
                          aria-label="Download file"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Messages Thread (Teams Layout with Date Dividers & Mention Highlights) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-[#FAF9F6]">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full text-xs text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span>Loading message thread...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <MessageSquare className="h-8 w-8 mb-2 text-gray-300" />
                      <p className="text-xs font-semibold text-gray-700">No messages yet</p>
                      <p className="text-[11px] text-gray-500">Send a message to start the conversation.</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const prevMsg = idx > 0 ? messages[idx - 1] : null;
                      const isDifferentDay =
                        !prevMsg ||
                        new Date(prevMsg.createdAt).toDateString() !==
                          new Date(m.createdAt).toDateString();
                      const dateGroupLabel = isDifferentDay
                        ? formatTeamsDateDivider(m.createdAt)
                        : null;
                      const isMentioned = currentUser
                        ? isUserMentioned(m.content, currentUser)
                        : false;
                      const reactions = messageReactions[m.id] || {};

                      return (
                        <React.Fragment key={m.id}>
                          {/* Centered Teams Date Divider */}
                          {dateGroupLabel && (
                            <div className="relative flex items-center justify-center my-4">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                              </div>
                              <span className="relative bg-[#FAF9F6] px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                {dateGroupLabel}
                              </span>
                            </div>
                          )}

                          {/* Message Item */}
                          <div
                            className={`group relative flex items-start gap-2.5 ${
                              m.isSelf ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {/* Floating Hover Action Toolbar (Teams Style) */}
                            <div
                              className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3.5 ${
                                m.isSelf ? 'right-4' : 'left-8'
                              } bg-white border border-gray-200 shadow-sm rounded-lg flex items-center p-0.5 gap-0.5 z-10`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleReaction(m.id, 'thumbsUp')}
                                className={`p-1 rounded hover:bg-gray-100 text-xs transition-colors ${
                                  reactions['thumbsUp']
                                    ? 'text-primary font-bold bg-primary/10'
                                    : 'text-gray-500 hover:text-gray-900'
                                }`}
                                title="Thumbs Up"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleReaction(m.id, 'heart')}
                                className={`p-1 rounded hover:bg-gray-100 text-xs transition-colors ${
                                  reactions['heart']
                                    ? 'text-red-500 font-bold bg-red-50'
                                    : 'text-gray-500 hover:text-gray-900'
                                }`}
                                title="Heart"
                              >
                                <Heart className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleReaction(m.id, 'smile')}
                                className={`p-1 rounded hover:bg-gray-100 text-xs transition-colors ${
                                  reactions['smile']
                                    ? 'text-amber-500 font-bold bg-amber-50'
                                    : 'text-gray-500 hover:text-gray-900'
                                }`}
                                title="Smile"
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(m);
                                  chatInputRef.current?.focus();
                                }}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 text-xs transition-colors"
                                title="Quote Reply"
                              >
                                <CornerUpLeft className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(m)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 text-xs transition-colors"
                                title="Copy message"
                              >
                                {copiedMsgId === m.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>

                            {!m.isSelf && (
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                                {m.senderName?.[0]?.toUpperCase() || 'M'}
                              </div>
                            )}

                            <div
                              className={`max-w-md ${
                                m.isSelf ? 'items-end' : 'items-start'
                              } flex flex-col`}
                            >
                              {!m.isSelf && (
                                <div className="flex items-center gap-1.5 mb-1 px-1">
                                  <span className="text-[11px] font-semibold text-gray-900">
                                    {m.senderName}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-gray-100 text-gray-500">
                                    {m.senderRole}
                                  </span>
                                  {isMentioned && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                      <AtSign className="h-2.5 w-2.5" /> Mentioned you
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Message bubble with Teams Mention Highlight */}
                              <div
                                className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs transition-all ${
                                  isMentioned
                                    ? 'border-l-4 border-amber-500 bg-amber-50/80 border-amber-200 text-gray-900 ring-1 ring-amber-300/40 rounded-bl-xs'
                                    : m.isSelf
                                    ? 'bg-primary text-white rounded-br-xs'
                                    : 'bg-white border border-border text-gray-900 rounded-bl-xs'
                                }`}
                              >
                                <div className="whitespace-pre-wrap break-words">
                                  {renderMessageWithMentions(m.content, currentUser?.fullName)}
                                </div>
                              </div>

                              {/* Reactions Counter Row */}
                              {(reactions['thumbsUp'] ||
                                reactions['heart'] ||
                                reactions['smile']) && (
                                <div className="flex items-center gap-1 mt-1 px-1">
                                  {reactions['thumbsUp'] ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold">
                                      <ThumbsUp className="h-2.5 w-2.5" /> {reactions['thumbsUp']}
                                    </span>
                                  ) : null}
                                  {reactions['heart'] ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold">
                                      <Heart className="h-2.5 w-2.5 fill-red-500" />{' '}
                                      {reactions['heart']}
                                    </span>
                                  ) : null}
                                  {reactions['smile'] ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                                      <Smile className="h-2.5 w-2.5" /> {reactions['smile']}
                                    </span>
                                  ) : null}
                                </div>
                              )}

                              {/* Timestamp & Delivered Status */}
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 px-1">
                                <span>{format(new Date(m.createdAt), 'h:mm a')}</span>
                                {m.isSelf && (
                                  <span title="Delivered">
                                    <CheckCheck className="h-3 w-3 text-primary/70 inline" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Realtime Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-6 py-1.5 text-xs text-gray-500 flex items-center gap-2 italic bg-white border-t border-gray-100">
                    <span className="flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                    </span>
                    <span>
                      {typingUsers.map((u) => u.name).join(', ')}{' '}
                      {typingUsers.length > 1 ? 'are' : 'is'} typing...
                    </span>
                  </div>
                )}

                {/* Replying context banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-t border-border text-xs text-gray-600">
                    <div className="flex items-center gap-2 truncate">
                      <CornerUpLeft className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-gray-900">
                        Replying to {replyingTo.senderName}:
                      </span>
                      <span className="truncate italic text-gray-500">{replyingTo.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Teams Rich Composer Toolbar */}
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-t border-border text-gray-500">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleFormatBold}
                      className="p-1 rounded hover:bg-gray-200 hover:text-gray-800 transition-colors"
                      title="Bold (**text**)"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFormatItalic}
                      className="p-1 rounded hover:bg-gray-200 hover:text-gray-800 transition-colors"
                      title="Italic (*text*)"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFormatCode}
                      className="p-1 rounded hover:bg-gray-200 hover:text-gray-800 transition-colors"
                      title="Code snippet"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-3.5 w-px bg-gray-300 mx-1" />
                    <button
                      type="button"
                      onClick={handleTriggerMention}
                      className="p-1 rounded hover:bg-gray-200 hover:text-gray-800 transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Mention someone (@)"
                    >
                      <AtSign className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 rounded hover:bg-gray-200 hover:text-gray-800 transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    Type <kbd className="px-1 py-0.2 bg-gray-200 rounded text-gray-700">@</kbd> to
                    mention
                  </span>
                </div>

                {/* Teams Input Bar */}
                <form
                  onSubmit={(e) => {
                    if (mention.isOpen) {
                      e.preventDefault();
                      return;
                    }
                    handleSendMessage(e);
                  }}
                  className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 relative"
                >
                  <MentionSuggestionsDropdown
                    isOpen={mention.isOpen}
                    query={mention.query}
                    selectedIndex={mention.selectedIndex}
                    setSelectedIndex={mention.setSelectedIndex}
                    filteredCandidates={mention.filteredCandidates}
                    onSelect={mention.selectCandidate}
                    onClose={mention.close}
                  />
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (mention.handleKeyDown(e)) {
                        return;
                      }
                    }}
                    placeholder="Type a new message (Press Enter to send, type @ to mention)"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-gray-50/50 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-40 transition-colors shadow-subtle shrink-0"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">Select a conversation</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose an existing chat from the left or create a new 1v1 direct message or Teams group.
            </p>
          </div>
        )}
      </div>

      {/* New Chat Modal (1v1 or Teams-style Group) */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-border shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Start New Chat</h3>
                  <p className="text-[11px] text-gray-500">1v1 Direct Message or Group Chat</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="px-6 pt-3 flex gap-2 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setModalMode('direct')}
                className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  modalMode === 'direct'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>1v1 Direct Message</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('group')}
                className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  modalMode === 'group'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Create Group Chat (Teams)</span>
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="mx-6 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {modalError}
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6">
              {modalMode === 'direct' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search colleague by name..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 border border-border rounded-xl">
                    {loadingUsers ? (
                      <div className="p-6 text-center text-xs text-gray-400">Loading colleagues...</div>
                    ) : availableUsers.filter((u) =>
                        u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase().trim())
                      ).length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">No colleagues found</div>
                    ) : (
                      availableUsers
                        .filter((u) =>
                          u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase().trim())
                        )
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            disabled={Boolean(startingChatUserId)}
                            onClick={() => handleStartDirectMessage(u.id)}
                            className="w-full p-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                {u.fullName[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900">{u.fullName}</p>
                                <p className="text-[10px] text-gray-400">{u.orgRole}</p>
                              </div>
                            </div>
                            {startingChatUserId === u.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <span className="text-[11px] font-semibold text-primary">Chat</span>
                            )}
                          </button>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateGroupChat} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. Design Sync, Sprint Team"
                      className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select Members ({selectedMemberIds.length} selected)
                    </label>
                    <div className="max-h-44 overflow-y-auto divide-y divide-gray-50 border border-border rounded-xl p-1">
                      {availableUsers.map((u) => {
                        const isSelected = selectedMemberIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  setSelectedMemberIds((prev) =>
                                    prev.includes(u.id)
                                      ? prev.filter((id) => id !== u.id)
                                      : [...prev, u.id]
                                  )
                                }
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-0"
                              />
                              <span className="text-xs font-medium text-gray-900">{u.fullName}</span>
                            </div>
                            <span className="text-[10px] text-gray-400">{u.orgRole}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setIsNewChatOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newGroupName.trim() || selectedMemberIds.length === 0 || isCreatingGroup}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle disabled:opacity-40 transition-colors"
                    >
                      {isCreatingGroup ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Create Group</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
