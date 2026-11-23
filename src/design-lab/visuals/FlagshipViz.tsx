// One island for the three flagship visuals (loaded with client:visible, so none of this code
// is on the initial page load). Interactions tell the Pet Bot, which may react once.
import { useCallback, useRef } from 'react';
import { emitPet } from '../../islands/petbot/events';
import SchedulerViz from './SchedulerViz';
import SecureViz from './SecureViz';
import XaiViz from './XaiViz';
import './viz.css';

export default function FlagshipViz({ kind, slug }: { kind: 'scheduler' | 'securemed' | 'xai'; slug: string }) {
  const told = useRef(false);
  const onInteract = useCallback(() => {
    if (told.current) return;
    told.current = true;
    emitPet({ kind: 'project', slug });
  }, [slug]);
  if (kind === 'scheduler') return <SchedulerViz onInteract={onInteract} />;
  if (kind === 'securemed') return <SecureViz onInteract={onInteract} />;
  return <XaiViz onInteract={onInteract} />;
}
