import { ImageResponse } from 'next/og';

export const alt = 'CodeRank — Rank Up Your Coding. Practice with purpose. Progress with confidence.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#f5f4ff', color: '#24213e', borderLeft: '24px solid #5146c7' }}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#5146c7', marginBottom: 40 }}>CodeRank</div>
      <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, letterSpacing: -3 }}>RANK UP CODING</div>
      <div style={{ display: 'flex', fontSize: 32, color: '#55516d', marginTop: 28 }}>Practice with purpose. Progress with confidence.</div>
      <div style={{ display: 'flex', fontSize: 26, color: '#5146c7', marginTop: 48 }}>C · C++ · Java · Python</div>
    </div>, size,
  );
}
