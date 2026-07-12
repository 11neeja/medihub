'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ResizableSidebar from '@/components/ResizableSidebar';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  Image as ImageIcon,
  Link as LinkIcon,
  TrendingUp,
  Newspaper,
  Calendar,
  Users,
  BookOpen,
  Smartphone,
  Lightbulb,
  Loader2,
  X,
  Send,
  Trash2,
  MoreHorizontal,
  Smile,
  SendHorizonal,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/context/AuthContext';
import {
  getPostsAPI,
  createPostAPI,
  toggleLikeAPI,
  toggleBookmarkAPI,
  addCommentAPI,
  deleteCommentAPI,
  repostAPI,
  deletePostAPI,
  createPrivateConversationAPI,
} from '@/lib/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Resolve a stored image URL. Cloudinary (and other cloud) URLs are absolute
// and used as-is; legacy /uploads/... paths are served by our backend.
const resolveImageUrl = (url?: string | null) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${BACKEND_URL}${url}`;
};

type Role = 'Student' | 'Doctor' | 'Professor' | 'Researcher';

interface Author {
  _id: string;
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface Comment {
  _id: string;
  content: string;
  createdAt: string;
  author: Author;
}

interface Post {
  _id: string;
  content: string;
  tags: string[];
  imageUrl?: string | null;
  linkUrl?: string | null;
  createdAt: string;
  author: Author;
  likes: { _id: string; name: string }[];
  commentsCount: number;
  repostsCount: number;
  comments: Comment[];
  repostedFrom?: Post | null;
  bookmarkedBy: string[];
}

const EMOJI_LIST = [
  '😀','😂','🥰','😍','🤔','👍','👏','🔥','❤️','💯',
  '🎉','✅','⚡','🧬','🩺','💉','🏥','📊','📝','🔬',
  '🧪','💊','🫀','🧠','👨‍⚕️','👩‍⚕️','🤝','💡','📚','🎓',
];

export default function FeedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [newPostLink, setNewPostLink] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [repostModal, setRepostModal] = useState<string | null>(null);
  const [repostContent, setRepostContent] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?._id || '';
  const currentUserName = user?.name || 'You';
  const currentUserHandle = `@${currentUserName.toLowerCase().replace(/\s+/g, '')}`;

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const data = await getPostsAPI();
        setPosts(data);
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      } finally {
        setIsLoadingPosts(false);
      }
    };
    fetchPosts();
  }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPosts = filterTag
    ? posts.filter(post => post.tags?.includes(filterTag))
    : posts;

  // Compute trending topics from actual post tags
  const trendingTopics = (() => {
    const tagCount: Record<string, number> = {};
    posts.forEach(p => {
      (p.tags || []).forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
      if (p.repostedFrom?.tags) {
        p.repostedFrom.tags.forEach(t => {
          tagCount[t] = (tagCount[t] || 0) + 1;
        });
      }
    });
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, posts: `${count} post${count !== 1 ? 's' : ''}` }));
  })();

  // Extract hashtags
  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g);
    return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPostImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewPostImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setNewPostImage(null);
    setNewPostImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Create post
  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostImage) return;
    setIsPosting(true);
    try {
      const tags = extractHashtags(newPostContent);
      const apiPost = await createPostAPI({
        content: newPostContent,
        tags,
        linkUrl: newPostLink || undefined,
        image: newPostImage || undefined,
      });
      setPosts([apiPost, ...posts]);
      setNewPostContent('');
      clearImage();
      setNewPostLink('');
      setShowLinkInput(false);
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsPosting(false);
    }
  };

  // Like
  const handleLike = async (postId: string) => {
    try {
      const updated = await toggleLikeAPI(postId);
      setPosts(posts.map(p => (p._id === postId ? updated : p)));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Bookmark
  const handleBookmark = async (postId: string) => {
    try {
      const updated = await toggleBookmarkAPI(postId);
      setPosts(posts.map(p => (p._id === postId ? updated : p)));
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  // Comment
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    try {
      const updated = await addCommentAPI(postId, text);
      setPosts(posts.map(p => (p._id === postId ? updated : p)));
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const updated = await deleteCommentAPI(postId, commentId);
      setPosts(posts.map(p => (p._id === postId ? updated : p)));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Repost
  const handleRepost = async (postId: string) => {
    try {
      const newRepost = await repostAPI(postId, repostContent);
      setPosts([newRepost, ...posts]);
      setRepostModal(null);
      setRepostContent('');
    } catch (err: any) {
      if (err?.response?.status === 400) {
        alert('You already reposted this');
      }
      console.error('Failed to repost:', err);
      setRepostModal(null);
      setRepostContent('');
    }
  };

  // Share (copy link)
  const handleShare = (postId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/feed?post=${postId}`);
    alert('Link copied to clipboard!');
  };

  // Message user — create/get private conversation and navigate to chat
  const handleMessageUser = async (authorId: string) => {
    try {
      const conv = await createPrivateConversationAPI(authorId);
      router.push(`/chat?conversationId=${conv.id}`);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    try {
      await deletePostAPI(postId);
      setPosts(posts.filter(p => p._id !== postId));
      setMenuOpen(null);
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'Doctor': return 'bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)]';
      case 'Professor': return 'bg-[var(--color-blue-primary)]/20 text-[var(--color-blue-primary)]';
      case 'Student': return 'bg-[var(--color-blue-soft)]/50 text-[var(--color-blue-primary)]';
      case 'Researcher': return 'bg-[var(--color-blue-primary)]/30 text-[var(--color-blue-primary)]';
      default: return 'bg-slate-100 text-[var(--color-text-secondary)]';
    }
  };

  const renderPostContent = (content: string) => {
    // Render hashtags as clickable + detect URLs
    const parts = content.split(/(#\w+|https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
          const tag = part.slice(1).toLowerCase();
          return (
            <button key={i} onClick={() => setFilterTag(tag)} className="text-[var(--color-blue-primary)] font-semibold hover:underline">
              {part}
            </button>
          );
      }
      if (part.match(/^https?:\/\//)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Render a single post card (used for both main posts and reposted content)
  const renderPostCard = (post: Post, isRepost = false) => {
    const isLiked = post.likes?.some(l => l._id === currentUserId);
    const isBookmarked = post.bookmarkedBy?.includes(currentUserId);
    const commentsOpen = expandedComments.has(post._id);

    return (
      <article key={post._id} id={`post-${post._id}`} className={`card hover-lift transition-smooth ${isRepost ? '' : ''}`}>
        <div className="p-6">
          {/* Repost indicator */}
          {post.repostedFrom && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3 pl-2">
              <Repeat2 className="w-4 h-4" />
              <span><strong className="text-[var(--color-text-primary)]">{post.author.name}</strong> reposted</span>
            </div>
          )}

          {/* Post Header */}
          <div className="flex gap-4 mb-4">
            <UserAvatar
              userId={post.repostedFrom ? post.repostedFrom.author._id : post.author._id}
              name={post.repostedFrom ? post.repostedFrom.author.name : post.author.name}
              size={48}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[var(--color-text-primary)]">
                  {post.repostedFrom ? post.repostedFrom.author.name : post.author.name}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRoleBadgeColor(
                  (post.repostedFrom ? post.repostedFrom.author.role : post.author.role) || 'Doctor'
                )}`}>
                  {(post.repostedFrom ? post.repostedFrom.author.role : post.author.role) || 'Doctor'}
                </span>
                <span className="text-gray-500 text-sm">
                  @{(post.repostedFrom ? post.repostedFrom.author.name : post.author.name).toLowerCase().replace(/\s+/g, '')}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 text-sm">{getTimeAgo(post.repostedFrom ? post.repostedFrom.createdAt : post.createdAt)}</span>
              </div>
            </div>
            {/* Message button (for other users' posts) */}
            {(post.repostedFrom ? post.repostedFrom.author._id : post.author._id) !== currentUserId && (
              <div className="relative group/tip">
                <button
                  onClick={() => handleMessageUser(post.repostedFrom ? post.repostedFrom.author.id : post.author.id)}
                  className="text-slate-400 hover:text-[var(--color-blue-primary)] p-1.5 rounded-lg hover:bg-[var(--color-surface-muted)] transition"
                >
                  <SendHorizonal className="w-[18px] h-[18px]" />
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Message</span>
              </div>
            )}
            {/* Post menu (delete for own posts) */}
            {post.author._id === currentUserId && !post.repostedFrom && (
              <div className="relative">
                  <button onClick={() => setMenuOpen(menuOpen === post._id ? null : post._id)} className="text-slate-400 hover:text-[var(--color-blue-primary)] p-1 rounded-lg hover:bg-[var(--color-surface-muted)] transition">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {menuOpen === post._id && (
                  <div className="absolute right-0 mt-1 bg-white border border-[var(--color-border-light)] rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Repost quote content */}
          {post.repostedFrom && post.content && (
            <div className="mb-3">
              <p className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed italic text-sm">
                {renderPostContent(post.content)}
              </p>
            </div>
          )}

          {/* Original Post Content */}
          <div className="mb-4">
            <p className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
              {renderPostContent(post.repostedFrom ? post.repostedFrom.content : post.content)}
            </p>
          </div>

          {/* Post Image */}
          {(post.repostedFrom?.imageUrl || post.imageUrl) && (
            <div className="mb-4 rounded-xl overflow-hidden border border-[var(--color-border-light)] bg-black/5 flex items-center justify-center max-h-[480px]">
              <img
                src={resolveImageUrl(post.repostedFrom?.imageUrl || post.imageUrl)}
                alt="Post image"
                className="max-w-full max-h-[480px] object-contain"
              />
            </div>
          )}

          {/* Link preview */}
          {(post.repostedFrom?.linkUrl || post.linkUrl) && (
            <a
              href={post.repostedFrom?.linkUrl || post.linkUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-4 p-4 border border-[var(--color-border-light)] rounded-xl hover:bg-[var(--color-surface-muted)] transition group"
            >
              <div className="flex items-center gap-2 text-blue-600 group-hover:text-blue-700">
                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">{post.repostedFrom?.linkUrl || post.linkUrl}</span>
              </div>
            </a>
          )}

          {/* Tags */}
          {((post.repostedFrom?.tags || post.tags) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
              {(post.repostedFrom?.tags || post.tags || []).map(tag => (
                <button key={tag} onClick={() => setFilterTag(tag)} className="text-[var(--color-blue-primary)] hover:text-[var(--color-blue-primary)] text-sm hover:underline transition">
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Post Actions */}
          <div className="flex items-center gap-1 pt-4 border-t border-[var(--color-border-light)]">
            {/* Like */}
            <div className="relative group/tip">
              <button
                onClick={() => handleLike(post._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${isLiked ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
              >
                <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">{post.likes?.length || 0}</span>
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">{isLiked ? 'Unlike' : 'Like'}</span>
            </div>

            {/* Comment */}
            <div className="relative group/tip">
              <button
                onClick={() => toggleComments(post._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${commentsOpen ? 'text-[var(--color-blue-primary)] bg-[var(--color-blue-soft)]' : 'text-slate-400 hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)]'}`}
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="text-sm font-medium">{post.commentsCount || 0}</span>
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Comment</span>
            </div>

            {/* Repost */}
            <div className="relative group/tip">
              <button
                onClick={() => setRepostModal(post.repostedFrom ? post.repostedFrom._id : post._id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)] transition-colors"
              >
                <Repeat2 className="w-[18px] h-[18px]" />
                <span className="text-sm font-medium">{post.repostsCount || 0}</span>
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Repost</span>
            </div>

            {/* Bookmark */}
            <div className="relative group/tip ml-auto">
              <button
                onClick={() => handleBookmark(post._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${isBookmarked ? 'text-[var(--color-blue-primary)] bg-[var(--color-blue-soft)]' : 'text-slate-400 hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)]'}`}
              >
                <Bookmark className={`w-[18px] h-[18px] ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">{isBookmarked ? 'Unsave' : 'Save'}</span>
            </div>

            {/* Share */}
            <div className="relative group/tip">
              <button
                onClick={() => handleShare(post._id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)] transition-colors"
              >
                <Share2 className="w-[18px] h-[18px]" />
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Share</span>
            </div>
          </div>

          {/* Comments Section */}
          {commentsOpen && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-light)]">
              {/* Existing comments */}
              <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                {(post.comments || []).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2">No comments yet. Be the first!</p>
                ) : (
                  post.comments.map(comment => (
                    <div key={comment._id} className="flex gap-3 group">
                      <UserAvatar userId={comment.author._id} name={comment.author.name} size={32} />
                      <div className="flex-1 bg-[var(--color-blue-soft)]/40 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[var(--color-text-primary)]">{comment.author.name}</span>
                            <span className="text-xs text-slate-400">{getTimeAgo(comment.createdAt)}</span>
                          </div>
                          {comment.author._id === currentUserId && (
                            <button
                              onClick={() => handleDeleteComment(post._id, comment._id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Comment input */}
              <div className="flex gap-3 items-center">
                <UserAvatar userId={currentUserId} name={currentUserName} size={32} />
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={commentTexts[post._id] || ''}
                    onChange={e => setCommentTexts(prev => ({ ...prev, [post._id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post._id); }}
                    placeholder="Write a comment..."
                    className="flex-1 px-4 py-2 border border-[var(--color-border-light)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-blue-primary)]/20 focus:border-[var(--color-blue-primary)] transition placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => handleAddComment(post._id)}
                    disabled={!commentTexts[post._id]?.trim()}
                    className="gradient-primary text-white px-3 py-2 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="page-container">
        {/* Editorial masthead */}
        <header className="relative mb-10 pb-10 border-b border-[var(--color-border-rule)] animate-section">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex-1 max-w-3xl">
              <div className="flex items-center gap-4 mb-5">
                <p className="label !mb-0">The Common Room</p>
                <span className="hidden md:inline text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-soft)] font-semibold">
                  {posts.length} posts · live
                </span>
              </div>
              <h1 className="heading-hero mb-4">
                Where colleagues <span className="serif-accent">speak</span>.
              </h1>
              <p className="body-lg max-w-xl text-[var(--color-text-secondary)]">
                Share cases, ideas, papers, and small wins — a feed by clinicians, for clinicians.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar */}
          <ResizableSidebar side="left" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
            <aside className="w-full">
              <div className="card p-7 lg:sticky lg:top-24">
                <div className="text-center mb-6 pb-6 border-b border-[var(--color-border-hairline)]">
                  <div className="mx-auto mb-4 w-fit hover-scale transition-transform">
                    <UserAvatar userId={currentUserId} name={currentUserName} size={84} />
                  </div>
                  <h2
                    className="text-[var(--color-navy)] mb-1"
                    style={{
                      fontFamily: 'var(--font-fraunces), serif',
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {currentUserName}
                  </h2>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-soft)] font-semibold mb-3">
                    {currentUserHandle}
                  </p>
                  <span className="badge">{user?.role || 'Doctor'}</span>
                </div>
                <div className="flex items-baseline justify-between mb-7 px-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] font-semibold">Posts</span>
                  <span
                    className="text-[var(--color-navy)] tabular-nums"
                    style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.5rem', fontWeight: 500 }}
                  >
                    {posts.filter(p => p.author._id === currentUserId).length}
                  </span>
                </div>
                <div className="space-y-0.5 -mx-2">
                  <p className="label !mb-2 px-2">Quick Access</p>
                  {[
                    { href: '/home', icon: Newspaper, label: 'News Feed' },
                    { href: '/events', icon: Calendar, label: 'Events' },
                    { href: '/groups', icon: Users, label: 'Groups' },
                    { href: '/notebook', icon: BookOpen, label: 'Notebook' },
                  ].map(({ href, icon: Icon, label }) => (
                    <a
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-[var(--color-accent-soft)] transition-smooth text-sm text-[var(--color-text-body)] hover:text-[var(--color-navy)] group"
                    >
                      <Icon className="w-4 h-4 text-[var(--color-text-soft)] group-hover:text-[var(--color-navy)] transition" strokeWidth={1.5} />
                      <span className="font-medium">{label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          </ResizableSidebar>

          {/* Center - Main Feed */}
          <main className="flex-1 min-w-0">
            {/* Post Composer */}
            <div className="card p-6 mb-6">
              <div className="flex gap-4">
                <UserAvatar userId={currentUserId} name={currentUserName} size={48} />
                <div className="flex-1">
                  <textarea
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="Share your medical insights, achievements, or questions..."
                    className="input w-full resize-none"
                    rows={3}
                  />

                  {/* Image Preview */}
                  {newPostImagePreview && (
                    <div className="relative mt-3 inline-block">
                      <img src={newPostImagePreview} alt="Preview" className="max-h-48 rounded-xl border border-[var(--color-border-light)]" />
                      <button
                        onClick={clearImage}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Link Input */}
                  {showLinkInput && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="url"
                        value={newPostLink}
                        onChange={e => setNewPostLink(e.target.value)}
                        placeholder="Paste a link (https://...)"
                        className="input flex-1 px-4 py-2"
                      />
                      <button onClick={() => { setShowLinkInput(false); setNewPostLink(''); }} className="text-slate-400 hover:text-red-500 p-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3">
                    <div className="flex gap-1">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <div className="relative group/tip">
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="text-slate-400 hover:text-[var(--color-blue-primary)] transition-smooth p-2 rounded-lg hover:bg-[var(--color-surface-muted)]"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Add image</span>
                      </div>
                      <div className="relative group/tip">
                        <button
                          onClick={() => setShowLinkInput(!showLinkInput)}
                          className={`transition-smooth p-2 rounded-lg hover:bg-[var(--color-surface-muted)] ${showLinkInput ? 'text-[var(--color-blue-primary)]' : 'text-slate-400 hover:text-[var(--color-blue-primary)]'}`}
                        >
                          <LinkIcon className="w-5 h-5" />
                        </button>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Add link</span>
                      </div>
                      <div className="relative" ref={emojiRef}>
                        <div className="relative group/tip">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`transition-smooth p-2 rounded-lg hover:bg-[var(--color-surface-muted)] ${showEmojiPicker ? 'text-[var(--color-blue-primary)]' : 'text-slate-400 hover:text-[var(--color-blue-primary)]'}`}
                          >
                            <Smile className="w-5 h-5" />
                          </button>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">Add emoji</span>
                        </div>
                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 mb-2 bg-white border border-[var(--color-border-light)] rounded-xl shadow-lg p-3 z-30 w-[280px]">
                            <div className="grid grid-cols-6 gap-1">
                              {EMOJI_LIST.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => {
                                    setNewPostContent(prev => prev + emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="text-xl hover:bg-[var(--color-surface-muted)] rounded-lg p-1.5 transition"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleCreatePost}
                      disabled={(!newPostContent.trim() && !newPostImage) || isPosting}
                      className="btn-primary inline-flex items-center gap-2 px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPosting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Filter */}
            {filterTag && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-slate-500">Filtering by:</span>
                <span className="bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                  #{filterTag}
                  <button onClick={() => setFilterTag(null)} className="hover:text-[var(--color-text-primary)]">✕</button>
                </span>
              </div>
            )}

            {/* Posts Timeline */}
            <div className="space-y-4">
              {isLoadingPosts ? (
                <div className="card p-12 text-center">
                  <Loader2 className="w-10 h-10 text-[var(--color-blue-primary)] animate-spin mx-auto mb-3" />
                  <p className="body-md">Loading posts...</p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-accent-soft)' }}>
                    <Heart className="w-10 h-10 text-[var(--color-blue-primary)]" />
                  </div>
                  <h3 className="heading-3 mb-2">No posts found</h3>
                  <p className="body-md max-w-sm mx-auto">Try adjusting your filter, or share something with the community to kick things off.</p>
                </div>
              ) : (
                filteredPosts.map(post => renderPostCard(post))
              )}
            </div>
          </main>

          {/* Right Sidebar */}
          <ResizableSidebar side="right" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
            <aside className="w-full">
              <div className="lg:sticky lg:top-20 space-y-6">
                {/* Trending Topics */}
                <div className="card p-6">
                  <h2 className="heading-3 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--color-blue-primary)]" />
                    Trending Topics
                  </h2>
                  {trendingTopics.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No trending topics yet. Start using #hashtags!</p>
                  ) : (
                    <div className="space-y-1">
                      {trendingTopics.map((topic, index) => (
                        <button
                          key={topic.tag}
                          onClick={() => setFilterTag(topic.tag)}
                          className="w-full text-left hover:bg-[var(--color-surface-muted)] p-2.5 rounded-xl transition-smooth hover-glow group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-400">#{index + 1}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-blue-primary)] transition">#{topic.tag}</div>
                              <div className="text-xs text-slate-500">{topic.posts}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved Posts */}
                <div className="card p-6">
                  <h2 className="heading-3 mb-4 flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-[var(--color-blue-primary)]" />
                    Saved Posts
                  </h2>
                  {(() => {
                    const saved = posts.filter(p => p.bookmarkedBy?.includes(currentUserId));
                    if (saved.length === 0) {
                      return <p className="text-sm text-slate-400 text-center py-4">No saved posts yet. Bookmark posts to see them here.</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {saved.slice(0, 5).map(p => (
                          <button
                            key={p._id}
                            onClick={() => {
                              document.getElementById(`post-${p._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-full text-left hover:bg-[var(--color-surface-muted)] p-2.5 rounded-xl transition group"
                          >
                            <div className="flex items-start gap-2">
                              <UserAvatar userId={p.author._id} name={p.author.name} size={28} className="mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{p.author.name}</div>
                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{p.content || '(Repost)'}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                        {saved.length > 5 && (
                          <p className="text-xs text-slate-400 text-center">+{saved.length - 5} more saved</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Quick Tips */}
                <div className="card p-6">
                  <h3 className="heading-3 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[var(--color-blue-primary)]" />
                    Feed Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                    <li>• Upload images of research, cases, or achievements</li>
                    <li>• Share medical articles with the link button</li>
                    <li>• Use hashtags to join conversations</li>
                    <li>• Repost interesting content to your followers</li>
                  </ul>
                </div>
              </div>
            </aside>
          </ResizableSidebar>
        </div>
      </div>

      {/* Repost Modal */}
      {repostModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setRepostModal(null); setRepostContent(''); }}>
          <div className="card max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Repost</h3>
              <button onClick={() => { setRepostModal(null); setRepostContent(''); }} className="text-slate-400 hover:text-[var(--color-text-primary)] transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={repostContent}
              onChange={e => setRepostContent(e.target.value)}
              placeholder="Add your thoughts (optional)..."
              className="input w-full mb-4 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRepostModal(null); setRepostContent(''); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRepost(repostModal)}
                className="btn-primary px-6 py-2 font-semibold"
              >
                <Repeat2 className="w-4 h-4 inline mr-2" />
                Repost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
