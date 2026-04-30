'use client';
import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

interface Ray {
  left: string;
  rotation: number;
  duration: number;
  delay: number;
  width: number;
  dx: number;
  opacity: number;
}

const RAYS: Ray[] = [
  { left: '8%',  rotation: -18, duration: 8,  delay: 0,   width: 3,  dx: -40, opacity: 0.7 },
  { left: '18%', rotation: -10, duration: 11, delay: 1.5, width: 2,  dx: -20, opacity: 0.5 },
  { left: '28%', rotation: -4,  duration: 9,  delay: 0.8, width: 4,  dx: -10, opacity: 0.8 },
  { left: '38%', rotation: 2,   duration: 13, delay: 2.2, width: 2,  dx: 10,  opacity: 0.4 },
  { left: '48%', rotation: 0,   duration: 10, delay: 0.3, width: 5,  dx: 0,   opacity: 0.9 },
  { left: '55%', rotation: 5,   duration: 12, delay: 1.8, width: 2,  dx: 15,  opacity: 0.5 },
  { left: '63%', rotation: 10,  duration: 8,  delay: 0.6, width: 3,  dx: 25,  opacity: 0.7 },
  { left: '72%', rotation: 16,  duration: 14, delay: 2.5, width: 2,  dx: 35,  opacity: 0.4 },
  { left: '80%', rotation: 22,  duration: 9,  delay: 1.1, width: 4,  dx: 50,  opacity: 0.6 },
  { left: '88%', rotation: 28,  duration: 11, delay: 3.0, width: 2,  dx: 60,  opacity: 0.5 },
  { left: '22%', rotation: -14, duration: 15, delay: 4.0, width: 1,  dx: -30, opacity: 0.3 },
  { left: '58%', rotation: 8,   duration: 16, delay: 3.5, width: 1,  dx: 20,  opacity: 0.3 },
];

export default function GodRays() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const rays = containerRef.current.querySelectorAll<HTMLElement>('.gr-ray');

    rays.forEach((ray, i) => {
      const r = RAYS[i];
      gsap.set(ray, { opacity: 0 });

      gsap.to(ray, {
        opacity: r.opacity * 0.6,
        duration: r.duration * 0.4,
        delay: r.delay,
        ease: 'power1.in',
        onComplete: () => {
          gsap.to(ray, {
            opacity: 0,
            duration: r.duration * 0.6,
            ease: 'power1.out',
            onComplete: () => {
              gsap.fromTo(
                ray,
                { opacity: 0 },
                {
                  opacity: r.opacity * 0.6,
                  duration: r.duration,
                  delay: Math.random() * 4,
                  ease: 'sine.inOut',
                  yoyo: true,
                  repeat: -1,
                }
              );
            },
          });
        },
      });

      // Subtle horizontal drift
      gsap.to(ray, {
        x: r.dx * 0.3,
        duration: r.duration * 2,
        delay: r.delay,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });

    return () => {
      gsap.killTweensOf(rays);
    };
  }, []);

  return (
    <div ref={containerRef} className="god-rays" aria-hidden="true">
      {/* Ambient orbs */}
      <div className="orb" style={{ width: 600, height: 600, left: '20%', top: '-10%',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 70%)' }} />
      <div className="orb" style={{ width: 500, height: 500, right: '15%', top: '5%',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--gradient2) 10%, transparent) 0%, transparent 70%)' }} />
      <div className="orb" style={{ width: 300, height: 300, left: '50%', top: '30%',
        transform: 'translateX(-50%)',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 6%, transparent) 0%, transparent 70%)' }} />

      {/* Rays */}
      {RAYS.map((ray, i) => (
        <div
          key={i}
          className="gr-ray"
          style={{
            position: 'absolute',
            top: '-10%',
            left: ray.left,
            width: `${ray.width}px`,
            height: '130%',
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              color-mix(in srgb, var(--primary) 0%, transparent) 5%,
              color-mix(in srgb, var(--primary) 22%, transparent) 35%,
              color-mix(in srgb, var(--gradient2) 14%, transparent) 65%,
              color-mix(in srgb, var(--primary) 5%, transparent) 85%,
              transparent 100%
            )`,
            transform: `rotate(${ray.rotation}deg)`,
            transformOrigin: 'top center',
            filter: `blur(${ray.width + 2}px)`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(to bottom, transparent, var(--bg))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
