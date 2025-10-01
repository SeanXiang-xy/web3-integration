import { Container, Typography, Card, CardContent, Box } from '@mui/material';
export default function Home() {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 8 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Web3 集成示例
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          本项目展示了如何使用不同的Web3库（Wagmi、Ethers.js和Viem）与以太坊区块链交互。
          通过连接钱包，您可以查询余额、发送交易、与ERC20代币交互等。
        </Typography>
      </Box>
      
      <Box sx={{ mt: 8 }}>
        <Card variant="outlined" sx={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom>
              功能介绍
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mt: 2 }}>
              <div>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  查询余额
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  通过指定地址，查询该地址的以太坊余额和ERC20代币余额。
                </Typography>
              </div>
              <div>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  发送交易
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  向指定地址发送以太坊，支持自定义Gas价格和Gas限制。
                </Typography>
              </div>
              <div>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  查询ERC20合约
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  获取ERC20代币的基本信息，如名称、符号、小数位等。
                </Typography>
              </div>
              <div>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  监听Transfer事件
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  实时监听ERC20代币的转账事件，获取交易详情。
                </Typography>
              </div>
              <div>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  发送ERC20代币
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  将ERC20代币转账到指定地址，支持自定义数量。
                </Typography>
              </div>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
