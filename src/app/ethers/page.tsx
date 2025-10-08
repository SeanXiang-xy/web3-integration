'use client'

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Tabs,
  Tab,
  Alert,
  IconButton,
  CircularProgress
} from '@mui/material';
import { CopyAll, Info } from '@mui/icons-material';
import { ethers } from 'ethers';
import { useWallet } from '../components/WalletProvider';

// 示例ERC20代币地址（Sepolia测试网）
const sampleErc20Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// 格式化大数值（处理大数时避免精度丢失）
const formatBigNumber = (value: ethers.BigNumberish, decimals: number = 18): string => {
  if (!value) return '0';
  try {
    // Convert to string first to handle various input types
    const valueStr = typeof value === 'string' ? value : String(value);
    return ethers.formatUnits(valueStr, decimals);
  } catch (error) {
    console.error('格式化数值失败:', error);
    return '0';
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  try {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  } catch (error) {
    console.error('格式化时间戳失败:', error);
    return '未知';
  }
};

// 验证以太坊地址
const isValidAddress = (address: string): boolean => {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
};

// 截断地址显示
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
};

// TabPanel组件
const TabPanel = (props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
};

// useTokenInfo Hook - 获取代币信息
const useTokenInfo = (contractAddress: string, provider: ethers.BrowserProvider | null) => {
  const [tokenInfo, setTokenInfo] = useState({
    name: '未知',
    symbol: '未知',
    decimals: 18,
    totalSupply: '',
    isLoading: false,
    error: ''
  });

  const fetchTokenInfo = useCallback(async () => {
    if (!contractAddress || !isValidAddress(contractAddress) || !provider) {
      setTokenInfo(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setTokenInfo(prev => ({ ...prev, isLoading: true, error: '' }));
    try {
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ],
        provider
      );

      // 单独调用每个方法并处理可能的错误，避免一个方法失败导致整体失败
      let name = '未知';
      let symbol = '未知';
      let decimals = 18;
      let totalSupply = '';
      const individualErrors: string[] = [];

      // 使用链式catch处理错误，避免额外的try-catch嵌套
      name = await contract.name().catch(() => {
        individualErrors.push('获取名称失败');
        return '未知';
      });

      symbol = await contract.symbol().catch(() => {
        individualErrors.push('获取符号失败');
        return '未知';
      });

      decimals = await contract.decimals().catch(() => {
        individualErrors.push('获取小数位失败');
        return 18;
      });

      // 为了避免编译错误，使用字符串'0'作为默认值
      const supply = await contract.totalSupply().catch(() => {
        individualErrors.push('获取总供应量失败');
        return '0';
      });
      totalSupply = formatBigNumber(supply, decimals);

      setTokenInfo({
        name,
        symbol,
        decimals,
        totalSupply,
        isLoading: false,
        error: individualErrors.length > 0 ? individualErrors.join(', ') : ''
      });
    } catch (error) {
      console.error('查询代币信息失败:', error);
      setTokenInfo(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '查询代币信息失败'
      }));
    }
  }, [contractAddress, provider]);

  useEffect(() => {
    fetchTokenInfo();
  }, [contractAddress, provider, fetchTokenInfo]);

  return tokenInfo;
};

