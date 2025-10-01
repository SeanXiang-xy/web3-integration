import React, { useState, useEffect, useCallback } from 'react';
import { Button, Tooltip, CircularProgress, Alert } from '@mui/material';
import { Wallet, CheckCircle } from '@mui/icons-material';
import { EthereumProvider, WalletState } from '../../lib/types';

// 扩展Window类型以支持ethereum属性
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// 截取地址显示
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  onConnect,
  onDisconnect
}) => {
  const [walletState, setWalletState] = useState({
    address: '',
    isConnected: false,
    isLoading: false,
    error: null as string | null
  });

  // 检查是否已有连接
  const checkExistingConnection = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      // 检查是否已有连接的账户
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletState(prev => ({ ...prev, address, isConnected: true }));
        if (onConnect) {
          onConnect(address);
        }
      }
    } catch (error) {
      console.error('检查钱包连接失败:', error);
    }
  }, [onConnect]);

  // 设置事件监听器
  const setupEventListeners = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletState(prev => ({ ...prev, address, isConnected: true, error: null }));
        if (onConnect) {
          onConnect(address);
        }
      } else {
        setWalletState(prev => ({ ...prev, address: '', isConnected: false }));
        if (onDisconnect) {
          onDisconnect();
        }
      }
    };

    const handleChainChanged = () => {
      // 当链改变时，刷新页面以确保使用正确的网络
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged as (...args: unknown[]) => void);
    window.ethereum.on('chainChanged', handleChainChanged as (...args: unknown[]) => void);
  }, [onConnect, onDisconnect]);

  // 清理事件监听器
  const cleanupEventListeners = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    // 需要传入具体的事件处理函数
    const handleAccountsChanged = () => checkExistingConnection();
    const handleChainChanged = () => checkExistingConnection();
    
    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    window.ethereum.removeListener('chainChanged', handleChainChanged);
  }, [checkExistingConnection]);

  // 检查是否已有连接
  useEffect(() => {
    checkExistingConnection();
    setupEventListeners();

    return () => {
      cleanupEventListeners();
    };
  }, [checkExistingConnection, setupEventListeners, cleanupEventListeners, onConnect, onDisconnect]);

  // 连接钱包
  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setWalletState(prev => ({ ...prev, error: '请安装MetaMask或其他以太坊钱包插件' }));
      return;
    }

    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

      // 请求连接
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      if (accounts.length > 0) {
        const address = accounts[0] as string;
        setWalletState(prev => ({ ...prev, address, isConnected: true }));
        if (onConnect) {
          onConnect(address);
        }
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
  };

  // 断开连接
  const disconnectWallet = () => {
    setWalletState(prev => ({ ...prev, address: '', isConnected: false }));
    if (onDisconnect) {
      onDisconnect();
    }
  };

  // 复制地址
  const copyAddress = async () => {
    if (walletState.address) {
      await navigator.clipboard.writeText(walletState.address);
      // 可以添加一个临时提示
    }
  };

  return (
    <>
      {walletState.isLoading ? (
        <CircularProgress size={24} color="primary" />
      ) : walletState.isConnected ? (
        <Tooltip title="已连接钱包" arrow placement="top">
          <Tooltip title="点击复制地址，右键断开连接" arrow placement="top">
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={copyAddress}
              onContextMenu={(e) => {
                e.preventDefault();
                disconnectWallet();
              }}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                px: 3,
                py: 1.5,
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {truncateAddress(walletState.address)}
            </Button>
          </Tooltip>
        </Tooltip>
      ) : (
        <Tooltip title="连接钱包" arrow placement="top">
          <Button
            variant="contained"
            color="primary"
            startIcon={<Wallet />}
            onClick={connectWallet}
            sx={{
              bgcolor: '#8b5cf6',
              color: 'white',
              '&:hover': {
                bgcolor: '#7c3aed',
                boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)',
                transform: 'translateY(-2px)',
              },
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 'bold',
              fontSize: '1rem',
              px: 4,
              py: 1.5,
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
            }}
          >
            连接钱包
          </Button>
        </Tooltip>
      )}
      
      {walletState.error && (
        <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
          {walletState.error}
        </Alert>
      )}
    </>
  );
};

export default WalletConnectButton;