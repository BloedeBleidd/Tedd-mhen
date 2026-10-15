import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { NOTICE_KEY, readLocal, writeLocal } from '../lib/appearance';

export function PrivacyNotice() {
  const [visible, setVisible] = useState(() => readLocal(NOTICE_KEY) !== '1');
  if (!visible) return null;
  return (
    <aside className="privacy-notice" aria-label="Cookies and data notice">
      <ShieldCheck size={22} />
      <div>
        <strong>Cookies & your data</strong>
        <p>
          We use necessary sign-in cookies. Saved journals are stored in Cloudflare; appearance
          preferences stay in your browser. No advertising or analytics trackers.
        </p>
        <Link to="/privacy">Read about privacy & data</Link>
      </div>
      <button
        className="button secondary small-button"
        onClick={() => {
          writeLocal(NOTICE_KEY, '1');
          setVisible(false);
        }}
      >
        Got it
      </button>
    </aside>
  );
}
