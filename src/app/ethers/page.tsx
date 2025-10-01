'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Alert, CircularProgress, Tabs, Tab, IconButton } from '@mui/material';
import { ethers } from 'ethers';
import { erc20ABI, sampleErc20Address } from '../../lib/erc20';
import { CopyAll, Info } from '@mui/icons-material';
import { useWallet, truncateAddress } from '../components/WalletProvider';

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

// 格式化大数值
const formatLargeNumber = (value: string | number, decimals: number = 18, maxDecimals: number = 6): string => {
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    const divisor = Math.pow(10, decimals);
    const formatted = numValue / divisor;
    return formatted.toFixed(Math.min(maxDecimals, decimals));
  } catch (error) {
    console.error('格式化数值失败:', error);
    return String(value);
  }
};

// 增强的地址验证函数
const isValidEthAddress = (address: string): boolean => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  try {
    // 尝试检查地址校验和
    ethers.getAddress(address);
    return true;
  } catch (e) {
    return false;
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

// 增强的代币信息Hook
const useTokenInfo = (contractAddress: string, provider: ethers.BrowserProvider | null) => {
  const [tokenInfo, setTokenInfo] = useState({
    tokenName: '未知',
    tokenSymbol: '未知',
    tokenDecimals: 18,
    tokenTotalSupply: '0',
    isLoading: false,
    error: null as string | null,
    isAddressValid: true
  });

  useEffect(() => {
    // 条件查询：只有在地址有效且provider存在时才查询
    if (!contractAddress || !provider || !isValidEthAddress(contractAddress)) {
      setTokenInfo(prev => ({
        ...prev,
        isAddressValid: !contractAddress || isValidEthAddress(contractAddress),
        isLoading: false
      }));
      return;
    }

    const fetchTokenInfo = async () => {
      setTokenInfo(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const tokenContract = new ethers.Contract(contractAddress, erc20ABI, provider);
        
        // 并行请求基本代币信息
        const [name, symbol, decimals] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.decimals()
        ]);

        // 单独获取totalSupply，处理可能的解码错误
        let totalSupply = '0';
        try {
          const supply = await tokenContract.totalSupply();
          totalSupply = formatLargeNumber(supply.toString(), decimals);
        } catch (supplyError) {
          console.warn('获取总供应量失败，使用默认值:', supplyError);
          // 即使totalSupply获取失败，也继续显示其他代币信息
        }

        setTokenInfo({
          tokenName: name,
          tokenSymbol: symbol,
          tokenDecimals: decimals,
          tokenTotalSupply: totalSupply,
          isLoading: false,
          error: null,
          isAddressValid: true
        });
      } catch (error) {
        console.error('查询代币信息失败:', error);
        setTokenInfo(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '查询代币信息失败'
        }));
      }
    };

    fetchTokenInfo();
  }, [contractAddress, provider]);

  return tokenInfo;
};

