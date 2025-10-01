// 定义ethereum提供者接口
export interface EthereumProvider {
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners(event?: string): void;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

// 钱包状态接口
export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isLoading?: boolean;
  error?: string | null;
  network?: string;
}