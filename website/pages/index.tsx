import Head from 'next/head';
import About from '../components/About';
import Download from '../components/Download';
import Features from '../components/Features';
import Footer from '../components/Footer';
import Hero from '../components/Hero';
import Navbar from '../components/Navbar';
import Screenshots from '../components/Screenshots';
import Stats from '../components/Stats';
import ThemeApplier from '../components/ThemeApplier';

export default function Home() {
  return (
    <>
      <Head>
        <title>Insightory — Smart Inventory Management</title>
        <meta name="description" content="Insightory gives your business real-time inventory intelligence. Track stock, predict demand, scan products, and get AI-powered alerts before you run out." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Insightory — Smart Inventory Management" />
        <meta property="og:description" content="Smart inventory management for modern retail. Track stock, predict demand, and grow your business with confidence." />
        <meta property="og:type" content="website" />
        <link rel="icon" href="/images/favicon.png" />
      </Head>
      <ThemeApplier />
      <main>
        <Navbar />
        <Hero />
        <Stats />
        <Features />
        <Screenshots />
        <Download />
        <About />
        <Footer />
      </main>
    </>
  );
}
