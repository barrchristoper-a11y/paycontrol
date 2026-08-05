const axios = require('axios');

const ALCHEMY_API_KEYS = {
    eth: process.env.ALCHEMY_API_KEY_ETH,
    sol: process.env.ALCHEMY_API_KEY_SOL,
};

async function getEthBalance(address) {
    const url = `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEYS.eth}`;
    const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
    });
    return parseInt(response.data.result) / 1e18; // Wei to ETH
}

async function getSolBalance(address) {
    const url = `https://solana-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEYS.sol}`;
    const response = await axios.post(url, {
        jsonrpc: '2.0',
        method: 'getBalance',
        params: [address],
        id: 1,
    });
    return response.data.result.value / 1e9; // Lamports to SOL
}

module.exports = { getEthBalance, getSolBalance };