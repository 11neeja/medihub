'use client';

import { useState, useEffect, useRef } from 'react';
import ResizableSidebar from '@/components/ResizableSidebar';
import { useAuth } from '@/context/AuthContext';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  MessageCircle, Users, Plus, Pin, ChevronUp, ChevronDown, Flame, Clock, Trophy,
  X, Search, Loader2, FileText, Download, Upload, UserPlus, UserMinus, Settings,
  ArrowLeft, Send, BarChart3, BookOpen, PinOff, Heart, Brain, Stethoscope,
  Syringe, Hospital, GraduationCap, Microscope, BookOpenCheck,
  Scissors, type LucideIcon,
} from 'lucide-react';
import {
  getCommunitiesAPI, createCommunityAPI, joinCommunityAPI, leaveCommunityAPI,
  getCommunityMembersAPI, addCommunityMembersAPI, removeCommunityMemberAPI,
  getThreadsAPI, createThreadAPI, voteThreadAPI, togglePinThreadAPI,
  getThreadRepliesAPI, createThreadReplyAPI,
  getCommunityResourcesAPI, uploadCommunityResourceAPI, downloadCommunityResourceAPI,
  searchUsersAPI,
} from '@/lib/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

type SortMode = 'hot' | 'new' | 'top';

interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  membersCount: number;
  threadsCount: number;
  creatorId: string;
  creatorName: string;
  isJoined: boolean;
  myRole: string | null;
  createdAt: string;
}

interface ThreadItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  authorName: string;
  authorRole: string;
  authorId: string;
  repliesCount: number;
  score: number;
  myVote: number;
  createdAt: string;
}

interface Reply {
  id: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorId: string;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  memberRole: string;
  joinedAt: string;
}

interface Resource {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  downloads: number;
  createdAt: string;
}

const CATEGORY_OPTIONS = ['General', 'Exam Prep', 'Cases', 'Specialty', 'Research'];

const ICON_OPTIONS: { key: string; icon: LucideIcon; label: string }[] = [
  { key: 'message-circle', icon: MessageCircle, label: 'Discussion' },
  { key: 'book-open', icon: BookOpen, label: 'Study' },
  { key: 'heart', icon: Heart, label: 'Cardiology' },
  { key: 'brain', icon: Brain, label: 'Neurology' },
  { key: 'scissors', icon: Scissors, label: 'Surgery' },
  { key: 'graduation-cap', icon: GraduationCap, label: 'Education' },
  { key: 'microscope', icon: Microscope, label: 'Research' },
  { key: 'book-open-check', icon: BookOpenCheck, label: 'Resources' },
  { key: 'search', icon: Search, label: 'Diagnosis' },
  { key: 'stethoscope', icon: Stethoscope, label: 'Clinical' },
  { key: 'syringe', icon: Syringe, label: 'Procedures' },
  { key: 'hospital', icon: Hospital, label: 'Hospital' },
];

