'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: 'chart' },
  { href: '/reading', label: 'Reading', icon: 'book' },
  { href: '/listening', label: 'Listening', icon: 'headphones' },
  { href: '/writing', label: 'Writing', icon: 'pen' },
  { href: '/speaking', label: 'Speaking', icon: 'mic' },
  { href: '/vocabulary', label: 'Vocabulary', icon: 'cards' },
];

export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isOn = (href: string) => path === href || path.startsWith(`${href}/`);

  async function signOut() {
    await logout();
    router.push('/');
  }

  return (
    <>
      <header className="site-header">
        <Logo />
        <nav className="header-nav" aria-label="Các kỹ năng">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isOn(l.href) ? 'page' : undefined}>{l.label}</Link>
          ))}
        </nav>
        <div className="header-cta">
          {state.status === 'in' ? (
            <>
              <span className="who" title="Tài khoản đang đăng nhập">{state.user.username}</span>
              <button type="button" className="btn" onClick={signOut}>Đăng xuất</button>
            </>
          ) : state.status === 'out' ? (
            <Link href="/login" className="btn primary">Đăng nhập <Icon name="arrow" size={16} /></Link>
          ) : null}
        </div>
        <button
          type="button" className="menu-btn" aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open}
          aria-controls="mobile-menu" onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </header>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Menu">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isOn(l.href) ? 'page' : undefined}>
              <span className="dot-icon c-white"><Icon name={l.icon} size={18} /></span>{l.label}
            </Link>
          ))}
          {state.status === 'in' && (
            <button type="button" className="mobile-menu-btn" onClick={signOut}>
              <span className="dot-icon c-white"><Icon name="close" size={18} /></span>Đăng xuất ({state.user.username})
            </button>
          )}
          {state.status === 'out' && (
            <Link href="/login"><span className="dot-icon c-yellow"><Icon name="arrow" size={18} /></span>Đăng nhập</Link>
          )}
        </nav>
      )}
    </>
  );
}
