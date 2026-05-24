export type OpportunityType = 'internship' | 'job';
export type ApplicationStatus = 'Applied' | 'Pending' | 'Reviewed' | 'Accepted' | 'Rejected';

export interface Opportunity {
  id: string;
  roleTitle: string;
  department: string;
  type: OpportunityType;
  location: string;
  description: string;
  requirements: string[];
  duration: string;
  postedBy: string;
  postedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  opportunityId: string;
  status: ApplicationStatus;
  appliedAt: string;
}
