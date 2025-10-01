'use client';

import React from 'react';
import "./globals.css";
import Nav from './nav';
import WalletProvider from './components/WalletProvider';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './config/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 创建QueryClient实例
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <WalletProvider>
              <div className="container mx-auto p-4">
                <header className="mt-10 mb-8 border-b border-border pb-4">
                  <Nav />
                </header>
                <main>
                  {children}
                </main>
              </div>
            </WalletProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
