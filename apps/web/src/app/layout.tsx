import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Project Hub | Hydrated Studio',
  description: 'Unified company project management with side-by-side task board and realtime project communication.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary font-sans">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
