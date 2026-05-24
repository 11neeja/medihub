'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ResizableSidebar from '@/components/ResizableSidebar';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  Search, Pin, MessageCircle, Users, Paperclip, FileText,
  ImageIcon, Info, Send, X, CheckCheck, Plus, Trash2,
  UserPlus, PinOff, Loader2, UserMinus
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  getConversationsAPI, getMessagesAPI, sendMessageAPI, sendFileMessageAPI,
  createPrivateConversationAPI, createGroupConversationAPI,
  togglePinConversationAPI, deleteConversationAPI,
  searchUsersAPI, getSharedFilesAPI,
  addGroupMembersAPI, removeGroupMemberAPI,
} from '@/lib/api';
import { io, Socket } from 'socket.io-client';

// Types
interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin?: boolean;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  text?: string;
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  documentId?: string;
  createdAt: string;
}

interface ConversationType {
  id: string;
  name: string;
  isGroup: boolean;
  isPinned: boolean;
  isAdmin: boolean;
  members: ChatUser[];
  lastMessage: {
    id: string;
    text?: string;
    fileName?: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface SharedFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  documentId?: string;
  senderName: string;
  createdAt: string;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export default function ChatPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const searchParams = useSearchParams();

  // State
  const [conversations, setConversations] = useState<ConversationType[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationType | null>(null);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChatInfo, setShowChatInfo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  // Modal states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Search users state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<ChatUser[]>([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<ChatUser[]>([]);

  // Add member to group state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
  const [addMemberSearchResults, setAddMemberSearchResults] = useState<ChatUser[]>([]);
  const [addMemberSelected, setAddMemberSelected] = useState<ChatUser[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversationsAPI();
      setConversations(data);
      return data;
    } catch (err) {
      console.error('Failed to load conversations:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('get_online_users');
    });

    socket.on('online_users_list', (users: string[]) => {
      setOnlineUsers(users);
    });

    socket.on('user_online', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => [...new Set([...prev, userId])]);
    });

