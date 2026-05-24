import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { OpportunityProvider } from '@/context/OpportunityContext'
import Navbar from '@/components/Navbar'
import ProtectedRoute from '@/components/ProtectedRoute'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'MediHub - Your Complete Medical Learning Platform',
  description: 'The all-in-one digital hub for medical professionals. Learn, collaborate, and grow with AI-powered tools, events, and communities.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            <AppProvider>
              <OpportunityProvider>
                <Navbar />
                <ProtectedRoute>
                  <main>{children}</main>
                </ProtectedRoute>
              </OpportunityProvider>
            </AppProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
