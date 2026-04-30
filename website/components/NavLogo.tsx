'use client';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

export default function NavLogo({ size = 8 }: { size?: number }) {
  const { isDark } = useTheme();
  return (
    <div className={`relative`} style={{ width: size * 4, height: size * 4 }}>
      <Image
        src={isDark ? '/images/Logo.png' : '/images/Logo_Light.png'}
        alt="Insightory"
        fill
        className="object-contain transition-opacity duration-300"
      />
    </div>
  );
}
