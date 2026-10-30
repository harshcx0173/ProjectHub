'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Users,
  User,
  Send,
  Check,
  X,
  Loader2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  rawName: string | null;
  avatarUrl: string | null;
  subtitle: string;
  membersCount: number;
  members: any[];
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
  const [sending, setSending] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Chat Modal state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'direct' | 'group'>('direct');
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
      setMessages(Array.isArray(data.messages) ? data.messages : []);
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

    // Live polling for responsive chat (every 3 seconds)
    const interval = setInterval(() => {
      fetchMessages(selectedConvId);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConvId, fetchMessages]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch available users when new chat modal opens
  useEffect(() => {
    if (!isNewChatOpen) return;
    setLoadingUsers(true);
    setModalError(null);
    fetch('/api/v1/admin/users')
      .then((r) => r.json())
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

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputMessage.trim();
    if (!content || !selectedConvId || sending) return;

    setSending(true);
    setInputMessage('');

    // Optimistic message
    const tempMsg: MessageItem = {
      id: crypto.randomUUID(),
      conversationId: selectedConvId,
      senderId: 'self',
      senderName: 'You',
      senderAvatar: null,
      senderRole: 'Member',
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSelf: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      // Refresh to get server timestamps
      fetchMessages(selectedConvId);
      fetchConversations(selectedConvId);
    } catch {
      // Retain optimistic message
    } finally {
      setSending(false);
    }
  };

  // Start 1v1 Direct Message
  const handleStartDirectMessage = async (targetUserId: string) => {
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
    }
  };

  // Create Teams-style Group Chat
  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || selectedMemberIds.length === 0) {
      setModalError('Please provide a group name and select at least one member.');
      return;
    }

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
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedConvId(c.id)}
                  className={`w-full p-3 text-left flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div className="relative shrink-0">
                    {c.type === 'group' ? (
                      <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200">
                        <Users className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                        {c.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  {/* Content snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
                      {c.latestMessage && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {format(new Date(c.latestMessage.createdAt), 'h:mm a')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {c.latestMessage
                        ? `${c.latestMessage.senderName}: ${c.latestMessage.content}`
                        : c.subtitle}
                    </p>
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
            {/* Active Header */}
            <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                {selectedConversation.type === 'group' ? (
                  <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    <Users className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {selectedConversation.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <h2 className="text-xs font-bold text-gray-900 leading-tight">
                    {selectedConversation.name}
                  </h2>
                  <p className="text-[11px] text-gray-400 leading-tight">
                    {selectedConversation.subtitle}
                  </p>
                </div>
              </div>

              {selectedConversation.type === 'group' && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border border-border">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <span>{selectedConversation.membersCount} participants</span>
                </div>
              )}
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAF9F6]">
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
                messages.map((m) => {
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-2.5 ${m.isSelf ? 'justify-end' : 'justify-start'}`}
                    >
                      {!m.isSelf && (
                        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                          {m.senderName?.[0]?.toUpperCase() || 'M'}
                        </div>
                      )}

                      <div className={`max-w-md ${m.isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!m.isSelf && (
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[11px] font-semibold text-gray-900">{m.senderName}</span>
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-gray-100 text-gray-500">
                              {m.senderRole}
                            </span>
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs ${
                            m.isSelf
                              ? 'bg-primary text-white rounded-br-xs'
                              : 'bg-white border border-border text-gray-900 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </div>

                        <span className="text-[10px] text-gray-400 mt-1 px-1">
                          {format(new Date(m.createdAt), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-border flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message... (Press Enter to send)"
                className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-gray-50/50 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || sending}
                className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-40 transition-colors shadow-subtle shrink-0"
              >
                {sending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
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
                            onClick={() => handleStartDirectMessage(u.id)}
                            className="w-full p-2.5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
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
                            <span className="text-[11px] font-semibold text-primary">Chat</span>
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
                      disabled={!newGroupName.trim() || selectedMemberIds.length === 0}
                      className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-subtle disabled:opacity-40 transition-colors flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Create Group</span>
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
