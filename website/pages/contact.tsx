'use client';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const scrollToTop = () => typeof window !== 'undefined' && window.scrollTo({ top: 0, behavior: 'smooth' });

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate send
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setSent(true);
  };

  return (
    <>
      <Head>
        <title>Contact Us — Insightory</title>
        <meta name="description" content="Get in touch with the Insightory team" />
      </Head>
      <ThemeApplier />

      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <Image src="/images/Logo.png" alt="Insightory" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Insight<span className="gradient-text">ory</span></span>
            </Link>
            <Link href="/" className="text-sm transition-colors duration-200 flex items-center gap-2" style={{ color: 'var(--subtext)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to Home
            </Link>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-6 pt-32 pb-24">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
              style={{ color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)' }}>
              We'd love to hear from you
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-4" style={{ color: 'var(--text)' }}>
              Get in <span className="gradient-text">touch</span>
            </h1>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--subtext)' }}>
              Have a question, feedback, or need support? Our team typically responds within 24 hours.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Contact info */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {[
                {
                  icon: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>,
                  icon2: <polyline points="22,6 12,13 2,6"/>,
                  title: 'Email Us',
                  value: 'support@insightory.app',
                  href: 'mailto:support@insightory.app',
                },
                {
                  icon: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>,
                  title: 'Call Us',
                  value: '+1 (555) 000-0000',
                  href: 'tel:+15550000000',
                },
                {
                  icon: <><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 11.5 7.35 11.76a1 1 0 0 0 1.3 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></>,
                  title: 'Location',
                  value: 'Remote-first, worldwide',
                  href: '#',
                },
              ].map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  className="glass-card p-6 flex items-start gap-5 feature-card group"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                    style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      {c.icon}
                      {c.icon2}
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--subtext)' }}>{c.title}</div>
                    <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{c.value}</div>
                  </div>
                </a>
              ))}

              {/* Response time */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Typical response time</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--subtext)' }}>We respond to all inquiries within <span className="font-semibold" style={{ color: 'var(--primary)' }}>24 hours</span> on business days.</p>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              {sent ? (
                <div className="glass-card p-12 text-center h-full flex flex-col items-center justify-center gap-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--success) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" style={{ stroke: 'var(--success)' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Message sent!</h3>
                    <p style={{ color: 'var(--subtext)' }}>Thanks for reaching out. We'll get back to you within 24 hours.</p>
                  </div>
                  <button onClick={() => setSent(false)} className="text-sm transition-colors duration-200" style={{ color: 'var(--primary)' }}>
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass-card p-8 flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--subtext)' }}>Name</label>
                      <input type="text" required value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your name"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--subtext)' }}>Email</label>
                      <input type="email" required value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--subtext)' }}>Subject</label>
                    <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: form.subject ? 'var(--text)' : 'var(--subtext)' }}>
                      <option value="" disabled style={{ background: 'var(--surface)' }}>Select a subject</option>
                      <option value="support"     style={{ background: 'var(--surface)' }}>Technical Support</option>
                      <option value="billing"     style={{ background: 'var(--surface)' }}>Billing & Subscriptions</option>
                      <option value="feature"     style={{ background: 'var(--surface)' }}>Feature Request</option>
                      <option value="partnership" style={{ background: 'var(--surface)' }}>Partnership</option>
                      <option value="other"       style={{ background: 'var(--surface)' }}>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--subtext)' }}>Message</label>
                    <textarea required rows={6} value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell us how we can help..."
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 resize-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-glow w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="mt-16 flex items-center justify-between">
            <Link href="/" className="text-sm transition-colors duration-200 flex items-center gap-2" style={{ color: 'var(--subtext)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to Home
            </Link>
            <button onClick={scrollToTop} className="text-sm transition-colors duration-200 flex items-center gap-2" style={{ color: 'var(--subtext)' }}>
              Back to top
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
