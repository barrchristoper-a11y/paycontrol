const { PlaidApi, Configuration } = require('plaid');

const plaidConfig = new Configuration({
    basePath: process.env.PLAID_ENV === 'production'
        ? 'https://production.plaid.com'
        : 'https://sandbox.plaid.com',
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
            'Plaid-Version': '2020-09-14',
        },
    },
});

const plaidClient = new PlaidApi(plaidConfig);

async function createLinkToken(userId) {
    const request = {
        user: { client_user_id: userId.toString() },
        client_name: 'PayControl',
        products: ['auth', 'transactions'],
        country_codes: ['US'],
        language: 'en',
    };
    const response = await plaidClient.linkTokenCreate(request);
    return response.data.link_token;
}

async function exchangePublicToken(publicToken) {
    const request = { public_token: publicToken };
    const response = await plaidClient.itemPublicTokenExchange(request);
    return response.data;
}

async function getAccounts(accessToken) {
    const request = { access_token: accessToken };
    const response = await plaidClient.accountsGet(request);
    return response.data.accounts;
}

module.exports = { createLinkToken, exchangePublicToken, getAccounts };