'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Tabs, Tab, Alert, CircularProgress, IconButton, Divider, Tooltip } from '@mui/material';
import { useBalance, useReadContract, useWriteContract, useWatchContractEvent, useSendTransaction } from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import { CopyAll, Info, Search, Send, Wallet } from '@mui/icons-material';
import { erc20ABI, sampleErc20Address } from '../../lib/erc20';
import { sepolia } from 'wagmi/chains';
import { useWallet } from '../components/WalletProvider';

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

// 自定义Hook：获取当前选中地址（查询地址或连接地址）
const useCurrentAddress = (address: string | undefined, addressToQuery: string) => {
  return useMemo(() => {
    // 如果有查询地址且有效，使用查询地址，否则使用连接地址
    if (addressToQuery && isValidEthAddress(addressToQuery)) {
      return addressToQuery as `0x${string}`;
    }
    return address as `0x${string}`;
  }, [address, addressToQuery]);
};

// 自定义Hook：获取代币信息（增强版，添加错误处理和验证）
const useTokenInfo = (tokenContractAddress: string) => {
  // 只有当合约地址有效时才执行查询
  const isAddressValid = isValidEthAddress(tokenContractAddress);
  
  // 模拟初始状态，防止组件渲染错误
  const mockContractResult = {
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    // 其他可能需要的属性
  };
  
  // 只有在地址有效时才执行合约调用
  const tokenName = isAddressValid ? useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'name',
    chainId: sepolia.id
  }) : mockContractResult;

  const tokenSymbol = isAddressValid ? useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'symbol',
    chainId: sepolia.id
  }) : mockContractResult;

  const tokenDecimals = isAddressValid ? useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'decimals',
    chainId: sepolia.id
  }) : mockContractResult;

  const tokenTotalSupply = isAddressValid ? useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'totalSupply',
    chainId: sepolia.id
  }) : mockContractResult;

  return { 
    tokenName, 
    tokenSymbol, 
    tokenDecimals, 
    tokenTotalSupply, 
    isAddressValid 
  };
};

