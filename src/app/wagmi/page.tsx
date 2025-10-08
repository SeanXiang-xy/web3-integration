'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress } from '@mui/material';
import { Info, CopyAll, Send, Search } from '@mui/icons-material';
import { useBalance, useReadContract, useWriteContract, useWatchContractEvent, useSendTransaction } from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import { TextField, Button, Tabs, Tab, Alert, IconButton, Divider } from '@mui/material';
import { erc20ABI, sampleErc20Address } from '../../lib/erc20';
import { sepolia } from 'wagmi/chains';
import { useWallet } from '../components/WalletProvider';

const WagmiPage: React.FC = () => {
  // 服务器端渲染时显示加载状态
  if (typeof window === 'undefined') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6">加载中...</Typography>
          <Typography variant="body2" color="text.secondary">
            正在准备Web3集成演示
          </Typography>
        </Box>
      </Box>
    );
  }

  // 返回客户端渲染的组件
  return <WagmiPageClient />;
};

// 客户端渲染的组件
const WagmiPageClient: React.FC = () => {

  // 格式化时间戳（暂时注释，因为未使用）
  // const formatTimestamp = (timestamp: string | number): string => {
  //   try {
  //     return new Date(timestamp).toLocaleString();
  //   } catch (error) {
  //     return 'Invalid Date';
  //   }
  // };

  // 自定义Tab面板组件
  const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => {
    return (
      <div role="tabpanel" hidden={value !== index} className="fade-in">
        {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
      </div>
    );
  };

  // 地址验证函数
  const isValidEthAddress = useCallback((address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }, []);

  // 截取地址显示
  const truncateAddress = useCallback((address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  // 自定义Hook：获取当前选中地址（查询地址或连接地址）
  const useCurrentAddress = (address: string | undefined | null, addressToQuery: string | undefined) => {
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
    // 先验证地址有效性
    const isAddressValid = isValidEthAddress(tokenContractAddress);
    
    // 始终在顶层调用React Hook，使用有效的地址或默认地址
    const tokenName = useReadContract({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      functionName: 'name',
      chainId: sepolia.id
    });

    const tokenSymbol = useReadContract({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      functionName: 'symbol',
      chainId: sepolia.id
    });

    const tokenDecimals = useReadContract({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      functionName: 'decimals',
      chainId: sepolia.id
    });

    const tokenTotalSupply = useReadContract({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      functionName: 'totalSupply',
      chainId: sepolia.id
    });

    return { 
      tokenName, 
      tokenSymbol, 
      tokenDecimals, 
      tokenTotalSupply, 
      isAddressValid 
    };
  };

  // 使用钱包Hook
    const { address, isConnected } = useWallet();

    // 状态管理
    const [tabValue, setTabValue] = useState(0);
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [tokenContractAddress, setTokenContractAddress] = useState(sampleErc20Address);
    const [tokenTransferAmount, setTokenTransferAmount] = useState('');
    const [tokenTransferRecipient, setTokenTransferRecipient] = useState('');
    const [events, setEvents] = useState<Array<{transactionHash: string, blockNumber: number, from: string, to: string, value: string, logIndex?: number}>>([]);
    const [addressToQuery, setAddressToQuery] = useState('');
    const [transactionHash, setTransactionHash] = useState<string | null>(null);
    const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
    const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('info');

    // 获取当前要查询的地址
    const currentAddress = useCurrentAddress(address, addressToQuery);

    // 获取代币信息
    const { tokenName, tokenSymbol, tokenDecimals, tokenTotalSupply, isAddressValid } = useTokenInfo(tokenContractAddress);

    // 查询余额
    const balance = useBalance({
      address: currentAddress,
      chainId: sepolia.id
    });

    // 查询代币余额
    const tokenBalance = useReadContract({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      functionName: 'balanceOf',
      args: [currentAddress],
      chainId: sepolia.id
    });

    // 发送ETH交易
    const sendTransaction = useSendTransaction();

    // 发送代币交易
    const writeContract = useWriteContract();

    // 监听代币转账事件
    useWatchContractEvent({
      address: isAddressValid ? (tokenContractAddress as `0x${string}`) : undefined,
      abi: erc20ABI,
      eventName: 'Transfer',
      chainId: sepolia.id,
      onLogs: (logs) => {
        setEvents((prevEvents) => [...logs, ...prevEvents]);
      }
    });

    // 显示通知
    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotificationMessage(message);
      setNotificationType(type);
      setTimeout(() => {
        setNotificationMessage(null);
      }, 5000);
    }, [setNotificationMessage, setNotificationType]);

    // 处理发送ETH
    const handleSendEth = useCallback(async () => {
      if (!recipient || !amount || !isValidEthAddress(recipient)) {
        showNotification('请输入有效的接收地址和金额', 'error');
        return;
      }

      try {
        setTransactionStatus('pending');
        const result = await writeContract({
          to: recipient as `0x${string}`,
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parseEther(amount)],
          value: parseEther(amount),
          chainId: sepolia.id
        });

        if (result.transactionHash) {
          setTransactionHash(result.transactionHash);
          showNotification(`交易已发送: ${truncateAddress(result.transactionHash)}`, 'success');
          setTransactionStatus('success');
        }
      } catch (error) {
        console.error('发送ETH失败:', error);
        showNotification(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        setTransactionStatus('error');
      }
    }, [recipient, amount, sendTransaction, showNotification, truncateAddress, isValidEthAddress]);

    // 处理发送代币
    const handleSendToken = useCallback(async () => {
      if (!tokenContractAddress || !isAddressValid || !tokenTransferRecipient || !tokenTransferAmount) {
        showNotification('请输入有效的合约地址、接收地址和金额', 'error');
        return;
      }

      try {
        setTransactionStatus('pending');
        const result = await writeContract({
          address: tokenContractAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'transfer',
          args: [tokenTransferRecipient as `0x${string}`, parseUnits(tokenTransferAmount, tokenDecimals.data as number)],
          chainId: sepolia.id
        });

        if (result.hash) {
          setTransactionHash(result.hash);
          showNotification(`代币交易已发送: ${truncateAddress(result.hash)}`, 'success');
          setTransactionStatus('success');
        }
      } catch (error) {
        console.error('发送代币失败:', error);
        showNotification(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        setTransactionStatus('error');
      }
    }, [tokenContractAddress, isAddressValid, tokenTransferRecipient, tokenTransferAmount, tokenDecimals.data, writeContract, showNotification, truncateAddress]);

    // 处理Tab切换
    const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
      setTabValue(newValue);
    }, []);

    // 复制交易哈希
    const copyTransactionHash = useCallback(() => {
      if (transactionHash) {
        navigator.clipboard.writeText(transactionHash).then(() => {
          showNotification('交易哈希已复制到剪贴板', 'success');
        }).catch(() => {
          showNotification('复制失败，请手动复制', 'error');
        });
      }
    }, [transactionHash, showNotification]);

    // 复制地址
    const copyAddress = useCallback((addressToCopy: string) => {
      navigator.clipboard.writeText(addressToCopy).then(() => {
        showNotification('地址已复制到剪贴板', 'success');
      }).catch(() => {
        showNotification('复制失败，请手动复制', 'error');
      });
    }, [showNotification]);

    // 处理地址查询
    const handleAddressQuery = useCallback(() => {
      if (!addressToQuery) {
        showNotification('请输入要查询的地址', 'error');
        return;
      }
      if (!isValidEthAddress(addressToQuery)) {
        showNotification('请输入有效的以太坊地址', 'error');
        return;
      }
      showNotification(`已开始查询地址: ${truncateAddress(addressToQuery)}`, 'info');
    }, [addressToQuery, isValidEthAddress, truncateAddress, showNotification]);

    // 处理代币合约地址变更
    const handleTokenContractChange = useCallback(() => {
      if (tokenContractAddress && isValidEthAddress(tokenContractAddress)) {
        showNotification(`正在查询代币信息: ${truncateAddress(tokenContractAddress)}`, 'info');
      }
    }, [tokenContractAddress, isValidEthAddress, truncateAddress, showNotification]);

    // 监听地址查询变更
    useEffect(() => {
      if (addressToQuery && isValidEthAddress(addressToQuery)) {
        handleAddressQuery();
      }
    }, [addressToQuery, handleAddressQuery, isValidEthAddress]);

    // 监听代币合约地址变更
    useEffect(() => {
      if (tokenContractAddress && isValidEthAddress(tokenContractAddress)) {
        handleTokenContractChange();
      }
    }, [tokenContractAddress, handleTokenContractChange, isValidEthAddress]);

    // 渲染余额查询选项卡
    const renderBalanceTab = () => {
      return (
        <div>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>以太坊地址余额</Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="输入地址查询"
                variant="outlined"
                value={addressToQuery}
                onChange={(e) => setAddressToQuery(e.target.value)}
                placeholder="0x..."
                helperText={addressToQuery && !isValidEthAddress(addressToQuery) ? '无效的以太坊地址' : undefined}
                error={addressToQuery && !isValidEthAddress(addressToQuery) ? true : undefined}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddressQuery}
                startIcon={<Search size={16} />}
              >
                查询
              </Button>
            </Box>
            
            {currentAddress && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  当前查询地址: {truncateAddress(currentAddress)}
                </Typography>
                <IconButton size="small" onClick={() => copyAddress(currentAddress)}>
                  <CopyAll fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>

          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>ETH 余额</Typography>
              {balance.isLoading ? (
                <CircularProgress size={20} />
              ) : balance.data ? (
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {formatEther(balance.data.value)} ETH
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  无法获取余额
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>地址信息</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">链 ID</Typography>
                  <Typography variant="body2">{sepolia.id}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">网络名称</Typography>
                  <Typography variant="body2">{sepolia.name}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </div>
      );
    };

    // 渲染发送ETH选项卡
    const renderSendEthTab = () => {
      return (
        <div>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>发送 ETH</Typography>
            
            {!isConnected && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                请先连接钱包以发送 ETH
              </Alert>
            )}

            <TextField
              fullWidth
              label="接收地址"
              variant="outlined"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              helperText={recipient && !isValidEthAddress(recipient) ? '无效的以太坊地址' : undefined}
                error={recipient && !isValidEthAddress(recipient) ? true : undefined}
              disabled={!isConnected}
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              label="发送金额 (ETH)"
              variant="outlined"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.1"
              helperText={amount && parseFloat(amount) <= 0 ? '请输入大于0的金额' : ''}
              error={amount && parseFloat(amount) <= 0}
              disabled={!isConnected}
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleSendEth}
              disabled={!isConnected || !recipient || !amount || !isValidEthAddress(recipient) || parseFloat(amount) <= 0}
              sx={{ py: 1.5 }}
              startIcon={<Send />}
            >
              {transactionStatus === 'pending' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <span>发送中...</span>
                </Box>
              ) : (
                '发送 ETH'
              )}
            </Button>
          </Box>

          {transactionHash && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>交易哈希</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all', flexGrow: 1 }}>
                    {transactionHash}
                  </Typography>
                  <IconButton size="small" onClick={copyTransactionHash}>
                    <CopyAll fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 500 }}>提示</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                1. 请确保接收地址正确无误，一旦发送将无法撤销。
                <br />
                2. 交易需要网络确认，可能需要几分钟时间。
                <br />
                3. 发送前请确保余额充足，包括交易手续费。
              </Typography>
            </CardContent>
          </Card>
        </div>
      );
    };

    // 渲染代币信息选项卡
    const renderTokenInfoTab = () => {
      return (
        <div>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>代币信息</Typography>
            
            <TextField
              fullWidth
              label="代币合约地址"
              variant="outlined"
              value={tokenContractAddress}
              onChange={(e) => setTokenContractAddress(e.target.value)}
              placeholder="0x..."
              helperText={tokenContractAddress && !isValidEthAddress(tokenContractAddress) ? '无效的以太坊地址' : undefined}
                error={tokenContractAddress && !isValidEthAddress(tokenContractAddress) ? true : undefined}
              sx={{ mb: 3 }}
            />

            {!isAddressValid && tokenContractAddress && (
              <Alert severity="error" sx={{ mb: 3 }}>
                无效的代币合约地址
              </Alert>
            )}
          </Box>

          {(tokenName.isLoading || tokenSymbol.isLoading || tokenDecimals.isLoading || tokenTotalSupply.isLoading) && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={40} />
                </Box>
                <Typography variant="body2" color="text.secondary" align="center">
                  正在获取代币信息...
                </Typography>
              </CardContent>
            </Card>
          )}

          {isAddressValid && !tokenName.isLoading && tokenName.data && (
            <>
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">{tokenName.data}</Typography>
                    <Typography variant="subtitle1" fontWeight="bold">{tokenSymbol.data}</Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">小数位数</Typography>
                      <Typography variant="body1">{tokenDecimals.data || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">总供应量</Typography>
                      <Typography variant="body1">
                        {tokenTotalSupply.data 
                          ? tokenDecimals.data 
                            ? formatEther(parseUnits(tokenTotalSupply.data.toString(), tokenDecimals.data)) 
                            : tokenTotalSupply.data.toString()
                          : 'N/A'}
                        {' '}{tokenSymbol.data}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {currentAddress && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>你的余额</Typography>
                    {tokenBalance.isLoading ? (
                      <CircularProgress size={20} />
                    ) : tokenBalance.data ? (
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {tokenDecimals.data 
                          ? formatEther(parseUnits(tokenBalance.data.toString(), tokenDecimals.data)) 
                          : tokenBalance.data.toString()}
                        {' '}{tokenSymbol.data}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        无法获取余额
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )};
        </div>
      );
    };

    // 渲染发送代币选项卡
    const renderSendTokenTab = () => {
      return (
        <div>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>发送代币</Typography>
            
            {!isConnected && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                请先连接钱包以发送代币
              </Alert>
            )}

            <TextField
              fullWidth
              label="代币合约地址"
              variant="outlined"
              value={tokenContractAddress}
              onChange={(e) => setTokenContractAddress(e.target.value)}
              placeholder="0x..."
              helperText={tokenContractAddress && !isValidEthAddress(tokenContractAddress) ? '无效的以太坊地址' : ''}
              error={tokenContractAddress && !isValidEthAddress(tokenContractAddress)}
              disabled={!isConnected}
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              label="接收地址"
              variant="outlined"
              value={tokenTransferRecipient}
              onChange={(e) => setTokenTransferRecipient(e.target.value)}
              placeholder="0x..."
              helperText={tokenTransferRecipient && !isValidEthAddress(tokenTransferRecipient) ? '无效的以太坊地址' : undefined}
                error={tokenTransferRecipient && !isValidEthAddress(tokenTransferRecipient) ? true : undefined}
              disabled={!isConnected}
              sx={{ mb: 3 }}
            />

            <TextField
              fullWidth
              label={`发送金额 (${tokenSymbol.data || '代币'})`}
              variant="outlined"
              type="number"
              value={tokenTransferAmount}
              onChange={(e) => setTokenTransferAmount(e.target.value)}
              placeholder="1.0"
              helperText={tokenTransferAmount && parseFloat(tokenTransferAmount) <= 0 ? '请输入大于0的金额' : ''}
              error={tokenTransferAmount && parseFloat(tokenTransferAmount) <= 0}
              disabled={!isConnected || !isAddressValid}
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleSendToken}
              disabled={
                !isConnected || 
                !tokenContractAddress || 
                !isAddressValid || 
                !tokenTransferRecipient || 
                !tokenTransferAmount || 
                !isValidEthAddress(tokenTransferRecipient) || 
                parseFloat(tokenTransferAmount) <= 0
              }
              sx={{ py: 1.5 }}
              startIcon={<Send />}
            >
              {transactionStatus === 'pending' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <span>发送中...</span>
                </Box>
              ) : (
                `发送 ${tokenSymbol.data || '代币'}`
              )}
            </Button>
          </Box>

          {transactionHash && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>交易哈希</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all', flexGrow: 1 }}>
                    {transactionHash}
                  </Typography>
                  <IconButton size="small" onClick={copyTransactionHash}>
                    <CopyAll size={16} />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          )}

          {isAddressValid && tokenSymbol.data && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 500 }}>提示</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  1. 请确保代币合约地址和接收地址正确无误。
                  <br />
                  2. 发送前请确保您持有足够的 {tokenSymbol.data} 代币和 ETH 用于支付手续费。
                  <br />
                  3. 交易可能需要几分钟时间才能确认。
                </Typography>
              </CardContent>
            </Card>
          )}
        </div>
      );
    };

    // 渲染事件监听选项卡
    const renderEventListenerTab = () => {
      return (
        <div>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>代币转账事件</Typography>
            
            <TextField
              fullWidth
              label="代币合约地址"
              variant="outlined"
              value={tokenContractAddress}
              onChange={(e) => setTokenContractAddress(e.target.value)}
              placeholder="0x..."
              helperText={tokenContractAddress && !isValidEthAddress(tokenContractAddress) ? '无效的以太坊地址' : ''}
              error={tokenContractAddress && !isValidEthAddress(tokenContractAddress)}
              sx={{ mb: 3 }}
            />

            {!isAddressValid && tokenContractAddress && (
              <Alert severity="error" sx={{ mb: 3 }}>
                无效的代币合约地址，无法监听事件
              </Alert>
            )}
          </Box>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 3 }}>最近的转账事件</Typography>
              
              {events.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  暂无转账事件记录
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 400, overflowY: 'auto', gap: 2, display: 'flex', flexDirection: 'column' }}>
                  {events.slice(0, 10).map((event, index) => {
                    // 确保事件数据有效
                    if (!event || !event.blockNumber) return null;
                    
                    const from = event.from as string;
                    const to = event.to as string;
                    const value = event.value as bigint;
                    const formattedValue = tokenDecimals.data 
                      ? formatEther(parseUnits(value.toString(), tokenDecimals.data)) 
                      : value.toString();
                    
                    return (
                      <Box key={`${event.blockNumber}-${event.logIndex}-${index}`} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="subtitle2" fontWeight={500}>
                            {truncateAddress(from)} → {truncateAddress(to)}
                          </Typography>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {formattedValue}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {tokenSymbol.data || '代币'}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', color: 'text.secondary', fontSize: '0.75rem' }}>
                          <Typography variant="caption">区块: {event.blockNumber}</Typography>
                          <Typography variant="caption">索引: {event.logIndex}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </div>
      );
    };

  // 组件返回部分
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 py-12">
          {/* 页面标题 */}
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Web3 集成演示
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              通过 Wagmi 和 Viem 实现的以太坊交互界面
            </Typography>
          </Box>

          {/* 钱包连接状态 */}
          <Box sx={{ mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h6">钱包连接</Typography>
              <div>
                {isConnected && address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {truncateAddress(address)}
                    </Typography>
                    <IconButton size="small" onClick={() => copyAddress(address)}>
                  <CopyAll fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </div>
            </Box>
          </Box>

          {/* 状态消息 */}
          {notificationMessage && (
            <Alert
              severity={notificationType}
              sx={{ mb: 4 }}
              onClose={() => setNotificationMessage(null)}
            >
              {notificationMessage}
            </Alert>
          )}

          {/* 功能选项卡 */}
          <Card sx={{ mb: 8 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="功能选项卡"
              >
                <Tab label="余额查询" />
                <Tab label="发送 ETH" />
                <Tab label="代币信息" />
                <Tab label="发送代币" />
                <Tab label="事件监听" />
              </Tabs>
            </Box>
            <CardContent>
              <TabPanel value={tabValue} index={0}>{renderBalanceTab()}</TabPanel>
              <TabPanel value={tabValue} index={1}>{renderSendEthTab()}</TabPanel>
              <TabPanel value={tabValue} index={2}>{renderTokenInfoTab()}</TabPanel>
              <TabPanel value={tabValue} index={3}>{renderSendTokenTab()}</TabPanel>
              <TabPanel value={tabValue} index={4}>{renderEventListenerTab()}</TabPanel>
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Info size={20} color="primary" />
                <Typography variant="h6">使用说明</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                此演示界面使用 Wagmi 和 Viem 库与以太坊网络进行交互。您可以：
              </Typography>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginBottom: '16px' }}>
                <li style={{ marginBottom: '8px' }}>
                  <Typography variant="body2">查询任何以太坊地址的余额和信息</Typography>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <Typography variant="body2">发送 ETH 到其他地址</Typography>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <Typography variant="body2">查询和管理 ERC20 代币</Typography>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <Typography variant="body2">发送 ERC20 代币到其他地址</Typography>
                </li>
                <li>
                  <Typography variant="body2">监听代币的转账事件</Typography>
                </li>
              </ul>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                提示：此演示使用 Sepolia 测试网络，请确保您的钱包已切换至 Sepolia 网络并拥有测试 ETH。
              </Typography>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

export default WagmiPage;