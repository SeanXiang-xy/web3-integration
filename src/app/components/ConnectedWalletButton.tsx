'use client';

import React from 'react';
import { Button, Tooltip, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Wallet, CheckCircle, NetworkCell, Refresh } from '@mui/icons-material';
import { useWallet, truncateAddress } from './WalletProvider';

interface ConnectedWalletButtonProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const ConnectedWalletButton: React.FC<ConnectedWalletButtonProps> = ({
  onConnect,
  onDisconnect
}) => {
  const { 
    address, 
    isConnected, 
    isLoading, 
    error, 
    network,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    copyAddress 
  } = useWallet();

  // 处理连接成功后的回调
  React.useEffect(() => {
    if (isConnected && address && onConnect) {
      onConnect(address);
    }
  }, [isConnected, address, onConnect]);

  // 处理断开连接后的回调
  React.useEffect(() => {
    if (!isConnected && onDisconnect) {
      onDisconnect();
    }
  }, [isConnected, onDisconnect]);

  // 支持的网络列表
  const supportedNetworks = [
    { id: '0x1', name: '以太坊主网' },
    { id: '0xaa36a7', name: 'Sepolia测试网' },
    { id: '0x5', name: 'Goerli测试网' },
    { id: '0x13881', name: 'Polygon Mumbai测试网' }
  ];

  // 切换网络处理函数
  const handleNetworkChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const networkId = e.target.value as string;
    switchNetwork(networkId);
  };

  return (
    <>
      {isLoading ? (
        <CircularProgress size={24} color="primary" />
      ) : isConnected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
              {address && truncateAddress(address)}
            </Button>
          </Tooltip>
          
          {/* 网络选择器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NetworkCell color="primary" />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel size="small">网络</InputLabel>
              <Select
                value="current"
                label="网络"
                size="small"
                sx={{ 
                  fontSize: '0.75rem',
                  '& .MuiSelect-select': {
                    py: 1
                  }
                }}
                renderValue={() => network}
              >
                {supportedNetworks.map(net => (
                  <MenuItem key={net.id} value={net.id} onClick={() => switchNetwork(net.id)}>
                    {net.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
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
      
      {error && (
        <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
          {error}
        </Alert>
      )}
    </>
  );
};

export default ConnectedWalletButton;