const WagmiPage: React.FC = () => {
  // 使用通用钱包Hook
  const { address, isConnected } = useWallet();

  // 状态管理 - 重构为更有组织的结构
  const [formData, setFormData] = useState({
    addressToQuery: '',
    transferToAddress: '',
    transferAmount: '',
    tokenAmount: '',
    tokenContractAddress: sampleErc20Address
  });

  // 数据状态
  const [dataState, setDataState] = useState({
    transferEvents: [] as Array<{from: string; to: string; value: string; blockNumber: number; timestamp: string;}>
  });

  // UI状态
  const [uiState, setUiState] = useState({
    isLoading: false,
    activeTab: 0,
    error: null as string | null,
    success: null as string | null
  });

  // 获取当前查询地址 - 将null转换为undefined以匹配函数参数类型
  const currentAddress = useCurrentAddress(address ?? undefined, formData.addressToQuery);
  
  // 获取代币信息
  const { tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply, isAddressValid } = useTokenInfo(formData.tokenContractAddress);
  
  // 查询ETH余额
  const balanceQuery = useBalance({
    address: currentAddress,
    chainId: sepolia.id,
  });

  // 查询ERC20代币余额
  const tokenBalance = useReadContract({
    address: formData.tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [currentAddress],
    chainId: sepolia.id,
  });

  // 功能1: 发送ETH交易
  const { sendTransaction: sendEth, data: txData, isPending: isSendingTx } = useSendTransaction();

  // 功能2: 发送ERC20代币
  const { writeContract, data: tokenTxData, isPending: isSendingToken } = useWriteContract();

  // 格式化大数值函数
  const formatLargeNumber = useCallback((value: string, decimals: number = 18) => {
    try {
      return formatEther(parseUnits(value, decimals));
    } catch {
      return value;
    }
  }, []);
  
  // 监听Transfer事件
  useWatchContractEvent({
    address: formData.tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    eventName: 'Transfer',
    onLogs: (logs) => {
      const newEvents = logs.map(log => ({
        from: log.args.from as string || '',
        to: log.args.to as string || '',
        value: String(log.args.value) || '0',
        blockNumber: Number(log.blockNumber) || 0,
        timestamp: new Date().toISOString()
      }));
      setDataState(prev => ({
        transferEvents: [...newEvents, ...prev.transferEvents].slice(0, 10) // 只保留最近10条事件
      }));
    },
    // 仅在事件选项卡激活时监听
    enabled: uiState.activeTab === 4 && isValidEthAddress(formData.tokenContractAddress)
  });

  // 处理发送ETH交易
  const handleSendEth = useCallback(() => {
    setUiState(prev => ({ ...prev, error: null }));
    
    if (!isConnected) {
      setUiState(prev => ({ ...prev, error: '请先连接钱包' }));
      return;
    }
    
    if (!formData.transferToAddress || !isValidEthAddress(formData.transferToAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的目标地址' }));
      return;
    }
    
    if (!formData.transferAmount || isNaN(parseFloat(formData.transferAmount)) || parseFloat(formData.transferAmount) <= 0) {
      setUiState(prev => ({ ...prev, error: '请输入有效的转账金额' }));
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      sendEth({
        to: formData.transferToAddress as `0x${string}`,
        value: parseEther(formData.transferAmount),
        chainId: sepolia.id,
      });
    } catch (error) {
      console.error('发送交易失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送交易失败，请检查钱包余额或网络状态'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isConnected, formData.transferToAddress, formData.transferAmount, sendEth]);

  // 处理发送ERC20代币
  const handleSendToken = useCallback(() => {
    setUiState(prev => ({ ...prev, error: null }));
    
    if (!isConnected) {
      setUiState(prev => ({ ...prev, error: '请先连接钱包' }));
      return;
    }
    
    if (!formData.tokenContractAddress || !isValidEthAddress(formData.tokenContractAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的代币合约地址' }));
      return;
    }
    
    if (!formData.transferToAddress || !isValidEthAddress(formData.transferToAddress)) {
      setUiState(prev => ({ ...prev, error: '请输入有效的目标地址' }));
      return;
    }
    
    if (!formData.tokenAmount || isNaN(parseFloat(formData.tokenAmount)) || parseFloat(formData.tokenAmount) <= 0) {
      setUiState(prev => ({ ...prev, error: '请输入有效的转账金额' }));
      return;
    }
    
    if (!tokenDecimals.data) {
      setUiState(prev => ({ ...prev, error: '无法获取代币小数位信息' }));
      return;
    }

    try {
      setUiState(prev => ({ ...prev, isLoading: true }));
      writeContract({
        address: formData.tokenContractAddress as `0x${string}`,
        abi: erc20ABI,
        functionName: 'transfer',
        args: [
          formData.transferToAddress as `0x${string}`,
          parseUnits(formData.tokenAmount, tokenDecimals.data),
        ],
        chainId: sepolia.id,
      });
    } catch (error) {
      console.error('发送代币失败:', error);
      setUiState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送代币失败，请检查钱包余额或网络状态'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isConnected, formData, tokenDecimals.data, writeContract]);

  // 当连接地址变化时更新查询地址
  useEffect(() => {
    if (address) {
      setFormData(prev => ({ ...prev, addressToQuery: address }));
    }
  }, [address]);

  // 交易发送成功后的处理
  useEffect(() => {
    if (txData || tokenTxData) {
      setUiState(prev => ({ ...prev, success: '交易已发送，等待确认' }));
      // 3秒后清除成功消息
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 3000);
    }
  }, [txData, tokenTxData]);

  // 验证地址输入
  const validateAddressInput = useCallback((value: string) => {
    // 允许空值
    if (!value) {
      return '';
    }
    
    // 去除空格
    const trimmedValue = value.trim();
    
    // 转换为小写（以太坊地址大小写不敏感）
    const lowercaseValue = trimmedValue.toLowerCase();
    
    // 检查是否以0x开头，如果不是则添加
    return lowercaseValue.startsWith('0x') ? lowercaseValue : `0x${lowercaseValue}`;
  }, []);

  // 处理输入变化
  const handleInputChange = (field: string, value: string) => {
    if (['addressToQuery', 'transferToAddress', 'tokenContractAddress'].includes(field)) {
      // 地址字段需要特殊验证
      const validatedValue = validateAddressInput(value);
      setFormData(prev => ({ ...prev, [field]: validatedValue }));
    } else {
      // 其他字段直接更新
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // 处理Tab变化
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setUiState(prev => ({ ...prev, activeTab: newValue, error: null, success: null }));
  };

  // 复制交易哈希
  const copyTxHash = useCallback(() => {
    const hashToCopy = txData || tokenTxData;
    if (hashToCopy && typeof window !== 'undefined') {
      navigator.clipboard.writeText(hashToCopy);
      setUiState(prev => ({ ...prev, success: '交易哈希已复制' }));
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 2000);
    }
  }, [txData, tokenTxData]);

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
          helperText={formData.addressToQuery && !isValidEthAddress(formData.addressToQuery) ? "地址格式无效" : "留空使用当前连接地址"}
          error={formData.addressToQuery ? !isValidEthAddress(formData.addressToQuery) : false}
        />
        
        {balanceQuery.isLoading ? (
          <CircularProgress size={24} sx={{ mt: 2 }} />
        ) : (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">ETH 余额: {balanceQuery.data ? formatEther(balanceQuery.data.value) : '0'} ETH</Typography>
            <Typography variant="body2" color="text.secondary">
              查询地址: {currentAddress ? truncateAddress(currentAddress) : '未连接'}
            </Typography>
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
          helperText={formData.tokenContractAddress && !isValidEthAddress(formData.tokenContractAddress) ? "地址格式无效" : "Sepolia测试网络代币"}
          error={formData.tokenContractAddress ? !isValidEthAddress(formData.tokenContractAddress) : false}
        />
        
        {tokenBalance.isLoading ? (
          <CircularProgress size={24} sx={{ mt: 2 }} />
        ) : tokenBalance.data && tokenSymbol.data ? (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
            <Typography variant="subtitle1">{tokenSymbol.data} 余额: {formatEther(tokenBalance.data)}</Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            暂无余额数据
          </Typography>
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
          helperText={formData.transferToAddress && !isValidEthAddress(formData.transferToAddress) ? "地址格式无效" : ""}
          error={formData.transferToAddress ? !isValidEthAddress(formData.transferToAddress) : false}
        />
        <TextField
          fullWidth
          label="金额 (ETH)"
          variant="outlined"
          margin="normal"
          value={formData.transferAmount}
          onChange={(e) => handleInputChange('transferAmount', e.target.value)}
          type="number"
          inputProps={{ min: 0, step: 0.0001 }}
          helperText={formData.transferAmount && (isNaN(parseFloat(formData.transferAmount)) || parseFloat(formData.transferAmount) <= 0) ? "请输入有效的金额" : ""}
          error={formData.transferAmount ? (isNaN(parseFloat(formData.transferAmount)) || parseFloat(formData.transferAmount) <= 0) : false}
        />
        
        {balanceQuery.data && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            当前余额: {formatEther(balanceQuery.data.value)} ETH
          </Typography>
        )}
        
        <Button
          variant="contained"
          fullWidth
          onClick={handleSendEth}
          disabled={!formData.transferToAddress || !formData.transferAmount || !isValidEthAddress(formData.transferToAddress) || 
                   isNaN(parseFloat(formData.transferAmount)) || parseFloat(formData.transferAmount) <= 0 || isSendingTx || uiState.isLoading}
          sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          startIcon={isSendingTx || uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Send sx={{ width: 16, height: 16 }} />}
        >
          {isSendingTx || uiState.isLoading ? '发送中...' : '发送以太坊'}
        </Button>
        
        {txData && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {txData}</Typography>
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
          helperText={formData.tokenContractAddress && !isValidEthAddress(formData.tokenContractAddress) ? "地址格式无效" : "请输入Sepolia测试网络上的ERC20代币合约地址"}
          error={formData.tokenContractAddress ? !isValidEthAddress(formData.tokenContractAddress) : false}
        />
        
        {formData.tokenContractAddress && !isAddressValid && (
          <Alert severity="error" sx={{ mt: 2 }}>
            请输入有效的以太坊合约地址
          </Alert>
        )}
        
        {formData.tokenContractAddress && isAddressValid && (
          (tokenName.isLoading || tokenSymbol.isLoading || tokenDecimals.isLoading || tokenTotalSupply.isLoading) ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
              <CircularProgress size={32} />
            </div>
          ) : (
            <Box sx={{ mt: 2 }}>
              {tokenName.error || tokenSymbol.error || tokenDecimals.error || tokenTotalSupply.error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  查询代币信息失败，请检查合约地址是否正确或是否为有效的ERC20代币合约
                </Alert>
              ) : (
                <>
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle1">代币名称: {tokenName.data || '未知'}</Typography>
                  </Box>
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle1">代币符号: {tokenSymbol.data || '未知'}</Typography>
                  </Box>
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle1">小数位: {tokenDecimals.data || 0}</Typography>
                  </Box>
                  <Box sx={{ p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1 }}>
                    <Typography variant="subtitle1">总供应量: {tokenTotalSupply.data && tokenDecimals.data ? formatLargeNumber(String(tokenTotalSupply.data), tokenDecimals.data) : '未知'}</Typography>
                  </Box>
                </>
              )}
            </Box>
          )
        )}
        
        {!formData.tokenContractAddress && (
          <Alert severity="info" sx={{ mt: 2 }}>
            请输入代币合约地址以查询信息
          </Alert>
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
          helperText={formData.tokenContractAddress && !isValidEthAddress(formData.tokenContractAddress) ? "地址格式无效" : ""}
          error={formData.tokenContractAddress ? !isValidEthAddress(formData.tokenContractAddress) : false}
        />
        <TextField
          fullWidth
          label="目标地址"
          variant="outlined"
          margin="normal"
          value={formData.transferToAddress}
          onChange={(e) => handleInputChange('transferToAddress', e.target.value)}
          helperText={formData.transferToAddress && !isValidEthAddress(formData.transferToAddress) ? "地址格式无效" : ""}
          error={formData.transferToAddress ? !isValidEthAddress(formData.transferToAddress) : false}
        />
        <TextField
          fullWidth
          label={`金额 (${tokenSymbol.data || '代币'})`}
          variant="outlined"
          margin="normal"
          value={formData.tokenAmount}
          onChange={(e) => handleInputChange('tokenAmount', e.target.value)}
          type="number"
          inputProps={{ min: 0, step: 0.0001 }}
          helperText={formData.tokenAmount && (isNaN(parseFloat(formData.tokenAmount)) || parseFloat(formData.tokenAmount) <= 0) ? "请输入有效的金额" : ""}
          error={formData.tokenAmount ? (isNaN(parseFloat(formData.tokenAmount)) || parseFloat(formData.tokenAmount) <= 0) : false}
        />
        
        <Button
          variant="contained"
          fullWidth
          onClick={handleSendToken}
          disabled={!formData.transferToAddress || !formData.tokenAmount || !formData.tokenContractAddress || !isValidEthAddress(formData.transferToAddress) || 
                   !isValidEthAddress(formData.tokenContractAddress) || isSendingToken || uiState.isLoading}
          sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          startIcon={isSendingToken || uiState.isLoading ? <CircularProgress sx={{ width: 16, height: 16 }} /> : <Send sx={{ width: 16, height: 16 }} />}
        >
          {isSendingToken || uiState.isLoading ? '发送中...' : '发送代币'}
        </Button>
        
        {tokenTxData && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>交易哈希: {tokenTxData}</Typography>
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
          helperText={formData.tokenContractAddress && !isValidEthAddress(formData.tokenContractAddress) ? "地址格式无效" : ""}
          error={formData.tokenContractAddress ? !isValidEthAddress(formData.tokenContractAddress) : false}
        />
        
        {!isValidEthAddress(formData.tokenContractAddress) && formData.tokenContractAddress && (
          <Alert severity="info" sx={{ my: 2 }}>
            请输入有效的代币合约地址以开始监听事件
          </Alert>
        )}
        
        <Typography variant="subtitle1" gutterBottom>最近的转账事件:</Typography>
        
        {dataState.transferEvents.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(59, 130, 246, 0.05)', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              暂无事件数据
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {dataState.transferEvents.map((event, index) => (
              <Card key={index} sx={{ mb: 2, bgcolor: 'rgba(59, 130, 246, 0.05)', transition: 'all 0.2s' }}>
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
                      <Typography variant="body1">
                        {tokenDecimals.data ? formatLargeNumber(event.value, tokenDecimals.data) : event.value}
                        {tokenSymbol.data && ` ${tokenSymbol.data}`}
                      </Typography>
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

  // 当钱包未连接时，让Nav组件中的连接按钮处理连接逻辑
  // 移除重复的连接钱包页面，使用统一的导航栏连接体验

  // 渲染主组件
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#1e293b', fontWeight: 'bold', textAlign: 'center' }}>
          Wagmi 区块链集成演示
        </Typography>
        
        {/* 钱包连接状态 */}
        <Card sx={{ mb: 4, borderRadius: '1rem', overflow: 'hidden', transition: 'all 0.3s ease', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1">
              <span>已连接: {truncateAddress(address || '')}</span>
            </Typography>
            <div>
              <Button
                variant="outlined"
                disabled={true}
                startIcon={<Wallet sx={{ width: 16, height: 16 }} />}
                sx={{
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                  '&:hover': {
                    borderColor: '#2563eb',
                    bgcolor: 'rgba(59, 130, 246, 0.1)'
                  }
                }}
              >
                已连接
              </Button>
            </div>
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
            aria-label="wagmi功能选项卡"
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
              1. 使用Wagmi库提供的Hooks可以轻松与以太坊区块链交互，无需手动管理provider和signer。
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              2. 所有操作都在Sepolia测试网络上进行，请确保您的钱包已切换到正确的网络。
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. 页面上展示了查询余额、发送交易、查询代币信息、发送代币和监听事件等常用功能。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default WagmiPage;