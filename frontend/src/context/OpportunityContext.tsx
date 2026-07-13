'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Opportunity, Application, OpportunityType, ApplicationStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  getOpportunitiesAPI,
  createOpportunityAPI,
  applyToOpportunityAPI,
  getMyApplicationsAPI,
} from '@/lib/api';

// ─── Context types ─────────────────────────────────────────────────
interface OpportunityFilters {
  department: string;
  location: string;
  type: string; // 'all' | 'internship' | 'job'
}

interface OpportunityContextType {
  opportunities: Opportunity[];
  applications: Application[];
  filters: OpportunityFilters;
  setFilters: (filters: OpportunityFilters) => void;
  filteredOpportunities: Opportunity[];
  addOpportunity: (opp: Omit<Opportunity, 'id' | 'postedAt'>) => void;
  applyToOpportunity: (opportunityId: string) => void;
  getApplicationForOpportunity: (opportunityId: string) => Application | undefined;
  departments: string[];
  locations: string[];
  isLoading: boolean;
}

const OpportunityContext = createContext<OpportunityContextType | undefined>(undefined);

// Helper: map API response to frontend Opportunity shape
const mapOpportunity = (o: any): Opportunity => ({
  id: o.id,
  roleTitle: o.roleTitle,
  department: o.department,
  type: o.type as OpportunityType,
  location: o.location,
  description: o.description,
  requirements: o.requirements || [],
  duration: o.duration || '',
  postedBy: o.postedBy,
  postedAt: o.createdAt,
});

// Helper: map API application to frontend Application shape
const mapApplication = (a: any): Application => ({
  id: a.id,
  userId: a.userId,
  opportunityId: a.opportunityId,
  status: a.status as ApplicationStatus,
  appliedAt: a.appliedAt,
});

// ─── Provider ──────────────────────────────────────────────────────
export function OpportunityProvider({ children }: { children: ReactNode }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<OpportunityFilters>({
    department: 'All',
    location: 'All',
    type: 'all',
  });

  const { addNotification } = useNotifications();
  const { isAuthenticated } = useAuth();

  // Fetch opportunities once signed in — these are authenticated endpoints,
  // and anonymous visitors on the landing page shouldn't hit the API at all.
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [opps, apps] = await Promise.all([
          getOpportunitiesAPI(),
          getMyApplicationsAPI(),
        ]);
        setOpportunities(opps.map(mapOpportunity));
        setApplications(apps.map(mapApplication));
      } catch (err) {
        console.error('Failed to load opportunities:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  // Derive unique departments & locations from current data
  const departments = ['All', ...Array.from(new Set(opportunities.map(o => o.department)))];
  const locations = ['All', ...Array.from(new Set(opportunities.map(o => o.location)))];

  // Filtered list
  const filteredOpportunities = opportunities.filter(opp => {
    const matchDept = filters.department === 'All' || opp.department === filters.department;
    const matchLoc = filters.location === 'All' || opp.location === filters.location;
    const matchType = filters.type === 'all' || opp.type === filters.type;
    return matchDept && matchLoc && matchType;
  });

  // Create opportunity (persisted to database)
  const addOpportunity = useCallback(
    async (opp: Omit<Opportunity, 'id' | 'postedAt'>) => {
      try {
        const created = await createOpportunityAPI({
          roleTitle: opp.roleTitle,
          department: opp.department,
          type: opp.type,
          location: opp.location,
          description: opp.description,
          requirements: opp.requirements,
          duration: opp.duration,
          postedBy: opp.postedBy,
        });
        setOpportunities(prev => [mapOpportunity(created), ...prev]);

        addNotification({
          type: 'system',
          title: 'New Opportunity',
          message: `${opp.postedBy} posted "${opp.roleTitle}" in ${opp.department}`,
          link: '/opportunities',
        });
      } catch (err) {
        console.error('Failed to create opportunity:', err);
      }
    },
    [addNotification],
  );

  // Apply to opportunity (persisted to database)
  const handleApply = useCallback(
    async (opportunityId: string) => {
      // Prevent duplicate
      const existing = applications.find(a => a.opportunityId === opportunityId);
      if (existing) return;

      try {
        const app = await applyToOpportunityAPI(opportunityId);
        setApplications(prev => [...prev, mapApplication(app)]);

        const opp = opportunities.find(o => o.id === opportunityId);
        addNotification({
          type: 'system',
          title: 'Application Submitted',
          message: `You applied to "${opp?.roleTitle ?? 'an opportunity'}" successfully`,
          link: '/opportunities',
        });
      } catch (err: any) {
        console.error('Failed to apply:', err);
        if (err?.response?.data?.message === 'Already applied') {
          // Already applied on server, refresh applications
          const apps = await getMyApplicationsAPI();
          setApplications(apps.map(mapApplication));
        }
      }
    },
    [applications, opportunities, addNotification],
  );

  // Check application status for current user
  const getApplicationForOpportunity = useCallback(
    (opportunityId: string) => applications.find(a => a.opportunityId === opportunityId),
    [applications],
  );

  return (
    <OpportunityContext.Provider
      value={{
        opportunities,
        applications,
        filters,
        setFilters,
        filteredOpportunities,
        addOpportunity,
        applyToOpportunity: handleApply,
        getApplicationForOpportunity,
        departments,
        locations,
        isLoading,
      }}
    >
      {children}
    </OpportunityContext.Provider>
  );
}

export const useOpportunities = () => {
  const ctx = useContext(OpportunityContext);
  if (!ctx) throw new Error('useOpportunities must be used within OpportunityProvider');
  return ctx;
};
