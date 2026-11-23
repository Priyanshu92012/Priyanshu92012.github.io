// The Pet Bot mascot: an original tiger cub drawn as one small inline SVG (~3 KB).
// Colours come from CSS custom properties (--pb-*), so each concept restyles it without
// new artwork. Moods: idle · happy · curious · wave. All motion is CSS and stops under
// reduced motion.
import { useId } from 'react';

export type Mood = 'idle' | 'happy' | 'curious' | 'wave';

export default function Mascot({ mood = 'idle', blink = false, title }: { mood?: Mood; blink?: boolean; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fur = `pbf${uid}`, glow = `pbg${uid}`;
  return (
    <svg className="pb-mascot" data-mood={mood} data-blink={blink ? '' : undefined} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <radialGradient id={fur} cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--pb-fur-hi)" />
          <stop offset="0.55" stopColor="var(--pb-fur)" />
          <stop offset="1" stopColor="var(--pb-fur-lo)" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--pb-accent)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--pb-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="pb-shadow" cx="60" cy="116" rx="30" ry="3.2" />

      {/* tail: curls up behind the body */}
      <g className="pb-tail">
        <path d="M80 104c12 2 22-4 23-16 .8-8-4-13-9-12" fill="none" stroke={`url(#${fur})`} strokeWidth="8" strokeLinecap="round" />
        <path d="M80 104c12 2 22-4 23-16 .8-8-4-13-9-12" fill="none" stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeLinecap="round" opacity="var(--pb-line-o)" />
        <path d="M96 100.5l-3-5M102 93l-5-2.5M103 84l-5.6.4" stroke="var(--pb-stripe)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="94" cy="76.4" r="4.4" fill="var(--pb-stripe)" />
      </g>

      {/* body */}
      <g className="pb-body">
        <path d="M34 112c-3-17 7-33 26-33s29 16 26 33z" fill={`url(#${fur})`} stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
        <path d="M48 112c-1-11 4-20 12-20s13 9 12 20z" fill="var(--pb-cream)" />
        <path d="M38 96l5 2M37 103l5.4 1M82 96l-5 2M83 103l-5.4 1" stroke="var(--pb-stripe)" strokeWidth="2.2" strokeLinecap="round" />
        {/* collar with a tiny signal tag: the "bot" part */}
        <path className="pb-collar" d="M42 84c11 6 25 6 36 0" fill="none" stroke="var(--pb-collar)" strokeWidth="3.4" strokeLinecap="round" />
        <circle className="pb-tag-glow" cx="60" cy="89.6" r="7" fill={`url(#${glow})`} />
        <circle className="pb-tag" cx="60" cy="89.6" r="3" fill="var(--pb-accent)" stroke="var(--pb-line)" strokeWidth="0.8" strokeOpacity="var(--pb-line-o)" />
        <ellipse cx="49" cy="112.5" rx="8.4" ry="5" fill="var(--pb-cream)" stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
        <g className="pb-paw-r">
          <ellipse cx="71" cy="112.5" rx="8.4" ry="5" fill="var(--pb-cream)" stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
        </g>
      </g>

      {/* head */}
      <g className="pb-head">
        <g className="pb-ear pb-ear-l">
          <path d="M27 36c-6-14 0-25 9-25 7 0 12 6 14 11z" fill={`url(#${fur})`} stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
          <path d="M32 31c-3-8 0-14 5-14 3.6 0 6.4 3 7.6 6z" fill="var(--pb-ear)" />
        </g>
        <g className="pb-ear pb-ear-r">
          <path d="M93 36c6-14 0-25-9-25-7 0-12 6-14 11z" fill={`url(#${fur})`} stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
          <path d="M88 31c3-8 0-14-5-14-3.6 0-6.4 3-7.6 6z" fill="var(--pb-ear)" />
        </g>
        <path d="M60 18c22 0 37 13 37 33 0 19-16 30-37 30S23 70 23 51c0-20 15-33 37-33z" fill={`url(#${fur})`} stroke="var(--pb-line)" strokeWidth="var(--pb-line-w)" strokeOpacity="var(--pb-line-o)" />
        {/* forehead + cheek stripes */}
        <path d="M60 20.5v9M51.5 22.4l2.4 7.4M68.5 22.4l-2.4 7.4" stroke="var(--pb-stripe)" strokeWidth="3" strokeLinecap="round" />
        <path d="M24.6 47l8 2.2M25 55.6l7.6.6M95.4 47l-8 2.2M95 55.6l-7.6.6" stroke="var(--pb-stripe)" strokeWidth="2.6" strokeLinecap="round" />
        {/* muzzle */}
        <path d="M60 58c-9 0-17 4-17 11 0 6 7 10 17 10s17-4 17-10c0-7-8-11-17-11z" fill="var(--pb-cream)" />
        <ellipse className="pb-blush" cx="36" cy="63" rx="5.4" ry="3.2" fill="var(--pb-blush)" />
        <ellipse className="pb-blush" cx="84" cy="63" rx="5.4" ry="3.2" fill="var(--pb-blush)" />
        {/* eyes: open */}
        <g className="pb-eyes">
          <g className="pb-eye">
            <ellipse cx="45.5" cy="49" rx="5.6" ry="7" fill="var(--pb-eye)" />
            <circle cx="47.6" cy="46.2" r="2.1" fill="#fff" />
            <circle cx="43.8" cy="51.8" r="1" fill="var(--pb-glint)" />
          </g>
          <g className="pb-eye">
            <ellipse cx="74.5" cy="49" rx="5.6" ry="7" fill="var(--pb-eye)" />
            <circle cx="76.6" cy="46.2" r="2.1" fill="#fff" />
            <circle cx="72.8" cy="51.8" r="1" fill="var(--pb-glint)" />
          </g>
        </g>
        {/* eyes: happy */}
        <path className="pb-eyes-happy" d="M40 50.5q5.5-7 11 0M69 50.5q5.5-7 11 0" fill="none" stroke="var(--pb-eye)" strokeWidth="3" strokeLinecap="round" />
        <path d="M56.4 61.4h7.2c.9 0 1.4 1 .8 1.7l-3.6 3.6c-.4.4-1 .4-1.4 0l-3.6-3.6c-.6-.7-.1-1.7.8-1.7z" fill="var(--pb-nose)" />
        <path className="pb-mouth" d="M60 67v2.4m-5.4.4q2.7 2.8 5.4 0 2.7 2.8 5.4 0" fill="none" stroke="var(--pb-eye)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
