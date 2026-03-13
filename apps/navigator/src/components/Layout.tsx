import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
const ChatPanel = lazy(() => import('./ChatPanel'));
import { MessageCircle, Settings, HelpCircle, X } from 'lucide-react';
// @ts-ignore — @irc/shared is a workspace dependency (plain JS)
import { getSiteConfig, getSettingsUrl, getHelpUrl, IRC_LOGO_DATA_URI } from '@irc/shared';
import { useClassification } from '@/context/ClassificationContext';

// Admin page URL (environment-aware — works on GH Pages + localhost)
const SETTINGS_URL = getSettingsUrl();
const HELP_URL = getHelpUrl();

/* ── useWindowWidth hook for responsive inline styles ── */
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const handleResize = useCallback(() => setWidth(window.innerWidth), []);
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  return width;
}

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/navigator', label: 'Navigator' },
  { path: '/resources', label: 'Resources' },
];

// Site config from shared package (includes classification, navigator, crf)
const SITE_CONFIG = getSiteConfig();
const SITES = {
  classification: SITE_CONFIG.classification,
  navigator: SITE_CONFIG.navigator,
  crf: SITE_CONFIG.crf,
  admin: SITE_CONFIG.admin,
};

// IRC logo from shared package
const IRC_LOGO = IRC_LOGO_DATA_URI;

/* ── Site Switcher ──
   Matches Classification's .site-switcher exactly:
   position relative, margin-right 12px, toggle is 0.75rem/600/0.04em uppercase */
