'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications, NotificationType, Notification } from '@/context/NotificationContext';
import {
  Home,
  Calendar,
  BookOpen,
  Newspaper,
  Users,
  MessageCircle,
  Bot,
  Bell,
  X,
  Heart,
  UserPlus,
  CalendarClock,
  AlertCircle,
  Briefcase,
  Menu,
  LogOut
} from 'lucide-react';

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, clearAll, handleJoinRequest } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setShowMobileMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    // Defer so the same click that opened the panel does not immediately close it
    const timer = window.setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showNotifications]);

  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }

  const appLinks = [
    { href: '/home', label: 'Home', icon: Home },
    { href: '/events', label: 'Events', icon: Calendar },
    { href: '/notebook', label: 'Notebook', icon: BookOpen },
    { href: '/feed', label: 'Feed', icon: Newspaper },
    { href: '/groups', label: 'Groups', icon: Users },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/assistant', label: 'Assistant', icon: Bot },
    { href: '/opportunities', label: 'Opportunities', icon: Briefcase },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string): boolean => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'chat': return MessageCircle;
      case 'feed': return Heart;
      case 'group': return Users;
      case 'group_join_request': return UserPlus;
      case 'event': return CalendarClock;
      case 'system': return AlertCircle;
      default: return Bell;
    }
  };

  const parseMetadata = (notif: Notification) => {
    if (!notif.metadata) return null;
    try {
      return JSON.parse(notif.metadata);
    } catch {
      return null;
    }
  };

  const handleJoinRequestAction = async (notif: Notification, action: 'approve' | 'reject', e: React.MouseEvent) => {
    e.stopPropagation();
    const meta = parseMetadata(notif);
    if (meta?.joinRequestId) {
      await handleJoinRequest(meta.joinRequestId, action);
      markAsRead(notif.id);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.link) {
      router.push(notif.link);
      setShowNotifications(false);
    }
  };

  return (
    <nav className="nav-glass sticky top-0 z-50 overflow-visible">
      <div className="w-full max-w-[1600px] min-[1920px]:max-w-[1760px] mx-auto px-4 sm:px-6 flex justify-between items-center h-16 gap-4">
        <Link
          href="/"
          className="text-xl font-bold text-[var(--color-navy)] hover:text-[var(--color-blue-primary)] transition-smooth shrink-0"
        >
          MediHub
        </Link>

        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          {isAuthenticated ? (
            <>
              <div className="hidden md:flex gap-1 sm:gap-1.5 items-center overflow-x-auto scrollbar-hide min-w-0">
              {appLinks.map(link => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-smooth whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-blue-primary)] font-semibold shadow-premium'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-blue-primary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{link.label}</span>
                  </Link>
                );
              })}
              </div>

              <div className="relative shrink-0" ref={notifRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotifications((open) => !open);
                  }}
                  className="relative p-2.5 hover:bg-[var(--color-accent-soft)] rounded-full transition-smooth text-[var(--color-text-muted)] hover:text-[var(--color-blue-primary)]"
                  aria-label="Notifications"
                  aria-expanded={showNotifications}
                  aria-haspopup="true"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-blue-primary)] text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center shadow-btn">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-[var(--color-surface-white)] rounded-2xl overflow-hidden z-[200] border border-[var(--color-border-light)]"
                    style={{ boxShadow: 'var(--shadow-modal)' }}
                    role="dialog"
                    aria-label="Notifications"
                  >
                    <div className="px-4 py-3 border-b border-[var(--color-border-light)] flex justify-between items-center bg-[var(--color-surface-muted)]">
                      <h3 className="font-semibold text-[var(--color-navy)]">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs font-semibold text-[var(--color-blue-primary)] bg-[var(--color-accent-soft)] px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--color-border-mid)]" />
                          <p className="text-[var(--color-text-muted)]">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map(notif => {
                          const NotifIcon = getNotificationIcon(notif.type);
                          const isJoinRequest = notif.type === 'group_join_request';
                          return (
                            <button
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full text-left p-4 border-b border-[var(--color-border-light)] hover:bg-[var(--color-accent-soft)]/50 transition-colors ${
                                !notif.isRead ? 'bg-[var(--color-accent-soft)]/30' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <NotifIcon className="w-5 h-5 flex-shrink-0 text-[var(--color-blue-primary)] mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-semibold text-[var(--color-navy)] text-sm">
                                      {notif.title}
                                    </h4>
                                    {!notif.isRead && (
                                      <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full flex-shrink-0 mt-1" />
                                    )}
                                  </div>
                                  <p className="text-sm text-[var(--color-text-muted)] mb-1">
                                    {notif.message}
                                  </p>
                                  {isJoinRequest && !notif.isRead && (
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={(e) => handleJoinRequestAction(notif, 'approve', e)}
                                        className="px-3 py-1 btn-primary text-xs !py-1.5 !px-3"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={(e) => handleJoinRequestAction(notif, 'reject', e)}
                                        className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded-full font-semibold hover:bg-red-100 transition-colors"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                  <span className="text-xs text-[var(--color-text-muted)]">
                                    {formatTimeAgo(notif.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="px-4 py-3 border-t border-[var(--color-border-light)] text-center bg-[var(--color-surface-muted)]">
                        <button
                          type="button"
                          onClick={async () => {
                            await clearAll();
                            setShowNotifications(false);
                          }}
                          className="text-sm text-[var(--color-blue-primary)] hover:text-[var(--color-navy-hover)] font-semibold transition-smooth"
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden md:inline-flex btn-primary !py-2.5 !px-5 text-sm shrink-0"
              >
                Logout
              </button>

              {/* Hamburger — mobile only */}
              <button
                type="button"
                onClick={() => setShowMobileMenu((open) => !open)}
                className="md:hidden p-2.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-blue-primary)] hover:bg-[var(--color-accent-soft)] transition-smooth shrink-0"
                aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
                aria-expanded={showMobileMenu}
                aria-controls="mobile-menu"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-ghost text-sm whitespace-nowrap"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="btn-primary !py-2.5 !px-6 text-sm whitespace-nowrap"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu dropdown — slides down below navbar */}
      {isAuthenticated && showMobileMenu && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-[var(--color-border-light)] bg-[var(--color-surface-white)] shadow-premium"
        >
          <nav className="px-4 py-3 space-y-1">
            {appLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-smooth ${
                    active
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-blue-primary)] font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-blue-primary)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-[var(--color-border-light)]">
            <button
              type="button"
              onClick={() => {
                setShowMobileMenu(false);
                handleLogout();
              }}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 !py-2.5 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
