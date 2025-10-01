import { createConfig, http } from 'wagmi'
import { mainnet, sepolia, goerli } from 'wagmi/chains'

// 创建Wagmi配置
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, goerli],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [goerli.id]: http(),
  },
  ssr: true,
})