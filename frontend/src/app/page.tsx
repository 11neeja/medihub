'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  Users,
  TrendingUp,
  Mail,
  Send,
  Stethoscope,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const ECOSYSTEM_PILLS = [
  'Medical Students',
  'Doctors',
  'Professors',
  'Researchers',
  'News Feed',
  'Events',
  'Groups',
  'AI Assistant',
];

const FEATURES = [
  {
    icon: Clock,
    title: 'News Feed and Events',
    description:
      'Stay current with curated medical updates and discover conferences, workshops, and seminars in one place.',
  },
  {
    icon: BookOpen,
    title: 'Notebook Workspace',
    description:
      'Organize notes, PDFs, task lists, and references by subject with a clean, distraction-free workspace.',
  },
  {
    icon: Users,
    title: 'Groups and Chat',
    description:
      'Connect with peers through communities and direct chat for discussions, case sharing, and support.',
  },
  {
    icon: TrendingUp,
    title: 'AI Study Assistant',
    description:
      'Ask medical questions, summarize documents, and save study-ready insights directly into your notes.',
  },
];

const STATS = [
  { value: '7', label: 'Tools Unified in One Platform' },
  { value: '3.5K+', label: 'Active Medical Community Members' },
  { value: '24/7', label: 'AI-Powered Study Assistance' },
  { value: '100%', label: 'Focus on Learning and Collaboration' },
];

const FAQ_ITEMS = [
  {
    question: 'Who is MediHub designed for?',
    answer:
      'MediHub is built for medical students, doctors, professors, and researchers who need one organized hub for daily learning and collaboration.',
  },
  {
    question: 'Can I use it for both study and community interactions?',
    answer:
      'Yes. MediHub combines study tools like notebooks and AI summaries with community features such as groups, chat, and a professional feed in one platform.',
  },
  {
    question: 'How does the AI assistant help?',
    answer:
      'The AI assistant can answer medical questions, summarize uploaded documents, and help you capture study-ready insights you can save to your notebook.',
  },
  {
    question: 'Is MediHub beginner-friendly?',
    answer:
      'Absolutely. The interface is designed to be calm and intuitive, so you can get started quickly whether you are new to digital study tools or switching from multiple apps.',
  },
];

const HERO_IMAGES: { src: string; alt: string }[] = [
  {
    src: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=1400&h=800&fit=crop&q=80',
    alt: 'Medical professionals performing surgery in an operating room',
  },
  {
    src: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1400&h=800&fit=crop&q=80',
    alt: 'Doctor consulting with a patient in a clinic',
  },
  {
    src: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1400&h=800&fit=crop&q=80',
    alt: 'Medical research team in a modern clinical environment',
  },
  {
    src: 'https://images.unsplash.com/photo-1666214280391-8ff5bd3c0bf0?w=1400&h=800&fit=crop&q=80',
    alt: 'Medical students collaborating with study materials',
  },
];
const HERO_ROTATION_MS = 5000;
const FEEDBACK_IMAGE_1 =
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&h=500&fit=crop&q=80';
const FEEDBACK_IMAGE_2 =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=700&fit=crop&q=80';

