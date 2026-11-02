import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Advaitum Business OS',
  description: 'Commercial ERP — Products In & Out, Earned Revenue, Expended Costs & FIFO Inventory Automation.',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  manifest: '/manifest.json',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#174f3d' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
