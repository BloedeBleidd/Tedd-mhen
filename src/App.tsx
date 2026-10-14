import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Download,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Plus,
  ShieldCheck,
  X,
  UserRound,
} from 'lucide-react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApi, useLoad } from './lib/api';
import { EmptyState, Loading } from './components/ui';
import { AppearanceControl } from './components/AppearanceControl';
import { PrivacyNotice } from './components/PrivacyNotice';
import { AuthPage } from './pages/Auth';
import { Privacy } from './pages/Privacy';
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const CheckIn = lazy(() => import('./pages/CheckIn').then((m) => ({ default: m.CheckIn })));
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })));
const Analysis = lazy(() => import('./pages/Analysis').then((m) => ({ default: m.Analysis })));
const Export = lazy(() => import('./pages/Export').then((m) => ({ default: m.Export })));
const Help = lazy(() => import('./pages/Help').then((m) => ({ default: m.Help })));
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
export function App() {
  const { demo, toggleDemo } = useApi(),
    location = useLocation(),
    [menuOpen, setMenuOpen] = useState(false);
  const session = useLoad<{ email: string; local: boolean }>('/api/session', true);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Overview' },
    { to: '/check-in', icon: Plus, label: 'Daily check-in' },
    { to: '/journal', icon: BookOpen, label: 'Journal' },
    { to: '/analysis', icon: ChartNoAxesCombined, label: 'Trends & predictions' },
    { to: '/export', icon: Download, label: 'Export data' },
  ];
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
        <PrivacyNotice />
        <main id="main">
          {location.pathname === '/privacy' ? (
            <Privacy />
          ) : !authRoute && session.loading ? (
            <Loading />
          ) : (
            <AuthPage key={location.pathname} />
          )}
        </main>
        <footer className="public-footer">
          <NavLink to="/privacy">Privacy & data</NavLink>
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
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
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
          <button className="demo-toggle" onClick={toggleDemo}>
            <FlaskConical size={17} />
            {demo ? 'Leave demo workspace' : 'Explore a demo'}
          </button>
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
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>
              {nav.find((n) => n.to === location.pathname)?.label ||
                (location.pathname === '/privacy'
                  ? 'Privacy & data'
                  : location.pathname === '/account'
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
        <PrivacyNotice />
        {demo && (
          <div className="demo-banner">
            <FlaskConical size={15} />
            You’re exploring synthetic data. Changes stay in memory and disappear when you leave.
            <button onClick={toggleDemo}>
              Back to my journal <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        {session.error && !demo && (
          <div className="setup-banner">
            <ShieldCheck size={17} />
            <span>{session.error}</span>
            <NavLink to="/help">Setup guide</NavLink>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/check-in" element={<CheckIn />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/export" element={<Export />} />
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
          <footer className="page-footer">
            <span>
              <Activity size={13} /> Tedd’mhen
            </span>
            <span>Your observations. A little more perspective.</span>
            <NavLink to="/privacy">Privacy & data</NavLink>
          </footer>
        </main>
      </div>
    </div>
  );
}
