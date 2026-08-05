-- Demo User
INSERT INTO users (email, password_hash, first_name, last_name, role, status)
VALUES (
  'admin@atrpay.io',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H3.8fq23JY2L0Jm5n0J3a1B3J3O', -- bcrypt hash for 'password123'
  'Diana',
  'Mercer',
  'admin',
  'active'
) ON CONFLICT (email) DO NOTHING;

-- Demo Crypto Wallets
INSERT INTO crypto_wallets (user_id, name, address, symbol, network, balance, balance_usd, is_verified)
VALUES 
  (1, 'Primary Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC', 'Bitcoin', 2.4812, 158420.14, true),
  (1, 'Ethereum Wallet', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'ETH', 'Ethereum', 18.7400, 56980.22, true),
  (1, 'Tether USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Ethereum', 24500.00, 24500.00, true),
  (1, 'BNB Chain', 'bnb1jxfh2g85fka8zt3uagcfyk2vcrd5es7xqegkwy', 'BNB', 'BSC', 45.200, 13204.80, true),
  (1, 'Solana Wallet', '9xnEbqBTGpAqLPi3CXoA8rCMzWM5k2VLtT1M2Q3K4n', 'SOL', 'Solana', 312.50, 46406.25, true),
  (1, 'Polygon MATIC', '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7', 'MATIC', 'Polygon', 9840.00, 5904.00, true)
ON CONFLICT (address) DO NOTHING;

-- Demo Bank Accounts
INSERT INTO bank_accounts (user_id, name, bank_name, account_type, last4, balance, currency, status)
VALUES 
  (1, 'Chase Business Checking', 'JPMorgan Chase', 'checking', '4821', 284750.00, 'USD', 'verified'),
  (1, 'Bank of America Savings', 'Bank of America', 'savings', '9344', 52000.00, 'USD', 'verified'),
  (1, 'Wise Multi-Currency', 'Wise', 'digital', '7701', 18200.00, 'USD', 'verified'),
  (1, 'Mercury Business', 'Mercury', 'checking', '2290', 91400.00, 'USD', 'pending')
ON CONFLICT (plaid_item_id) DO NOTHING;

-- Demo Payment Gateways
INSERT INTO payment_gateways (user_id, name, fee, fixed_fee, is_enabled, monthly_volume, transaction_count)
VALUES 
  (1, 'Stripe', 2.90, 0.30, true, 142800.00, 1847),
  (1, 'PayPal', 3.49, 0.49, true, 38400.00, 412),
  (1, 'Wise', 0.41, 0.00, true, 91200.00, 203),
  (1, 'Cash App', 1.50, 0.00, false, 12600.00, 89),
  (1, 'Coinbase', 1.49, 0.00, true, 67200.00, 334),
  (1, 'Revolut', 0.00, 0.00, false, 0.00, 0)
ON CONFLICT (name) DO NOTHING;

-- Demo Allocation Rules
INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
VALUES 
  (1, 'Operations Reserve', 15.00, '#3D8EF0', false, true),
  (1, 'Partner Payouts', 30.00, '#00E5A0', false, true),
  (1, 'Platform Revenue', 25.00, '#A855F7', true, true),
  (1, 'Compliance Reserve', 10.00, '#FFB800', true, true),
  (1, 'Growth Fund', 12.00, '#00D4FF', false, false),
  (1, 'Founder Distribution', 8.00, '#F5C518', false, false)
ON CONFLICT (name) DO NOTHING;

-- Demo Transactions
INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
VALUES 
  (1, 'receive', 'Crypto', 'BTC', 0.4212, 26814.00, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', NULL, 'External Wallet', 'confirmed', 'tx_001', 0.0001),
  (1, 'send', 'Stripe', 'Stripe', 4200.00, 4200.00, NULL, 'Chase 4821', 'Stripe → Chase 4821', 'settled', 'pi_001', 1.26),
  (1, 'receive', 'Crypto', 'USDT', 8500.00, 8500.00, '0xdAC17F958D2ee523a2206206994597C13D831ec7', NULL, '0xd4…f44e', 'confirmed', 'tx_002', 0.00),
  (1, 'send', 'Wise', 'Wise', 3100.00, 3100.00, NULL, 'Partner', 'Wise → Partner', 'processing', 'tx_003', 0.50),
  (1, 'receive', 'PayPal', 'PayPal', 890.00, 890.00, NULL, NULL, 'PayPal Checkout', 'settled', 'tx_004', 0.45),
  (1, 'swap', 'Crypto', 'ETH', 2.1000, 6384.60, '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'ETH → USDT Swap', 'confirmed', 'tx_005', 0.10),
  (1, 'receive', 'Stripe', 'Stripe', 12400.00, 12400.00, NULL, NULL, 'Stripe Batch Settlement', 'settled', 'pi_002', 3.72),
  (1, 'send', 'Crypto', 'BTC', 0.1500, 9569.25, 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'bc1qpartner', 'atrpay → Partner BTC', 'confirmed', 'tx_006', 0.0002),
  (1, 'alloc', 'Internal', 'Bank', 28400.00, 28400.00, NULL, NULL, 'Profit Allocation Run', 'settled', NULL, 0.00),
  (1, 'receive', 'Coinbase', 'Coinbase', 1840.00, 1840.00, NULL, NULL, 'Coinbase Commerce', 'settled', 'tx_007', 0.92)
ON CONFLICT DO NOTHING;