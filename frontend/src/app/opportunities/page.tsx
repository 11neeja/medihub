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
    <div className="card hover-lift group">
      <div className="p-7">
        <div className="flex items-start justify-between gap-5 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-blue-primary)]">
                {opp.type === 'internship' ? 'Internship' : 'Position'}
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--color-border-strong)]" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-soft)] font-semibold">
                {opp.department}
              </span>
            </div>
            <h3
              className="mb-1 group-hover:text-[var(--color-blue-primary)] transition-colors duration-300"
              style={{
                fontFamily: 'var(--font-fraunces), serif',
                fontSize: '1.375rem',
                fontWeight: 500,
                lineHeight: 1.18,
                letterSpacing: '-0.022em',
                color: 'var(--color-navy)',
              }}
            >
              {opp.roleTitle}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] font-medium">{opp.postedBy}</p>
          </div>
          <div className="flex-shrink-0 w-12 h-12 rounded-md border border-[var(--color-border-rule)] flex items-center justify-center" style={{ background: 'var(--color-surface-elevated)' }}>
            {opp.type === 'internship' ? (
              <GraduationCap className="w-5 h-5 text-[var(--color-navy)]" strokeWidth={1.5} />
            ) : (
              <Stethoscope className="w-5 h-5 text-[var(--color-navy)]" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-[var(--color-text-body)] mb-4">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[var(--color-text-muted)]" strokeWidth={1.75} /> {opp.department}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[var(--color-text-muted)]" strokeWidth={1.75} /> {opp.location}
          </span>
          {opp.duration && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" strokeWidth={1.75} /> {opp.duration}
            </span>
          )}
        </div>

        <p className={`body-md leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {opp.description}
        </p>

        {expanded && opp.requirements.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--color-border-hairline)]">
            <p className="label !mb-2">Requirements</p>
            <ul className="space-y-1.5">
              {opp.requirements.map((req, i) => (
                <li key={i} className="text-sm text-[var(--color-text-body)] flex items-start gap-2">
                  <span className="text-[var(--color-navy)] mt-0.5 font-semibold">·</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border-hairline)]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-navy)] font-semibold flex items-center gap-1.5 transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>Details <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[var(--color-text-soft)]">
              {formatDate(opp.postedAt)}
            </span>
            {hasApplied ? (
              <span className="badge badge-success inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {application.status}
              </span>
            ) : (
              <button onClick={() => applyToOpportunity(opp.id)} className="btn-primary !py-2 !px-4">Apply</button>
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
        {/* Editorial masthead */}
        <header className="relative mb-10 pb-10 border-b border-[var(--color-border-rule)] animate-section">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex-1 max-w-3xl">
              <p className="label !mb-3">The Board</p>
              <h1 className="heading-hero mb-4">
                <span className="serif-accent">Posts</span> from clinics
                <br /> &amp; hospitals.
              </h1>
              <p className="body-lg max-w-xl text-[var(--color-text-secondary)]">
                Internships, residencies, and roles — posted by clinicians, for clinicians.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" strokeWidth={2} /> Post an opportunity
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left Sidebar: Filters ── */}
          <ResizableSidebar side="left" defaultWidth={280} minWidth={200} maxWidth={400} responsive>
          <aside className="w-full">
            <div className="card p-7 lg:sticky lg:top-24 space-y-7">
              <div>
                <p className="label !mb-1">Refine</p>
                <h2 className="heading-3 flex items-center gap-2">Filters</h2>
              </div>

              <div>
                <p className="label !mb-3">Department</p>
                <select
                  value={filters.department}
                  onChange={e => handleSetFilters({ ...filters, department: e.target.value })}
                  className="input"
                >
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="label !mb-3">Location</p>
                <select
                  value={filters.location}
                  onChange={e => handleSetFilters({ ...filters, location: e.target.value })}
                  className="input"
                >
                  {locations.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="label !mb-3">Role Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {[{ value: 'all', label: 'All' }, { value: 'internship', label: 'Internship' }, { value: 'job', label: 'Job' }].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSetFilters({ ...filters, type: opt.value })}
                      className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold tracking-tight transition-smooth border ${
                        filters.type === opt.value
                          ? 'bg-[var(--color-navy)] text-white border-[var(--color-navy)]'
                          : 'bg-transparent text-[var(--color-text-body)] border-[var(--color-border-rule)] hover:border-[var(--color-navy)] hover:text-[var(--color-navy)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {(filters.department !== 'All' || filters.location !== 'All' || filters.type !== 'all') && (
                <button
                  onClick={() => handleSetFilters({ department: 'All', location: 'All', type: 'all' })}
                  className="text-xs uppercase tracking-[0.18em] text-[var(--color-blue-primary)] hover:text-[var(--color-navy)] font-semibold transition-colors pt-2 border-t border-[var(--color-border-hairline)] w-full text-left"
                >
                  ✕ Clear all filters
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
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-accent-soft)' }}>
                    <Briefcase className="w-10 h-10 text-[var(--color-blue-primary)]" />
                  </div>
                  <h3 className="heading-3 mb-2">No opportunities found</h3>
                  <p className="body-md max-w-sm mx-auto">Try adjusting your filters &mdash; or post your own opportunity to reach the community.</p>
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