const EthersPage: React.FC = () => {
  // 使用全局钱包状态 - 解构所有需要的属性
  const { address, isConnected, connectWallet, disconnectWallet, network } = useWallet();
  
  // 内部状态管理
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    txHash: '',
    tokenName: '未知',
    tokenSymbol: '未知',
    tokenDecimals: 18,
    transferEvents: [] as Array<{from: string, to: string, value: string, blockNumber: number, timestamp: string}>  
  });

  // UI状态
  const [uiState, setUiState] = useState({
    isLoading: false,
    activeTab: 0,
    success: null as string | null
  });
  
  // 当钱包连接状态改变时更新provider和signer
  useEffect(() => {
    const updateProviderAndSigner = async () => {
      if (typeof window !== 'undefined' && window.ethereum && isConnected) {
        try {
          const newProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(newProvider);
          const newSigner = await newProvider.getSigner();
          setSigner(newSigner);
        } catch (err) {
          console.error('更新provider失败:', err);
          setError('初始化provider失败');
        }
      } else {
        setProvider(null);
        setSigner(null);
      }
    };
    
    updateProviderAndSigner();
  }, [isConnected]);

  // 自动填充当前地址
  useEffect(() => {
    if (address) {
      setFormData(prev => ({ ...prev, addressToQuery: address }));
    }
  }, [address]);

  // 输入变化处理函数在下方定义

  // 复制交易哈希函数在下方定义

  // 功能1: 查询余额
  const queryBalance = useCallback(async () => {
    if (!provider || !formData.addressToQuery || !isValidEthAddress(formData.addressToQuery)) {
      setError('请输入有效的以太坊地址');
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      setError(null);
      const balanceWei = await provider.getBalance(formData.addressToQuery);
      setDataState(prev => ({ ...prev, balance: ethers.formatEther(balanceWei) }));
    } catch (error) {
      console.error('查询余额失败:', error);
      setError(error instanceof Error ? error.message : '查询余额失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [provider, formData.addressToQuery, setError, setUiState, setDataState]);



  // 功能2: 发送ETH交易
  const sendTransaction = useCallback(async () => {
    if (!signer || !formData.transferToAddress || !formData.transferAmount) {
      setError('请填写完整的转账信息');
      return;
    }

    if (!isValidEthAddress(formData.transferToAddress)) {
      setError('请输入有效的目标地址');
      return;
    }

    const amount = parseFloat(formData.transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('请输入有效的转账金额');
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      setError(null);

      // 发送交易
      const tx = await signer.sendTransaction({
        to: formData.transferToAddress,
        value: ethers.parseEther(formData.transferAmount)
      });

      setDataState(prev => ({ ...prev, txHash: tx.hash }));
      setUiState(prev => ({ ...prev, success: '交易已发送，等待确认' }));

      // 等待交易确认
      await tx.wait();
      setUiState(prev => ({ ...prev, success: '交易已确认' }));

      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);

    } catch (error) {
      console.error('发送交易失败:', error);
      setError(error instanceof Error ? error.message : '发送交易失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [signer, formData.transferToAddress, formData.transferAmount, setError]);

  // 使用增强的代币信息Hook
  const { tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply, isAddressValid, isLoading: tokenInfoLoading, error: tokenInfoError } = useTokenInfo(
    formData.tokenContractAddress, 
    provider
  );

  // 功能4: 查询代币余额
  const queryTokenBalance = useCallback(async () => {
    if (!provider || !formData.addressToQuery || !formData.tokenContractAddress || 
        !isValidEthAddress(formData.addressToQuery) || !isValidEthAddress(formData.tokenContractAddress)) {
      setError('请输入有效的地址');
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      setError(null);

      const tokenContract = new ethers.Contract(formData.tokenContractAddress, erc20ABI, provider);
      const balance = await tokenContract.balanceOf(formData.addressToQuery);

      setDataState(prev => ({
        ...prev, 
        tokenBalance: formatLargeNumber(balance.toString(), tokenDecimals)
      }));

    } catch (error) {
      console.error('查询代币余额失败:', error);
      setError(error instanceof Error ? error.message : '查询代币余额失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [provider, formData.addressToQuery, formData.tokenContractAddress, tokenDecimals, setError]);

  // 功能5: 发送代币
  const transferToken = useCallback(async () => {
    if (!signer || !formData.transferToAddress || !formData.tokenAmount || !formData.tokenContractAddress ||
        !isValidEthAddress(formData.transferToAddress) || !isValidEthAddress(formData.tokenContractAddress)) {
      setError('请填写完整的代币转账信息');
      return;
    }

    const amount = parseFloat(formData.tokenAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('请输入有效的代币转账金额');
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      setError(null);

      const tokenContract = new ethers.Contract(formData.tokenContractAddress, erc20ABI, signer);

      // 发送代币
      const tx = await tokenContract.transfer(
        formData.transferToAddress,
        ethers.parseUnits(formData.tokenAmount, tokenDecimals)
      );

      setDataState(prev => ({ ...prev, txHash: tx.hash }));
      setUiState(prev => ({ ...prev, success: '代币转账已发送，等待确认' }));

      // 等待交易确认
      await tx.wait();
      setUiState(prev => ({ ...prev, success: '代币转账已确认' }));

      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);

    } catch (error) {
      console.error('发送代币失败:', error);
      setError(error instanceof Error ? error.message : '发送代币失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [signer, formData.transferToAddress, formData.tokenAmount, formData.tokenContractAddress, tokenDecimals, setError]);

  // 功能6: 查询转账事件
  const queryTransferEvents = useCallback(async () => {
    if (!provider || !formData.tokenContractAddress || !isValidEthAddress(formData.tokenContractAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的代币合约地址' }));
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!provider) {
        throw new Error('Provider not available');
      }

      // provider 已经从 useWallet hook 获取
      
      const tokenContract = new ethers.Contract(formData.tokenContractAddress, erc20ABI, provider);
      
      // 获取最近100个区块的Transfer事件
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 100);
      
      const events = await tokenContract.queryFilter('Transfer', fromBlock, latestBlock);

      // 并行获取每个区块的时间戳
      const eventPromises = events.map(async (event) => {
        const block = await provider.getBlock(event.blockNumber!);
        // 类型断言确保是EventLog类型
        const eventLog = event as ethers.EventLog;
        return {
          from: eventLog.args!.from,
          to: eventLog.args!.to,
          value: formatLargeNumber(eventLog.args!.value.toString(), dataState.tokenDecimals),
          blockNumber: event.blockNumber!,
          timestamp: block ? formatTimestamp(block.timestamp) : 'Unknown'
        };
      });

      const formattedEvents = await Promise.all(eventPromises);
      setDataState(prev => ({ ...prev, transferEvents: formattedEvents }));

    } catch (error) {
      console.error('查询转账事件失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '查询转账事件失败'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [provider, formData.tokenContractAddress, dataState.tokenDecimals]);

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
    if (dataState.txHash && typeof window !== 'undefined') {
      window.navigator.clipboard.writeText(dataState.txHash);
      setUiState(prev => ({ ...prev, success: '交易哈希已复制' }));
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 2000);
    }
  }, [dataState.txHash, setUiState]);

  // 渲染余额查询选项卡
  const renderBalanceTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
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
          sx={{ mt: 2, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          onClick={queryBalance}
          disabled={uiState.isLoading || !provider}
          startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {uiState.isLoading ? '查询中...' : '查询余额'}
        </Button>
        {dataState.balance !== '0' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">余额: {dataState.balance} ETH</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染交易选项卡
  const renderTransactionTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>发送 ETH</Typography>
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
          label="转账金额 (ETH)"
          variant="outlined"
          margin="normal"
          value={formData.transferAmount}
          onChange={(e) => handleInputChange('transferAmount', e.target.value)}
          type="number"
          helperText="输入要转账的ETH数量"
          disabled={uiState.isLoading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          onClick={sendTransaction}
          disabled={uiState.isLoading || !isConnected}
          startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {uiState.isLoading ? '发送中...' : '发送 ETH'}
        </Button>
        {dataState.txHash && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {dataState.txHash}</Typography>
            <IconButton size="small" onClick={copyTxHash}>
              <CopyAll fontSize="small" />
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染代币信息选项卡
  const renderTokenInfoTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>代币信息</Typography>
        <TextField
          fullWidth
          label="代币合约地址"
          variant="outlined"
          margin="normal"
          value={formData.tokenContractAddress}
          onChange={(e) => handleInputChange('tokenContractAddress', e.target.value)}
          helperText="输入ERC20代币合约地址"
          disabled={uiState.isLoading || tokenInfoLoading}
          error={!isAddressValid}
        />
        {!isAddressValid && (
          <Typography variant="body2" color="error" sx={{ mt: -1, mb: 2 }}>
            无效的代币合约地址
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          {(tokenName !== '未知' || tokenSymbol !== '未知') && (
            <Card sx={{ p: 3, bgcolor: 'rgba(99, 102, 241, 0.1)' }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>代币名称: {tokenName}</Typography>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>代币符号: {tokenSymbol}</Typography>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>小数位数: {tokenDecimals}</Typography>
              {tokenTotalSupply && (
                <Typography variant="subtitle1">总供应量: {tokenTotalSupply} {tokenSymbol}</Typography>
              )}
            </Card>
          )}
          {tokenInfoLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#6366f1' }} />
            </Box>
          )}
          {tokenInfoError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>
              {tokenInfoError}
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  // 渲染代币余额查询选项卡
  const renderTokenBalanceTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>查询代币余额</Typography>
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
          sx={{ mt: 2, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          onClick={queryTokenBalance}
          disabled={uiState.isLoading || !provider}
          startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {uiState.isLoading ? '查询中...' : '查询代币余额'}
        </Button>
        {dataState.tokenBalance !== '0' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">代币余额: {dataState.tokenBalance} {dataState.tokenSymbol}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染代币转账选项卡
  const renderTokenTransferTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>发送代币</Typography>
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
          label={`转账金额 (${dataState.tokenSymbol || '代币'})`}
          variant="outlined"
          margin="normal"
          value={formData.tokenAmount}
          onChange={(e) => handleInputChange('tokenAmount', e.target.value)}
          type="number"
          helperText="输入要转账的代币数量"
          disabled={uiState.isLoading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          onClick={transferToken}
          disabled={uiState.isLoading || !isConnected}
          startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {uiState.isLoading ? '发送中...' : '发送代币'}
        </Button>
        {dataState.txHash && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {dataState.txHash}</Typography>
            <IconButton size="small" onClick={copyTxHash}>
              <CopyAll fontSize="small" />
            </IconButton>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // 渲染事件查询选项卡
  const renderEventsTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>查询转账事件</Typography>
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
          onClick={queryTransferEvents}
          disabled={uiState.isLoading || !provider}
          startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {uiState.isLoading ? '查询中...' : '查询转账事件'}
        </Button>
        {dataState.transferEvents.length > 0 && (
          <Box sx={{ mt: 3, maxHeight: 400, overflowY: 'auto' }}>
            {dataState.transferEvents.map((event, index) => (
              <Card key={index} sx={{ mb: 2, bgcolor: 'rgba(16, 185, 129, 0.05)' }}>
                <CardContent>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">发送方:</Typography>
                      <Typography variant="body1">{truncateAddress(event.from)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">接收方:</Typography>
                      <Typography variant="body1">{truncateAddress(event.to)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">金额:</Typography>
                      <Typography variant="body1">{event.value} {dataState.tokenSymbol}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">区块号:</Typography>
                      <Typography variant="body1">{event.blockNumber}</Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
                      <Typography variant="body2" color="text.secondary">时间戳:</Typography>
                      <Typography variant="body1">{event.timestamp}</Typography>
                    </Box>
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
          Ethers.js 区块链集成演示
        </Typography>
        
        {/* 钱包连接状态 */}
        <Card sx={{ mb: 4, borderRadius: '1rem', overflow: 'hidden', transition: 'all 0.3s ease' }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1">
              {isConnected && address ? (
                <span>已连接: {truncateAddress(address)} {network && `(${network})`}</span>
              ) : (
                '未连接钱包'
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {isConnected && address && (
                <Button
                  variant="text"
                  size="small"
                  onClick={async () => {
                    if (address && typeof window !== 'undefined') {
                      try {
                        await window.navigator.clipboard.writeText(address);
                        setUiState(prev => ({ ...prev, success: '地址已复制' }));
                        setTimeout(() => {
                          setUiState(prev => ({ ...prev, success: null }));
                        }, 2000);
                      } catch (error) {
                        console.error('复制地址失败:', error);
                      }
                    }
                  }}
                  sx={{ color: '#3b82f6' }}
                >
                  复制地址
                </Button>
              )}
              <Button
                variant={isConnected ? 'outlined' : 'contained'}
                onClick={isConnected ? disconnectWallet : connectWallet}
                disabled={uiState.isLoading}
                startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
                sx={{
                  bgcolor: isConnected ? 'transparent' : '#3b82f6',
                  color: isConnected ? '#3b82f6' : 'white',
                  borderColor: isConnected ? '#3b82f6' : 'transparent',
                  '&:hover': {
                    bgcolor: isConnected ? 'rgba(59, 130, 246, 0.1)' : '#2563eb',
                    borderColor: isConnected ? '#2563eb' : 'transparent'
                  }
                }}
              >
                {uiState.isLoading ? '连接中...' : isConnected ? '断开连接' : '连接钱包'}
              </Button>
            </Box>
          </CardContent>
        </Card>
        
        {/* 消息提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 4, borderRadius: 1 }}>
            {error}
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
              aria-label="ethers.js功能选项卡"
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 'medium',
                  fontSize: '0.95rem'
                },
                '& .Mui-selected': {
                  color: '#3b82f6 !important',
                  fontWeight: 'bold'
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#3b82f6'
                }
              }}
            >
              <Tab label="查询余额" />
              <Tab label="发送 ETH" />
              <Tab label="代币信息" />
              <Tab label="代币余额" />
              <Tab label="发送代币" />
              <Tab label="转账事件" />
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
            {renderTokenBalanceTab()}
          </TabPanel>
          <TabPanel value={uiState.activeTab} index={4}>
            {renderTokenTransferTab()}
          </TabPanel>
          <TabPanel value={uiState.activeTab} index={5}>
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
                2. 连接成功后，您可以进行余额查询、ETH转账、代币信息查询、代币余额查询、代币转账和转账事件查询等操作。
              </Typography>
              <Typography variant="body2" color="text.secondary">
                3. 所有操作都需要确保您已连接到正确的网络（目前使用Sepolia测试网）。
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }; 

  export default EthersPage;