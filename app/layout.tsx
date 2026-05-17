/**
 * 本文件定义应用根布局，挂载全局样式、主题和页面外壳。
 */
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'My AI Chat',
  description: 'A simple AI chat application',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // 根布局把主题 Provider 放在 body 内，保证所有页面都能读取主题上下文。
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-2xl',
                title: 'text-sm font-medium',
                description: 'text-muted-foreground text-sm',
                actionButton: 'rounded-full bg-primary text-primary-foreground',
                cancelButton:
                  'rounded-full border border-border bg-transparent text-foreground',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
