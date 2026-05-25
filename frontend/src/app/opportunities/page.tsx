'use client';

import { useState } from 'react';
import ResizableSidebar from '@/components/ResizableSidebar';
import {
  Briefcase,
  MapPin,
  Clock,
  Building2,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { useOpportunities } from '@/context/OpportunityContext';
import { Opportunity, OpportunityType } from '@/types';

// ─── Create Opportunity Form ───────────────────────────────────────
function CreateOpportunityForm({ onClose }: { onClose: () => void }) {
  const { addOpportunity } = useOpportunities();
  const [form, setForm] = useState({
    roleTitle: '',
    department: '',
    type: 'internship' as OpportunityType,
    location: '',
    description: '',
    requirements: '',
    duration: '',
    postedBy: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roleTitle || !form.department || !form.location || !form.description || !form.postedBy) return;
    addOpportunity({
      roleTitle: form.roleTitle,
      department: form.department,
      type: form.type,
      location: form.location,
      description: form.description,
      requirements: form.requirements.split('\n').filter(r => r.trim()),
      duration: form.duration,
      postedBy: form.postedBy,
    });
    onClose();
  };

  const inputClass = 'input';

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-premium-xl overflow-hidden fade-in-up"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 px-6 md:px-8 pt-6 md:pt-7 pb-5 border-b border-[var(--color-border-light)]">
          <div>
            <p className="label mb-2">New Opportunity</p>
            <h2 className="heading-2 mb-1">Post an opportunity</h2>
            <p className="body-md">Share an internship or job at your clinic or hospital</p>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 -mt-1 p-2 rounded-xl text-slate-400 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (scrollable) */}
        <form id="post-opportunity-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Role title <span className="text-red-500">*</span></label>
            <input
              className={inputClass}
              placeholder="e.g. Clinical Research Intern"
              value={form.roleTitle}
              onChange={e => setForm({ ...form, roleTitle: e.target.value })}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Department <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                placeholder="e.g. Cardiology"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Type <span className="text-red-500">*</span></label>
              <select
                className={inputClass}
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as OpportunityType })}
              >
                <option value="internship">Internship</option>
                <option value="job">Job</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Location <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                placeholder="e.g. Mumbai, India"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Duration</label>
              <input
                className={inputClass}
                placeholder="e.g. 3 months"
                value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Posted by (clinic or hospital) <span className="text-red-500">*</span></label>
            <input
              className={inputClass}
              placeholder="e.g. Apollo Hospitals"
              value={form.postedBy}
              onChange={e => setForm({ ...form, postedBy: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Description <span className="text-red-500">*</span></label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={4}
              placeholder="Describe the opportunity, responsibilities, and what candidates will gain…"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Requirements <span className="text-[var(--color-text-muted)] font-normal">(one per line)</span></label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={4}
              placeholder={"MBBS student (3rd year+)\nInterest in cardiology\nBasic statistics knowledge"}
              value={form.requirements}
              onChange={e => setForm({ ...form, requirements: e.target.value })}
            />
          </div>
        </form>

        {/* Modal Footer (sticky) */}
        <div className="flex items-center justify-end gap-3 px-6 md:px-8 py-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-muted)]/40">
          <button type="button" onClick={onClose} className="btn-secondary inline-flex items-center gap-2 !py-2.5">
            Cancel
          </button>
          <button type="submit" form="post-opportunity-form" className="btn-primary inline-flex items-center gap-2 !py-2.5">
            <Plus className="w-4 h-4" /> Post Opportunity
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Opportunity Card ──────────────────────────────────────────────
function OpportunityCard({ opp }: { opp: Opportunity }) {
  const { applyToOpportunity, getApplicationForOpportunity } = useOpportunities();
  const [expanded, setExpanded] = useState(false);

  const application = getApplicationForOpportunity(opp.id);
  const hasApplied = !!application;

  const typeColors =
    opp.type === 'internship'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="card">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${typeColors}`}>
                {opp.type === 'internship' ? 'Internship' : 'Job'}
              </span>
            </div>
            <h3 className="heading-md">{opp.roleTitle}</h3>
            <p className="body-sm text-slate-500 font-medium">{opp.postedBy}</p>
          </div>
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--color-blue-soft)] flex items-center justify-center">
            {opp.type === 'internship' ? (
              <GraduationCap className="w-6 h-6 text-[var(--color-blue-primary)]" />
            ) : (
              <Stethoscope className="w-6 h-6 text-[var(--color-blue-primary)]" />
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 body-sm text-slate-500 mb-4">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" /> {opp.department}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> {opp.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {opp.duration}
          </span>
        </div>

        {/* Description */}
        <p className={`body-md text-slate-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {opp.description}
        </p>

        {/* Expandable details */}
        {expanded && opp.requirements.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Requirements</h4>
            <ul className="space-y-1">
              {opp.requirements.map((req, i) => (
                <li key={i} className="text-sm text-slate-500 flex items-start gap-2">
                  <span className="text-[var(--color-blue-primary)] mt-0.5">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--color-border-light)]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-[var(--color-blue-primary)] font-medium flex items-center gap-1 hover:text-[var(--color-blue-primary)] transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                View details <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>

            <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Posted {formatDate(opp.postedAt)}</span>
            {hasApplied ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> {application.status}
              </span>
            ) : (
              <button onClick={() => applyToOpportunity(opp.id)} className="btn-primary px-5 py-2 rounded-xl">Apply Now</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Opportunities Page ────────────────────────────────────────────
export default function OpportunitiesPage() {
  const {
    filteredOpportunities,
    filters,
    setFilters,
    departments,
    locations,
    isLoading,
  } = useOpportunities();

  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  // Wrap setFilters to also reset page
  const handleSetFilters = (f: typeof filters) => {
    setFilters(f);
    setCurrentPage(1);
  };

  // Additional local search on top of context filters
  const displayedOpportunities = filteredOpportunities.filter(opp => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      opp.roleTitle.toLowerCase().includes(q) ||
      opp.department.toLowerCase().includes(q) ||
      opp.location.toLowerCase().includes(q) ||
      opp.postedBy.toLowerCase().includes(q) ||
      opp.description.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayedOpportunities.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOpportunities = displayedOpportunities.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Reset to page 1 when filters/search change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="page-container">
        {/* Page Header */}
        <div className="card rounded-3xl p-6 md:p-8 mb-6 animate-section">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
            <div className="fade-in-up">
              <p className="label mb-2">Opportunities</p>
              <h1 className="heading-2 mb-2">Clinic Connect</h1>
              <p className="body-md">Discover internships and jobs at top clinics and hospitals</p>
            </div>
            <div className="flex flex-wrap gap-3 fade-in-delay-1">
              <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 !py-2.5">
                <Plus className="w-4 h-4" /> Post Opportunity
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left Sidebar: Filters ── */}
          <ResizableSidebar side="left" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full">
            <div className="card p-6 lg:sticky lg:top-20 space-y-6">
              <h2 className="heading-3 flex items-center gap-2">
                <Filter className="w-5 h-5 text-[var(--color-blue-primary)]" /> Filters
              </h2>

              {/* Department filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Department</label>
                <select
                  value={filters.department}
                  onChange={e => handleSetFilters({ ...filters, department: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[var(--color-border-light)] rounded-xl text-sm bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-blue-primary)] focus:border-transparent transition-all"
                >
                  {departments.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Location</label>
                <select
                  value={filters.location}
                  onChange={e => handleSetFilters({ ...filters, location: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[var(--color-border-light)] rounded-xl text-sm bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-blue-primary)] focus:border-transparent transition-all"
                >
                  {locations.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type filter */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Role Type</label>
                <div className="space-y-2">
                  {[{ value: 'all', label: 'All' }, { value: 'internship', label: 'Internship' }, { value: 'job', label: 'Job' }].map(opt => (
                    <button key={opt.value} onClick={() => handleSetFilters({ ...filters, type: opt.value })} className={`${filters.type === opt.value ? 'btn-primary' : 'btn-secondary'} w-full text-left px-4 py-2.5 text-sm`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear filters */}
              {(filters.department !== 'All' || filters.location !== 'All' || filters.type !== 'all') && (
                <button
                  onClick={() => handleSetFilters({ department: 'All', location: 'All', type: 'all' })}
                  className="text-sm text-[var(--color-blue-primary)] hover:underline font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </aside>
          </ResizableSidebar>

          {/* ── Main Content ── */}
          <main className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="card p-6 mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search opportunities by title, department, location…"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="input pl-11"
                />
                <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-slate-500 font-medium">
                  {displayedOpportunities.length}{' '}
                  {displayedOpportunities.length === 1 ? 'opportunity' : 'opportunities'} found
                </span>

                {/* Pagination */}
                {!isLoading && displayedOpportunities.length > PAGE_SIZE && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="p-1.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === safePage
                            ? 'bg-[var(--color-blue-primary)] text-white shadow-sm'
                            : 'border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="p-1.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-blue-soft)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <span className="ml-2 text-sm text-slate-500">
                      Page {safePage} of {totalPages}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Opportunity list */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="bg-[var(--color-surface-muted)] rounded-2xl shadow-premium p-12 text-center">
                  <Loader2 className="w-10 h-10 text-[var(--color-blue-primary)] mx-auto mb-4 animate-spin" />
                  <p className="text-slate-500 font-medium">Loading opportunities…</p>
                </div>
              ) : displayedOpportunities.length === 0 ? (
                <div className="card p-12 text-center">
                  <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="heading-3 mb-2">No opportunities found</h3>
                  <p className="body-md">Try adjusting your filters or post a new opportunity</p>
                </div>
              ) : (
                paginatedOpportunities.map(opp => <OpportunityCard key={opp.id} opp={opp} />)
              )}
            </div>


          </main>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && <CreateOpportunityForm onClose={() => setShowCreate(false)} />}
    </div>
  );
}
