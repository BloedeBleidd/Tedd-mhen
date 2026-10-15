import { useEffect, type RefObject } from 'react';
import { useBlocker } from 'react-router-dom';

export function PendingAccountGuard({ pending }: { pending: RefObject<boolean> }) {
  const blocker = useBlocker(() => pending.current);
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!pending.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [pending]);
  return pending.current ? (
    <p role="status">
      Keep this page open while your account request finishes. Navigation will be available when it
      completes.
    </p>
  ) : null;
}
