import { ArrowUpRight, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Welcome() {
  return (
    <section className="welcome-card auth-card">
      <p className="eyebrow">TRAINING · SLEEP · RECOVERY</p>
      <h1>
        Your days.
        <br />A clearer picture.
      </h1>
      <p>
        Connect how you train, sleep and feel. Explore your patterns with clear charts, correlations
        and Bayesian predictions.
      </p>
      <Link className="button primary demo-entry" to="/demo">
        <FlaskConical size={19} /> Try demo <ArrowUpRight size={18} />
      </Link>
      <p className="demo-entry-hint">No account needed. Explore a complete example journal.</p>
      <div className="welcome-features">
        <span>Daily check-ins & training</span>
        <span>Relationships & predictions</span>
        <span>Import & export</span>
      </div>
      <nav className="welcome-actions" aria-label="Account access">
        <Link className="button secondary" to="/register">
          Create account
        </Link>
        <Link className="button secondary" to="/sign-in">
          Sign in
        </Link>
      </nav>
    </section>
  );
}
