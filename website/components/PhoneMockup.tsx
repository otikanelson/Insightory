'use client';
import React from 'react';

// All screenshots are 576×1280 (9:20 ratio).
// The frame uses overflow:hidden to clip the image naturally.
export function PhoneMockup({
  width,
  src,
  alt,
  glare = false,
  showButtons = true,
}: {
  width: number;
  src: string;
  alt: string;
  glare?: boolean;
  showButtons?: boolean;
}) {
  const frameHeight = Math.round(width * (1280 / 576));

  const btnStyle = (w: number, h: number, top: number, side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    width: w,
    height: h,
    top,
    [side]: -w,
    background: '#3a3a3a',
    borderRadius: side === 'left' ? '3px 0 0 3px' : '0 3px 3px 0',
    boxShadow:
      side === 'left'
        ? 'inset 1px 0 0 rgba(255,255,255,0.12), -1px 0 0 rgba(0,0,0,0.5)'
        : 'inset -1px 0 0 rgba(255,255,255,0.12), 1px 0 0 rgba(0,0,0,0.5)',
  });

  return (
    <div style={{ position: 'relative', width, height: frameHeight }}>
      {showButtons && (
        <>
          {/* Volume up */}
          <div style={btnStyle(4, 36, frameHeight * 0.22, 'left')} />
          {/* Volume down */}
          <div style={btnStyle(4, 36, frameHeight * 0.33, 'left')} />
          {/* Power/lock */}
          <div style={btnStyle(4, 52, frameHeight * 0.27, 'right')} />
        </>
      )}

      {/* Frame */}
      <div className="phone-frame" style={{ width, height: frameHeight, position: 'relative' }}>
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', borderRadius: 30 }}
        />
        {glare && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 45%)',
              borderRadius: 'inherit',
            }}
          />
        )}
      </div>
    </div>
  );
}
