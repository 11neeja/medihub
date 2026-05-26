'use client';

import { useState, useEffect } from 'react';
import ResizableSidebar from '@/components/ResizableSidebar';
import { Microscope, GraduationCap, PartyPopper, Monitor, Zap, Target, Search, Plus, X, Calendar, Clock, MapPin, Star, Check, Loader2, RefreshCw, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEventsAPI, getEventbriteEventsAPI, refreshEventbriteCacheAPI, createEventAPI, toggleEventRegistrationAPI } from '@/lib/api';

// Event interface with comprehensive fields
interface Event {
  id: string;
  title: string;
  organizer: string;
  date: string;
  time: string;
  location: string;
  mode: 'Online' | 'On-campus' | 'Hybrid';
  type: 'Workshop' | 'Conference' | 'Fest' | 'Webinar' | 'Hackathon';
  shortDescription: string;
  longDescription: string;
  imageUrl: string;
  isRegistered: boolean;
  featured?: boolean;
  capacity?: number;
  registered?: number;
  isNew?: boolean;
  source?: 'local' | 'eventbrite';
  eventbriteUrl?: string;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [modeFilter, setModeFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [showHostForm, setShowHostForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [isCached, setIsCached] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const EVENTS_PER_PAGE = 5;

  // ─── LocalStorage cache helpers ──────────────────────────────────
  const CACHE_KEY = 'medihub_events_cache';
  const CACHE_TS_KEY = 'medihub_events_cache_ts';
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  const saveToCache = (eventsList: Event[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(eventsList));
      localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
    } catch { /* localStorage full or unavailable */ }
  };

  const loadFromCache = (): { events: Event[]; timestamp: number } | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const ts = localStorage.getItem(CACHE_TS_KEY);
      if (raw && ts) {
        return { events: JSON.parse(raw), timestamp: Number(ts) };
      }
    } catch { /* parse error */ }
    return null;
  };

  const isCacheStale = (timestamp: number) => Date.now() - timestamp > CACHE_TTL;

  // Helper to map local DB event to frontend Event shape
  const mapAPIEvent = (apiEvent: any): Event => ({
    id: apiEvent._id,
    title: apiEvent.title,
    organizer: apiEvent.organizer,
    date: apiEvent.date,
    time: apiEvent.time,
    location: apiEvent.location,
    mode: apiEvent.mode,
    type: apiEvent.type,
    shortDescription: apiEvent.shortDescription,
    longDescription: apiEvent.longDescription || '',
    imageUrl: apiEvent.imageUrl || '/event-custom.jpg',
    isRegistered: apiEvent.isRegistered || false,
    featured: apiEvent.featured || false,
    capacity: apiEvent.capacity || 100,
    registered: apiEvent.registered || 0,
    source: 'local',
  });

  // Helper to map Eventbrite event to frontend Event shape
  const mapEventbriteEvent = (eb: any): Event => ({
    id: eb._id || eb.id,
    title: eb.title,
    organizer: eb.organizer || 'Eventbrite',
    date: eb.date,
    time: eb.time || 'TBA',
    location: eb.location || 'TBA',
    mode: eb.mode || 'Online',
    type: eb.type || 'Conference',
    shortDescription: eb.shortDescription || '',
    longDescription: eb.longDescription || '',
    imageUrl: eb.imageUrl || '',
    isRegistered: false,
    featured: eb.featured || false,
    capacity: eb.capacity || null,
    registered: eb.registered || 0,
    source: 'eventbrite',
    eventbriteUrl: eb.eventbriteUrl || '',
  });

  // Stale-while-revalidate: show cache instantly, fetch fresh in background
  useEffect(() => {
    // 1) Immediately load from cache (instant render, no spinner)
    const cached = loadFromCache();
    if (cached && cached.events.length > 0) {
      setEvents(cached.events);
      setLastUpdated(new Date(cached.timestamp));
      setIsLoadingEvents(false);
      setIsCached(true);

      // If cache is fresh (<24hrs), skip network fetch entirely
      if (!isCacheStale(cached.timestamp)) {
        return;
      }
    }

    // 2) Fetch fresh data from API (in background if cache was loaded)
    const fetchAllEvents = async () => {
      if (!cached?.events.length) setIsLoadingEvents(true);
      try {
        const [localData, eventbriteData] = await Promise.allSettled([
          getEventsAPI(),
          getEventbriteEventsAPI(),
        ]);

        const localEvents = localData.status === 'fulfilled'
          ? localData.value.map(mapAPIEvent)
          : [];

        const ebEvents = eventbriteData.status === 'fulfilled'
          ? eventbriteData.value.map(mapEventbriteEvent)
          : [];

        const allEvents = [...ebEvents, ...localEvents];
        setEvents(allEvents);
        setLastUpdated(new Date());
        setIsCached(false);
        saveToCache(allEvents);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchAllEvents();
  }, []);

  // Force refresh Eventbrite events + update cache
  const handleRefreshEventbrite = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshEventbriteCacheAPI();
      const ebEvents = result.events.map(mapEventbriteEvent);
      // Keep local events, replace eventbrite events
      setEvents(prev => {
        const updated = [
          ...ebEvents,
          ...prev.filter(e => e.source !== 'eventbrite'),
        ];
        saveToCache(updated);
        return updated;
      });
      setLastUpdated(new Date());
      setIsCached(false);
    } catch (err) {
      console.error('Failed to refresh Eventbrite events:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Form state for creating new event
  const [newEvent, setNewEvent] = useState({
    title: '',
    organizer: '',
    date: '',
    time: '',
    location: '',
    mode: 'Online' as Event['mode'],
    type: 'Workshop' as Event['type'],
    shortDescription: '',
    longDescription: '',
  });

  // Filter events based on all active filters
  const filteredEvents = events.filter(event => {
    // Search filter
    const matchesSearch =
      searchQuery === '' ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType = typeFilter === 'All' || event.type === typeFilter;

    // Mode filter
    const matchesMode = modeFilter === 'All' || event.mode === modeFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'All' && event.date) {
      const now = new Date();
      const eventDate = new Date(event.date);
      if (dateFilter === 'This Week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        matchesDate = eventDate >= startOfWeek && eventDate <= endOfWeek;
      } else if (dateFilter === 'This Month') {
        matchesDate = eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'Upcoming') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        matchesDate = eventDate >= today;
      }
    }

    // Source filter
    const matchesSource = sourceFilter === 'All' || event.source === sourceFilter.toLowerCase();

    return matchesSearch && matchesType && matchesMode && matchesDate && matchesSource;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * EVENTS_PER_PAGE,
    currentPage * EVENTS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, modeFilter, dateFilter, sourceFilter]);

  // Get registered events
  const registeredEvents = events.filter(e => e.isRegistered);
  const featuredEvents = events.filter(e => e.featured);

  // Upcoming events (sorted by date, future only) for right sidebar
  const upcomingEvents = [...events]
    .filter(e => {
      if (!e.date) return false;
      const eventDate = new Date(e.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Upcoming this week count
  const upcomingThisWeek = events.filter(e => {
    if (!e.date) return false;
    const eventDate = new Date(e.date);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return eventDate >= startOfWeek && eventDate <= endOfWeek;
  }).length;

  // Toggle registration via API (local events only)
  const handleRegister = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    // For Eventbrite events, redirect to the real registration page
    if (event?.source === 'eventbrite' && event.eventbriteUrl) {
      window.open(event.eventbriteUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // For local events, toggle registration in DB
    try {
      const updated = await toggleEventRegistrationAPI(eventId);
      const mapped = mapAPIEvent(updated);
      setEvents(events.map(e => (e.id === eventId ? mapped : e)));
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent(mapped);
      }
    } catch (err) {
      console.error('Failed to toggle registration:', err);
    }
  };

  // Create new event via API
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createEventAPI(newEvent);
      const updated = [mapAPIEvent(created), ...events];
      setEvents(updated);
      saveToCache(updated);
      setShowHostForm(false);
      setNewEvent({
        title: '',
        organizer: '',
        date: '',
        time: '',
        location: '',
        mode: 'Online',
        type: 'Workshop',
        shortDescription: '',
        longDescription: '',
      });
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="page-container">
        {/* Page Header */}
        <div className="relative card rounded-3xl p-6 md:p-8 mb-6 animate-section overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)' }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 w-64 h-64 rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, var(--color-blue-soft) 0%, transparent 70%)' }} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-6">
            <div className="flex items-start gap-4 fade-in-up">
              <div className="hidden sm:flex w-12 h-12 lg:w-14 lg:h-14 rounded-2xl items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-btn)' }}>
                <Calendar className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
              </div>
              <div>
                <p className="label mb-2">Events</p>
                <h1 className="heading-2 mb-2">Medical Events & Conferences</h1>
                <p className="body-md">
                  Discover, host, and register for medical workshops, conferences, fests, and hackathons
                </p>
                {lastUpdated && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Auto-refresh every 24 hrs &middot; Last updated: {lastUpdated.toLocaleString()}
                    {isCached && <span className="ml-1 text-orange-500 font-medium">(cached)</span>}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 fade-in-delay-1 flex-shrink-0">
              <button onClick={handleRefreshEventbrite} disabled={isRefreshing} className="btn-secondary inline-flex items-center gap-2 !py-2.5 disabled:opacity-50" title="Force refresh Eventbrite events">
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={() => setShowHostForm(!showHostForm)} className="btn-primary inline-flex items-center gap-2 !py-2.5">
                <Plus className="w-4 h-4" />
                Host Event
              </button>
            </div>
          </div>
        </div>

      {/* Host Event Form Modal */}
      {showHostForm && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in"
          onClick={() => setShowHostForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-premium-xl overflow-hidden fade-in-up"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 px-6 md:px-8 pt-6 md:pt-7 pb-5 border-b border-[var(--color-border-light)]">
              <div>
                <p className="label mb-2">New Event</p>
                <h2 className="heading-2 mb-1">Host an event</h2>
                <p className="body-md">Add a workshop, conference, webinar, or other medical event</p>
              </div>
              <button
                onClick={() => setShowHostForm(false)}
                className="-mr-2 -mt-1 p-2 rounded-xl text-slate-400 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (scrollable) */}
            <form id="host-event-form" onSubmit={handleCreateEvent} className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Event title <span className="text-red-500">*</span></label>
                <input type="text" required value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="input" placeholder="e.g., Advanced Surgical Techniques Workshop" />
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Organizer <span className="text-red-500">*</span></label>
                  <input type="text" required value={newEvent.organizer} onChange={(e) => setNewEvent({ ...newEvent, organizer: e.target.value })} className="input" placeholder="Your name or organization" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Event type <span className="text-red-500">*</span></label>
                  <select value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as Event['type'] })} className="input">
                    <option value="Workshop">Workshop</option>
                    <option value="Conference">Conference</option>
                    <option value="Fest">Fest</option>
                    <option value="Webinar">Webinar</option>
                    <option value="Hackathon">Hackathon</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Date <span className="text-red-500">*</span></label>
                  <input type="date" required value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Time <span className="text-red-500">*</span></label>
                  <input type="text" required value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="input" placeholder="09:00 AM – 05:00 PM" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Location <span className="text-red-500">*</span></label>
                  <input type="text" required value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} className="input" placeholder="Venue or virtual platform" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Mode <span className="text-red-500">*</span></label>
                  <select value={newEvent.mode} onChange={(e) => setNewEvent({ ...newEvent, mode: e.target.value as Event['mode'] })} className="input">
                    <option value="Online">Online</option>
                    <option value="On-campus">On-campus</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Short description <span className="text-red-500">*</span></label>
                <input type="text" required value={newEvent.shortDescription} onChange={(e) => setNewEvent({ ...newEvent, shortDescription: e.target.value })} className="input" placeholder="Brief one-line description" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Detailed description <span className="text-red-500">*</span></label>
                <textarea required value={newEvent.longDescription} onChange={(e) => setNewEvent({ ...newEvent, longDescription: e.target.value })} rows={4} className="input resize-none" placeholder="Provide comprehensive event details, agenda, and what participants can expect…" />
              </div>
            </form>

            {/* Modal Footer (sticky) */}
            <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-muted)]/40">
              <button type="button" onClick={() => setShowHostForm(false)} className="btn-secondary inline-flex items-center gap-2 !py-2.5">
                Cancel
              </button>
              <button type="submit" form="host-event-form" className="btn-primary inline-flex items-center gap-2 !py-2.5">
                <Plus className="w-4 h-4" /> Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4 fade-in">
          <div className="glass-effect rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-premium-xl fade-in-up">
            {/* Event Banner */}
            <div className="h-64 gradient-primary flex items-center justify-center text-white relative overflow-hidden">
              {selectedEvent.imageUrl ? (
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <>
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 shimmer"></div>
                  </div>
                  <Target className="w-16 h-16 relative z-10 float" />
                </>
              )}

            </div>

            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <div className="flex gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${selectedEvent.mode === 'Online' ? 'bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)]' :
                      selectedEvent.mode === 'On-campus' ? 'bg-[var(--color-blue-primary)]/20 text-[var(--color-blue-primary)]' :
                        'bg-[var(--color-blue-soft)]/50 text-[var(--color-blue-primary)]'
                      }`}>
                      {selectedEvent.mode}
                    </span>
                    <span className="bg-slate-100 text-[var(--color-text-primary)] px-3 py-1 rounded-full text-sm font-semibold">
                      {selectedEvent.type}
                    </span>
                    {selectedEvent.isRegistered && (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Registered
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">{selectedEvent.title}</h2>
                  <p className="text-lg text-slate-500 mb-4">by {selectedEvent.organizer}</p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600 ml-4 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="flex items-start gap-3">
                  <span className="text-[var(--color-blue-primary)]"><Calendar className="w-6 h-6" /></span>
                  <div>
                    <div className="text-sm text-slate-500">Date</div>
                    <div className="font-semibold">{new Date(selectedEvent.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-blue-primary)]"><Clock className="w-6 h-6" /></span>
                  <div>
                    <div className="text-sm text-slate-500">Time</div>
                    <div className="font-semibold">{selectedEvent.time}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[var(--color-blue-primary)]"><MapPin className="w-6 h-6" /></span>
                  <div>
                    <div className="text-sm text-slate-500">Location</div>
                    <div className="font-semibold">{selectedEvent.location}</div>
                  </div>
                </div>
              </div>

              {selectedEvent.capacity && (
                <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Registration Progress</span>
                    <span>{selectedEvent.registered}/{selectedEvent.capacity} registered</span>
                  </div>
                  <div className="w-full bg-[var(--color-surface-muted)] rounded-full h-2">
                    <div
                      className="bg-[var(--color-blue-primary)] h-2 rounded-full transition-all"
                      style={{ width: `${(selectedEvent.registered! / selectedEvent.capacity) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">About This Event</h3>
                <p className="text-slate-500 leading-relaxed">{selectedEvent.longDescription}</p>
              </div>

              <button
                onClick={() => handleRegister(selectedEvent.id)}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition ${selectedEvent.isRegistered
                  ? 'bg-[var(--color-blue-primary)] text-white hover:bg-[var(--color-blue-primary)]/80'
                  : 'bg-[var(--color-blue-primary)] text-white hover:bg-[var(--color-blue-primary)]/80'
                  }`}
              >
                {selectedEvent.source === 'eventbrite' ? (
                  <span className="flex items-center justify-center gap-2">
                    <ExternalLink className="w-5 h-5" /> Register on Eventbrite
                  </span>
                ) : selectedEvent.isRegistered ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> Registered - Click to Cancel
                  </span>
                ) : 'Register Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Filters */}
          <ResizableSidebar side="left" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full">
            <div className="card p-6 lg:sticky lg:top-20 space-y-6">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Search Events</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by title or organizer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-[var(--color-border-light)] rounded-lg focus:ring-2 focus:ring-[var(--color-blue-primary)] focus:border-transparent"
                  />
                  <span className="absolute left-3 top-3.5 text-slate-400"><Search className="w-4 h-4" /></span>
                </div>
              </div>

              {/* Event Type Filter */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-4">Event Type</label>
                <div className="space-y-2">
                  {['All', 'Workshop', 'Conference', 'Fest', 'Webinar', 'Hackathon'].map(type => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`w-full text-left px-5 py-3 rounded-xl transition-smooth ${typeFilter === type
                        ? 'gradient-primary text-white font-semibold shadow-premium hover-scale'
                        : 'bg-slate-50 text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]/30 hover-glow'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Filter */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-3">Mode</label>
                <div className="space-y-2">
                  {['All', 'Online', 'On-campus', 'Hybrid'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setModeFilter(mode)}
                        className={`w-full text-left px-4 py-2 rounded-xl transition ${modeFilter === mode
                        ? 'bg-[var(--color-blue-primary)] text-white font-semibold'
                        : 'bg-slate-50 text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]/30'
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-3">When</label>
                <div className="space-y-2">
                  {['All', 'This Week', 'This Month', 'Upcoming'].map(date => (
                    <button
                      key={date}
                      onClick={() => setDateFilter(date)}
                        className={`w-full text-left px-4 py-2 rounded-xl transition ${dateFilter === date
                        ? 'bg-[var(--color-blue-primary)] text-white font-semibold'
                        : 'bg-slate-50 text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]/30'
                        }`}
                    >
                      {date}
                      </button>
                  ))}
                </div>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-3">Source</label>
                <div className="space-y-2">
                  {['All', 'Eventbrite', 'Local'].map(src => (
                    <button
                      key={src}
                      onClick={() => setSourceFilter(src)}
                        className={`w-full text-left px-4 py-2 rounded-xl transition ${sourceFilter === src
                        ? 'bg-[var(--color-blue-primary)] text-white font-semibold'
                        : 'bg-slate-50 text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]/30'
                        }`}
                    >
                      {src}
                      </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {(searchQuery || typeFilter !== 'All' || modeFilter !== 'All' || dateFilter !== 'All' || sourceFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('All');
                    setModeFilter('All');
                    setDateFilter('All');
                    setSourceFilter('All');
                  }}
                  className="w-full text-[var(--color-blue-primary)] hover:text-[var(--color-blue-primary)]/80 font-semibold py-2 text-sm"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </aside>
          </ResizableSidebar>

          {/* Center - Event Listing */}
          <main className="flex-1 min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
                {totalPages > 1 && <span> &middot; Page {currentPage} of {totalPages}</span>}
              </span>
            </div>

            {isLoadingEvents ? (
                <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-blue-primary)]" />
              </div>
            ) : (
            <>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-blue-soft)] transition disabled:opacity-30 disabled:cursor-not-allowed"
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
                            : 'border border-[var(--color-border-light)] text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-blue-soft)] transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-[var(--color-blue-primary)]" />
                </button>
              </div>
            )}
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-accent-soft)' }}>
                    <Calendar className="w-10 h-10 text-[var(--color-blue-primary)]" />
                  </div>
                  <h3 className="heading-3 mb-2">No events found</h3>
                  <p className="body-md max-w-sm mx-auto mb-5">Try adjusting your filters &mdash; or host the first event the community needs.</p>
                  <button
                    onClick={() => setShowHostForm(true)}
                    className="btn-primary inline-flex items-center gap-2 !py-2.5"
                  >
                    <Plus className="w-4 h-4" /> Host Your Own Event
                  </button>
                </div>
              ) : (
                paginatedEvents.map(event => (
                  <article
                    key={event.id}
                    className="card hover-lift transition-smooth overflow-hidden group"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Event Image */}
                      <div className="relative w-full sm:w-48 h-48 sm:h-auto sm:min-h-[200px] bg-gradient-to-br from-[var(--color-blue-primary)] to-[var(--color-blue-soft)] flex-shrink-0 overflow-hidden">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Target className="w-12 h-12 text-white/80 group-hover:scale-110 transition-transform" />
                          </div>
                        )}

                        {event.isNew && (
                          <span className="absolute top-3 right-3 bg-white text-[var(--color-blue-primary)] px-3 py-1 rounded-full text-xs font-bold shadow-premium pulse-subtle">
                            NEW
                          </span>
                        )}
                      </div>
                      {/* Event Content */}
                      <div className="flex-1 p-6">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex gap-2 mb-2">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${event.mode === 'Online' ? 'bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)]' :
                                event.mode === 'On-campus' ? 'bg-[var(--color-blue-primary)]/20 text-[var(--color-blue-primary)]' :
                                  'bg-[var(--color-blue-soft)]/50 text-[var(--color-blue-primary)]'
                                }`}>
                                {event.mode}
                              </span>
                              <span className="bg-slate-100 text-[var(--color-text-primary)] px-2 py-1 rounded-lg text-xs font-semibold">
                                {event.type}
                              </span>
                              {event.isRegistered && (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Registered
                                </span>
                              )}
                            </div>
                            <h2
                              onClick={() => setSelectedEvent(event)}
                              className="text-xl font-bold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-blue-primary)] transition cursor-pointer"
                            >
                              {event.title}
                            </h2>
                            <p className="text-sm text-slate-500 mb-3">by {event.organizer}</p>
                            <p className="text-slate-700 mb-3 line-clamp-2">{event.shortDescription}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-[var(--color-blue-primary)]" /> {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-[var(--color-blue-primary)]" /> {event.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-[var(--color-blue-primary)]" /> {event.location}
                          </span>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="flex-1 border-2 border-[var(--color-blue-primary)] text-[var(--color-blue-primary)] px-5 py-3 rounded-xl font-semibold hover:bg-[var(--color-blue-soft)] transition-smooth hover-glow"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => handleRegister(event.id)}
                            className={`flex-1 px-5 py-3 rounded-xl font-semibold transition-smooth shadow-premium hover:shadow-premium-md hover-scale ${event.isRegistered
                              ? 'gradient-primary text-white hover:opacity-90'
                              : 'gradient-primary text-white hover:opacity-90'
                              }`}
                          >
                            {event.source === 'eventbrite' ? (
                              <span className="flex items-center justify-center gap-1"><ExternalLink className="w-4 h-4" /> Register</span>
                            ) : event.isRegistered ? (
                              <span className="flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Registered</span>
                            ) : 'Register'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            </>
            )}
          </main>

          {/* Right Sidebar - Your Events & Featured */}
          <ResizableSidebar side="right" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full space-y-6">
            {/* Your Registrations */}
            {registeredEvents.length > 0 && (
              <div className="card p-6">
                  <h2 className="heading-3 mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5 text-[var(--color-blue-primary)]" />
                    Your Registrations
                  </h2>
                <div className="space-y-3">
                  {registeredEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="cursor-pointer group"
                    >
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-blue-primary)] transition line-clamp-2 mb-1">
                        {event.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {event.type}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Featured / Upcoming Events */}
              <div className="card p-6">
              <h2 className="heading-3 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-[var(--color-blue-primary)]" />
                {featuredEvents.length > 0 ? 'Featured Events' : 'Upcoming Events'}
              </h2>
              {(featuredEvents.length > 0 ? featuredEvents : upcomingEvents).slice(0, 3).length === 0 ? (
                <p className="text-sm text-slate-400">No upcoming events</p>
              ) : (
              <div className="space-y-4">
                {(featuredEvents.length > 0 ? featuredEvents : upcomingEvents).slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="cursor-pointer group"
                  >
                    <div className="h-28 rounded-lg mb-2 overflow-hidden relative bg-gradient-to-br from-[var(--color-blue-primary)] to-[var(--color-blue-primary)]">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          {event.type === 'Workshop' ? <Microscope className="w-8 h-8" /> :
                            event.type === 'Conference' ? <GraduationCap className="w-8 h-8" /> :
                              event.type === 'Fest' ? <PartyPopper className="w-8 h-8" /> :
                                event.type === 'Webinar' ? <Monitor className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <span className="text-white text-[10px] font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-blue-primary)] transition line-clamp-2 mb-1">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location.length > 25 ? event.location.slice(0, 25) + '...' : event.location}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] font-medium">{event.mode}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-[var(--color-text-primary)] font-medium">{event.type}</span>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="card p-6">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Event Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Events</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">{events.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Your Registrations</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">{registeredEvents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Upcoming This Week</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">{upcomingThisWeek}</span>
                </div>
              </div>
            </div>
          </aside>
          </ResizableSidebar>
        </div>
      </div>
    </div>
  );
}
