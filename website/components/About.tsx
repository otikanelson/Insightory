'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const steps = [
  {
    num: '01',
    title: 'Set up your store',
    desc: 'Create your account, add your store details, and invite your team in minutes.',
    color: '#2aa3f5',
  },
  {
    num: '02',
    title: 'Add your products',
    desc: 'Scan barcodes or manually add products. Import existing catalogs with a single tap.',
    color: '#7c3aed',
  },
  {
    num: '03',
    title: 'Track in real time',
    desc: 'Every sale, restock, and transfer is logged instantly across all your devices.',
    color: '#10b981',
  },
  {
    num: '04',
    title: 'Act on insights',
    desc: 'Let AI surface what matters — reorder alerts, demand forecasts, and expiry warnings.',
    color: '#f59e0b',
  },
];

export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

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

      const items = stepsRef.current?.querySelectorAll('.step-item');
      if (items) {
        gsap.fromTo(
          items,
          { x: -40, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: 'power3.out',
            scrollTrigger: { trigger: stepsRef.current, start: 'top 80%' },
          }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="about" className="relative py-32 px-6 overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="orb" style={{ width: 400, height: 400, right: '5%', top: '20%', background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 7%, transparent) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-20 items-center">
          {/* Left */}
          <div ref={titleRef} className="flex-1 max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--primary)' }}>How it works</p>
            <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight" style={{ color: 'var(--text)' }}>
              Up and running in <span className="gradient-text">minutes</span>
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--subtext)' }}>
              Insightory is designed to get out of your way. No complex setup, no training required — just powerful inventory management that works from day one.
            </p>

            {/* Testimonial */}
            <div className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  JM
                </div>
                <div>
                  <p className="text-sm leading-relaxed italic mb-3" style={{ color: 'var(--subtext)' }}>
                    "Insightory cut our stockout incidents by 80% in the first month. The AI alerts are genuinely impressive."
                  </p>
                  <div className="text-xs font-medium" style={{ color: 'var(--subtext)' }}>James M. — Retail Store Owner</div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div ref={stepsRef} className="flex-1 flex flex-col gap-6">
            {steps.map((s, i) => (
              <div
                key={i}
                className="step-item flex items-start gap-6 glass-card p-6 feature-card"
              >
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
                  style={{
                    background: `linear-gradient(135deg, ${s.color}20, ${s.color}08)`,
                    border: `1px solid ${s.color}30`,
                    color: s.color,
                  }}
                >
                  {s.num}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--subtext)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
