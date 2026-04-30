import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import ThemeApplier from '../components/ThemeApplier';

const scrollToTop = () => typeof window !== 'undefined' && window.scrollTo({ top: 0, behavior: 'smooth' });

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service — Insightory</title>
        <meta name="description" content="Insightory Terms of Service" />
      </Head>
      <ThemeApplier />

      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <Image src="/images/Logo.png" alt="Insightory" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                Insight<span className="gradient-text">ory</span>
              </span>
            </Link>
            <Link href="/" className="text-sm transition-colors duration-200 flex items-center gap-2" style={{ color: 'var(--subtext)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to Home
            </Link>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
              style={{ color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 20%, transparent)' }}>
              Legal
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: 'var(--text)' }}>Terms of Service</h1>
            <p className="text-sm" style={{ color: 'var(--subtext)' }}>Last updated: April 30, 2026</p>
          </div>

          <div className="divider mb-12" />

          <div className="space-y-10 text-base leading-relaxed" style={{ color: 'var(--subtext)' }}>
            {[
              { title: '1. Acceptance of Terms', content: 'By downloading, installing, or using the Insightory application ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.' },
              {
                title: '2. Use of the Service',
                content: 'You may use the Service only for lawful purposes and in accordance with these Terms. You agree not to:',
                list: ['Use the Service in any way that violates applicable laws or regulations', 'Attempt to gain unauthorized access to any part of the Service', 'Transmit any harmful, offensive, or disruptive content', 'Reverse engineer or attempt to extract the source code', 'Use the Service to compete with Insightory or build a similar product'],
              },
              {
                title: '3. Account Responsibilities',
                content: null,
                custom: <>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account at <a href="mailto:security@insightory.app" style={{ color: 'var(--primary)' }}>security@insightory.app</a>.</>,
              },
              { title: '4. Intellectual Property', content: 'The Service and its original content, features, and functionality are and will remain the exclusive property of Insightory and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Insightory.' },
              { title: '5. Subscription and Billing', content: 'Some features of the Service may require a paid subscription. Subscription fees are billed in advance on a monthly or annual basis. You may cancel your subscription at any time, and cancellation will take effect at the end of the current billing period. We do not provide refunds for partial billing periods.' },
              { title: '6. Limitation of Liability', content: 'To the maximum extent permitted by law, Insightory shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or in connection with your use of the Service.' },
              { title: '7. Termination', content: 'We may terminate or suspend your account and access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.' },
              { title: '8. Changes to Terms', content: 'We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the date at the top of this page. Your continued use of the Service after any changes constitutes your acceptance of the new Terms.' },
              {
                title: '9. Contact',
                content: null,
                custom: <>Questions about these Terms? Contact us at <a href="mailto:legal@insightory.app" style={{ color: 'var(--primary)' }}>legal@insightory.app</a> or visit our <Link href="/contact" style={{ color: 'var(--primary)' }}>Contact page</Link>.</>,
              },
            ].map((s) => (
              <section key={s.title}>
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>{s.title}</h2>
                {s.content && <p>{s.content}</p>}
                {s.custom && <p>{s.custom}</p>}
                {s.list && (
                  <ul className="mt-4 space-y-2 list-none pl-0">
                    {s.list.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--primary)' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
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
