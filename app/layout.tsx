import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Geologica } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';

const geologica = Geologica({
  subsets: ['latin'],
  variable: '--font-geologica',
});

export const metadata: Metadata = {
  title: 'Freela Hub | V3A',
  description: 'Plataforma interna V3A para gestão de freelancers.',
  icons: {
    icon: '/brand/v3a-logo.png',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${geologica.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('freela_hub_theme') || 'dark';
              var resolved = 'dark';
              if (theme === 'system') {
                var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                resolved = isDark ? 'dark' : 'light';
              } else {
                resolved = theme;
              }
              document.documentElement.classList.remove('light', 'dark');
              document.documentElement.classList.add(resolved);
              document.documentElement.setAttribute('data-theme', resolved);
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
