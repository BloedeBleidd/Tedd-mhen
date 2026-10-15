import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Download,
  Upload,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Plus,
  ShieldCheck,
  X,
  UserRound,
} from 'lucide-react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useApi, useLoad } from './lib/api';
import { EmptyState, Loading } from './components/ui';
import { AppearanceControl } from './components/AppearanceControl';
import { PrivacyNotice } from './components/PrivacyNotice';
import { WorkspaceNavLink as NavLink } from './components/WorkspaceLink';
import { Welcome } from './pages/Welcome';
import { AuthPage } from './pages/Auth';
import { Privacy } from './pages/Privacy';
import { About } from './pages/About';
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const CheckIn = lazy(() => import('./pages/CheckIn').then((m) => ({ default: m.CheckIn })));
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })));
const Analysis = lazy(() =>
  import('./pages/AnalysisHub').then((m) => ({ default: m.AnalysisHub })),
);
const Export = lazy(() => import('./pages/Export').then((m) => ({ default: m.Export })));
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })));
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
const Import = lazy(() => import('./pages/Import').then((m) => ({ default: m.Import })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
export function App() {
  const { demo } = useApi(),
    location = useLocation(),
    [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const session = useLoad<{ email: string; local: boolean; admin: boolean }>('/api/session', true);
  useEffect(() => {
    if (!menuOpen) return;
    const panel = sidebar.current;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.querySelector<HTMLElement>('button, a')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key !== 'Tab' || !panel) return;
      const targets = [...panel.querySelectorAll<HTMLElement>('a[href], button')];
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth > 720) setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('resize', resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
      window.removeEventListener('resize', resize);
      trigger?.focus({ preventScroll: true });
    };
  }, [menuOpen]);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/check-in', icon: Plus, label: 'Daily check-in' },
    { to: '/journal', icon: BookOpen, label: 'Journal' },
    { to: '/analysis', icon: ChartNoAxesCombined, label: 'Trends & predictions' },
    { to: '/export', icon: Download, label: 'Export data' },
    { to: '/import', icon: Upload, label: 'Import data' },
    ...(session.data?.admin && !demo
      ? [{ to: '/admin', icon: ShieldCheck, label: 'Administration' }]
      : []),
  ];
  const pathname = demo
    ? location.pathname.replace(/^\/demo(?=\/|$)/, '') || '/'
    : location.pathname;
  const authRoute = ['/sign-in', '/register', '/recover', '/api/auth/claim'].includes(
    location.pathname,
  );
  if (authRoute || (!session.data && !demo)) {
    return (
      <div className="public-shell">
        <header className="public-header">
          <NavLink to="/" className="public-brand">
            Tedd’mhen
          </NavLink>
          <AppearanceControl />
        </header>
        <main id="main">
          {location.pathname === '/about' ? (
            <About />
          ) : pathname === '/privacy' ? (
            <Privacy />
          ) : !authRoute && session.loading ? (
            <Loading />
          ) : location.pathname === '/' ? (
            <Welcome />
          ) : (
            <AuthPage key={location.pathname} />
          )}
        </main>
        <PrivacyNotice />
        <footer className="public-footer">
          <NavLink to="/privacy">Privacy & data</NavLink>
          <NavLink to="/about">About the author</NavLink>
          <span>A personal training & recovery journal.</span>
        </footer>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside
        ref={sidebar}
        id="workspace-navigation"
        className={`sidebar ${menuOpen ? 'open' : ''}`}
      >
        <button
          className="icon-button mobile-menu sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <NavLink className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">
            t<span>·</span>
          </span>
          <span>
            Tedd’mhen<small>YOUR PERSONAL OBSERVATORY</small>
          </span>
        </NavLink>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}>
              <Icon size={18} strokeWidth={1.7} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="leaf-decoration">✳</span>
          <p>
            Notice your patterns.
            <br />
            Find your rhythm.
          </p>
          <span>One day at a time.</span>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/account" onClick={() => setMenuOpen(false)}>
            <UserRound size={17} /> Account
          </NavLink>
          <NavLink to="/privacy" onClick={() => setMenuOpen(false)}>
            <ShieldCheck size={17} /> Privacy & data
          </NavLink>
          <NavLink to="/help" onClick={() => setMenuOpen(false)}>
            <BookOpen size={17} /> Guide & methodology <ArrowUpRight size={14} />
          </NavLink>
          <div className="profile">
            <span className="avatar">{demo ? 'D' : 'Y'}</span>
            <div>
              <strong>{demo ? 'Demo workspace' : 'Your workspace'}</strong>
              <small>
                {session.data?.local
                  ? 'Local development'
                  : demo
                    ? 'Synthetic data only'
                    : 'Private journal'}
              </small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="nav-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main-shell" inert={menuOpen || undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuButton}
              className="icon-button mobile-menu"
              aria-controls="workspace-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {nav.find(
                (n) =>
                  n.to === pathname || (n.to === '/analysis' && pathname.startsWith('/analysis/')),
              )?.label ||
                (pathname === '/about'
                  ? 'About the author'
                  : pathname === '/privacy'
                    ? 'Privacy & data'
                    : pathname === '/account'
                      ? 'Account'
                      : 'Guide & methodology')}
            </strong>
          </div>
          <div className="topbar-tools">
            <AppearanceControl />
            <span className={`privacy-pill ${demo ? 'demo' : ''}`}>
              <span />
              {demo ? 'DEMO DATA' : session.data?.local ? 'LOCAL WORKSPACE' : 'PRIVATE BY DESIGN'}
            </span>
          </div>
        </header>
        {demo && (
          <aside className="demo-banner" aria-label="Demo information">
            <div className="demo-description">
              <FlaskConical size={20} />
              <div>
                <strong>Explore the demo</strong>
                <p>Synthetic data. Edits reset when you leave or reload.</p>
              </div>
            </div>
            <nav className="demo-actions" aria-label="Account access">
              <Link className="button secondary" to="/sign-in">
                Sign in
              </Link>
              <Link className="button primary" to="/register">
                Create account <ArrowUpRight size={15} />
              </Link>
            </nav>
          </aside>
        )}
        {session.error && !demo && (
          <div className="setup-banner">
            <ShieldCheck size={17} />
            <span>{session.error}</span>
            <NavLink to="/help">Setup guide</NavLink>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <Suspense key={demo ? 'demo' : 'personal'} fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/check-in" element={<CheckIn />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/analysis/*" element={<Analysis />} />
              <Route path="/export" element={<Export />} />
              <Route path="/import" element={<Import />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/about" element={<About />} />
              <Route path="/help" element={<Help />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/account" element={<Account />} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="This page has wandered off."
                    description="Use the navigation to return to your journal."
                    action={false}
                  />
                }
              />
            </Routes>
          </Suspense>
          <PrivacyNotice />
          <footer className="page-footer">
            <span>
              <Activity size={13} /> Tedd’mhen
            </span>
            <span>Your observations. A little more perspective.</span>
            <NavLink to="/privacy">Privacy & data</NavLink>
            <NavLink to="/about">About the author</NavLink>
          </footer>
        </main>
      </div>
    </div>
  );
}
