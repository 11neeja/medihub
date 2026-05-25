'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ResizableSidebar from '@/components/ResizableSidebar';
import { getNewsAPI, getTrendingTopicsAPI } from '@/lib/api';
import {
  Star,
  Microscope,
  Newspaper,
  Search,
  Stethoscope,
  TrendingUp,
  Calendar,
  BookOpen,
  Globe,
  Users,
  Bot,
  X,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// NewsItem interface matching backend response
interface NewsItem {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  url: string;
  tags: string[];
  source: string;
  specialty: string;
  timeAgo: string;
  publishedAt: string;
  featured?: boolean;
}

const specialties = [
  'All',
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Surgery',
  'Pediatrics',
  'Research & Trials',
];

export default function HomePage() {
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const NEWS_PER_PAGE = 5;

  // Fetch news from the backend (which uses 24hr cached NewsAPI data)
  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const articles = await getNewsAPI({
        specialty: selectedSpecialty,
        search: searchQuery,
        sort: sortBy,
      });
      setNewsData(articles);
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
      setError('Failed to load news. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedSpecialty, searchQuery, sortBy]);

  // Fetch trending topics once
  useEffect(() => {
    getTrendingTopicsAPI()
      .then(setTrendingTopics)
      .catch(() => setTrendingTopics(['AI in Radiology', 'mRNA Vaccine Technology', 'Personalized Medicine', 'Mental Health Innovation']));
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const featuredArticle = newsData.find(item => item.featured) || newsData[0];

  // Pagination
  const totalPages = Math.ceil(newsData.length / NEWS_PER_PAGE);
  const paginatedNews = newsData.slice(
    (currentPage - 1) * NEWS_PER_PAGE,
    currentPage * NEWS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSpecialty, searchQuery, sortBy]);

  const suggestedArticles = newsData
    .filter(item => selectedSpecialty !== 'All' && item.specialty === selectedSpecialty)
    .slice(0, 3);

  const handleArticleClick = (article: NewsItem) => {
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="page-container !pb-6">
      <div className="card rounded-3xl p-6 md:p-8 mb-6 animate-section">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          <div>
            <p className="label mb-2">Dashboard</p>
            <h1 className="heading-2 mb-2">Medical News & Updates</h1>
            <p className="body-md">Curated insights across specialties, personalized for your MediHub workspace</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/assistant" className="btn-primary inline-flex items-center gap-2 !py-2.5">
              <Bot className="w-4 h-4" />
              Ask AI
            </Link>
            <Link href="/events" className="btn-secondary inline-flex items-center gap-2 !py-2.5">
              <Calendar className="w-4 h-4" />
              Browse Events
            </Link>
          </div>
        </div>
      </div>

      <div>
        {/* Today's Highlight - Featured Article */}
        {!loading && featuredArticle && (
          <div onClick={() => handleArticleClick(featuredArticle)} className="card gradient-primary p-6 md:p-8 lg:p-10 mb-6 cursor-pointer hover-lift relative overflow-hidden fade-in-delay-2">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 shimmer"></div>
            </div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <span className="bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-2 pulse-subtle">
                <Star className="w-4 h-4" /> Today&apos;s Highlight
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-6 items-center relative z-10">
              <div className="md:col-span-2">
                <h2 className="heading-3 text-white mb-3 tracking-tight">{featuredArticle.title}</h2>
                <p className="body-md text-white/90 mb-5 leading-relaxed">{featuredArticle.summary}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {featuredArticle.tags.map(tag => (
                    <span key={tag} className="bg-white/20 text-white px-3 py-1 rounded-full text-sm hover-glow cursor-default">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  <span>{featuredArticle.source}</span>
                  <span>•</span>
                  <span>{featuredArticle.timeAgo}</span>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="bg-white/10 rounded-xl h-48 flex items-center justify-center float overflow-hidden">
                  {featuredArticle.imageUrl ? (
                    <img
                      src={featuredArticle.imageUrl}
                      alt={featuredArticle.title}
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Microscope className="w-20 h-20 text-white/80" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main 3-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Filters */}
          <ResizableSidebar side="left" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full">
            <div className="card p-6 lg:sticky lg:top-20">
              <h2 className="heading-3 mb-4">Specialties</h2>
              <nav className="space-y-2">
                {specialties.map(specialty => (
                  <button
                    key={specialty}
                    onClick={() => setSelectedSpecialty(specialty)}
                    className={`w-full text-left px-5 py-3 rounded-xl transition-smooth ${selectedSpecialty === specialty
                      ? 'gradient-primary text-white font-medium shadow-premium hover-scale'
                      : 'bg-[var(--color-surface-white)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-blue-primary)] hover-glow'
                      }`}
                  >
                    {specialty}
                  </button>
                ))}
              </nav>

              {/* Active Filters Indicator */}
              {(selectedSpecialty !== 'All' || searchQuery) && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border-muted)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-[var(--color-text-muted)]">Active Filters</span>
                    <button
                      onClick={() => {
                        setSelectedSpecialty('All');
                        setSearchQuery('');
                      }}
                      className="text-xs text-[var(--color-blue-primary)] hover:underline font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                  {selectedSpecialty !== 'All' && (
                    <div className="badge inline-flex items-center gap-2 font-medium">
                      {selectedSpecialty}
                      <button onClick={() => setSelectedSpecialty('All')} className="hover:opacity-90 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
          </ResizableSidebar>

          {/* Center - Main News Feed */}
          <main className="flex-1 min-w-0">
            {/* Search and Sort Controls */}
            <div className="card p-6 mb-6">
              <div className="flex gap-3 mb-6">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="input"
                  />
                  <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular')} className="input px-4 py-3">
                  <option value="latest">Latest</option>
                  <option value="popular">Popular</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="text-sm text-[var(--color-text-muted)] font-medium">
                {newsData.length} {newsData.length === 1 ? 'article' : 'articles'} found
                {totalPages > 1 && <span> &middot; Page {currentPage} of {totalPages}</span>}
              </div>
            </div>

            {/* Pagination Controls (Top) */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  <ChevronLeft className="w-5 h-5 text-[var(--color-blue-primary)]" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | string)[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    typeof item === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => { setCurrentPage(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`w-10 h-10 rounded-lg font-semibold text-sm transition ${
                          currentPage === item
                            ? 'gradient-primary text-white shadow-premium'
                                : 'pagination-page'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentPage === totalPages} className="pagination-btn">
                  <ChevronRight className="w-5 h-5 text-[var(--color-blue-primary)]" />
                </button>
              </div>
            )}

            {/* News Feed */}
            <div className="space-y-4">
              {loading ? (
                <div className="card p-12 text-center">
                  <Loader2 className="w-10 h-10 text-[var(--color-accent)] mx-auto mb-4 animate-spin" />
                  <h3 className="heading-3 mb-1">Loading news…</h3>
                  <p className="body-md">Fetching latest medical news</p>
                </div>
              ) : error ? (
                <div className="card p-12 text-center">
                  <Newspaper className="w-16 h-16 text-red-300 mx-auto mb-4" />
                  <h3 className="heading-3 mb-2">Failed to load</h3>
                  <p className="body-md mb-4">{error}</p>
                  <button onClick={fetchNews} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                </div>
              ) : paginatedNews.length === 0 ? (
                <div className="card p-12 text-center">
                  <Newspaper className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="heading-3 mb-2">No articles found</h3>
                  <p className="body-md">Try adjusting your filters or search query</p>
                </div>
              ) : (
                paginatedNews.map(article => (
                  <article key={article.id} onClick={() => handleArticleClick(article)} className="card hover-lift cursor-pointer overflow-hidden group">
                    <div className="flex flex-col sm:flex-row">
                      {/* Image Thumbnail */}
                      <div className="sm:w-48 h-48 sm:h-auto bg-[var(--color-surface-muted)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {article.imageUrl ? (
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling as any && ((e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue-soft)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/><path d="M8 15v1a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg></div>');
                            }}
                          />
                        ) : (
                          <Stethoscope className="w-14 h-14 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h2 className="heading-3 mb-2 group-hover:text-[var(--color-blue-primary)] transition-colors duration-200">{article.title}</h2>
                            <p className="body-md mb-3 line-clamp-2 leading-relaxed">{article.summary}</p>
                          </div>
                          {article.url && (
                            <ExternalLink className="w-4 h-4 text-slate-400 ml-3 mt-1 flex-shrink-0 group-hover:text-[var(--color-blue-primary)] transition-colors" />
                          )}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {article.tags.map(tag => (
                            <span key={tag} className="badge" >{tag}</span>
                          ))}
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          <span className="font-medium text-slate-500">{article.source}</span>
                          <span>•</span>
                          <span>{article.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </main>

          {/* Right Sidebar - Extra Context */}
          <ResizableSidebar side="right" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full space-y-6">
            {/* Trending Topics */}
            <div className="card p-6">
              <h2 className="heading-3 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[var(--color-blue-primary)]" />
                Trending Topics
              </h2>
              <ul className="space-y-2">
                {trendingTopics.map((topic, index) => (
                  <li key={index}>
                    <button className="text-left w-full hover:bg-[var(--color-blue-soft)] p-3 rounded-xl transition-smooth hover-glow">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[var(--color-blue-primary)]" >#{index + 1}</span>
                        <span className="text-sm text-[var(--color-text-secondary)] font-medium">{topic}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Access */}
            <div className="card p-6">
              <h2 className="heading-3 mb-4">Quick Access</h2>
              <div className="space-y-2">
                <Link
                  href="/events"
                  className="flex items-center gap-3 p-3 bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] rounded-xl hover:bg-[var(--color-blue-soft)] transition-smooth shadow-premium hover:shadow-premium-md hover-scale"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">Events</span>
                </Link>
                <Link
                  href="/notebook"
                  className="flex items-center gap-3 p-3 bg-[var(--color-blue-soft)]/70 text-[var(--color-blue-primary)] rounded-xl hover:bg-[var(--color-blue-soft)] transition-smooth shadow-premium hover:shadow-premium-md hover-scale"
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">Notebook</span>
                </Link>
                <Link
                  href="/feed"
                  className="flex items-center gap-3 p-3 bg-[var(--color-blue-soft)]/50 text-[var(--color-blue-primary)] rounded-xl hover:bg-[var(--color-blue-soft)] transition-smooth shadow-premium hover:shadow-premium-md hover-scale"
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">Global Feed</span>
                </Link>
                <Link
                  href="/groups"
                  className="flex items-center gap-3 p-3 bg-[var(--color-blue-soft)]/80 text-[var(--color-blue-primary)] rounded-xl hover:bg-[var(--color-blue-soft)] transition-smooth shadow-premium hover:shadow-premium-md hover-scale"
                >
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Groups</span>
                </Link>
                <Link
                  href="/assistant"
                  className="flex items-center gap-3 p-3 gradient-primary text-white rounded-xl hover:opacity-90 transition-smooth shadow-premium-md hover:shadow-premium-lg hover-scale"
                >
                  <Bot className="w-5 h-5" />
                  <span className="font-medium">AI Assistant</span>
                </Link>
              </div>
            </div>

            {/* Suggested for You */}
            {suggestedArticles.length > 0 && (
              <div className="card p-6">
                <h2 className="heading-3 mb-4">Suggested for You</h2>
                <div className="space-y-4">
                  {suggestedArticles.map(article => (
                    <div
                      key={article.id}
                      onClick={() => handleArticleClick(article)}
                      className="cursor-pointer group p-3 rounded-xl hover:bg-[var(--color-blue-soft)] transition-smooth"
                    >
                      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 group-hover:text-[var(--color-blue-primary)] transition-colors duration-200 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-slate-400">{article.source} • {article.timeAgo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
          </ResizableSidebar>

        </div>
      </div>
      </div>
    </div>
  );
}
