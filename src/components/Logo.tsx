import Link from 'next/link';

/** Logo riêng của project: ô vuông xanh bo góc với ba cột đi lên. */
export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 42 42" aria-hidden="true">
      <rect x="5" y="5" width="35" height="35" rx="11" fill="var(--ink)" />
      <rect x="2" y="2" width="35" height="35" rx="11" fill="var(--brand)" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="9" y="22" width="6" height="9" rx="1.8" fill="var(--ink)" />
      <rect x="17" y="16" width="6" height="15" rx="1.8" fill="var(--ink)" />
      <rect x="25" y="9" width="6" height="22" rx="1.8" fill="var(--ink)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Band 8.0 Practice, trang chủ">
      <LogoMark />
      <span>Band 8.0 <em>Practice</em></span>
    </Link>
  );
}
