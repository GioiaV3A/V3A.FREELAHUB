import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Geologica, Play } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';

const geologica = Geologica({
  subsets: ['latin'],
  variable: '--font-geologica',
});

const play = Play({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-play',
});

export const metadata: Metadata = {
  title: 'Freela Hub | V3A',
  description: 'Plataforma interna V3A para gestão de freelancers.',
  icons: {
    icon: '/brand/v3a-mark-yellow.png',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${geologica.variable} ${play.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
              document.documentElement.setAttribute('data-theme', 'light');
            } catch (e) {}
          })()
        `}} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