function getCommunityIcon(iconKey: string) {
  return ICON_OPTIONS.find(o => o.key === iconKey)?.icon || MessageCircle;
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getCategoryColor(cat: string) {
  const map: Record<string, string> = {
    'Exam Prep': 'bg-blue-100 text-blue-700',
    'Cases': 'bg-red-100 text-red-700',
    'Specialty': 'bg-purple-100 text-purple-700',
    'Research': 'bg-green-100 text-green-700',
    'General': 'bg-slate-100 text-slate-700',
  };
  return map[cat] || map['General'];
}

export default function GroupsPage() {
  const { user } = useAuth();

  // Data
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('hot');

  // Thread detail / replies
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingReplies, setLoadingReplies] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Modals
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [showAllResources, setShowAllResources] = useState(false);

  // Create community form
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [newCommunityCategory, setNewCommunityCategory] = useState('General');
  const [newCommunityEmoji, setNewCommunityEmoji] = useState('message-circle');

  // Create thread form
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadTags, setNewThreadTags] = useState('');

  // Add member search
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const [creating, setCreating] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load communities ──────────────────────────────────
  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const data = await getCommunitiesAPI();
      setCommunities(data);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Load threads when community or sort changes ───────
  useEffect(() => {
    if (selectedCommunity) {
      loadThreads();
      loadResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunity?.id, sortMode]);

  const loadThreads = async () => {
    if (!selectedCommunity) return;
    setLoadingThreads(true);
    try {
      const data = await getThreadsAPI(selectedCommunity.id, sortMode);
      setThreads(data);
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadResources = async () => {
    if (!selectedCommunity) return;
    try {
      const data = await getCommunityResourcesAPI(selectedCommunity.id);
      setResources(data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  };

  // ── Handlers ──────────────────────────────────────────
  const handleSelectCommunity = (c: Community) => {
    setSelectedCommunity(c);
    setSelectedThread(null);
    setReplies([]);
    setReplyText('');
  };

  const handleCreateCommunity = async () => {
    if (!newCommunityName.trim() || !newCommunityDesc.trim()) return;
    setCreating(true);
    try {
      const created = await createCommunityAPI({
        name: newCommunityName,
        description: newCommunityDesc,
        category: newCommunityCategory,
        emoji: newCommunityEmoji,
      });
      setCommunities(prev => [created, ...prev]);
      setSelectedCommunity(created);
      setShowCreateCommunity(false);
      setNewCommunityName('');
      setNewCommunityDesc('');
      setNewCommunityCategory('General');
      setNewCommunityEmoji('message-circle');
      showToast('Community created successfully!');
    } catch (err: any) {
      console.error('Failed to create community:', err);
      showToast(err?.response?.data?.message || 'Failed to create community', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinLeave = async (community: Community) => {
    try {
      if (community.isJoined) {
        const res = await leaveCommunityAPI(community.id);
        setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, isJoined: false, myRole: null, membersCount: res.membersCount } : c));
        if (selectedCommunity?.id === community.id) {
          setSelectedCommunity(prev => prev ? { ...prev, isJoined: false, myRole: null, membersCount: res.membersCount } : null);
        }
      } else {
        const res = await joinCommunityAPI(community.id);
        setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, isJoined: true, myRole: 'member', membersCount: res.membersCount } : c));
        if (selectedCommunity?.id === community.id) {
          setSelectedCommunity(prev => prev ? { ...prev, isJoined: true, myRole: 'member', membersCount: res.membersCount } : null);
        }
      }
    } catch (err) {
      console.error('Join/leave failed:', err);
      showToast('Failed to update membership', 'error');
    }
  };

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim() || !selectedCommunity) return;
    try {
      const tags = newThreadTags.split(',').map(t => t.trim()).filter(Boolean);
      const thread = await createThreadAPI(selectedCommunity.id, {
        title: newThreadTitle,
        content: newThreadContent,
        tags,
      });
      setThreads(prev => [thread, ...prev]);
      setShowNewThread(false);
      setNewThreadTitle('');
      setNewThreadContent('');
      setNewThreadTags('');
    } catch (err) {
      console.error('Failed to create thread:', err);
      showToast('Failed to create thread', 'error');
    }
  };

  const handleVote = async (threadId: string, value: number) => {
    try {
      const res = await voteThreadAPI(threadId, value);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, score: res.score, myVote: res.myVote } : t));
      if (selectedThread?.id === threadId) {
        setSelectedThread(prev => prev ? { ...prev, score: res.score, myVote: res.myVote } : null);
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handlePinThread = async (threadId: string) => {
    try {
      const res = await togglePinThreadAPI(threadId);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isPinned: res.isPinned } : t));
    } catch (err) {
      console.error('Pin failed:', err);
    }
  };

  const handleOpenThread = async (thread: ThreadItem) => {
    setSelectedThread(thread);
    setLoadingReplies(true);
    try {
      const data = await getThreadRepliesAPI(thread.id);
      setReplies(data);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    try {
      const reply = await createThreadReplyAPI(selectedThread.id, replyText);
      setReplies(prev => [...prev, reply]);
      setReplyText('');
      setThreads(prev => prev.map(t => t.id === selectedThread.id ? { ...t, repliesCount: t.repliesCount + 1 } : t));
      setSelectedThread(prev => prev ? { ...prev, repliesCount: prev.repliesCount + 1 } : null);
    } catch (err) {
      console.error('Reply failed:', err);
    }
  };

  // ── Member management ─────────────────────────────────
  const handleOpenManageMembers = async () => {
    if (!selectedCommunity) return;
    setShowManageMembers(true);
    try {
      const data = await getCommunityMembersAPI(selectedCommunity.id);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setMemberSearchQuery(query);
    if (query.length < 2) { setMemberSearchResults([]); return; }
    setSearchingMembers(true);
    try {
      const results = await searchUsersAPI(query);
      const memberIds = new Set(members.map(m => m.id));
      setMemberSearchResults(results.filter((u: any) => !memberIds.has(u.id)));
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchingMembers(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedCommunity) return;
    try {
      await addCommunityMembersAPI(selectedCommunity.id, [userId]);
      const data = await getCommunityMembersAPI(selectedCommunity.id);
      setMembers(data);
      setMemberSearchResults(prev => prev.filter(u => u.id !== userId));
      setCommunities(prev => prev.map(c => c.id === selectedCommunity.id ? { ...c, membersCount: data.length } : c));
      setSelectedCommunity(prev => prev ? { ...prev, membersCount: data.length } : null);
    } catch (err) {
      console.error('Add member failed:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedCommunity) return;
    try {
      await removeCommunityMemberAPI(selectedCommunity.id, userId);
      setMembers(prev => prev.filter(m => m.id !== userId));
      setCommunities(prev => prev.map(c => c.id === selectedCommunity.id ? { ...c, membersCount: c.membersCount - 1 } : c));
      setSelectedCommunity(prev => prev ? { ...prev, membersCount: prev.membersCount - 1 } : null);
    } catch (err) {
      console.error('Remove member failed:', err);
    }
  };

  // ── Resource handling ─────────────────────────────────
  const handleUploadResource = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedCommunity) return;
    try {
      const resource = await uploadCommunityResourceAPI(selectedCommunity.id, e.target.files[0]);
      setResources(prev => [resource, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
      showToast('Failed to upload resource', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadResource = async (resource: Resource) => {
    try {
      await downloadCommunityResourceAPI(resource.id);
      window.open(`${BACKEND_URL}${resource.fileUrl}`, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const isAdmin = selectedCommunity?.myRole === 'creator' || selectedCommunity?.myRole === 'admin';

  // ── RENDER ────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-subtle">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in-down ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)]'
        }`}>
          {toast.message}
        </div>
      )}
      <div className="page-container">
        {/* Page Header */}
        <div className="card rounded-3xl p-6 md:p-8 mb-6 animate-section">
          <p className="label mb-2">Communities</p>
          <h1 className="heading-2 mb-2 fade-in-up">Communities</h1>
          <p className="body-md fade-in-delay-1">Join groups, discuss cases, and share resources with peers</p>
        </div>

        <div className="card rounded-3xl overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-280px)] min-h-[560px]">
      {/* Left Sidebar — Communities List */}
      <ResizableSidebar side="left" defaultWidth={280} minWidth={240} maxWidth={360} className="bg-[var(--color-surface-muted)] lg:border-r border-[var(--color-border-light)]" responsive>
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[var(--color-border-light)]">
            <h2 className="heading-md mb-3">Communities</h2>
            <button onClick={() => setShowCreateCommunity(true)} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Create Community
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-blue-primary)]" /></div>
            ) : communities.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No communities yet. Create one!</p>
            ) : (
              communities.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCommunity(c)}
                  className={`w-full text-left p-4 border-b border-[var(--color-border-light)]/50 transition ${selectedCommunity?.id === c.id ? 'bg-[var(--color-blue-soft)] border-l-4 border-l-[var(--color-blue-primary)]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {(() => { const Icon = getCommunityIcon(c.emoji); return <div className="w-9 h-9 rounded-lg bg-[var(--color-blue-soft)] flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-[var(--color-blue-primary)]" /></div>; })()}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-text-primary)] text-sm truncate">{c.name}</span>
                        {c.isJoined && <span className="badge badge-success">Joined</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`badge badge-sm ${getCategoryColor(c.category)}`}>{c.category}</span>
                        <span className="text-[10px] text-slate-400">{c.membersCount.toLocaleString()} members</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </ResizableSidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedCommunity ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-[var(--color-blue-primary)]/20 mx-auto mb-4" />
              <h2 className="heading-md mb-2">Medical Communities</h2>
              <p className="body-sm text-slate-500">Select a community from the sidebar or create a new one</p>
            </div>
          </div>
        ) : selectedThread ? (
          /* ── Thread detail view ─────────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="card px-6 py-4">
              <button onClick={() => { setSelectedThread(null); setReplies([]); setReplyText(''); }} className="flex items-center gap-2 text-sm text-[var(--color-blue-primary)] hover:text-[var(--color-text-primary)] mb-3 transition">
                <ArrowLeft className="w-4 h-4" /> Back to threads
              </button>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <button onClick={() => handleVote(selectedThread.id, 1)} className={`p-0.5 rounded hover:bg-[var(--color-blue-soft)] ${selectedThread.myVote === 1 ? 'text-[var(--color-blue-primary)]' : 'text-slate-400'}`}><ChevronUp className="w-5 h-5" /></button>
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">{selectedThread.score}</span>
                  <button onClick={() => handleVote(selectedThread.id, -1)} className={`p-0.5 rounded hover:bg-[var(--color-surface-muted)] ${selectedThread.myVote === -1 ? 'text-red-500' : 'text-slate-400'}`}><ChevronDown className="w-5 h-5" /></button>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    {selectedThread.isPinned && <Pin className="w-4 h-4 inline text-[var(--color-blue-primary)] mr-1" />}
                    {selectedThread.title}
                  </h2>
                  {selectedThread.content && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{selectedThread.content}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <span className="font-medium">{selectedThread.authorName}</span>
                    <span>•</span>
                    <span>{getTimeAgo(selectedThread.createdAt)}</span>
                    <span>•</span>
                    <MessageCircle className="w-3 h-3" />
                    <span>{selectedThread.repliesCount} replies</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {selectedThread.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] rounded text-[10px] font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Replies */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {loadingReplies ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-blue-primary)]" /></div>
              ) : replies.length === 0 ? (
                <p className="text-center body-sm text-slate-400 py-8">No replies yet. Be the first to respond!</p>
              ) : (
                replies.map(reply => (
                  <div key={reply.id} className="flex gap-3">
                    <UserAvatar userId={reply.authorId} name={reply.authorName} size={32} />
                    <div className="card p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-[var(--color-text-primary)]">{reply.authorName}</span>
                        <span className="text-[10px] text-slate-400">{reply.authorRole}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{getTimeAgo(reply.createdAt)}</span>
                      </div>
                      <p className="body-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply input */}
              {selectedCommunity.isJoined && (
              <div className="card px-6 py-4 border-t">
                <div className="flex gap-3">
                  <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendReply()} placeholder="Write a reply..." className="input flex-1" />
                  <button onClick={handleSendReply} disabled={!replyText.trim()} className="btn-primary px-4 py-2.5 disabled:opacity-50 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Reply
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Community thread list ─────────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Community header */}
            <div className="bg-[var(--color-surface-muted)] border-b border-[var(--color-border-light)] px-6 py-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  {(() => { const Icon = getCommunityIcon(selectedCommunity.emoji); return <div className="w-14 h-14 rounded-xl bg-[var(--color-blue-soft)] flex items-center justify-center"><Icon className="w-7 h-7 text-[var(--color-blue-primary)]" /></div>; })()}
                  <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{selectedCommunity.name}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{selectedCommunity.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCategoryColor(selectedCommunity.category)}`}>{selectedCommunity.category}</span>
                      <span className="text-xs text-slate-500">{selectedCommunity.membersCount.toLocaleString()} members</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={handleOpenManageMembers} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-sm">
                      <Settings className="w-4 h-4" /> Manage
                    </button>
                  )}
                  <button onClick={() => handleJoinLeave(selectedCommunity)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${selectedCommunity.isJoined ? 'btn-secondary' : 'btn-primary'}`}>
                    {selectedCommunity.isJoined ? 'Leave' : 'Join'}
                  </button>
                </div>
              </div>

              {/* Sort tabs + New Thread */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  {([
                    { key: 'hot' as SortMode, icon: Flame, label: 'Hot' },
                    { key: 'new' as SortMode, icon: Clock, label: 'New' },
                    { key: 'top' as SortMode, icon: Trophy, label: 'Top' },
                  ]).map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setSortMode(key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${sortMode === key ? 'btn-primary shadow-premium-md' : 'btn-secondary'}`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
                {selectedCommunity.isJoined && (
                  <button onClick={() => setShowNewThread(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    <Plus className="w-4 h-4" /> New Thread
                  </button>
                )}
              </div>
            </div>

            {/* Threads list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingThreads ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-blue-primary)]" /></div>
              ) : threads.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No threads yet. Start a discussion!</p>
                </div>
              ) : (
                threads.map(thread => (
                  <div
                    key={thread.id}
                    className="card group"
                  >
                    <div className="flex items-start gap-3 p-4">
                      {/* Vote column */}
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <button onClick={() => handleVote(thread.id, 1)} className={`p-0.5 rounded hover:bg-[var(--color-blue-soft)] ${thread.myVote === 1 ? 'text-[var(--color-blue-primary)]' : 'text-slate-400'}`}><ChevronUp className="w-5 h-5" /></button>
                        <span className="text-sm font-bold text-[var(--color-text-primary)] min-w-[28px] text-center">{thread.score}</span>
                        <button onClick={() => handleVote(thread.id, -1)} className={`p-0.5 rounded hover:bg-[var(--color-surface-muted)] ${thread.myVote === -1 ? 'text-red-500' : 'text-slate-400'}`}><ChevronDown className="w-5 h-5" /></button>
                      </div>

                      {/* Thread content */}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenThread(thread)}>
                        <div className="flex items-center gap-2">
                          {thread.isPinned && <Pin className="w-3.5 h-3.5 text-[var(--color-blue-primary)]" />}
                          <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-blue-primary)] transition">{thread.title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {thread.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] rounded text-[10px] font-medium">{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <span className="font-medium">{thread.authorName}</span>
                          <span>•</span>
                          <span>{getTimeAgo(thread.createdAt)}</span>
                          <span>•</span>
                          <MessageCircle className="w-3 h-3" />
                          <span>{thread.repliesCount} replies</span>
                        </div>
                      </div>

                      {/* Pin button for admins */}
                      {isAdmin && (
                        <button onClick={() => handlePinThread(thread.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)] transition opacity-0 group-hover:opacity-100">
                          {thread.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar — Stats & Resources */}
      {selectedCommunity && !selectedThread && (
        <ResizableSidebar side="right" defaultWidth={300} minWidth={260} maxWidth={400} className="bg-[var(--color-surface-muted)] border-l border-[var(--color-border-light)]">
          <div className="p-4 space-y-5">
            {/* Group Stats */}
            <div className="card p-4">
              <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-[var(--color-blue-primary)]" /> Group Stats</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Members</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{selectedCommunity.membersCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Threads</span>
                  <span className="font-bold text-[var(--color-text-primary)]">{threads.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Category</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCategoryColor(selectedCommunity.category)}`}>{selectedCommunity.category}</span>
                </div>
              </div>
            </div>

            {/* Shared Resources */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2"><BookOpen className="w-4 h-4 text-[var(--color-blue-primary)]" /> Shared Resources</h3>
                {isAdmin && (
                  <button onClick={() => fileInputRef.current?.click()} className="text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)] p-1.5 rounded-lg transition">
                    <Upload className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadResource} />

              {resources.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No resources shared yet</p>
              ) : (
                <>
                  {resources.slice(0, 3).map(r => (
                    <button key={r.id} onClick={() => handleDownloadResource(r)} className="w-full flex items-center gap-3 p-2.5 rounded-lg transition text-left mb-1.5 card">
                      <FileText className="w-5 h-5 text-[var(--color-blue-primary)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{r.name}</p>
                        <p className="text-[10px] text-slate-400">{r.downloads} downloads</p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                  {resources.length > 3 && (
                    <button onClick={() => setShowAllResources(true)} className="w-full text-center text-sm btn-secondary mt-2 py-1">
                      View All Resources →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </ResizableSidebar>
      )}

      {/* ── MODALS ───────────────────────────────────── */}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateCommunity(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-light)]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Create Community</h3>
              <button onClick={() => setShowCreateCommunity(false)} className="text-slate-400 hover:text-slate-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map(({ key, icon: Icon, label }) => (
                    <button type="button" key={key} onClick={() => setNewCommunityEmoji(key)} title={label} className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition ${newCommunityEmoji === key ? 'border-[var(--color-blue-primary)] bg-[var(--color-blue-soft)]' : 'border-transparent hover:bg-[var(--color-blue-soft)]'}`}>
                      <Icon className="w-5 h-5 text-[var(--color-blue-primary)]" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Name</label>
                <input value={newCommunityName} onChange={e => setNewCommunityName(e.target.value)} placeholder="e.g. Cardiology Cases" className="input" />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Description</label>
                <textarea value={newCommunityDesc} onChange={e => setNewCommunityDesc(e.target.value)} placeholder="What is this community about?" rows={3} className="input" />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Category</label>
                <select value={newCommunityCategory} onChange={e => setNewCommunityCategory(e.target.value)} className="input">
                  {CATEGORY_OPTIONS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-[var(--color-border-light)]">
              <button onClick={() => setShowCreateCommunity(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button type="button" onClick={handleCreateCommunity} disabled={!newCommunityName.trim() || !newCommunityDesc.trim() || creating} className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewThread(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-light)]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">New Thread</h3>
              <button onClick={() => setShowNewThread(false)} className="text-slate-400 hover:text-slate-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Title</label>
                <input value={newThreadTitle} onChange={e => setNewThreadTitle(e.target.value)} placeholder="Thread title" className="input" />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Content <span className="text-slate-400">(optional)</span></label>
                <textarea value={newThreadContent} onChange={e => setNewThreadContent(e.target.value)} placeholder="Add more details..." rows={4} className="input" />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">Tags <span className="text-slate-400">(comma separated)</span></label>
                <input value={newThreadTags} onChange={e => setNewThreadTags(e.target.value)} placeholder="e.g. resources, anatomy" className="input" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-[var(--color-border-light)]">
              <button onClick={() => setShowNewThread(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
              <button onClick={handleCreateThread} disabled={!newThreadTitle.trim()} className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50">Post Thread</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showManageMembers && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowManageMembers(false); setMemberSearchQuery(''); setMemberSearchResults([]); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-light)]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Manage Members</h3>
              <button onClick={() => { setShowManageMembers(false); setMemberSearchQuery(''); setMemberSearchResults([]); }} className="text-slate-400 hover:text-slate-600 transition"><X className="w-5 h-5" /></button>
            </div>

            {/* Add member search */}
            <div className="p-5 pb-3 border-b border-[var(--color-border-light)]">
              <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">Add Members</label>
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={memberSearchQuery} onChange={e => handleSearchUsers(e.target.value)} placeholder="Search platform users by name..." className="input pl-10" />
              </div>
              {searchingMembers && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-[var(--color-blue-primary)]" /></div>}
              {memberSearchResults.length > 0 && (
                <div className="mt-2 max-h-[120px] overflow-y-auto space-y-1">
                  {memberSearchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--color-surface-muted)]">
                      <div className="flex items-center gap-2">
                        <UserAvatar userId={u.id} name={u.name} size={28} />
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{u.name}</span>
                        <span className="text-[10px] text-slate-400">{u.role}</span>
                      </div>
                      <button onClick={() => handleAddMember(u.id)} className="text-xs font-semibold text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)] px-2 py-1 rounded-lg transition flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current members list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Current Members ({members.length})</p>
              {members.map(m => (
                <div key={m.id} className="card flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <UserAvatar userId={m.id} name={m.name} size={32} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{m.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.memberRole === 'creator' ? 'bg-[var(--color-blue-primary)] text-white' : m.memberRole === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{m.memberRole}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{m.role}</span>
                    </div>
                  </div>
                  {m.memberRole !== 'creator' && m.id !== user?._id && (
                    <button onClick={() => handleRemoveMember(m.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Resources Modal */}
      {showAllResources && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAllResources(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border-light)]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2"><BookOpen className="w-5 h-5 text-[var(--color-blue-primary)]" /> All Shared Resources</h3>
              <button onClick={() => setShowAllResources(false)} className="text-slate-400 hover:text-slate-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {resources.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No resources shared yet</p>
              ) : (
                resources.map(r => (
                  <button key={r.id} onClick={() => handleDownloadResource(r)} className="w-full flex items-center gap-3 p-3 rounded-xl transition text-left card">
                    <FileText className="w-6 h-6 text-[var(--color-blue-primary)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{r.name}</p>
                      <p className="text-[10px] text-slate-400">{r.downloads} downloads • {r.fileType.toUpperCase()} • {getTimeAgo(r.createdAt)}</p>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
            {isAdmin && (
              <div className="p-5 border-t border-[var(--color-border-light)]">
                <button onClick={() => fileInputRef.current?.click()} className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold">
                  <Upload className="w-4 h-4" /> Upload Resource
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}