export default function LandingPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [openFaq, setOpenFaq] = useState(0);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  // Auto-rotate hero images
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroImageIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, HERO_ROTATION_MS);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for your message! We will get back to you soon.');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-[var(--color-navy)]">
      {/* ── Hero copy ───────────────────────────────────────── */}
      <section
        id="home"
        className="relative overflow-hidden flex items-center justify-center min-h-[calc(100vh-72px)] py-20 md:py-24"
      >
        {/* Watermark — very subtle, behind the heading */}
        <p
          aria-hidden
          className="pointer-events-none absolute left-1/2 select-none text-center font-extrabold uppercase tracking-tight whitespace-nowrap opacity-50"
          style={{
            fontSize: 'clamp(6rem, 22vw, 20rem)',
            lineHeight: 1,
            zIndex: 0,
            bottom: '4%',
            transform: 'translateX(-50%)',
            color: '#E8ECF4',
          }}
        >
          THE MEDIHUB
        </p>

        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E2E8F0] text-sm font-medium text-[var(--color-text-secondary)] shadow-sm mb-8 fade-in-up">
            <BadgeCheck className="w-4 h-4 text-[var(--color-blue-primary)]" />
            The Future of Medical Learning
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-[var(--color-navy)] mb-6 fade-in-delay-1">
            Welcome to MediHub
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto mb-10 fade-in-delay-2">
            Your complete digital hub for medical learning and collaboration. Medical news, events,
            workspace tools, social networking, discussion groups, messaging, and an AI-powered study
            assistant, all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fade-in-delay-3">
            <Link
              href="/signup"
              className="btn-primary !px-8 !py-3.5 text-base inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="btn-secondary !px-8 !py-3.5 text-base bg-white"
            >
              Explore Features
            </button>
          </div>

        </div>
      </section>

      {/* ── Hero image ────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto relative pb-6">
          <div className="relative rounded-[2.5rem] overflow-hidden shadow-[0_24px_64px_rgba(0,11,51,0.12)] bg-[var(--color-surface-muted)]">
            <div className="relative w-full h-[280px] sm:h-[380px] md:h-[480px]">
              {HERO_IMAGES.map((image, i) => (
                <img
                  key={image.src}
                  src={image.src}
                  alt={image.alt}
                  aria-hidden={i !== heroImageIndex}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
                    i === heroImageIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
            </div>

            {/* Dot indicators */}
            <div className="absolute bottom-5 left-5 sm:bottom-6 sm:left-6 flex items-center gap-2 z-10">
              {HERO_IMAGES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroImageIndex(i)}
                  aria-label={`Show slide ${i + 1}`}
                  aria-current={i === heroImageIndex}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === heroImageIndex
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="absolute -bottom-6 right-6 sm:right-10 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,11,51,0.18)] border border-[var(--color-border-light)] p-4 sm:p-5 flex items-center gap-4 max-w-xs z-10">
            <div className="w-11 h-11 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-[var(--color-blue-primary)]" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                AI Study Assistant
              </p>
              <p className="text-sm sm:text-base font-bold text-[var(--color-navy)] truncate">
                Summarizing paper...
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ecosystem pills ───────────────────────────────────── */}
      <section className="py-12 md:py-16 bg-white border-y border-[#EEF2F6]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-8">
            Built for the entire medical ecosystem
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {ECOSYSTEM_PILLS.map((pill) => (
              <span
                key={pill}
                className="px-5 py-2.5 rounded-full bg-[#F8FAFC] border border-[#E8EDF3] text-sm font-medium text-[var(--color-navy)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="features" className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--color-navy)] mb-6">
              Powerful features, one platform.
            </h2>
            <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed">
              Medical professionals and students often juggle separate tools for news, events, notes,
              communication, and study resources. MediHub solves this by bringing everything together
              in one seamless experience.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-3xl border border-[#EEF2F6] p-8 shadow-[0_8px_32px_rgba(11,59,145,0.06)] hover:shadow-[var(--shadow-hover)] transition-shadow"
                >
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-6">
                    <Icon className="w-5 h-5 text-[var(--color-blue-primary)]" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-navy)] mb-3">{feature.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Community feedback ────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="grid grid-cols-2 gap-4">
              <img
                src={FEEDBACK_IMAGE_1}
                alt="Modern operating room"
                className="w-full h-48 sm:h-64 object-cover rounded-3xl"
              />
              <img
                src={FEEDBACK_IMAGE_2}
                alt="Medical professional working on laptop"
                className="w-full h-56 sm:h-72 object-cover rounded-3xl mt-8"
              />
            </div>

            <div>
              <span className="inline-block px-4 py-1.5 rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold uppercase tracking-wider text-[var(--color-blue-primary)] mb-6">
                Community Feedback
              </span>
              <blockquote className="text-2xl sm:text-3xl md:text-4xl font-bold leading-snug text-[var(--color-navy)] mb-8">
                &ldquo;MediHub finally gave us one calm space for updates, discussions, and study
                resources without switching between apps.&rdquo;
              </blockquote>
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12 bg-[var(--color-navy)]">
                  <AvatarFallback className="bg-[var(--color-navy)] text-white text-sm font-semibold">
                    MH
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-[var(--color-navy)]">MediHub Community Member</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Medical Student</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section className="py-16 md:py-20 bg-[var(--color-navy)] text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl sm:text-5xl font-bold text-white/95 mb-3">{stat.value}</p>
                <p className="text-sm sm:text-base text-white/70 leading-snug max-w-[200px] mx-auto">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="py-16 md:py-24 bg-[#F8FAFC]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-navy)] mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Everything you need to know before getting started.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.question}
                  className="bg-white rounded-3xl border border-[#EEF2F6] shadow-[0_4px_24px_rgba(11,59,145,0.05)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="w-full flex items-center justify-between gap-4 p-6 sm:p-8 text-left"
                  >
                    <span className="text-base sm:text-lg font-bold text-[var(--color-navy)] pr-4">
                      {item.question}
                    </span>
                    <span className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 sm:px-8 pb-6 sm:pb-8 -mt-2">
                      <p className="text-[var(--color-text-secondary)] leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────── */}
      <section id="contact" className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-navy)] mb-6">
                Get in touch
              </h2>
              <p className="text-[var(--color-text-secondary)] leading-relaxed mb-8 max-w-md">
                Have questions? We would love to hear from you. Drop us a line and our team will get
                back to you shortly.
              </p>
              <a
                href="mailto:contact@medihub.example"
                className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--color-accent-soft)] border border-[var(--color-border-mid)]"
              >
                <span className="w-9 h-9 rounded-full bg-[var(--color-blue-primary)] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </span>
                <span className="font-semibold text-[var(--color-navy)]">contact@medihub.example</span>
              </a>
            </div>

            <div className="bg-white rounded-[2rem] border border-[#EEF2F6] shadow-[0_16px_48px_rgba(11,59,145,0.08)] p-8 sm:p-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold text-[var(--color-navy)] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    className="input bg-[#F8FAFC] border-[#E8EDF3]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-bold text-[var(--color-navy)] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                    className="input bg-[#F8FAFC] border-[#E8EDF3]"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-bold text-[var(--color-navy)] mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we help?"
                    rows={4}
                    className="input bg-[#F8FAFC] border-[#E8EDF3] resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full btn-primary !py-4 text-base inline-flex items-center justify-center gap-2 !rounded-2xl"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F1F5F9]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-navy)] mb-6 tracking-tight">
            Ready to simplify your medical workflow?
          </h2>
          <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed mb-10">
            Join thousands of medical professionals using MediHub to learn faster, collaborate better,
            and stay organized.
          </p>
          <Link
            href="/signup"
            className="btn-primary !px-10 !py-4 text-base inline-flex items-center gap-2"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="bg-[var(--color-navy)] text-white py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xl font-bold">MediHub</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70">
            <button type="button" onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">
              Features
            </button>
            <button type="button" onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">
              FAQ
            </button>
            <button type="button" onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors">
              Contact
            </button>
            <Link href="/login" className="hover:text-white transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="hover:text-white transition-colors">
              Sign Up
            </Link>
          </div>
          <p className="text-sm text-white/50">&copy; {new Date().getFullYear()} MediHub</p>
        </div>
      </footer>
    </div>
  );
}