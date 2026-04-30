'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState } from 'react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const stats = [
  { value: 10000, suffix: '+', label: 'Products Tracked', icon: '📦' },
  { value: 99.9, suffix: '%', label: 'Uptime Guaranteed', icon: '⚡', decimals: 1 },
  { value: 500, suffix: '+', label: 'Stores Powered', icon: '🏪' },
  { value: 4.9, suffix: '★', label: 'App Store Rating', icon: '⭐', decimals: 1 },
];

function Counter({ target, suffix, decimals = 0 }: { target: number; suffix: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const trigger = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top 85%',
      onEnter: () => {
        if (triggered.current) return;
        triggered.current = true;
        gsap.to({ v: 0 }, {
          v: target,
          duration: 2,
          ease: 'power2.out',
          onUpdate: function () {
            setVal(parseFloat(this.targets()[0].v.toFixed(decimals)));
          },
        });
      },
    });
    return () => trigger.kill();
  }, [target, decimals]);

  return (
    <span ref={ref}>
      {decimals > 0 ? val.toFixed(decimals) : val.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll('.stat-item');
      if (cards) {
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out',
            scrollTrigger: { trigger: cardsRef.current, start: 'top 85%' },
          }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 px-6">
      <div className="divider mb-20" />
      <div ref={cardsRef} className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="stat-item stat-card p-8 text-center">
            <div className="text-3xl mb-3">{s.icon}</div>
            <div className="text-4xl md:text-5xl font-black gradient-text mb-2">
              <Counter target={s.value} suffix={s.suffix} decimals={s.decimals} />
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--subtext)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="divider mt-20" />
    </section>
  );
}