const EthersPage: React.FC = () => {
  // 使用全局钱包状态
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

  // 获取代币信息
  const tokenInfo = useTokenInfo(formData.tokenContractAddress, provider);
  const { name: tokenName, symbol: tokenSymbol, decimals: tokenDecimals, totalSupply: tokenTotalSupply, isLoading: tokenInfoLoading, error: tokenInfoError } = tokenInfo;

  // 地址验证
  const isAddressValid = isValidAddress(formData.tokenContractAddress);

  // Provider和Signer状态更新
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum && isConnected) {
      const initProvider = async () => {
        try {
          // 确保window.ethereum符合Eip1193Provider类型
          const ethereumProvider = window.ethereum as ethers.Eip1193Provider;
          const newProvider = new ethers.BrowserProvider(ethereumProvider);
          setProvider(newProvider);
          const newSigner = await newProvider.getSigner();
          setSigner(newSigner);
        } catch (error) {
          console.error('初始化Provider失败:', error);
          setError('初始化Provider失败');
        }
      };
      initProvider();
    } else {
      setProvider(null);
      setSigner(null);
    }
  }, [isConnected]);

  // 自动填充地址
  useEffect(() => {
    if (address) {
      setFormData(prev => ({ ...prev, addressToQuery: address }));
    }
  }, [address]);

  // 处理输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 处理Tab切换
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setUiState(prev => ({ ...prev, activeTab: newValue }));
  };

  // 查询余额
  const queryBalance = async () => {
    if (!formData.addressToQuery || !isValidAddress(formData.addressToQuery) || !provider) {
      setError('请输入有效的以太坊地址');
      return;
    }

    setUiState(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      const balance = await provider.getBalance(formData.addressToQuery);
      setDataState(prev => ({ ...prev, balance: formatBigNumber(balance) }));
    } catch (error) {
      console.error('查询余额失败:', error);
      setError(error instanceof Error ? error.message : '查询余额失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 发送交易
  const sendTransaction = async () => {
    if (!formData.transferToAddress || !isValidAddress(formData.transferToAddress) || !formData.transferAmount || !signer) {
      setError('请检查目标地址和转账金额');
      return;
    }

    setUiState(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      const amount = ethers.parseEther(formData.transferAmount);
      const tx = await signer.sendTransaction({
        to: formData.transferToAddress,
        value: amount
      });

      setDataState(prev => ({ ...prev, txHash: tx.hash }));
      setUiState(prev => ({ ...prev, success: '交易已发送，等待确认' }));
      
      // 等待交易确认
      await tx.wait();
      setUiState(prev => ({ ...prev, success: '交易已确认' }));
    } catch (error) {
      console.error('发送交易失败:', error);
      setError(error instanceof Error ? error.message : '发送交易失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 5000);
    }
  };

  // 查询代币余额
  const queryTokenBalance = async () => {
    if (!formData.addressToQuery || !isValidAddress(formData.addressToQuery) || !formData.tokenContractAddress || !isValidAddress(formData.tokenContractAddress) || !provider) {
      setError('请输入有效的地址');
      return;
    }

    setUiState(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      const contract = new ethers.Contract(
        formData.tokenContractAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const balance = await contract.balanceOf(formData.addressToQuery);
      setDataState(prev => ({
        ...prev,
        tokenBalance: formatBigNumber(balance, tokenDecimals),
        tokenSymbol
      }));
    } catch (error) {
      console.error('查询代币余额失败:', error);
      setError(error instanceof Error ? error.message : '查询代币余额失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 发送代币
  const transferToken = async () => {
    if (!formData.transferToAddress || !isValidAddress(formData.transferToAddress) || !formData.tokenContractAddress || !isValidAddress(formData.tokenContractAddress) || !formData.tokenAmount || !signer) {
      setError('请检查输入信息');
      return;
    }

    setUiState(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      const contract = new ethers.Contract(
        formData.tokenContractAddress,
        ['function transfer(address to, uint256 amount) returns (bool)'],
        signer
      );

      const amount = ethers.parseUnits(formData.tokenAmount, tokenDecimals);
      const tx = await contract.transfer(formData.transferToAddress, amount);

      setDataState(prev => ({ ...prev, txHash: tx.hash }));
      setUiState(prev => ({ ...prev, success: '代币转账已发送，等待确认' }));

      // 等待交易确认
      await tx.wait();
      setUiState(prev => ({ ...prev, success: '代币转账已确认' }));
    } catch (error) {
      console.error('发送代币失败:', error);
      setError(error instanceof Error ? error.message : '发送代币失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
      setTimeout(() => {
        setUiState(prev => ({ ...prev, success: null }));
      }, 5000);
    }
  };

  // 初始化获取历史事件（使用useCallback包装以避免不必要的重新创建）
  const fetchHistoricalEvents = useCallback(async () => {
    if (!formData.tokenContractAddress || !isValidAddress(formData.tokenContractAddress) || !provider) {
      setError('请输入有效的代币合约地址');
      return;
    }

    setUiState(prev => ({ ...prev, isLoading: true }));
    setError(null);

    try {
      const contract = new ethers.Contract(
        formData.tokenContractAddress,
        [
          'event Transfer(address indexed from, address indexed to, uint256 value)',
          'function decimals() view returns (uint8)'
        ],
        provider
      );

      // 获取最近的10个转账事件
      const filter = contract.filters.Transfer();
      const events = await contract.queryFilter(filter, -10);
      const currentDecimals = await contract.decimals();

      // 格式化事件数据
      const formattedEvents = await Promise.all(
        events.map(async event => {
          // 确保event是EventLog类型并有args属性
          if (!('args' in event)) {
            throw new Error('Invalid event format');
          }
          
          const block = await provider.getBlock(event.blockNumber);
          
          // 检查block不为null
          if (!block) {
            throw new Error(`Block ${event.blockNumber} not found`);
          }
          
          return {
            from: event.args.from,
            to: event.args.to,
            value: formatBigNumber(event.args.value, currentDecimals),
            blockNumber: event.blockNumber,
            timestamp: formatTimestamp(block.timestamp)
          };
        })
      );

      setDataState(prev => ({
        ...prev,
        transferEvents: formattedEvents.reverse(), // 按时间倒序
        tokenSymbol
      }));
    } catch (error) {
      console.error('获取历史事件失败:', error);
      setError(error instanceof Error ? error.message : '获取历史事件失败');
    } finally {
      setUiState(prev => ({ ...prev, isLoading: false }));
    }
  }, [formData.tokenContractAddress, provider, tokenSymbol]);

  // 监听新的Transfer事件
  useEffect(() => {
    // 只有在"监听事件"选项卡激活且有有效的合约地址和provider时才开始监听
    if (!formData.tokenContractAddress || !isValidAddress(formData.tokenContractAddress) || !provider || uiState.activeTab !== 4) {
      return;
    }

    
    const startListening = async () => {
      try {
        const contract = new ethers.Contract(
          formData.tokenContractAddress,
          [
            'event Transfer(address indexed from, address indexed to, uint256 value)',
            'function decimals() view returns (uint8)'
          ],
          provider
        );

        const currentDecimals = await contract.decimals();
        // 不使用currentSymbol，因为我们已经在dataState中存储了tokenSymbol

        // 设置事件监听
        contract.on('Transfer', (from, to, value, event) => {
          // 格式化新事件
          const newEvent = {
            from: from,
            to: to,
            value: formatBigNumber(value, currentDecimals),
            blockNumber: event.blockNumber,
            timestamp: formatTimestamp(Math.floor(Date.now() / 1000)) // 使用当前时间作为临时时间戳
          };

          // 更新事件列表，只保留最近10条
          setDataState(prev => ({
            ...prev,
            transferEvents: [newEvent, ...prev.transferEvents].slice(0, 10)
          }));

          // 显示新事件通知
          setUiState(prev => ({ ...prev, success: '监听到新的转账事件' }));
          setTimeout(() => {
            setUiState(prev => ({ ...prev, success: null }));
          }, 3000);
        });

        // 注意：ethers.js v6中合约事件监听的清理方式是通过合约实例调用removeAllListeners
        // 我们将在清理函数中创建新的合约实例来移除所有监听器
        // 不需要保存listenerId
      } catch (error) {
        console.error('设置事件监听失败:', error);
        setError(error instanceof Error ? error.message : '设置事件监听失败');
      }
    };

    // 先获取历史事件，然后开始实时监听
    if (dataState.transferEvents.length === 0) {
      fetchHistoricalEvents().then(() => {
        startListening();
      });
    } else {
      startListening();
    }

    // 清理函数
    return () => {
      if (provider && formData.tokenContractAddress) {
        try {
          // 创建一个临时合约实例用于移除所有监听器
          const contract = new ethers.Contract(
            formData.tokenContractAddress,
            [
              'event Transfer(address indexed from, address indexed to, uint256 value)'
            ],
            provider
          );
          // 移除所有Transfer事件的监听器
          contract.removeAllListeners('Transfer');
        } catch (error) {
          console.error('清理事件监听器失败:', error);
        }
      }
    };
  }, [formData.tokenContractAddress, provider, uiState.activeTab, dataState.transferEvents.length, dataState.tokenSymbol, fetchHistoricalEvents]);

  // 复制交易哈希
  const copyTxHash = async () => {
    if (dataState.txHash) {
      try {
        await navigator.clipboard.writeText(dataState.txHash);
        setUiState(prev => ({ ...prev, success: '交易哈希已复制' }));
        setTimeout(() => {
          setUiState(prev => ({ ...prev, success: null }));
        }, 2000);
      } catch (error) {
        console.error('复制交易哈希失败:', error);
        setError('复制失败');
      }
    }
  };

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

  // 渲染合并后的代币信息和余额选项卡
  const renderCombinedTokenTab = () => (
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
        
        {/* 代币余额查询 */}
        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" gutterBottom>查询代币余额</Typography>
          <TextField
            fullWidth
            label="以太坊地址"
            variant="outlined"
            margin="normal"
            value={formData.addressToQuery}
            onChange={(e) => handleInputChange('addressToQuery', e.target.value)}
            helperText="输入要查询的以太坊地址"
            disabled={uiState.isLoading || tokenInfoLoading}
          />
          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2, bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
            onClick={queryTokenBalance}
            disabled={uiState.isLoading || tokenInfoLoading || !provider}
            startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
          >
            {uiState.isLoading ? '查询中...' : '查询代币余额'}
          </Button>
          {dataState.tokenBalance !== '0' && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(99, 102, 241, 0.1)', borderRadius: 1 }}>
              <Typography variant="subtitle1">代币余额: {dataState.tokenBalance} {tokenSymbol}</Typography>
            </Box>
          )}
        </Box>
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

  // 渲染事件监听选项卡
  const renderEventsTab = () => (
    <Card sx={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>监听事件</Typography>
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
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            当选择此选项卡时，系统会自动开始监听该代币合约的Transfer事件
          </Typography>
          <Button
            variant="contained"
            fullWidth
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            onClick={fetchHistoricalEvents}
            disabled={uiState.isLoading || !provider}
            startIcon={uiState.isLoading ? <CircularProgress size={16} /> : undefined}
          >
            {uiState.isLoading ? '获取中...' : '重新获取历史事件'}
          </Button>
          {uiState.activeTab === 4 && provider && isValidAddress(formData.tokenContractAddress) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              🔍 正在监听新的转账事件...
            </Typography>
          )}
        </Box>
        {dataState.transferEvents.length > 0 && (
          <Box sx={{ mt: 3, maxHeight: 400, overflowY: 'auto' }}>
            {dataState.transferEvents.map((event: {from: string, to: string, value: string, blockNumber: number, timestamp: string}, index: number) => (
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
          {renderCombinedTokenTab()}
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
              2. 连接成功后，您可以进行余额查询、ETH转账、代币信息查询、代币余额查询、代币转账和实时事件监听等操作。
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