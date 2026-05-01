'use client';
import NavLogo from './NavLogo';

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

export default function Footer() {
  return (
    <footer className="relative border-t pt-20 pb-10 px-6 overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      {/* Aurora */}
      <div className="aurora-blob" style={{ width: 800, height: 400, left: '-10%', top: '-120px', background: 'radial-gradient(ellipse, rgba(124, 111, 247, 0.55) 0%, rgba(124, 111, 247, 0.15) 50%, transparent 70%)', animation: 'aurora-1 14s ease-in-out infinite' }} />
      <div className="aurora-blob" style={{ width: 700, height: 350, left: '25%',  top: '-100px', background: 'radial-gradient(ellipse, rgba(227, 43, 216, 0.5)  0%, rgba(227, 43, 216, 0.12) 50%, transparent 70%)', animation: 'aurora-2 18s ease-in-out infinite' }} />
      <div className="aurora-blob" style={{ width: 600, height: 300, right: '-8%', top: '-110px', background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.5)  0%, rgba(167, 139, 250, 0.12) 50%, transparent 70%)', animation: 'aurora-3 12s ease-in-out infinite' }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5 cursor-pointer" onClick={scrollToTop}>
              <NavLogo size={9} />
              <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--text)' }}>
                Insight<span className="gradient-text">ory</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-6" style={{ color: 'var(--subtext)' }}>
              Smart inventory management for modern retail. Track stock, predict demand, and grow your business with confidence.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { label: 'Twitter', icon: <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/> },
                { label: 'Instagram', icon: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></> },
                { label: 'LinkedIn', icon: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></> },
              ].map((s) => (
                <a
                  key={s.label}
                  href="https://www.linkedin.com/in/otika-somtochukwu-0318622b2/"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl glass flex items-center justify-center transition-all duration-200 border"
                  style={{ color: 'var(--subtext)', borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent2)'; (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--accent2) 40%, transparent)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--subtext)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>Product</h4>
            <ul className="flex flex-col gap-3 list-none">
              {[
                { label: 'Features',    href: '/#features' },
                { label: 'Screenshots', href: '/#screenshots' },
                { label: 'Download',    href: '/#download' },
                { label: 'About',       href: '/#about' },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href}
                    onClick={(e) => {
                      if (l.href.startsWith('/#')) {
                        e.preventDefault();
                        document.querySelector(l.href.replace('/#','#'))?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--subtext)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtext)')}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>Legal & Support</h4>
            <ul className="flex flex-col gap-3 list-none">
              {[
                { label: 'Privacy Policy',    href: '/privacy' },
                { label: 'Terms of Service',  href: '/terms' },
                { label: 'Contact Us',        href: '/contact' },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm transition-colors duration-200"
                    style={{ color: 'var(--subtext)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtext)')}>
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="mailto:support@insightory.app" className="text-sm transition-colors duration-200"
                  style={{ color: 'var(--subtext)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtext)')}>
                  support@insightory.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="divider mb-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: 'var(--subtext)' }}>
            © {new Date().getFullYear()} Insightory. All rights reserved.
          </p>
          <button onClick={scrollToTop}
            className="flex items-center gap-2 text-xs transition-colors duration-200 group"
            style={{ color: 'var(--subtext)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent2)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--subtext)')}
            aria-label="Scroll to top">
            Back to top
            <span className="w-6 h-6 rounded-lg glass flex items-center justify-center border transition-all duration-200"
              style={{ borderColor: 'var(--border)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
