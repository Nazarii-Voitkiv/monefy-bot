import './globals.css';

import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700']
});

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'Monefy Dashboard',
  description: 'Private Telegram mini app for personal finance tracking.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <Script src="https://telegram.org/js/telegram-web-app.js?61" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
