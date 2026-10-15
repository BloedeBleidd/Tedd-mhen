import { PreferencesProvider, PreferencesStatus } from './lib/preferences-context';
import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from './i18n';
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
import { EmptyState, ErrorBox, Loading } from './components/ui';
import { LanguageControl } from './components/LanguageControl';
import { AppearanceControl } from './components/AppearanceControl';
import { PrivacyNotice } from './components/PrivacyNotice';
import { WorkspaceNavLink as NavLink, WorkspaceLink } from './components/WorkspaceLink';
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
  useTranslation();
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
    { to: '/', icon: LayoutDashboard, label: tr('app:overview') },
    { to: '/check-in', icon: Plus, label: tr('app:dailyCheckIn') },
    { to: '/journal', icon: BookOpen, label: tr('app:journal') },
    { to: '/analysis', icon: ChartNoAxesCombined, label: tr('app:trendsPredictions') },
    { to: '/export', icon: Download, label: tr('app:exportData') },
    { to: '/import', icon: Upload, label: tr('app:importData') },
    ...(session.data?.admin && !demo
      ? [{ to: '/admin', icon: ShieldCheck, label: tr('app:administration') }]
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
            {tr('app:teddMhen')}
          </NavLink>
          <div className="topbar-tools">
            <AppearanceControl />
            <LanguageControl />
          </div>
        </header>
        <main id="main">
          {location.pathname === '/about' ? (
            <About />
          ) : pathname === '/privacy' ? (
            <Privacy />
          ) : !authRoute && session.loading ? (
            <Loading />
          ) : !authRoute && session.error && session.status !== 401 ? (
            <section className="auth-card panel">
              <h1>{tr('app:couldNotOpenYourJournal')}</h1>
              <ErrorBox message={session.error} />
              <button className="button primary" onClick={session.retry}>
                {tr('app:tryAgain')}
              </button>
              <p>{tr('app:yourSavedDataIsStillInYourAccount')}</p>
              <Link to="/sign-in">{tr('app:goToSignIn')}</Link>
            </section>
          ) : location.pathname === '/' ? (
            <Welcome />
          ) : (
            <AuthPage key={location.pathname} />
          )}
        </main>
        <PrivacyNotice />
        <footer className="public-footer">
          <NavLink to="/privacy">{tr('app:privacyData')}</NavLink>
          <NavLink to="/about">{tr('app:aboutTheAuthor')}</NavLink>
          <span>{tr('app:aPersonalTrainingRecoveryJournal')}</span>
        </footer>
      </div>
    );
  }
  return (
    <PreferencesProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          {tr('app:skipToContent')}
        </a>
        <aside
          ref={sidebar}
          id="workspace-navigation"
          className={`sidebar ${menuOpen ? 'open' : ''}`}
        >
          <button
            className="icon-button mobile-menu sidebar-close"
            aria-label={tr('app:closeNavigation')}
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
          <NavLink className="brand" to="/" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">
              <Trans i18nKey="app:t" components={{ slot0: <span /> }} />
            </span>
            <span>
              <Trans
                i18nKey="app:teddMhenYourPersonalObservatory"
                components={{ slot0: <small /> }}
              />
            </span>
          </NavLink>
          <p className="nav-caption">{tr('app:workspace')}</p>
          <nav aria-label={tr('app:mainNavigation')}>
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
              <Trans
                i18nKey="app:noticeYourPatternsFindYourRhythm"
                components={{ slot0: <br /> }}
              />
            </p>
            <span>{tr('app:oneDayAtATime')}</span>
          </div>
          <div className="sidebar-bottom">
            <NavLink to="/account" onClick={() => setMenuOpen(false)}>
              <Trans i18nKey="app:account" components={{ slot0: <UserRound size={17} /> }} />
            </NavLink>
            <NavLink to="/privacy" onClick={() => setMenuOpen(false)}>
              <Trans i18nKey="app:privacyData2" components={{ slot0: <ShieldCheck size={17} /> }} />
            </NavLink>
            <NavLink to="/help" onClick={() => setMenuOpen(false)}>
              <Trans
                i18nKey="app:guideMethodology"
                components={{ slot0: <BookOpen size={17} />, slot1: <ArrowUpRight size={14} /> }}
              />
            </NavLink>
            <div className="profile">
              <span className="avatar">{demo ? 'D' : 'Y'}</span>
              <div>
                <strong>{demo ? tr('app:demoWorkspace') : tr('app:yourWorkspace')}</strong>
                <small>
                  {session.data?.local
                    ? tr('app:localDevelopment')
                    : demo
                      ? tr('app:syntheticDataOnly')
                      : tr('app:privateJournal')}
                </small>
              </div>
              <ShieldCheck size={16} />
            </div>
          </div>
        </aside>
        {menuOpen && (
          <button
            className="nav-backdrop"
            aria-label={tr('app:dismissNavigation')}
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
                aria-label={menuOpen ? tr('app:closeNavigation') : tr('app:openNavigation')}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
                <span className="menu-label">{tr('app:menu')}</span>
              </button>
              <span>{tr('app:workspace2')}</span>
              <span className="slash">/</span>
              <strong>
                {nav.find(
                  (n) =>
                    n.to === pathname ||
                    (n.to === '/analysis' && pathname.startsWith('/analysis/')),
                )?.label ||
                  (pathname === '/about'
                    ? tr('app:aboutTheAuthor')
                    : pathname === '/privacy'
                      ? tr('app:privacyData')
                      : pathname === '/account'
                        ? tr('app:account2')
                        : tr('app:guideMethodology2'))}
              </strong>
            </div>
            <div className="topbar-tools">
              <AppearanceControl />
              <LanguageControl />
              <span className={`privacy-pill ${demo ? 'demo' : ''}`}>
                <span />
                {demo
                  ? tr('app:demoData')
                  : session.data?.local
                    ? tr('app:localWorkspace')
                    : tr('app:privateByDesign')}
              </span>
            </div>
          </header>
          {demo && (
            <aside className="demo-banner" aria-label={tr('app:demoInformation')}>
              <div className="demo-description">
                <FlaskConical size={20} />
                <div>
                  <strong>{tr('app:exploreTheDemo')}</strong>
                  <p>{tr('app:syntheticDataEditsResetWhenYouLeaveOrReload')}</p>
                </div>
              </div>
              <nav className="demo-actions" aria-label={tr('app:accountAccess')}>
                <Link className="button secondary" to="/sign-in">
                  {tr('app:signIn')}
                </Link>
                <Link className="button primary" to="/register">
                  <Trans
                    i18nKey="app:createAccount"
                    components={{ slot0: <ArrowUpRight size={15} /> }}
                  />
                </Link>
              </nav>
            </aside>
          )}
          {session.error && !demo && (
            <div className="setup-banner">
              <ShieldCheck size={17} />
              <span>{session.error}</span>
              <button className="button secondary" onClick={session.retry}>
                {tr('app:retryConnection')}
              </button>
              <Link to="/sign-in">{tr('app:signInAgain')}</Link>
            </div>
          )}
          <main id="main" tabIndex={-1}>
            <PreferencesStatus />
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
                    <section className="panel">
                      <EmptyState
                        title={tr('app:thisPageCouldNotBeFound')}
                        description={tr('app:returnToYourOverviewAndChooseAPageFrom')}
                        action={false}
                      />
                      <WorkspaceLink className="button primary" to="/">
                        {tr('app:backToOverview')}
                      </WorkspaceLink>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
            <PrivacyNotice />
            <footer className="page-footer">
              <span>
                <Trans i18nKey="app:teddMhen2" components={{ slot0: <Activity size={13} /> }} />
              </span>
              <span>{tr('app:yourObservationsALittleMorePerspective')}</span>
              <NavLink to="/privacy">{tr('app:privacyData')}</NavLink>
              <NavLink to="/about">{tr('app:aboutTheAuthor')}</NavLink>
            </footer>
          </main>
        </div>
      </div>
    </PreferencesProvider>
  );
}
