'use client';

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { Button, Tooltip, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Wallet, CheckCircle, NetworkCell, Refresh } from '@mui/icons-material';
import { EthereumProvider, WalletState } from '../../lib/types';

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// 截取地址显示
export const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

interface WalletProviderProps {
  children: React.ReactNode;
}

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  network: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (networkId: string) => Promise<void>;
  copyAddress: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    isLoading: false,
    error: null,
    network: '未知网络'
  });

  // 检查网络名称
  const getNetworkName = useCallback((chainId: string) => {
    const networks: Record<string, string> = {
      '0x1': '以太坊主网',
      '0x5': 'Goerli测试网',
      '0xaa36a7': 'Sepolia测试网',
      '0x13881': 'Polygon Mumbai测试网',
      '0x89': 'Polygon主网',
      '0xa4b1': 'Arbitrum主网',
      '0x42161': 'Avalanche主网'
    };
    return networks[chainId] || `未知网络 (${chainId})`;
  }, []);

  // 检查当前网络
  const checkNetwork = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      setWalletState(prev => ({ ...prev, network: getNetworkName(chainId) }));
    } catch (error) {
      console.error('检查网络失败:', error);
    }
  }, [getNetworkName]);

  // 检查是否已有连接
  const checkExistingConnection = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      // 检查是否已有连接的账户
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletState(prev => ({ ...prev, address, isConnected: true }));
      }
      // 检查当前网络
      await checkNetwork();
    } catch (error) {
      console.error('检查钱包连接失败:', error);
    }
  }, [checkNetwork]);

  // 设置事件监听器
  const setupEventListeners = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletState(prev => ({ ...prev, address, isConnected: true, error: null }));
      } else {
        setWalletState(prev => ({ ...prev, address: '', isConnected: false }));
      }
    };

    const handleChainChanged = (chainId: string) => {
      setWalletState(prev => ({ ...prev, network: getNetworkName(chainId) }));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged as (...args: unknown[]) => void);
    window.ethereum.on('chainChanged', handleChainChanged as (...args: unknown[]) => void);

    return () => {
      // 类型兼容处理 - 添加window.ethereum存在性检查
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged as (...args: unknown[]) => void);
        window.ethereum.removeListener('chainChanged', handleChainChanged as (...args: unknown[]) => void);
      }
    };
  }, [getNetworkName]);

  // 检查是否已有连接
  useEffect(() => {
    checkExistingConnection();
    const cleanup = setupEventListeners();

    return () => {
      if (cleanup) cleanup();
    };
  }, [checkExistingConnection, setupEventListeners]);

  // 连接钱包
  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setWalletState(prev => ({ ...prev, error: '请安装MetaMask或其他以太坊钱包插件' }));
      return;
    }

    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

      // 请求连接
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletState(prev => ({ ...prev, address, isConnected: true }));
        await checkNetwork();
      }
    } catch (error) {
      console.error('连接钱包失败:', error);
      setWalletState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '连接钱包失败',
        isConnected: false
      }));
    } finally {
      setWalletState(prev => ({ ...prev, isLoading: false }));
    }
  }, [checkNetwork]);

  // 断开连接
  const disconnectWallet = useCallback(() => {
    setWalletState(prev => ({ ...prev, address: '', isConnected: false }));
  }, []);

  // 切换网络
  const switchNetwork = useCallback(async (chainId: string) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setWalletState(prev => ({ ...prev, error: '请安装MetaMask或其他以太坊钱包插件' }));
      return;
    }

    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error: unknown) {
      console.error('切换网络失败:', error);
      // 如果是因为网络不存在，尝试添加网络
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 4902) {
        setWalletState(prev => ({ ...prev, error: '该网络尚未添加到您的钱包，请手动添加' }));
      } else if (error instanceof Error) {
        setWalletState(prev => ({
          ...prev,
          error: error.message || '切换网络失败',
        }));
      } else {
        setWalletState(prev => ({
          ...prev,
          error: '切换网络失败',
        }));
      }
    } finally {
      setWalletState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // 复制地址
  const copyAddress = useCallback(async () => {
    if (walletState.address) {
      try {
        await navigator.clipboard.writeText(walletState.address);
        // 可以添加临时提示，但为了简洁这里不实现
      } catch (error) {
        console.error('复制地址失败:', error);
      }
    }
  }, [walletState.address]);

  const contextValue: WalletContextType = {
    address: walletState.address,
    isConnected: walletState.isConnected,
    isLoading: walletState.isLoading || false,
    error: walletState.error ?? null,
    network: walletState.network || '',
    connectWallet,
    disconnectWallet,
    switchNetwork,
    copyAddress
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;