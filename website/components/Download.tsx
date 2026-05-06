'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';
import { PhoneMockup } from './PhoneMockup';
import { useTheme } from '@/context/ThemeContext';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Download() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = gsap.context(() => {
      // Card entrance
      gsap.fromTo(
        cardRef.current,
        { y: 60, opacity: 0, scale: 0.96 },
        {
          y: 0, opacity: 1, scale: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: cardRef.current, start: 'top 80%' },
        }
      );

      // Left content
      gsap.fromTo(
        leftRef.current,
        { x: -40, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: cardRef.current, start: 'top 75%' },
        }
      );

      // Right phones
      gsap.fromTo(
        rightRef.current,
        { x: 40, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: cardRef.current, start: 'top 75%' },
        }
      );

      // Badges stagger
      const badges = badgesRef.current?.querySelectorAll('.dl-badge');
      if (badges) {
        gsap.fromTo(
          badges,
          { y: 20, opacity: 0, scale: 0.9 },
          {
            y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.15, ease: 'back.out(1.7)',
            scrollTrigger: { trigger: badgesRef.current, start: 'top 85%' },
          }
        );
      }

      // Floating phones
      const phones = rightRef.current?.querySelectorAll('.dl-phone');
      if (phones) {
        phones.forEach((phone, i) => {
          gsap.to(phone, {
            y: i % 2 === 0 ? -12 : 12,
            duration: 3 + i * 0.5,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: i * 0.4,
          });
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="download" className="relative py-32 px-6 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Background */}
      <div className="orb" style={{ width: 600, height: 600, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--gradient2) 6%, transparent) 50%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto">
        <div
          ref={cardRef}
          className="relative rounded-3xl overflow-hidden aurora-card"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--gradient2) 8%, transparent) 50%, var(--surface) 100%)',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
          }}
        >
          {/* Inner glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 30% 50%, rgba(42,163,245,0.06) 0%, transparent 60%)',
            }}
          />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: `linear-gradient(rgba(42,163,245,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(42,163,245,0.05) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 p-10 md:p-16">
            {/* Left */}
            <div ref={leftRef} className="flex-1 max-w-lg">

              <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight" style={{ color: 'var(--text)' }}>
                Take control of your inventory <span className="gradient-text">today</span>
              </h2>

              <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--subtext)' }}>
                Download Insightory for free and start managing your inventory smarter. Available on iOS and Android — no credit card required.
              </p>

              {/* Store badges */}
              <div ref={badgesRef} className="flex flex-col sm:flex-row gap-4">
                {/* App Store */}
                <a
                  href="#"
                  className="dl-badge store-badge flex items-center gap-4 glass-strong px-6 py-4 rounded-2xl border border-white/10 transition-colors duration-300"
                  aria-disabled="true"
                  style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)', opacity: 0.35 }}>
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--subtext)', opacity: 0.35 }}>Download on the</div>
                    <div className="font-bold text-lg leading-tight" style={{ color: 'var(--text)', opacity: 0.35 }}>App Store</div>
                  </div>
                </a>

                {/* Google Play */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.son_the_nel.Inventory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dl-badge store-badge aurora-card flex items-center gap-4 glass-strong px-6 py-4 rounded-2xl border border-white/10 hover:border-brand-500/40 transition-colors duration-300"
                  aria-label="Get it on Google Play"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)' }}>
                    <path d="M3.18 23.76c.3.17.64.22.99.14l12.12-6.99-2.54-2.54-10.57 9.39zM.5 1.26C.19 1.6 0 2.1 0 2.73v18.54c0 .63.19 1.13.5 1.47l.08.07 10.39-10.39v-.24L.58 1.19.5 1.26zM20.1 10.53l-2.9-1.67-2.85 2.85 2.85 2.85 2.92-1.68c.83-.48.83-1.27-.02-1.35zM4.17.24L16.29 7.23l-2.54 2.54L3.18.38C3.53.3 3.87.07 4.17.24z"/>
                  </svg>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--subtext)' }}>Get it on</div>
                    <div className="font-bold text-lg leading-tight" style={{ color: 'var(--text)' }}>Google Play</div>
                  </div>
                </a>
              </div>

              {/* QR hint */}
              <p className="mt-6 text-sm flex items-center gap-2" style={{ color: 'var(--subtext)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                Scan QR code in-app to share with your team
              </p>
            </div>

            {/* Right — phone stack */}
            <div ref={rightRef} className="relative flex-shrink-0 flex items-end justify-center gap-4 h-[600px] lg:ml-32">

              {/* Back phone */}
              <div
                className="dl-phone absolute"
                style={{ bottom: 0, left: '50%', transform: 'translateX(-120%) rotate(-8deg)', opacity: 0.6, zIndex: 1 }}
              >
                <PhoneMockup width={200} src={isDark ? '/images/analytics_dark.jpeg' : '/images/analytics.jpeg'} alt="Analytics screen" />
              </div>

              {/* Front phone */}
              <div className="dl-phone relative" style={{ zIndex: 2 }}>
                <PhoneMockup width={248} src={isDark ? '/images/inventory_dark.jpeg' : '/images/inventory.jpeg'} alt="Inventory screen" glare />
              </div>

              {/* Right phone */}
              <div
                className="dl-phone absolute"
                style={{ bottom: 0, left: '50%', transform: 'translateX(20%) rotate(8deg)', opacity: 0.6, zIndex: 1 }}
              >
                <PhoneMockup width={200} src={isDark ? '/images/scan_dark.jpeg' : '/images/scan.jpeg'} alt="Scan screen" />
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
