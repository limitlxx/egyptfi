export const config = {
  starknet: {
    rpcUrl: process.env.STARKNET_RPC_URL!,
    contractAddress: process.env.PAYMENT_GATEWAY_CONTRACT!,
    autoswapprAddress: process.env.AUTOSWAPPR_CONTRACT!,
    operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY!,
    operatorAddress: process.env.OPERATOR_ADDRESS!,
  },
  tokens: {
    USDC: process.env.USDC_TOKEN_ADDRESS!,
    ETH: process.env.ETH_TOKEN_ADDRESS!,
    STRK: process.env.STRK_TOKEN_ADDRESS!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
    secretKey: process.env.API_SECRET_KEY!,
  }
};