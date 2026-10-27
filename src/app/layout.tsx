import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Unbounded } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import '@/styles/globals.css';

const body = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body', display: 'swap' });
const display = Unbounded({ subsets: ['latin', 'vietnamese'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Band 8.0 Practice',
  description: 'Kho đề IELTS Reading, Listening, Writing, Speaking cùng từ vựng học thuật, luyện để lên Band 8.0.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable}`}>
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
