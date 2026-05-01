'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const screens = [
  { light: '/images/dashboard.jpeg',  dark: '/images/dashboard_dark.jpeg',  label: 'Dashboard', desc: 'Your inventory at a glance — live stock levels, alerts, and key metrics.' },
  { light: '/images/inventory.jpeg',  dark: '/images/inventory_dark.jpeg',  label: 'Inventory', desc: 'Browse, filter, and manage every product in your catalog with ease.' },
  { light: '/images/analytics.jpeg',  dark: '/images/analytics_dark.jpeg',  label: 'Analytics', desc: 'AI-driven insights and demand forecasting to stay ahead of the curve.' },
  { light: '/images/scan.jpeg',       dark: '/images/scan_dark.jpeg',       label: 'Scanning',  desc: 'Instant barcode scanning to log sales and update stock in real time.' },
  { light: '/images/alerts.jpeg',     dark: '/images/alerts_dark.jpeg',     label: 'Alerts',    desc: 'Smart notifications so you never miss a low-stock or expiry event.' },
  { light: '/images/settings.jpeg',   dark: '/images/settings_dark.jpeg',   label: 'Settings',  desc: 'Full control over your store, staff, and notification preferences.' },
];

export default function Screenshots() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const phoneRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: titleRef.current, start: 'top 85%' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const switchScreen = (idx: number) => {
    if (idx === active) return;

    // Animate out
    gsap.to(phoneRef.current, {
      scale: 0.92, opacity: 0, y: 20, duration: 0.25, ease: 'power2.in',
      onComplete: () => {
        setActive(idx);
        gsap.fromTo(
          phoneRef.current,
          { scale: 0.92, opacity: 0, y: -20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' }
        );
      },
    });

    gsap.to(infoRef.current, {
      opacity: 0, y: 10, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        gsap.fromTo(infoRef.current, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      },
    });
  };

  // Auto-cycle
  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % screens.length;
        gsap.fromTo(phoneRef.current, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.4)' });
        return next;
      });
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section ref={sectionRef} id="screenshots" className="relative py-32 px-6 overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="orb" style={{ width: 500, height: 500, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, color-mix(in srgb, var(--gradient2) 7%, transparent) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto">
        {/* Title */}
        <div ref={titleRef} className="text-center mb-20">
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--primary)' }}>See it in action</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6" style={{ color: 'var(--text)' }}>
            Beautiful by <span className="gradient-text">design</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--subtext)' }}>
            Every screen crafted for clarity and speed. Inventory management has never looked this good.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-16 justify-center">
          {/* Phone */}
          <div className="relative flex-shrink-0">
            {/* Glow */}
            <div
              className="absolute inset-0 rounded-[44px]"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(42,163,245,0.25) 0%, rgba(124,58,237,0.15) 50%, transparent 70%)',
                filter: 'blur(40px)',
                transform: 'scale(1.4)',
              }}
            />
            <div ref={phoneRef} className="phone-frame relative" style={{ width: 280, height: 580 }}>
              <Image
                src={isDark ? screens[active].dark : screens[active].light}
                alt={screens[active].label}
                fill
                className="object-cover"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
                  borderRadius: '44px',
                }}
              />
            </div>
          </div>

          {/* Info + tabs */}
          <div className="flex flex-col gap-8 max-w-md w-full">
            {/* Current screen info */}
            <div ref={infoRef}>
              <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs text-brand-400 font-semibold mb-4 border border-brand-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                {screens[active].label}
              </div>
              <h3 className="text-3xl font-bold mb-3" style={{ color: 'var(--text)' }}>{screens[active].label} View</h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--subtext)' }}>{screens[active].desc}</p>
            </div>

            {/* Tab buttons */}
            <div className="grid grid-cols-3 gap-3">
              {screens.map((s, i) => (
                <button
                  key={i}
                  onClick={() => switchScreen(i)}
                  className={`relative rounded-2xl overflow-hidden transition-all duration-300${i % 2 === 0 ? ' aurora-card' : ''} ${
                    i === active
                      ? 'ring-2 ring-brand-400 scale-105'
                      : 'opacity-50 hover:opacity-80 hover:scale-102'
                  }`}
                  style={{ aspectRatio: '9/16' }}
                  aria-label={s.label}
                >
                  <Image src={isDark ? s.dark : s.light} alt={s.label} fill className="object-cover" />
                  <div className={`absolute inset-0 transition-opacity duration-300 ${i === active ? 'bg-brand-500/10' : 'bg-black/30'}`} />
                  <span className="absolute bottom-1.5 left-0 right-0 text-center text-white text-[10px] font-semibold">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {screens.map((_, i) => (
                <button
                  key={i}
                  onClick={() => switchScreen(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === active ? 'w-6 h-2 bg-brand-400' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Go to screen ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