    socket.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId));
    });

    socket.on('new_message', (message: ChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });

      // Update conversation list with latest message
      setConversations(prev =>
        prev.map(c =>
          c.id === message.conversationId
            ? {
                ...c,
                lastMessage: {
                  id: message.id,
                  text: message.text,
                  fileName: message.fileName,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  createdAt: message.createdAt,
                },
              }
            : c
        )
      );

      // Refresh shared files if it's a file message
      if (message.fileName) {
        setSharedFiles(prev => [
          {
            id: message.id,
            fileName: message.fileName!,
            fileUrl: message.fileUrl!,
            fileType: message.fileType!,
            documentId: message.documentId,
            senderName: message.senderName,
            createdAt: message.createdAt,
          },
          ...prev,
        ]);
      }
    });

    socket.on('user_typing', ({ conversationId, userName }: { conversationId: string; userId: string; userName: string }) => {
      setTypingUsers(prev => ({ ...prev, [conversationId]: userName }));
    });

    socket.on('user_stop_typing', ({ conversationId }: { conversationId: string; userId: string }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    });

    socket.on('conversation_deleted', ({ conversationId }: { conversationId: string }) => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setSelectedConv(prev => (prev?.id === conversationId ? null : prev));
    });

    socket.on('join_new_conversation', ({ conversationId }: { conversationId: string }) => {
      socket.emit('join_conversation', conversationId);
      loadConversations();
    });

    socket.on('members_updated', ({ conversationId }: { conversationId: string }) => {
      // Reload conversations to get updated member list
      loadConversations();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user) {
      loadConversations().then((convs) => {
        const convId = searchParams.get('conversationId');
        if (convId && convs.length > 0) {
          const target = convs.find((c: ConversationType) => c.id === convId);
          if (target) setSelectedConv(target);
        }
      });
    }
  }, [user, loadConversations, searchParams]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConv) return;
    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const data = await getMessagesAPI(selectedConv.id);
        setMessages(data);
        socketRef.current?.emit('join_conversation', selectedConv.id);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    };
    const loadFiles = async () => {
      try {
        const data = await getSharedFilesAPI(selectedConv.id);
        setSharedFiles(data);
      } catch (err) {
        console.error('Failed to load shared files:', err);
      }
    };
    loadMessages();
    loadFiles();
  }, [selectedConv]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConv]);

  // Filter conversations
  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedChats = filteredConversations.filter(c => c.isPinned);
  const privateChats = filteredConversations.filter(c => !c.isPinned && !c.isGroup);
  const groupChats = filteredConversations.filter(c => !c.isPinned && c.isGroup);

  // Get current conversation messages
  const chatMessages = selectedConv
    ? messages.filter(m => m.conversationId === selectedConv.id)
    : [];

  // Send message
  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !selectedConv) return;
    const text = newMessageText;
    setNewMessageText('');
    try {
      await sendMessageAPI(selectedConv.id, text);
      socketRef.current?.emit('stop_typing', { conversationId: selectedConv.id });
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessageText(text);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!fileInputRef.current?.files?.length || !selectedConv) return;
    const file = fileInputRef.current.files[0];
    try {
      await sendFileMessageAPI(selectedConv.id, file);
    } catch (err) {
      console.error('Failed to send file:', err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!selectedConv || !socketRef.current) return;
    socketRef.current.emit('typing', { conversationId: selectedConv.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { conversationId: selectedConv.id });
    }, 2000);
  };

  // Search users for new chat
  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const results = await searchUsersAPI(query);
      setSearchResults(results);
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Start private chat
  const handleStartPrivateChat = async (otherUser: ChatUser) => {
    try {
      const result = await createPrivateConversationAPI(otherUser.id);
      setShowNewChatModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
      const convs = await getConversationsAPI();
      setConversations(convs);
      const conv = convs.find((c: ConversationType) => c.id === result.id);
      if (conv) setSelectedConv(conv);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  // Group search
  const handleGroupSearch = async (query: string) => {
    setGroupSearchQuery(query);
    if (!query.trim()) {
      setGroupSearchResults([]);
      return;
    }
    try {
      const results = await searchUsersAPI(query);
      setGroupSearchResults(results.filter((u: ChatUser) => !selectedGroupMembers.some(m => m.id === u.id)));
    } catch (err) {
      console.error('Group search failed:', err);
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await createGroupConversationAPI(groupName, selectedGroupMembers.map(m => m.id));
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedGroupMembers([]);
      setGroupSearchQuery('');
      setGroupSearchResults([]);
      await loadConversations();
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Pin/unpin conversation
  const handleTogglePin = async (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const result = await togglePinConversationAPI(convId);
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, isPinned: result.isPinned } : c))
      );
      if (selectedConv?.id === convId) {
        setSelectedConv(prev => prev ? { ...prev, isPinned: result.isPinned } : null);
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    try {
      await deleteConversationAPI(selectedConv.id);
      setConversations(prev => prev.filter(c => c.id !== selectedConv.id));
      setSelectedConv(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Add member search
  const handleAddMemberSearch = async (query: string) => {
    setAddMemberSearchQuery(query);
    if (!query.trim()) {
      setAddMemberSearchResults([]);
      return;
    }
    try {
      const results = await searchUsersAPI(query);
      // Filter out users who are already members or already selected
      const existingIds = selectedConv?.members.map(m => m.id) || [];
      const selectedIds = addMemberSelected.map(m => m.id);
      setAddMemberSearchResults(
        results.filter((u: ChatUser) => !existingIds.includes(u.id) && !selectedIds.includes(u.id))
      );
    } catch (err) {
      console.error('Add member search failed:', err);
    }
  };

  // Add members to group
  const handleAddMembersToGroup = async () => {
    if (!selectedConv || addMemberSelected.length === 0) return;
    setAddingMembers(true);
    try {
      const result = await addGroupMembersAPI(selectedConv.id, addMemberSelected.map(m => m.id));
      // Update selected conversation members
      setSelectedConv(prev => prev ? { ...prev, members: result.members } : null);
      setConversations(prev =>
        prev.map(c => c.id === selectedConv.id ? { ...c, members: result.members } : c)
      );
      setShowAddMemberModal(false);
      setAddMemberSelected([]);
      setAddMemberSearchQuery('');
      setAddMemberSearchResults([]);
    } catch (err: any) {
      console.error('Failed to add members:', err);
      alert(err?.response?.data?.message || 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove member from group
  const handleRemoveMember = async (memberId: string) => {
    if (!selectedConv) return;
    try {
      const result = await removeGroupMemberAPI(selectedConv.id, memberId);
      setSelectedConv(prev => prev ? { ...prev, members: result.members } : null);
      setConversations(prev =>
        prev.map(c => c.id === selectedConv.id ? { ...c, members: result.members } : c)
      );
      setShowRemoveConfirm(null);
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      alert(err?.response?.data?.message || 'Failed to remove member');
    }
  };

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get role color
  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'Doctor': return 'bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)]';
      case 'Professor': return 'bg-[var(--color-blue-primary)/20] text-[var(--color-blue-primary)]';
      case 'Researcher': return 'bg-[var(--color-blue-soft)/50] text-[var(--color-blue-primary)]';
      default: return 'bg-[var(--color-blue-primary)/30] text-[var(--color-blue-primary)]';
    }
  };

  // Check if user is online
  const isUserOnline = (userId: string) => onlineUsers.includes(userId);

  // Get other user in private chat
  const getOtherUser = (conv: ConversationType) =>
    conv.members.find(m => m.id !== user?._id);

  // Handle save/download file
  const handleSaveToNotebook = (file: SharedFile) => {
    if (file.fileUrl) {
      window.open(`http://localhost:5000${file.fileUrl}`, '_blank');
    }
  };

  // Render conversation item
  const renderConversationItem = (conv: ConversationType) => {
    const otherUser = !conv.isGroup ? getOtherUser(conv) : null;
    const isOnline = otherUser ? isUserOnline(otherUser.id) : false;
    const typing = typingUsers[conv.id];

    return (
      <button
        key={conv.id}
        onClick={() => setSelectedConv(conv)}
        className={`w-full text-left p-4 border-b border-[var(--color-border-light)] hover:bg-[var(--color-accent-soft)]/40 transition-all group ${
          selectedConv?.id === conv.id ? 'bg-[var(--color-accent-soft)]' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
              {conv.isGroup ? (
                <div className="w-12 h-12 bg-[var(--color-blue-primary)] rounded-lg flex items-center justify-center text-white">
                  <Users className="w-5 h-5" />
                </div>
              ) : (
                <UserAvatar userId={otherUser?.id || conv.id} name={otherUser?.name || conv.name} size={48} />
              )}
            </div>
            {!conv.isGroup && isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
              <h3 className="font-semibold text-[var(--color-text-primary)] truncate">{conv.name}</h3>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {conv.lastMessage && (
                  <span className="text-xs text-slate-500">
                    {formatTime(conv.lastMessage.createdAt)}
                  </span>
                )}
                <button
                  onClick={(e) => handleTogglePin(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-all"
                  title={conv.isPinned ? 'Unpin' : 'Pin'}
                >
                  {conv.isPinned ? <PinOff className="w-3 h-3 text-slate-400" /> : <Pin className="w-3 h-3 text-slate-400" />}
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500 truncate">
              {typing
                ? <span className="text-[var(--color-blue-primary)] italic">{typing} is typing...</span>
                : conv.lastMessage?.text || conv.lastMessage?.fileName || 'No messages yet'}
            </p>
          </div>
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--color-blue-primary)] mx-auto mb-3" />
          <p className="text-slate-500">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen gradient-subtle flex flex-col">
      {/* Header */}
      <div className="card px-6 py-4">
        <h1 className="heading-lg fade-in-up">Messages</h1>
        <p className="body-sm text-slate-500 fade-in-delay-1">Chat with colleagues and collaborate in group conversations</p>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <ResizableSidebar side="left" defaultWidth={320} minWidth={240} maxWidth={480}>
          <aside className="w-full h-full bg-[var(--color-surface-muted)] border-r border-[var(--color-border-light)] flex flex-col">
            {/* Search & Actions */}
            <div className="p-4 border-b border-[var(--color-border-light)]">
              <div className="relative mb-3">
                  <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input pl-10" />
                  <span className="absolute left-3 top-2.5 text-slate-500"><Search className="w-4 h-4" /></span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowNewChatModal(true)} className="btn-primary flex-1 text-sm">
                    <span className="flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> New Chat</span>
                  </button>
                  <button onClick={() => setShowNewGroupModal(true)} className="btn-secondary flex-1 text-sm">
                    <span className="flex items-center justify-center gap-1.5"><Users className="w-4 h-4" /> New Group</span>
                  </button>
                </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {/* Pinned */}
              {pinnedChats.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-1">
                    <Pin className="w-3 h-3" /> PINNED
                  </div>
                  {pinnedChats.map(renderConversationItem)}
                </div>
              )}

              {/* Private Chats */}
              {privateChats.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> PRIVATE CHATS
                  </div>
                  {privateChats.map(renderConversationItem)}
                </div>
              )}

              {/* Groups */}
              {groupChats.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-1">
                    <Users className="w-3 h-3" /> GROUPS
                  </div>
                  {groupChats.map(renderConversationItem)}
                </div>
              )}

              {filteredConversations.length === 0 && !loading && (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">No conversations yet</p>
                  <p className="text-xs text-slate-400 mt-1">Start a new chat or create a group</p>
                </div>
              )}
            </div>
          </aside>
        </ResizableSidebar>

        {/* Center - Message Panel */}
        <main className="flex-1 flex flex-col bg-slate-50">
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="card px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                    {selectedConv.isGroup ? (
                      <div className="w-10 h-10 bg-[var(--color-blue-primary)] rounded-lg flex items-center justify-center text-white">
                        <Users className="w-4 h-4" />
                      </div>
                    ) : (
                      <UserAvatar userId={getOtherUser(selectedConv)?.id || selectedConv.id} name={getOtherUser(selectedConv)?.name || selectedConv.name} size={40} />
                    )}
                  </div>
                  <div>
                    <h2 className="heading-md">{selectedConv.name}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedConv.isGroup
                        ? `${selectedConv.members.length} members`
                        : (() => {
                            const other = getOtherUser(selectedConv);
                            return other && isUserOnline(other.id)
                              ? <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span> Online</span>
                              : 'Offline';
                          })()}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowChatInfo(!showChatInfo)} className="btn-secondary p-2">
                  <Info className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-blue-primary)]" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-[var(--color-blue-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-10 h-10 text-[var(--color-blue-primary)]" />
                      </div>
                      <h3 className="heading-md mb-2">No messages yet</h3>
                      <p className="body-sm text-slate-500">Start a conversation!</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((message) => {
                    const isSentByMe = message.senderId === user?._id;
                    const showSenderName = selectedConv.isGroup && !isSentByMe;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-md ${isSentByMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          {showSenderName && (
                            <span className="text-xs font-semibold text-[var(--color-text-primary)] ml-2">
                              {message.senderName}
                            </span>
                          )}
                          <div
                            className={`px-4 py-2.5 shadow-premium ${
                              isSentByMe ? 'message-sent' : 'message-received'
                            }`}
                          >
                            {message.text && <p className="body-sm">{message.text}</p>}

                            {message.fileName && (
                              <div className="flex items-center gap-3 min-w-[250px]">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isSentByMe ? 'bg-[var(--color-blue-primary)/30]' : 'bg-slate-50'}`}>
                                  {message.fileType === 'pdf' ? <FileText className="w-6 h-6" /> :
                                   message.fileType === 'image' ? <ImageIcon className="w-6 h-6" /> :
                                   <Paperclip className="w-6 h-6" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate">{message.fileName}</div>
                                  {message.fileUrl && (
                                    <a
                                      href={`http://localhost:5000${message.fileUrl}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`text-xs ${isSentByMe ? 'text-[var(--color-blue-soft)]' : 'text-[var(--color-blue-primary)]'} hover:underline`}
                                    >
                                      Download
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className={`text-xs mt-1 flex items-center gap-1 ${isSentByMe ? 'text-[var(--color-blue-soft)]' : 'text-slate-500'}`}>
                              {formatTime(message.createdAt)}
                              {isSentByMe && <CheckCheck className="w-3.5 h-3.5 ml-1" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Typing indicator */}
                {selectedConv && typingUsers[selectedConv.id] && (
                  <div className="flex justify-start">
                    <div className="card px-4 py-2">
                      <p className="body-sm text-slate-500 italic">{typingUsers[selectedConv.id]} is typing...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="card p-4 border-t">
                <div className="flex items-end gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-500 hover:text-[var(--color-blue-primary)] transition-all p-2 rounded-lg hover:bg-slate-50"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <textarea
                    value={newMessageText}
                    onChange={(e) => {
                      setNewMessageText(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="input flex-1 resize-none"
                    rows={1}
                  />
                  <button onClick={handleSendMessage} disabled={!newMessageText.trim()} className="btn-primary w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-50">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 ml-14">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-[var(--color-blue-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-12 h-12 text-[var(--color-blue-primary)]" />
                </div>
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Welcome to MediHub Chat</h2>
                <p className="text-slate-500">Select a conversation or start a new one</p>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel - Chat Info */}
        {selectedConv && showChatInfo && (
          <ResizableSidebar side="right" defaultWidth={320} minWidth={240} maxWidth={480}>
            <aside className="w-full h-full bg-[var(--color-surface-muted)] border-l border-[var(--color-border-light)] overflow-y-auto">
              <div className="p-6">
                {/* Chat Info Header */}
                <div className="text-center mb-6">
                  <div className="w-24 h-24 rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
                    {selectedConv.isGroup ? (
                      <div className="w-24 h-24 bg-[var(--color-blue-primary)] rounded-lg flex items-center justify-center text-white text-4xl font-bold">
                        <Users className="w-10 h-10" />
                      </div>
                    ) : (
                      <UserAvatar userId={getOtherUser(selectedConv)?.id || selectedConv.id} name={getOtherUser(selectedConv)?.name || selectedConv.name} size={96} />
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">{selectedConv.name}</h2>
                  <p className="text-sm text-slate-500">
                    {selectedConv.isGroup
                      ? `Group · ${selectedConv.members.length} members`
                      : getOtherUser(selectedConv)?.role || 'User'}
                  </p>
                </div>

                {/* Members */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-[var(--color-text-primary)]">
                      {selectedConv.isGroup ? 'Members' : 'Info'}
                    </h3>
                    {selectedConv.isGroup && selectedConv.isAdmin && (
                      <button
                        onClick={() => setShowAddMemberModal(true)}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--color-blue-primary)] hover:text-[var(--color-blue-primary)] bg-[var(--color-blue-soft)] hover:bg-[var(--color-blue-soft)] px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedConv.members.map(member => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-all group">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                            <UserAvatar userId={member.id} name={member.name} size={40} />
                          </div>
                          {isUserOnline(member.id) && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                            {member.name} {member.id === user?._id && '(You)'}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded inline-block ${getRoleColor(member.role)}`}>
                              {member.role}
                            </span>
                            {member.isAdmin && (
                              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Admin</span>
                            )}
                          </div>
                        </div>
                        {/* Remove button - visible to admins for non-self members */}
                        {selectedConv.isGroup && selectedConv.isAdmin && member.id !== user?._id && (
                          showRemoveConfirm === member.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-xs px-2 py-1 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setShowRemoveConfirm(null)}
                                className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded font-medium hover:bg-slate-300 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowRemoveConfirm(member.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                              title="Remove member"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shared Files */}
                <div className="mb-6">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">Shared Files</h3>
                  <div className="space-y-2">
                    {sharedFiles.map(file => (
                        <div key={file.id} className="card p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[var(--color-blue-primary)]">
                            {file.fileType === 'pdf' ? <FileText className="w-5 h-5" /> :
                             file.fileType === 'image' ? <ImageIcon className="w-5 h-5" /> :
                             <Paperclip className="w-5 h-5" />}
                          </span>
                          <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1 truncate">{file.fileName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">Shared by {file.senderName}</p>
                        <button
                          onClick={() => handleSaveToNotebook(file)}
                          className="w-full text-[var(--color-blue-primary)] hover:text-[var(--color-blue-primary)] text-xs font-semibold"
                        >
                          Download File →
                        </button>
                      </div>
                    ))}
                    {sharedFiles.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No shared files yet</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleTogglePin(selectedConv.id)}
                    className="w-full bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] py-2 rounded-lg font-semibold hover:bg-[var(--color-blue-soft)] transition-all flex items-center justify-center gap-2"
                  >
                    {selectedConv.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    {selectedConv.isPinned ? 'Unpin Chat' : 'Pin Chat'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-50 text-red-600 py-2 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {selectedConv.isGroup ? 'Delete Group' : 'Delete Chat'}
                  </button>
                </div>
              </div>
            </aside>
          </ResizableSidebar>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface-muted)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">New Conversation</h2>
              <button onClick={() => { setShowNewChatModal(false); setUserSearchQuery(''); setSearchResults([]); }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5 text-[var(--color-text-primary)]" />
              </button>
            </div>
            <p className="text-slate-500 mb-4 text-sm">Search for a user by name or email to start chatting.</p>
            <div className="relative mb-4">
              <input type="text" placeholder="Search users by name or email..." value={userSearchQuery} onChange={(e) => handleUserSearch(e.target.value)} className="input pl-10" autoFocus />
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 bg-white">
              {searchingUsers && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-blue-primary)] mx-auto" />
                </div>
              )}
              {!searchingUsers && searchResults.length === 0 && userSearchQuery && (
                <p className="text-center text-slate-400 py-4">No users found</p>
              )}
              {searchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleStartPrivateChat(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg card transition-all"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                      <UserAvatar userId={u.id} name={u.name} size={40} />
                    </div>
                    {isUserOnline(u.id) && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-[var(--color-text-primary)]">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${getRoleColor(u.role)}`}>{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface-muted)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Create Group</h2>
              <button onClick={() => {
                setShowNewGroupModal(false); setGroupName('');
                setSelectedGroupMembers([]); setGroupSearchQuery(''); setGroupSearchResults([]);
              }}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <input type="text" placeholder="Group name..." value={groupName} onChange={(e) => setGroupName(e.target.value)} className="input mb-4" autoFocus />

            {/* Selected Members */}
            {selectedGroupMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedGroupMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-1 bg-[var(--color-blue-soft)] rounded-full px-3 py-1 text-sm">
                    <span className="text-[var(--color-blue-primary)]">{m.name}</span>
                    <button onClick={() => setSelectedGroupMembers(prev => prev.filter(p => p.id !== m.id))}>
                      <X className="w-3 h-3 text-[var(--color-blue-primary)]" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search Members */}
            <div className="relative mb-4">
              <input type="text" placeholder="Search users to add..." value={groupSearchQuery} onChange={(e) => handleGroupSearch(e.target.value)} className="input pl-10" />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {groupSearchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedGroupMembers(prev => [...prev, u]);
                    setGroupSearchResults(prev => prev.filter(p => p.id !== u.id));
                    setGroupSearchQuery('');
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg card transition-all"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <UserAvatar userId={u.id} name={u.name} size={32} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-[var(--color-blue-primary)]" />
                </button>
              ))}
            </div>

            <button onClick={handleCreateGroup} disabled={!groupName.trim()} className="btn-primary w-full py-3 text-sm font-semibold disabled:opacity-50">
              Create Group ({selectedGroupMembers.length + 1} members)
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedConv && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface-muted)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Are you sure?</h2>
              <p className="text-slate-500 text-sm">
                This will permanently delete {selectedConv.isGroup ? `the group "${selectedConv.name}"` : `your chat with ${selectedConv.name}`} and all messages. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 text-[var(--color-text-primary)] py-2.5 rounded-xl font-semibold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConversation}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-semibold hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedConv?.isGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface-muted)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Add Members</h2>
              <button onClick={() => { setShowAddMemberModal(false); setAddMemberSelected([]); setAddMemberSearchQuery(''); setAddMemberSearchResults([]); }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500 mb-4 text-sm">Search for users to add to &quot;{selectedConv.name}&quot;.</p>

            {/* Selected members chips */}
            {addMemberSelected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {addMemberSelected.map(m => (
                  <span key={m.id} className="flex items-center gap-1 bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] px-3 py-1.5 rounded-lg text-sm font-medium">
                    {m.name}
                    <button onClick={() => setAddMemberSelected(prev => prev.filter(p => p.id !== m.id))} className="hover:text-red-500">
                      <X className="w-3.5 h-3.5 text-[var(--color-blue-primary)]" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={addMemberSearchQuery}
                onChange={(e) => handleAddMemberSearch(e.target.value)}
                className="input pl-10"
                autoFocus
              />
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {addMemberSearchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    setAddMemberSelected(prev => [...prev, u]);
                    setAddMemberSearchResults(prev => prev.filter(p => p.id !== u.id));
                    setAddMemberSearchQuery('');
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg card transition-all"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden">
                    <UserAvatar userId={u.id} name={u.name} size={32} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-[var(--color-blue-primary)]" />
                </button>
              ))}
              {addMemberSearchQuery && addMemberSearchResults.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">No users found</p>
              )}
            </div>

            <button
              onClick={handleAddMembersToGroup}
              disabled={addMemberSelected.length === 0 || addingMembers}
              className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed shadow-premium-md flex items-center justify-center gap-2"
            >
              {addingMembers ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add {addMemberSelected.length} Member{addMemberSelected.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
