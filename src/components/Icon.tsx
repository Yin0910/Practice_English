import type { ReactElement } from 'react';

/** Bộ icon nét một màu (stroke = currentColor), không dùng emoji. */
const PATHS: Record<string, ReactElement> = {
  'chev-down': <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 5 5 9-10" />,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 0 4 21.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 1 1.5 1.5z" /></>,
  pen: <><path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z" /><path d="m14 7 3 3" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  cards: <><rect x="4" y="6" width="13" height="14" rx="2" /><path d="M8 3h11a1 1 0 0 1 1 1v13" /></>,
  home: <path d="m4 11 8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m12 8 1.6 2.4L16 12l-2.4 1.6L12 16l-1.6-2.4L8 12l2.4-1.6z" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  chart: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="M8 5v14l11-7z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
