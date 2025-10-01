'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Tabs, Tab, Alert, CircularProgress, IconButton, Divider, Tooltip } from '@mui/material';
import { createWalletClient, custom, createPublicClient, http, formatEther, parseEther, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { CopyAll, Info, Send, Search, Wallet } from '@mui/icons-material';
import { erc20ABI, sampleErc20Address } from '../../lib/erc20';

// 地址验证函数
const isValidEthAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// 截取地址显示
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 格式化时间戳
const formatTimestamp = (timestamp: string | number): string => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (_error) {
    return 'Invalid Date';
  }
};

// 自定义Tab面板组件
const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => {
  return (
    <div role="tabpanel" hidden={value !== index} className="fade-in">
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const ViemPage: React.FC = () => {
  // 状态管理 - 重构为更有组织的结构
  const [walletState, setWalletState] = useState({
    publicClient: null as ReturnType<typeof createPublicClient> | null,
    walletClient: null as ReturnType<typeof createWalletClient> | null,
    address: '',
    isConnected: false
  });

  // 表单状态
  const [formData, setFormData] = useState({
    addressToQuery: '',
    transferToAddress: '',
    transferAmount: '',
    tokenAmount: '',
    tokenContractAddress: sampleErc20Address
  });

  // 数据状态
  const [dataState, setDataState] = useState({
    balance: '0',
    tokenBalance: '0',
    tokenName: '未知',
    tokenSymbol: '未知',
    tokenDecimals: 18,
    txHash: '',
    transferEvents: [] as Array<{from: string, to: string, value: string, blockNumber: bigint, timestamp: string}>
  });

  // UI状态
  const [uiState, setUiState] = useState({
    isLoading: false,
    activeTab: 0,
    error: null as string | null,
    success: null as string | null
  });

  // 监听窗口对象，避免在服务器端渲染
  const isWindowAvailable = useMemo(() => typeof window !== 'undefined', []);

  // 连接钱包
  const connectWallet = useCallback(async () => {
    if (!isWindowAvailable || typeof window.ethereum === 'undefined') {
      setUiState(prev => ({ ...prev, error: '请安装MetaMask或其他以太坊钱包插件' }));
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // 创建公共客户端和钱包客户端
      const newPublicClient = createPublicClient({
        chain: sepolia,
        transport: http(),
      });
      
      const newWalletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
      });
      
      // 请求账户
      const [newAddress] = await newWalletClient.requestAddresses();
      
      setWalletState({
        publicClient: newPublicClient,
        walletClient: newWalletClient,
        address: newAddress,
        isConnected: true
      });
      setFormData(prev => ({ ...prev, addressToQuery: newAddress }));
      setUiState(prev => ({ ...prev, success: '钱包连接成功' }));
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('连接钱包失败:', (error as Error).message);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '连接钱包失败'
      }));
      setWalletState(prev => ({ ...prev, isConnected: false }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isWindowAvailable]);

  // 功能1: 查询余额
  const queryBalance = useCallback(async () => {
    if (!walletState.publicClient || !formData.addressToQuery || !isValidEthAddress(formData.addressToQuery)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的以太坊地址' }));
      return;
    }
    
    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      const balanceWei = await walletState.publicClient.getBalance({ address: formData.addressToQuery as `0x${string}` });
      setDataState(prev => ({ ...prev, balance: formatEther(balanceWei) }));
    } catch (error) {
      console.error('查询余额失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '查询余额失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletState.publicClient, formData.addressToQuery]);

  // 功能2: 查询ERC20代币余额
  const queryTokenBalance = useCallback(async () => {
    if (!walletState.publicClient || !formData.addressToQuery || !formData.tokenContractAddress ||
        !isValidEthAddress(formData.addressToQuery) || !isValidEthAddress(formData.tokenContractAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的地址' }));
      return;
    }
    
    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      const balanceWei = await walletState.publicClient.readContract({
        address: formData.tokenContractAddress as `0x${string}`,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: [formData.addressToQuery as `0x${string}`],
      });
      setDataState(prev => ({ ...prev, tokenBalance: formatEther(balanceWei) }));
    } catch (error) {
      console.error('查询代币余额失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '查询代币余额失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletState.publicClient, formData.addressToQuery, formData.tokenContractAddress]);

  // 功能3: 查询ERC20代币合约信息
  const queryTokenInfo = useCallback(async () => {
    if (!walletState.publicClient || !formData.tokenContractAddress || !isValidEthAddress(formData.tokenContractAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的代币合约地址' }));
      return;
    }
    
    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // 并行查询所有信息
      const [name, symbol, decimals] = await Promise.all([
        walletState.publicClient.readContract({
          address: formData.tokenContractAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'name',
        }),
        walletState.publicClient.readContract({
          address: formData.tokenContractAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'symbol',
        }),
        walletState.publicClient.readContract({
          address: formData.tokenContractAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'decimals',
        })
      ]);
      
      setDataState(prev => ({
        ...prev,
        tokenName: name as string,
        tokenSymbol: symbol as string,
        tokenDecimals: Number(decimals)
      }));
      
    } catch (error) {
      console.error('查询代币信息失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '查询代币信息失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletState.publicClient, formData.tokenContractAddress]);

  // 功能4: 监听Transfer事件
  useEffect(() => {
    if (!walletState.publicClient || !formData.tokenContractAddress || uiState.activeTab !== 4 || !isValidEthAddress(formData.tokenContractAddress)) {
      return;
    }
    
    // 设置事件过滤
    const unwatch = walletState.publicClient.watchContractEvent({
      address: formData.tokenContractAddress as `0x${string}`,
      abi: erc20ABI,
      eventName: 'Transfer',
      onLogs: (logs) => {
        logs.forEach((log) => {
          const eventData = {
            from: (log.args.from as string) || '',
            to: (log.args.to as string) || '',
            value: formatEther(log.args.value as bigint || parseEther('0')),
            blockNumber: log.blockNumber,
            timestamp: new Date().toISOString()
          };
          
          setDataState(prev => ({ ...prev, transferEvents: [eventData, ...prev.transferEvents].slice(0, 10) })); // 只保留最近10条
        });
      },
    });
    
    // 清理函数
    return () => {
      unwatch();
    };
  }, [walletState.publicClient, formData.tokenContractAddress, uiState.activeTab]);

  // 功能5: 发送交易
  const handleSendEth = useCallback(async () => {
    if (!walletState.walletClient || !formData.transferToAddress || !formData.transferAmount) {
      setUiState(prev => ({ ...prev, error: '请填写完整的转账信息' }));
      return;
    }
    
    if (!isValidEthAddress(formData.transferToAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的目标地址' }));
      return;
    }
    
    const amount = parseFloat(formData.transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setUiState(prev => ({ ...prev, error: '请输入有效的转账金额' }));
      return;
    }
    
    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      const hash = await walletState.walletClient.sendTransaction({
        to: formData.transferToAddress as `0x${string}`,
        value: parseEther(formData.transferAmount),
        account: walletState.address as `0x${string}`,
        chain: null
      });
      
      setDataState(prev => ({ ...prev, txHash: hash }));
      setUiState(prev => ({ ...prev, success: '交易已发送，等待确认' }));
      
      // 等待交易确认
      if (walletState.publicClient) {
        await walletState.publicClient.waitForTransactionReceipt({ hash });
        setUiState(prev => ({ ...prev, success: '交易已确认' }));
      }
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('发送交易失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送交易失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletState.walletClient, walletState.publicClient, walletState.address, formData.transferToAddress, formData.transferAmount]);

  // 功能6: 发送ERC20代币
  const handleSendToken = useCallback(async () => {
    if (!walletState.walletClient || !walletState.publicClient || !formData.transferToAddress || !formData.tokenAmount || !formData.tokenContractAddress) {
      setUiState(prev => ({ ...prev, error: '请填写完整的代币转账信息' }));
      return;
    }
    
    if (!isValidEthAddress(formData.transferToAddress) || !isValidEthAddress(formData.tokenContractAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的地址' }));
      return;
    }
    
    const amount = parseFloat(formData.tokenAmount);
    if (isNaN(amount) || amount <= 0) {
      setUiState(prev => ({ ...prev, error: '请输入有效的代币转账金额' }));
      return;
    }
    
    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { request } = await walletState.publicClient.simulateContract({
        address: formData.tokenContractAddress as `0x${string}`,
        abi: erc20ABI,
        functionName: 'transfer',
        args: [
          formData.transferToAddress as `0x${string}`,
          parseUnits(formData.tokenAmount, dataState.tokenDecimals),
        ],
        account: walletState.address as `0x${string}`,
      });
      
      const hash = await walletState.walletClient.writeContract(request);
      setDataState(prev => ({ ...prev, txHash: hash }));
      setUiState(prev => ({ ...prev, success: '代币交易已发送，等待确认' }));
      
      // 等待交易确认
      if (walletState.publicClient) {
        await walletState.publicClient.waitForTransactionReceipt({ hash });
        setUiState(prev => ({ ...prev, success: '代币交易已确认' }));
      }
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('发送代币失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送代币失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletState.walletClient, walletState.publicClient, walletState.address, formData, dataState.tokenDecimals]);

  // 初始化时检查是否已有连接
  useEffect(() => {
    if (isWindowAvailable && typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
        if (Array.isArray(accounts) && accounts.length > 0) {
          connectWallet();
        }
      });
    }
  }, [isWindowAvailable, connectWallet]);

  // 当地址或合约地址变化时自动查询
  useEffect(() => {
    if (walletState.isConnected && formData.addressToQuery && walletState.publicClient) {
      queryBalance();
      if (formData.tokenContractAddress) {
        queryTokenBalance();
      }
    }
  }, [walletState.isConnected, formData.addressToQuery, formData.tokenContractAddress, walletState.publicClient, queryBalance, queryTokenBalance]);
  
  useEffect(() => {
    if (walletState.isConnected && formData.tokenContractAddress && walletState.publicClient) {
      queryTokenInfo();
    }
  }, [walletState.isConnected, formData.tokenContractAddress, walletState.publicClient, queryTokenInfo]);

  // 监听账户和网络变化
  useEffect(() => {
    if (!isWindowAvailable || typeof window.ethereum === 'undefined') return;

    // window.ethereum.on期望(...args: unknown[]) => void类型的回调函数
    const handleAccountsChanged = (...args: unknown[]) => {
      // 第一个参数通常是账户数组
      const accounts = args[0] as string[];
      if (accounts.length > 0) {
        setWalletState(prev => ({
          ...prev,
          address: accounts[0],
        }));
        setFormData(prev => ({ ...prev, addressToQuery: accounts[0] }));
        setUiState(prev => ({ ...prev, error: null }));
      } else {
        setWalletState({
          publicClient: null,
          walletClient: null,
          address: '',
          isConnected: false
        });
        setUiState(prev => ({ ...prev, error: '钱包已断开连接' }));
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isWindowAvailable]);

  // 处理输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 处理Tab变化
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setUiState(prev => ({ ...prev, activeTab: newValue, error: null, success: null }));
  };

  // 复制交易哈希
  const copyTxHash = useCallback(() => {
    if (dataState.txHash && isWindowAvailable) {
      navigator.clipboard.writeText(dataState.txHash);
      setUiState(prev => ({ ...prev, success: '交易哈希已复制' }));
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 2000);
    }
  }, [dataState.txHash, isWindowAvailable]);

  // 渲染余额查询选项卡
  const renderBalanceTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>查询余额</Typography>
        <TextField
          fullWidth
          label="以太坊地址"
          variant="outlined"
          margin="normal"
          value={formData.addressToQuery}
          onChange={(e) => handleInputChange('addressToQuery', e.target.value)}
          helperText="输入要查询的以太坊地址"
          disabled={uiState.isLoading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={queryBalance}
          disabled={uiState.isLoading || !walletState.publicClient}
          startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Search sx={{ width: 16, height: 16 }} />}
        >
          {uiState.isLoading ? '查询中...' : '查询余额'}
        </Button>
        {dataState.balance !== '0' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">余额: {dataState.balance} ETH</Typography>
          </Box>
        )}
        
        <Divider sx={{ my: 4 }} />
        
        <Typography variant="h6" gutterBottom>查询ERC20代币余额</Typography>
        <TextField
          fullWidth
          label="代币合约地址"
          variant="outlined"
          margin="normal"
          value={formData.tokenContractAddress}
          onChange={(e) => handleInputChange('tokenContractAddress', e.target.value)}
          helperText="输入ERC20代币合约地址"
          disabled={uiState.isLoading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={queryTokenBalance}
          disabled={uiState.isLoading || !walletState.publicClient}
          startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Search sx={{ width: 16, height: 16 }} />}
        >
          {uiState.isLoading ? '查询中...' : '查询代币余额'}
        </Button>
        {dataState.tokenBalance !== '0' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">代币余额: {dataState.tokenBalance} {dataState.tokenSymbol}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染交易选项卡
  const renderTransactionTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>发送以太坊交易</Typography>
        <TextField
          fullWidth
          label="目标地址"
          variant="outlined"
          margin="normal"
          value={formData.transferToAddress}
          onChange={(e) => handleInputChange('transferToAddress', e.target.value)}
          helperText="输入接收ETH的地址"
          disabled={uiState.isLoading}
        />
        <TextField
          fullWidth
          label="金额 (ETH)"
          variant="outlined"
          margin="normal"
          value={formData.transferAmount}
          onChange={(e) => handleInputChange('transferAmount', e.target.value)}
          type="number"
          helperText="输入要转账的ETH数量"
          disabled={uiState.isLoading}
          inputProps={{ min: 0, step: 0.0001 }}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={handleSendEth}
          disabled={uiState.isLoading || !walletState.isConnected}
          startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Send sx={{ width: 16, height: 16 }} />}
        >
          {uiState.isLoading ? '发送中...' : '发送以太坊'}
        </Button>
        {dataState.txHash && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {dataState.txHash}</Typography>
            <Tooltip title="复制交易哈希">
              <IconButton size="small" onClick={copyTxHash}>
                <CopyAll sx={{ width: 16, height: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染代币信息选项卡
  const renderTokenInfoTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>查询ERC20代币合约信息</Typography>
        <TextField
          fullWidth
          label="代币合约地址"
          variant="outlined"
          margin="normal"
          value={formData.tokenContractAddress}
          onChange={(e) => handleInputChange('tokenContractAddress', e.target.value)}
          helperText="输入ERC20代币合约地址"
          disabled={uiState.isLoading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={queryTokenInfo}
          disabled={uiState.isLoading || !walletState.publicClient}
          startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Search sx={{ width: 16, height: 16 }} />}
        >
          {uiState.isLoading ? '查询中...' : '查询代币信息'}
        </Button>
        {(dataState.tokenName !== '未知' || dataState.tokenSymbol !== '未知') && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">代币名称: {dataState.tokenName}</Typography>
            <Typography variant="subtitle1">代币符号: {dataState.tokenSymbol}</Typography>
            <Typography variant="subtitle1">小数位: {dataState.tokenDecimals}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染代币转账选项卡
  const renderTokenTransferTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>发送ERC20代币</Typography>
        <TextField
          fullWidth
          label="代币合约地址"
          variant="outlined"
          margin="normal"
          value={formData.tokenContractAddress}
          onChange={(e) => handleInputChange('tokenContractAddress', e.target.value)}
          helperText="输入ERC20代币合约地址"
          disabled={uiState.isLoading}
        />
        <TextField
          fullWidth
          label="目标地址"
          variant="outlined"
          margin="normal"
          value={formData.transferToAddress}
          onChange={(e) => handleInputChange('transferToAddress', e.target.value)}
          helperText="输入接收代币的地址"
          disabled={uiState.isLoading}
        />
        <TextField
          fullWidth
          label={`金额 (${dataState.tokenSymbol || '代币'})`}
          variant="outlined"
          margin="normal"
          value={formData.tokenAmount}
          onChange={(e) => handleInputChange('tokenAmount', e.target.value)}
          type="number"
          helperText="输入要转账的代币数量"
          disabled={uiState.isLoading}
          inputProps={{ min: 0, step: 0.0001 }}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          onClick={handleSendToken}
          disabled={uiState.isLoading || !walletState.isConnected}
          startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Send sx={{ width: 16, height: 16 }} />}
        >
          {uiState.isLoading ? '发送中...' : '发送代币'}
        </Button>
        {dataState.txHash && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {dataState.txHash}</Typography>
            <Tooltip title="复制交易哈希">
              <IconButton size="small" onClick={copyTxHash}>
                <CopyAll sx={{ width: 16, height: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染事件监听选项卡
  const renderEventsTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>监听Transfer事件</Typography>
        <TextField
          fullWidth
          label="代币合约地址"
          variant="outlined"
          margin="normal"
          value={formData.tokenContractAddress}
          onChange={(e) => handleInputChange('tokenContractAddress', e.target.value)}
          helperText="输入ERC20代币合约地址"
          disabled={uiState.isLoading}
        />
        <Typography variant="subtitle1" gutterBottom>最近的转账事件:</Typography>
        
        {dataState.transferEvents.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              暂无事件数据
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {dataState.transferEvents.map((event, index) => (
              <Card key={index} sx={{ mb: 2, bgcolor: 'rgba(16, 185, 129, 0.05)', transition: 'all 0.2s' }}>
                <CardContent>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                    <div>
                      <Typography variant="body2" color="text.secondary">发送方:</Typography>
                      <Typography variant="body1">{truncateAddress(event.from)}</Typography>
                    </div>
                    <div>
                      <Typography variant="body2" color="text.secondary">接收方:</Typography>
                      <Typography variant="body1">{truncateAddress(event.to)}</Typography>
                    </div>
                    <div>
                      <Typography variant="body2" color="text.secondary">金额:</Typography>
                      <Typography variant="body1">{event.value} {dataState.tokenSymbol}</Typography>
                    </div>
                    <div>
                      <Typography variant="body2" color="text.secondary">区块号:</Typography>
                      <Typography variant="body1">{event.blockNumber}</Typography>
                    </div>
                    <div>
                      <Typography variant="body2" color="text.secondary">时间:</Typography>
                      <Typography variant="body1">{formatTimestamp(event.timestamp)}</Typography>
                    </div>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染主组件
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#1e293b', fontWeight: 'bold', textAlign: 'center' }}>
          Viem 区块链集成演示
        </Typography>
        
        {/* 钱包连接状态 */}
        <Card sx={{ mb: 4, borderRadius: '1rem', overflow: 'hidden', transition: 'all 0.3s ease', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1">
              {walletState.isConnected ? (
                <span>已连接: {truncateAddress(walletState.address)}</span>
              ) : (
                '未连接钱包'
              )}
            </Typography>
            <Button
              variant={walletState.isConnected ? 'outlined' : 'contained'}
              onClick={connectWallet}
              disabled={uiState.isLoading}
              startIcon={uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Wallet sx={{ width: 16, height: 16 }} />}
              sx={{
                bgcolor: walletState.isConnected ? 'transparent' : '#10b981',
                color: walletState.isConnected ? '#10b981' : 'white',
                borderColor: walletState.isConnected ? '#10b981' : 'transparent',
                '&:hover': {
                  bgcolor: walletState.isConnected ? 'rgba(16, 185, 129, 0.1)' : '#059669',
                  borderColor: walletState.isConnected ? '#059669' : 'transparent'
                }
              }}
            >
              {uiState.isLoading ? '连接中...' : walletState.isConnected ? '已连接' : '连接钱包'}
            </Button>
          </CardContent>
        </Card>
        
        {/* 消息提示 */}
        {uiState.error && (
          <Alert severity="error" sx={{ mb: 4, borderRadius: 1 }}>
            {uiState.error}
          </Alert>
        )}
        {uiState.success && (
          <Alert severity="success" sx={{ mb: 4, borderRadius: 1 }}>
            {uiState.success}
          </Alert>
        )}
        
        {/* 功能选项卡 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={uiState.activeTab} 
            onChange={handleTabChange} 
            variant="scrollable"
            scrollButtons="auto"
            aria-label="viem功能选项卡"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 'medium',
                fontSize: '0.95rem'
              },
              '& .Mui-selected': {
                color: '#10b981 !important',
                fontWeight: 'bold'
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#10b981'
              }
            }}
          >
            <Tab label="查询余额" />
            <Tab label="发送 ETH" />
            <Tab label="代币信息" />
            <Tab label="发送代币" />
            <Tab label="监听事件" />
          </Tabs>
        </Box>
        
        {/* 选项卡内容 */}
        <TabPanel value={uiState.activeTab} index={0}>
          {renderBalanceTab()}
        </TabPanel>
        <TabPanel value={uiState.activeTab} index={1}>
          {renderTransactionTab()}
        </TabPanel>
        <TabPanel value={uiState.activeTab} index={2}>
          {renderTokenInfoTab()}
        </TabPanel>
        <TabPanel value={uiState.activeTab} index={3}>
          {renderTokenTransferTab()}
        </TabPanel>
        <TabPanel value={uiState.activeTab} index={4}>
          {renderEventsTab()}
        </TabPanel>
        
        {/* 使用说明 */}
        <Card sx={{ mt: 6, borderRadius: '1rem', overflow: 'hidden', bgcolor: 'rgba(241, 245, 249, 0.8)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info sx={{ width: 18, height: 18 }} />
              使用说明
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. 首先点击连接钱包按钮，使用MetaMask等以太坊钱包连接到您的账户。
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              2. 连接成功后，您可以进行余额查询、ETH转账、代币信息查询、代币余额查询、代币转账和转账事件监听等操作。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. 所有操作都需要确保您已连接到Sepolia测试网络。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ViemPage;