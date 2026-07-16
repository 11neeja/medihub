import type { Metadata } from 'next'

// Auth-gated app page — titled for the browser tab, noindexed because
// crawlers only ever see the session splash / login redirect.
export const metadata: Metadata = {
  title: 'Opportunities',
  description: 'Medical roles, internships, and research opportunities on MediHub.',
  robots: { index: false, follow: true },
}

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children
}
