import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
