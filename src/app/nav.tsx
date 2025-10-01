import React from 'react';
import { Button, Tooltip, Box } from '@mui/material';
import Link from 'next/link';
import { Public, Code, Terminal } from '@mui/icons-material';
import ConnectedWalletButton from './components/ConnectedWalletButton';

const Nav: React.FC = () => {
  return (
    <Box 
      sx={{
        mb: 4,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box 
        sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Tooltip title="使用Wagmi库的Web3功能" arrow placement="top">
          <Button 
            component={Link} 
            href="/wagmi" 
            sx={{
              bgcolor: '#3b82f6',
              color: 'white',
              '&:hover': {
                bgcolor: '#2563eb',
                boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)',
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
            startIcon={<Public />}
          >
            Wagmi
          </Button>
        </Tooltip>
        
        <Tooltip title="使用Ethers.js库的Web3功能" arrow placement="top">
          <Button 
            component={Link} 
            href="/ethers" 
            sx={{
              bgcolor: '#6366f1',
              color: 'white',
              '&:hover': {
                bgcolor: '#4f46e5',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
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
            startIcon={<Code />}
          >
            Ethers.js
          </Button>
        </Tooltip>
        
        <Tooltip title="使用Viem库的Web3功能" arrow placement="top">
          <Button 
            component={Link} 
            href="/viem" 
            sx={{
              bgcolor: '#10b981',
              color: 'white',
              '&:hover': {
                bgcolor: '#059669',
                boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)',
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
            startIcon={<Terminal />}
          >
            Viem
          </Button>
        </Tooltip>
      </Box>
      
      {/* 钱包连接按钮 */}
      <Box>
        <ConnectedWalletButton />
      </Box>
    </Box>
  );
};

export default Nav;