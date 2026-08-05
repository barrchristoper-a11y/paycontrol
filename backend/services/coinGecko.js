const axios = require('axios');

async function getCryptoPrices(symbols = ['bitcoin', 'ethereum', 'tether']) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${symbols.join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const response = await axios.get(url, {
        headers: {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
        },
    });
    return response.data;
}

module.exports = { getCryptoPrices };