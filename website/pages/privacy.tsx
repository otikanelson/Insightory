import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import ThemeApplier from '../components/ThemeApplier';

const scrollToTop = () => typeof window !== 'undefined' && window.scrollTo({ top: 0, behavior: 'smooth' });

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Insightory</title>
        <meta name="description" content="Insightory Privacy Policy" />
      </Head>
      <ThemeApplier />

      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {/* Nav */}
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
            <Link href="/" className="text-sm transition-colors duration-200 flex items-center gap-2"
              style={{ color: 'var(--subtext)' }}>
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
            <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ color: 'var(--text)' }}>Privacy Policy</h1>
            <p className="text-sm" style={{ color: 'var(--subtext)' }}>Last updated: April 30, 2026</p>
          </div>

          <div className="divider mb-12" />

          <div className="space-y-10 text-base leading-relaxed" style={{ color: 'var(--subtext)' }}>
            {[
              {
                title: '1. Information We Collect',
                content: 'We collect information you provide directly to us when you create an account, use our services, or contact us for support. This includes:',
                list: ['Name and email address', 'Business name and store details', 'Product and inventory data you enter', 'Usage data and app interactions', 'Device information and identifiers'],
              },
              {
                title: '2. How We Use Your Information',
                content: 'We use the information we collect to provide, maintain, and improve our services, including to:',
                list: ['Process transactions and send related information', 'Send technical notices and support messages', 'Respond to your comments and questions', 'Monitor and analyze usage patterns to improve the app', 'Detect and prevent fraudulent transactions and abuse'],
              },
              {
                title: '3. Data Security',
                content: 'We take the security of your data seriously. We implement industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit. Your inventory data is stored in isolated, tenant-specific databases and is never shared with other users or third parties without your explicit consent.',
              },
              {
                title: '4. Data Retention',
                content: null,
                custom: <>We retain your personal information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time by contacting us at <a href="mailto:privacy@insightory.app" style={{ color: 'var(--primary)' }}>privacy@insightory.app</a>.</>,
              },
              {
                title: '5. Third-Party Services',
                content: 'We may use third-party services to help operate our platform, including cloud infrastructure providers, analytics services, and payment processors. These parties have access to your information only to perform specific tasks on our behalf and are obligated not to disclose or use it for any other purpose.',
              },
              {
                title: '6. Your Rights',
                content: null,
                custom: <>Depending on your location, you may have certain rights regarding your personal data, including the right to access, correct, or delete your data. To exercise these rights, please contact us at <a href="mailto:privacy@insightory.app" style={{ color: 'var(--primary)' }}>privacy@insightory.app</a>.</>,
              },
              {
                title: '7. Changes to This Policy',
                content: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of the app after any changes constitutes your acceptance of the new policy.',
              },
              {
                title: '8. Contact Us',
                content: null,
                custom: <>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@insightory.app" style={{ color: 'var(--primary)' }}>privacy@insightory.app</a> or visit our <Link href="/contact" style={{ color: 'var(--primary)' }}>Contact page</Link>.</>,
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