function SiteSwitcher({ isMobile, isNarrow }: { isMobile: boolean; isNarrow: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', marginRight: isMobile ? '6px' : '12px', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: isNarrow ? '6px' : isMobile ? '4px 8px' : '6px 12px',
          border: '1px solid #383838',
          borderRadius: '6px',
          background: 'transparent',
          color: '#D1D1D1',
          fontFamily: 'inherit',
          fontSize: isMobile ? '0.625rem' : '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {!isNarrow && <span>Navigator</span>}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          minWidth: '260px',
          background: '#FFFFFF',
          border: '1px solid #E9E9E9',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {Object.entries(SITES).map(([key, site]) => {
            const isCurrentSite = key === 'navigator';
            return (
              <a
                key={key}
                href={site.url}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  textDecoration: 'none',
                  transition: 'background 0.12s ease',
                  ...(isCurrentSite ? { background: '#FFF8E5', borderLeft: '3px solid #FFC72C' } : {}),
                }}
                onMouseEnter={e => { if (!isCurrentSite) e.currentTarget.style.background = '#F6F6F6'; }}
                onMouseLeave={e => { if (!isCurrentSite) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#000', lineHeight: 1.3 }}>{site.label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginTop: '2px', lineHeight: 1.3 }}>{site.description}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Nav link base (doesn't change with breakpoint) ── */
const navLinkBase: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '6px',
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  transition: 'all 0.12s ease',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prefillQuery, setPrefillQuery] = useState<string | null>(null);
  const windowWidth = useWindowWidth();
  const { country, stance, clearClassification } = useClassification();

  // Expose askAlbert function for child components via window
  useEffect(() => {
    (window as any).__askAlbert = (query: string) => {
      setPrefillQuery(query);
      setChatOpen(true);
    };
    return () => { delete (window as any).__askAlbert; };
  }, []);

  const isMobile = windowWidth <= 768;
  const isNarrow = windowWidth <= 400;

  /* ── Responsive header styles ── */
  const headerStyle: React.CSSProperties = {
    background: '#000',
    borderBottom: '4px solid #FFC72C',
    padding: isMobile ? '0 12px' : '0 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  };

  const headerInnerStyle: React.CSSProperties = {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '16px',
    height: isMobile ? '52px' : '60px',
  };

  const brandStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '12px',
    flexShrink: 0,
    textDecoration: 'none',
  };

  const logoHeight = isNarrow ? '24px' : isMobile ? '28px' : '36px';

  const titleStyle: React.CSSProperties = {
    fontSize: isNarrow ? '0.8125rem' : isMobile ? '0.875rem' : '1rem',
    fontWeight: 700,
    letterSpacing: '-0.04em',
    color: '#FFF',
    lineHeight: 1.2,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 400,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#FFC72C',
    marginTop: '2px',
    display: isMobile ? 'none' : 'block',
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: 'auto',
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — matching Classification System exactly */}
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          {/* Site Switcher */}
          <SiteSwitcher isMobile={isMobile} isNarrow={isNarrow} />

          {/* Brand: logo + title/subtitle */}
          <Link to="/" style={brandStyle}>
            <img src={IRC_LOGO} alt="IRC" style={{ height: logoHeight, width: 'auto', display: 'block' }} />
            <div>
              <div style={titleStyle}>Emergency Response Navigator</div>
              <div style={subtitleStyle}>An Emergency Unit Project</div>
            </div>
          </Link>

          {/* Classification Context Pill */}
          {country && stance && (
            <button
              onClick={clearClassification}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                background: '#383838',
                color: '#FFF',
                fontSize: '0.6875rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="Clear country context"
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: stance === 'red' ? '#D32F2F' : stance === 'orange' ? '#FB8C00' : '#FFC72C',
              }} />
              {!isNarrow && <span>{country.length > 20 ? country.slice(0, 18) + '…' : country}</span>}
              <span style={{ textTransform: 'capitalize' }}>{!isNarrow ? `· ${stance}` : stance}</span>
              <X style={{ width: '10px', height: '10px', opacity: 0.6 }} />
            </button>
          )}

          {/* Desktop Nav — hidden on mobile */}
          {!isMobile && (
            <nav style={navStyle}>
              {NAV_ITEMS.map(item => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      ...navLinkBase,
                      color: isActive ? '#000' : '#D1D1D1',
                      background: isActive ? '#FFC72C' : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#FFF';
                        e.currentTarget.style.background = '#383838';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.color = '#D1D1D1';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* Ask Albert — outlined/ghost style; fills yellow when chat is open */}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                style={{
                  ...navLinkBase,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: chatOpen ? '#000' : '#FFC72C',
                  background: chatOpen ? '#FFC72C' : 'transparent',
                  border: '1.5px solid #FFC72C',
                  cursor: 'pointer',
                  marginLeft: '8px',
                }}
                onMouseEnter={e => {
                  if (!chatOpen) {
                    e.currentTarget.style.color = '#000';
                    e.currentTarget.style.background = '#FFC72C';
                  }
                }}
                onMouseLeave={e => {
                  if (!chatOpen) {
                    e.currentTarget.style.color = '#FFC72C';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title="Ask Albert"
              >
                <MessageCircle style={{ width: '14px', height: '14px' }} />
                Ask Albert
              </button>

              {/* Settings gear — links to shared settings page */}
              <a
                href={SETTINGS_URL}
                style={{
                  ...navLinkBase,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#D1D1D1',
                  background: 'transparent',
                  padding: '8px',
                  marginLeft: '4px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#FFF';
                  e.currentTarget.style.background = '#383838';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#D1D1D1';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Settings"
              >
                <Settings style={{ width: '18px', height: '18px' }} />
              </a>

              {/* Help guide link */}
              <a
                href={HELP_URL}
                style={{
                  ...navLinkBase,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#D1D1D1',
                  background: 'transparent',
                  padding: '8px',
                  marginLeft: '2px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#FFF';
                  e.currentTarget.style.background = '#383838';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#D1D1D1';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Help Guide"
              >
                <HelpCircle style={{ width: '18px', height: '18px' }} />
              </a>
            </nav>
          )}

          {/* Mobile menu button — shown on mobile only */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                marginLeft: 'auto',
                padding: '8px',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: '#D1D1D1',
                cursor: 'pointer',
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* Mobile Nav */}
        {isMobile && mobileMenuOpen && (
          <nav style={{ paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
            {NAV_ITEMS.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'block',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    textDecoration: 'none',
                    color: isActive ? '#000' : '#D1D1D1',
                    background: isActive ? '#FFC72C' : 'transparent',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setChatOpen(!chatOpen); setMobileMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                color: chatOpen ? '#000' : '#FFC72C',
                background: chatOpen ? '#FFC72C' : 'transparent',
                border: '1.5px solid #FFC72C',
                cursor: 'pointer',
                marginTop: '4px',
                width: '100%',
              }}
            >
              <MessageCircle style={{ width: '14px', height: '14px' }} />
              Ask Albert
            </button>
            <a
              href={SETTINGS_URL}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
                color: '#D1D1D1',
                background: 'transparent',
                marginTop: '4px',
              }}
            >
              <Settings style={{ width: '16px', height: '16px' }} />
              Settings
            </a>
            <a
              href={HELP_URL}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
                color: '#D1D1D1',
                background: 'transparent',
                marginTop: '4px',
              }}
            >
              <HelpCircle style={{ width: '16px', height: '16px' }} />
              Help
            </a>
          </nav>
        )}
      </header>

      {/* Main content area */}
      <div className="flex-1 flex relative">
        <main className={`flex-1 transition-all duration-300 ${chatOpen ? 'mr-0 lg:mr-[32rem]' : ''}`}>
          {children}
        </main>

        {/* Chat Panel */}
        {chatOpen && (
          <Suspense fallback={null}>
            <ChatPanel
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              prefillQuery={prefillQuery}
              onPrefillConsumed={() => setPrefillQuery(null)}
            />
          </Suspense>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-irc-gray-50 border-t border-irc-gray-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-irc-gray-500">
          <div className="flex items-center gap-2">
            <img src={IRC_LOGO} alt="IRC" style={{ height: '20px', width: 'auto', opacity: 0.6 }} />
            <span>Emergency Response Navigator</span>
          </div>
          <span>Based on IRC Emergency Management Guidelines v2.0</span>
        </div>
      </footer>
    </div>
  );
}
