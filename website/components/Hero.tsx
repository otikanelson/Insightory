'use client';
import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import GodRays from './GodRays';

export default function Hero() {
  const sectionRef  = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef      = useRef<HTMLParagraphElement>(null);
  const ctasRef     = useRef<HTMLDivElement>(null);
  const badgesRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.8 });
      const words = headlineRef.current?.querySelectorAll('.word');
      if (words) {
        tl.fromTo(words,
          { y: 60, opacity: 0, rotateX: -30 },
          { y: 0, opacity: 1, rotateX: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }
        );
      }
      tl.fromTo(subRef.current,   { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.3')
        .fromTo(ctasRef.current,  { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, '-=0.4')
        .fromTo(badgesRef.current,{ y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.4');
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const words = 'Smart Inventory. Zero Guesswork.'.split(' ');

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-24 pb-16"
      style={{ background: 'var(--bg)' }}
    >
      <GodRays />

      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(color-mix(in srgb, var(--primary) 4%, transparent) 1px, transparent 1px),
          linear-gradient(90deg, color-mix(in srgb, var(--primary) 4%, transparent) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col items-center text-center">

        {/* Headline */}
        <h1 ref={headlineRef} className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-6"
          style={{ perspective: '800px' }}>
          {words.map((word, i) => (
            <span key={i} className="word inline-block mr-[0.25em] last:mr-0">
              {word === 'Smart' || word === 'Zero' ? (
                <span className="gradient-text">{word}</span>
              ) : (
                <span style={{ color: 'var(--text)' }}>{word}</span>
              )}
            </span>
          ))}
        </h1>

        {/* Sub */}
        <p ref={subRef} className="text-lg md:text-xl max-w-2xl leading-relaxed mb-10"
          style={{ color: 'var(--subtext)' }}>
          Insightory gives your business real-time inventory intelligence — track stock, predict demand, scan products, and get AI-powered alerts before you run out.
        </p>

        {/* CTAs */}
        <div ref={ctasRef} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <a href="#download"
            onClick={(e) => { e.preventDefault(); document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="btn-glow flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold"
            style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}
            aria-disabled="true"
            tabIndex={-1}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Download for iOS
          </a>
          <a href="#download"
            onClick={(e) => { e.preventDefault(); document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold glass border transition-all duration-300"
            style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent2) 60%, transparent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.18 23.76c.3.17.64.22.99.14l12.12-6.99-2.54-2.54-10.57 9.39zM.5 1.26C.19 1.6 0 2.1 0 2.73v18.54c0 .63.19 1.13.5 1.47l.08.07 10.39-10.39v-.24L.58 1.19.5 1.26zM20.1 10.53l-2.9-1.67-2.85 2.85 2.85 2.85 2.92-1.68c.83-.48.83-1.27-.02-1.35zM4.17.24L16.29 7.23l-2.54 2.54L3.18.38C3.53.3 3.87.07 4.17.24z"/>
            </svg>
            Download for Android
          </a>
        </div>

        {/* Trust badges */}
        <div ref={badgesRef} className="flex flex-wrap items-center mt justify-center gap-6 text-sm"
          style={{ color: 'var(--subtext)'}}>
          {[
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ),
              text: '4.9 App Store Rating',
            },
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ),
              text: 'Enterprise Security',
            },
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 2 13 9 20 9"/><path d="M21 3L13 11"/><path d="M3 12a9 9 0 1 0 18 0"/>
                </svg>
              ),
              text: 'Real-time Sync',
            },
            {
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              ),
              text: 'Multi-store Support',
            },
          ].map((b) => (
            <div key={b.text} className="flex items-center gap-2">
              <span style={{ color: 'var(--primary)' }}>{b.icon}</span><span>{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
