-- Demo seed data for PayControl
-- Run with psql or paste into Neon SQL editor

-- 1) Insert administrator
INSERT INTO users (email, password_hash, first_name, last_name, role, status)
VALUES (
  'admin@paycontrol.com',
  '$2a$10$uE5CbMjvTojr91DTvbFdcOTrKoMGclJvt7EoNOsLp/.AsJuWc3vH6',
  'System',
  'Administrator',
  'admin',
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- Helper: ensure we use the admin user's id for subsequent inserts
-- Use SELECT in each INSERT to avoid depending on fixed serial values

-- 2) Crypto wallets (2)
INSERT INTO crypto_wallets (user_id, name, address, symbol, network, balance, balance_usd, is_verified)
SELECT id, 'Primary BTC Wallet', 'bc1qexampleprimary000000000000000000000', 'BTC', 'bitcoin', 0.52345678, 26000.00, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT (address) DO NOTHING;

INSERT INTO crypto_wallets (user_id, name, address, symbol, network, balance, balance_usd, is_verified)
SELECT id, 'Secondary ETH Wallet', '0xExampleSecondary000000000000000000000000', 'ETH', 'ethereum', 2.34567890, 7200.00, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT (address) DO NOTHING;

-- 3) Bank accounts (2)
INSERT INTO bank_accounts (user_id, name, bank_name, account_type, last4, routing_number, balance, currency, status)
SELECT id, 'Main Checking', 'First Demo Bank', 'checking', '1234', '111000025', 15000.00, 'USD', 'verified' FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO bank_accounts (user_id, name, bank_name, account_type, last4, routing_number, balance, currency, status)
SELECT id, 'Savings', 'First Demo Bank', 'savings', '5678', '111000025', 50000.00, 'USD', 'verified' FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

-- 4) Payment gateways (3)
INSERT INTO payment_gateways (user_id, name, api_key, webhook_secret, fee, fixed_fee, is_enabled, monthly_volume, transaction_count)
SELECT id, 'Stripe', 'sk_test_example', 'whsec_example', 2.9, 0.30, true, 0, 0 FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO payment_gateways (user_id, name, api_key, webhook_secret, fee, fixed_fee, is_enabled, monthly_volume, transaction_count)
SELECT id, 'Flutterwave', 'fw_test_example', 'fw_wh_example', 2.5, 0.25, true, 0, 0 FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO payment_gateways (user_id, name, api_key, webhook_secret, fee, fixed_fee, is_enabled, monthly_volume, transaction_count)
SELECT id, 'PayPal', 'pp_test_example', 'pp_wh_example', 3.5, 0.30, true, 0, 0 FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

-- 5) Allocation rules (5) - total 100%
INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
SELECT id, 'Operations', 40.00, '#3D8EF0', true, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
SELECT id, 'Reserve', 20.00, '#F39C12', true, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
SELECT id, 'Investment', 20.00, '#2ECC71', true, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
SELECT id, 'Taxes', 10.00, '#E74C3C', true, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto)
SELECT id, 'Profit', 10.00, '#9B59B6', true, true FROM users WHERE email='admin@paycontrol.com' LIMIT 1
ON CONFLICT DO NOTHING;

-- 6) Transactions (20) - mix of receive/send/alloc/fee with amounts
-- We'll insert transactions tied to the admin user by selecting their id
INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
SELECT id, 'receive', 'Stripe', 'card', 100.00, 100.00, NULL, 'acct_1_example', 'Initial funding via Stripe', 'settled', 'tx_receive_001', 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
SELECT id, 'receive', 'PayPal', 'paypal', 250.00, 250.00, NULL, 'acct_pp_example', 'Customer payment via PayPal', 'settled', 'tx_receive_002', 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
SELECT id, 'send', 'Bank', 'ACH', -50.00, -50.00, 'acct_bank_1', NULL, 'Payout to vendor', 'confirmed', 'tx_send_001', 0.25 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

-- add multiple small transactions to reach 20 total entries
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM transactions) < 20 THEN
    INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
    SELECT id, 'receive', 'Stripe', 'card', 75.50, 75.50, NULL, 'acct_1_example', 'Subscription payment', 'settled', 'tx_receive_003', 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

    INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
    SELECT id, 'send', 'Stripe', 'card', -20.00, -20.00, 'acct_1_example', NULL, 'Refund', 'settled', 'tx_send_002', 0.30 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

    INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
    SELECT id, 'receive', 'Flutterwave', 'card', 120.00, 120.00, NULL, 'fw_acct_1', 'Payment via Flutterwave', 'settled', 'tx_receive_004', 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

    INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee)
    SELECT id, 'send', 'Bank', 'wire', -500.00, -500.00, 'acct_bank_2', NULL, 'Vendor settlement', 'confirmed', 'tx_send_003', 1.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;

    -- 5 allocation transactions
    FOR i IN 1..5 LOOP
      INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, description, status, tx_hash, fee)
      SELECT id, 'alloc', 'Internal', 'alloc', 10.00 * i, 10.00 * i, 'Auto allocation ' || i, 'settled', 'tx_alloc_' || i, 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;
    END LOOP;

    -- fill remaining with small receives
    FOR j IN 1..8 LOOP
      INSERT INTO transactions (user_id, type, gateway, method, amount, amount_usd, description, status, tx_hash, fee)
      SELECT id, 'receive', 'Stripe', 'card', 5.00 * j, 5.00 * j, 'Micro payment ' || j, 'settled', 'tx_micro_' || j, 0.00 FROM users WHERE email='admin@paycontrol.com' LIMIT 1;
    END LOOP;
  END IF;
END$$;

-- End of seed
