import type { Metadata } from 'next'
import { Fraunces, Manrope, Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { OpportunityProvider } from '@/context/OpportunityContext'
import Navbar from '@/components/Navbar'
import ProtectedRoute from '@/components/ProtectedRoute'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

// Keep Inter loaded for backward compatibility with any
// landing / auth pages still referencing --font-inter.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'MediHub — A Practice for Medical Minds',
  description: 'The all-in-one digital hub for medical professionals. Learn, collaborate, and grow with AI-powered tools, events, and communities.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${inter.variable}`}>
      <body className={`${manrope.className} antialiased`}>
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
