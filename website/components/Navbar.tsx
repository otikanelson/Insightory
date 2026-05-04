'use client';
import { gsap } from 'gsap';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const links = [
  { label: 'Features',    href: '#features' },
  { label: 'Screenshots', href: '#screenshots' },
  { label: 'Download',    href: '#download' },
  { label: 'About',       href: '#about' },
];

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function Navbar() {
  const navRef   = useRef<HTMLElement>(null);
  const logoRef  = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const ctaRef   = useRef<HTMLDivElement>(null);
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const { isDark } = useTheme();

  /* ── Entrance animation ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });
      tl.fromTo(navRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
      )
      .fromTo(logoRef.current,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }, '-=0.5'
      )
      .fromTo(
        linksRef.current?.children ? Array.from(linksRef.current.children) : [],
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, '-=0.4'
      )
      .fromTo(ctaRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.3'
      );
    });
    return () => ctx.revert();
  }, []);

  /* ── Scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Animate glass on scroll ── */
  useEffect(() => {
    if (!navRef.current) return;
    const bg = isDark
      ? scrolled ? 'rgba(8,11,24,0.82)' : 'rgba(8,11,24,0)'
      : scrolled ? 'rgba(240,240,240,0.88)' : 'rgba(240,240,240,0)';
    const border = scrolled
      ? isDark ? 'rgba(30,34,64,0.9)' : 'rgba(91,79,232,0.15)'
      : 'rgba(255,255,255,0)';

    gsap.to(navRef.current, {
      backgroundColor: bg,
      borderBottomColor: border,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, [scrolled, isDark]);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 border-b border-transparent"
      style={{ backdropFilter: scrolled ? 'blur(24px)' : 'none', willChange: 'background-color' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div
          ref={logoRef}
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="relative w-9 h-9">
            <Image
              src={isDark ? '/images/icon.png' : '/images/icon_light.png'}
              alt="Insightory"
              fill
              className="object-contain"
            />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--text)' }}>
            Insight<span className="gradient-text">ory</span>
          </span>
        </div>

        {/* Desktop links */}
        <ul ref={linksRef} className="hidden md:flex items-center gap-8 list-none">
          {links.map((l) => (
            <li key={l.label}>
              <button
                onClick={() => handleNavClick(l.href)}
                className="nav-link text-sm font-medium transition-colors duration-200"
                style={{ color: 'var(--subtext)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtext)')}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Right side: toggle + CTA */}
        <div ref={ctaRef} className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://play.google.com/store/apps/details?id=com.son_the_nel.Inventory"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/>
              <path d="M20 18H4v2h16v-2z"/>
            </svg>
            Get the App
          </a>
        </div>

        {/* Mobile: toggle + hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <ThemeToggle />
          <button
            className="flex flex-col gap-1.5 p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 transition-all duration-300`}
              style={{ background: 'var(--text)', transform: menuOpen ? 'rotate(45deg) translateY(8px)' : 'none' }} />
            <span className={`block w-6 h-0.5 transition-all duration-300`}
              style={{ background: 'var(--text)', opacity: menuOpen ? 0 : 1 }} />
            <span className={`block w-6 h-0.5 transition-all duration-300`}
              style={{ background: 'var(--text)', transform: menuOpen ? 'rotate(-45deg) translateY(-8px)' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden glass-strong transition-all duration-300 overflow-hidden border-t`}
        style={{
          maxHeight: menuOpen ? '320px' : '0',
          opacity: menuOpen ? 1 : 0,
          borderColor: 'var(--border)',
        }}
      >
        <ul className="flex flex-col px-6 py-4 gap-4 list-none">
          {links.map((l) => (
            <li key={l.label}>
              <button
                onClick={() => handleNavClick(l.href)}
                className="text-base font-medium w-full text-left transition-colors duration-200"
                style={{ color: 'var(--subtext)' }}
              >
                {l.label}
              </button>
            </li>
          ))}
          <li>
            <a
              href="https://play.google.com/store/apps/details?id=com.son_the_nel.Inventory"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-glow inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mt-2"
            >
              Get the App
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
