// ERC20代币接口定义 - 使用更现代的TypeScript类型定义
export const erc20ABI = [
  // 获取代币余额
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  // 转账
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  // 授权转账
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  // 获取授权余额
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  // 获取代币名称
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  // 获取代币符号
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  // 获取代币小数位
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  // 获取代币总供应量
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  // Transfer事件
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }
    ],
    anonymous: false,
  },
  // Approval事件
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false }
    ],
    anonymous: false,
  },
] as const;

// 网络配置
interface _NetworkConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const networkConfigs = {
  mainnet: {
    rpcUrl: "https://mainnet.infura.io/v3",
    chainId: 1,
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  sepolia: {
    rpcUrl: "https://sepolia.infura.io/v3",
    chainId: 11155111,
    chainName: "Sepolia Testnet",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
};

// 示例ERC20代币合约地址（Sepolia测试网络上的USDT合约）
export const sampleErc20Address = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";