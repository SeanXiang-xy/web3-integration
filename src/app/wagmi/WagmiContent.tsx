import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, CardContent, TextField, Button, Tabs, Tab, Alert, CircularProgress, IconButton, Divider, Tooltip } from '@mui/material';
import { useAccount, useBalance, useReadContract, useWriteContract, useWatchContractEvent, useSendTransaction } from 'wagmi';
import { parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { CopyAll, Info, Search, Send, Wallet } from '@mui/icons-material';
import { erc20ABI, sampleErc20Address } from '../../lib/erc20';
import { sepolia } from 'wagmi/chains';

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

// 自定义Hook：获取代币信息
const useTokenInfo = (tokenContractAddress: string) => {
  const tokenName = useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'name',
    chainId: sepolia.id,
  });

  const tokenSymbol = useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'symbol',
    chainId: sepolia.id,
  });

  const tokenDecimals = useReadContract({
    address: tokenContractAddress as `0x${string}`,
    abi: erc20ABI,
    functionName: 'decimals',
    chainId: sepolia.id,
  });

  return { tokenName, tokenSymbol, tokenDecimals };
};

const WagmiContent: React.FC = () => {
  // 账户状态
  const { address, isConnected } = useAccount();

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

  // 获取当前查询地址
  const currentAddress = useCurrentAddress(address, formData.addressToQuery);
  
  // 获取代币信息
  const { tokenName, tokenSymbol, tokenDecimals } = useTokenInfo(formData.tokenContractAddress);
  
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
    if (address && !formData.addressToQuery) {
      setFormData(prev => ({ ...prev, addressToQuery: address }));
    }
  }, [address, formData.addressToQuery]);

  // 交易状态监听
  useEffect(() => {
    if (txData) {
      setUiState(prev => ({
        ...prev,
        success: `交易已发送: ${txData}`,
        error: null
      }));
      // 清空输入
      setFormData(prev => ({
        ...prev,
        transferAmount: ''
      }));
    }
  }, [txData]);

  // 代币交易状态监听
  useEffect(() => {
    if (tokenTxData) {
      setUiState(prev => ({
        ...prev,
        success: `代币交易已发送: ${tokenTxData}`,
        error: null
      }));
      // 清空输入
      setFormData(prev => ({
        ...prev,
        tokenAmount: ''
      }));
    }
  }, [tokenTxData]);

  // 复制交易哈希
  const copyTxHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash)
      .then(() => {
        setUiState(prev => ({ ...prev, success: '交易哈希已复制到剪贴板' }));
        setTimeout(() => {
          setUiState(prev => ({ ...prev, success: null }));
        }, 2000);
      })
      .catch(() => {
        setUiState(prev => ({ ...prev, error: '复制失败，请手动复制' }));
      });
  }, []);

  // 渲染余额查询选项卡
  const renderBalanceTab = () => {
    return (
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
          查询地址余额
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="以太坊地址"
            variant="outlined"
            value={formData.addressToQuery}
            onChange={(e) => setFormData(prev => ({ ...prev, addressToQuery: e.target.value }))}
            placeholder="0x..."
            fullWidth
            helperText="留空则使用当前连接的钱包地址"
          />
          
          <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
            <Typography variant="body2" color="text.secondary" mb={1}>
              账户余额 (ETH)
            </Typography>
            
            {balanceQuery.isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ width: 16, height: 16 }} />
                <Typography variant="body2">加载中...</Typography>
              </Box>
            ) : balanceQuery.error ? (
              <Typography variant="body2" color="error">
                查询失败: {balanceQuery.error?.message || '未知错误'}
              </Typography>
            ) : balanceQuery.data ? (
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#3b82f6' }}>
                {formatEther(balanceQuery.data.value)}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.disabled">
                请输入有效的以太坊地址
              </Typography>
            )}
          </Box>
          
          {formData.tokenContractAddress && (
            <Box sx={{ mt: 1, p: 2, borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                代币余额 ({tokenSymbol.data || '未知'})
              </Typography>
              
              {tokenBalance.isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ width: 16, height: 16 }} />
                  <Typography variant="body2">加载中...</Typography>
                </Box>
              ) : tokenBalance.error ? (
                <Typography variant="body2" color="error">
                  查询失败: {tokenBalance.error?.message || '未知错误'}
                </Typography>
              ) : tokenBalance.data ? (
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                  {tokenDecimals.data ? 
                    formatUnits(tokenBalance.data as bigint, tokenDecimals.data) : 
                    tokenBalance.data.toString()}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  请输入有效的以太坊地址
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </CardContent>
    );
  };

  // 渲染交易发送选项卡
  const renderTransactionTab = () => {
    return (
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
          发送 ETH 交易
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="目标地址"
            variant="outlined"
            value={formData.transferToAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, transferToAddress: e.target.value }))}
            placeholder="0x..."
            fullWidth
            helperText={formData.transferToAddress && !isValidEthAddress(formData.transferToAddress) ? 
              '请输入有效的以太坊地址' : ''}
            error={!!formData.transferToAddress && !isValidEthAddress(formData.transferToAddress)}
          />
          
          <TextField
            label="转账金额 (ETH)"
            variant="outlined"
            type="number"
            value={formData.transferAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, transferAmount: e.target.value }))}
            placeholder="0.0"
            fullWidth
            helperText="请确保您的钱包有足够的余额"
            inputProps={{ step: '0.0001', min: '0' }}
          />
          
          <Button
            variant={isConnected ? "contained" : "outlined"}
            fullWidth
            size="large"
            onClick={handleSendEth}
            disabled={uiState.isLoading || !isConnected || isSendingTx}
            startIcon={uiState.isLoading || isSendingTx ? (
              <CircularProgress sx={{ width: 16, height: 16 }} />
            ) : (
              <Send sx={{ width: 16, height: 16 }} />
            )}
            sx={{
              py: 1.5,
              mt: 1,
              bgcolor: isConnected ? '#3b82f6' : 'transparent',
              '&:hover': {
                bgcolor: isConnected ? '#2563eb' : 'rgba(59, 130, 246, 0.08)'
              }
            }}
          >
            {uiState.isLoading || isSendingTx ? '发送中...' : '发送 ETH'}
          </Button>
          
          {!isConnected && (
            <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
              请先连接您的钱包
            </Alert>
          )}
        </Box>
      </CardContent>
    );
  };

  // 渲染代币信息选项卡
  const renderTokenInfoTab = () => {
    return (
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
          查询代币信息
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="代币合约地址"
            variant="outlined"
            value={formData.tokenContractAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, tokenContractAddress: e.target.value }))}
            placeholder="0x..."
            fullWidth
            helperText="输入ERC20代币的合约地址"
          />
          
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                代币名称
              </Typography>
              
              {tokenName.isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ width: 16, height: 16 }} />
                  <Typography variant="body2">加载中...</Typography>
                </Box>
              ) : tokenName.error ? (
                <Typography variant="body2" color="error">
                  查询失败
                </Typography>
              ) : tokenName.data ? (
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                  {tokenName.data}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  请输入有效的代币合约地址
                </Typography>
              )}
            </Box>
            
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.8)' }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                代币符号
              </Typography>
              
              {tokenSymbol.isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ width: 16, height: 16 }} />
                  <Typography variant="body2">加载中...</Typography>
                </Box>
              ) : tokenSymbol.error ? (
                <Typography variant="body2" color="error">
                  查询失败
                </Typography>
              ) : tokenSymbol.data ? (
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                  {tokenSymbol.data}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  请输入有效的代币合约地址
                </Typography>
              )}
            </Box>
            
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'rgba(248, 250, 252, 0.8)', gridColumn: { xs: '1', md: '1 / 3' } }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                小数位数
              </Typography>
              
              {tokenDecimals.isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ width: 16, height: 16 }} />
                  <Typography variant="body2">加载中...</Typography>
                </Box>
              ) : tokenDecimals.error ? (
                <Typography variant="body2" color="error">
                  查询失败
                </Typography>
              ) : tokenDecimals.data !== undefined ? (
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                  {tokenDecimals.data}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled">
                  请输入有效的代币合约地址
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    );
  };

  // 渲染代币转账选项卡
  const renderTokenTransferTab = () => {
    return (
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
          发送 ERC20 代币
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="代币合约地址"
            variant="outlined"
            value={formData.tokenContractAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, tokenContractAddress: e.target.value }))}
            placeholder="0x..."
            fullWidth
            helperText="输入ERC20代币的合约地址"
          />
          
          <TextField
            label="目标地址"
            variant="outlined"
            value={formData.transferToAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, transferToAddress: e.target.value }))}
            placeholder="0x..."
            fullWidth
            helperText={formData.transferToAddress && !isValidEthAddress(formData.transferToAddress) ? 
              '请输入有效的以太坊地址' : ''}
            error={!!formData.transferToAddress && !isValidEthAddress(formData.transferToAddress)}
          />
          
          <TextField
            label={`转账金额 (${tokenSymbol.data || '代币'})`}
            variant="outlined"
            type="number"
            value={formData.tokenAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, tokenAmount: e.target.value }))}
            placeholder="0.0"
            fullWidth
            inputProps={{ step: '0.0001', min: '0' }}
          />
          
          <Button
            variant={isConnected ? "contained" : "outlined"}
            fullWidth
            size="large"
            onClick={handleSendToken}
            disabled={uiState.isLoading || !isConnected || isSendingToken || !tokenDecimals.data}
            startIcon={uiState.isLoading || isSendingToken ? (
              <CircularProgress sx={{ width: 16, height: 16 }} />
            ) : (
              <Send sx={{ width: 16, height: 16 }} />
            )}
            sx={{
              py: 1.5,
              mt: 1,
              bgcolor: isConnected ? '#10b981' : 'transparent',
              '&:hover': {
                bgcolor: isConnected ? '#059669' : 'rgba(16, 185, 129, 0.08)'
              }
            }}
          >
            {uiState.isLoading || isSendingToken ? '发送中...' : '发送代币'}
          </Button>
          
          {!isConnected && (
            <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
              请先连接您的钱包
            </Alert>
          )}
        </Box>
      </CardContent>
    );
  };

  // 渲染事件监听选项卡
  const renderEventsTab = () => {
    return (
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
          代币转账事件监听
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="代币合约地址"
            variant="outlined"
            value={formData.tokenContractAddress}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, tokenContractAddress: e.target.value }));
              setDataState(prev => ({ ...prev, transferEvents: [] }));
            }}
            placeholder="0x..."
            fullWidth
          />
          
          {!isValidEthAddress(formData.tokenContractAddress) && (
            <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
              请输入有效的代币合约地址以监听事件
            </Alert>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              最近的转账事件 ({dataState.transferEvents.length})：
            </Typography>
            
            {dataState.transferEvents.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(248, 250, 252, 0.8)', borderRadius: 1 }}>
                暂无转账事件
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {dataState.transferEvents.map((event, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 2, 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 1, 
                      bgcolor: 'white',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <span style={{ fontWeight: 'medium' }}>从：</span>
                      {truncateAddress(event.from)}
                      {' → '}
                      <span style={{ fontWeight: 'medium' }}>到：</span>
                      {truncateAddress(event.to)}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          金额: {tokenDecimals.data ? 
                            formatUnits(BigInt(event.value), tokenDecimals.data) : 
                            event.value.toString()} {tokenSymbol.data || '代币'}
                        </Typography>
                        {event.blockNumber > 0 && (
                          <Typography variant="body2" color="text.secondary">
                            区块: {event.blockNumber}
                          </Typography>
                        )}
                      </Box>
                      
                      <Typography variant="caption" color="text.disabled">
                        {formatTimestamp(event.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    );
  };

  // 处理选项卡切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setUiState(prev => ({ ...prev, activeTab: newValue }));
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* 连接状态显示 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
          {isConnected ? (
            <>已连接: {truncateAddress(address || '')}</>
          ) : (
            '未连接钱包'
          )}
        </Typography>
        
        <Button
          variant={isConnected ? 'text' : 'contained'}
          startIcon={<Wallet sx={{ width: 16, height: 16 }} />}
          onClick={() => {
            if (!isConnected) {
              // 这里应该有连接钱包的逻辑，但通常由 Wagmi 配置处理
              console.log('连接钱包');
            }
          }}
          sx={{
            bgcolor: isConnected ? 'transparent' : '#3b82f6',
            '&:hover': {
              bgcolor: isConnected ? 'rgba(59, 130, 246, 0.08)' : '#2563eb'
            }
          }}
        >
          {isConnected ? '切换账户' : '连接钱包'}
        </Button>
      </Box>

      {/* 状态消息显示 */}
      {uiState.error && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          {uiState.error}
        </Alert>
      )}
      
      {uiState.success && (
        <Alert severity="success" variant="outlined" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{uiState.success}</span>
          {uiState.success.includes('交易已发送') && txData && (
            <IconButton size="small" onClick={() => copyTxHash(txData)}>
              <CopyAll sx={{ width: 16, height: 16 }} />
            </IconButton>
          )}
          {uiState.success.includes('代币交易已发送') && tokenTxData && (
            <IconButton size="small" onClick={() => copyTxHash(tokenTxData)}>
              <CopyAll sx={{ width: 16, height: 16 }} />
            </IconButton>
          )}
        </Alert>
      )}

      {/* 选项卡导航 */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={uiState.activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
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
      <Box sx={{ mt: 6, p: 3, borderRadius: '1rem', bgcolor: 'rgba(241, 245, 249, 0.8)' }}>
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
      </Box>
    </Box>
  );
};

export default WagmiContent;