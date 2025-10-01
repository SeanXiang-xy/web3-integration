import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 编译速度优化配置
  experimental: {},
  // 构建优化
  output: "standalone",
  // 图像优化
  images: {
    unoptimized: true,
  },
  // 禁用X-Powered-By头
  poweredByHeader: false,
  // 外部包配置
  serverExternalPackages: [
    'ethers',
    'viem',
    '@rainbow-me/rainbowkit',
    'wagmi'
  ],
  // 编译器配置
  compiler: {
    // 禁用React的开发警告
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
