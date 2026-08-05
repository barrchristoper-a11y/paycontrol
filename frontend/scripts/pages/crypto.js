async function renderCrypto() {
  try {
    const [wallets, prices] = await Promise.all([
      safeApiFetch('/crypto/wallets'),
      safeApiFetch('/crypto/prices'),
    ]);

    // Calculate total
    const total = (wallets || []).reduce((sum, w) => sum + (w.balance_usd || 0), 0);
    $('#crypto-total').text(fmtUSD(total));

    // Render crypto cards
    let html = '';
    (wallets || []).forEach(c => {
      const isSel = STATE.selectedCrypto === c.id;
      const chg = c.change > 0 ? '+' : c.change < 0 ? '' : ' ';
      const chgColor = c.change > 0 ? 'var(--green)' : c.change < 0 ? 'var(--red)' : 'var(--dim)';
      const symbolColors = {
        BTC: 'var(--btc)',
        ETH: 'var(--eth)',
        USDT: 'var(--usdt)',
        BNB: 'var(--bnb)',
        SOL: 'var(--sol)',
        MATIC: 'var(--matic)',
      };
      const color = symbolColors[c.symbol] || c.color || 'var(--blue)';

      html += `
        <div class="crypto-card ${isSel ? 'selected' : ''}" data-cid="${c.id}"
             style="border-left:3px solid ${color}; ${isSel ? `border-color:${color};box-shadow:0 0 0 1px ${color}44,0 4px 20px ${color}18;background:linear-gradient(135deg,var(--card),${color}10 300%)` : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:50%;background:${color}22;border:2px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:${color}">${esc(c.symbol)}</div>
              <div>
                <div style="font-weight:700;font-size:14px">${esc(c.name)}</div>
                <div style="font-size:11px;color:var(--dim);font-family:var(--mono)">${esc(c.network)}</div>
              </div>
            </div>
            <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${chgColor}">${chg}${c.change || 0}%</span>
          </div>
          <div style="font-family:var(--mono);font-size:22px;font-weight:700;color:${color};margin-bottom:4px">${fmt(c.balance, 4)} ${esc(c.symbol)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--sub)">${fmtUSD(c.balance_usd)}</span>
            <span style="font-size:10px;color:var(--dim);font-family:var(--mono)">${short(c.address)}</span>
          </div>
        </div>
      `;
    });
    $('#crypto-cards').html(html);

    // Render selected crypto detail
    if (STATE.selectedCrypto) {
      const selected = (wallets || []).find(c => c.id === STATE.selectedCrypto);
      if (selected) {
        renderCryptoDetail(selected, prices);
        $('#crypto-detail').show();
      } else {
        $('#crypto-detail').hide();
      }
    } else {
      $('#crypto-detail').hide();
    }

  } catch (error) {
    console.error('Failed to render crypto:', error);
    toast('Failed to load crypto data', 'error');
  }
}

// Crypto card click handler
$(document).on('click', '.crypto-card', function () {
  const cid = $(this).data('cid');
  STATE.selectedCrypto = STATE.selectedCrypto === cid ? null : cid;
  renderCrypto();
});

// Render crypto detail
function renderCryptoDetail(c, prices) {
  $('#crypto-detail-title').text(`${c.name} Wallet Detail`);

  const priceData = prices?.[c.symbol.toLowerCase()]?.usd || 0;
  const usdValue = c.balance * priceData;

  let html = `
    <div class="addr-box" style="margin-bottom:14px">${esc(c.address)}</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="lbl">Balance</div>
        <div class="val">${fmt(c.balance, 6)} ${esc(c.symbol)}</div>
      </div>
      <div class="info-cell">
        <div class="lbl">USD Value</div>
        <div class="val">${fmtUSD(usdValue)}</div>
      </div>
      <div class="info-cell">
        <div class="lbl">24h Change</div>
        <div class="val" style="color:${c.change > 0 ? 'var(--green)' : c.change < 0 ? 'var(--red)' : 'var(--dim)'}">
          ${c.change > 0 ? '+' : ''}${c.change || 0}%
        </div>
      </div>
      <div class="info-cell">
        <div class="lbl">Network</div>
        <div class="val">${esc(c.network)}</div>
      </div>
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn btn-primary" onclick="openCryptoAction('send', ${c.id})">↑ Send ${esc(c.symbol)}</button>
      <button class="btn btn-success" onclick="openCryptoAction('receive', ${c.id})">↓ Receive ${esc(c.symbol)}</button>
      <button class="btn" onclick="openCryptoAction('swap', ${c.id})">⇄ Swap ${esc(c.symbol)}</button>
    </div>
  `;
  $('#crypto-detail-body').html(html);
}

// Get selected crypto
function getSelectedCrypto() {
  if (!STATE.selectedCrypto) return null;
  return (window.CRYPTO_DATA || []).find(c => c.id === STATE.selectedCrypto);
}

// Crypto actions
window.openCryptoAction = function (action, cid) {
  const c = (window.CRYPTO_DATA || []).find(w => w.id === cid);
  if (!c) return;

  if (action === 'send') {
    openModal('send-crypto', `Send ${c.symbol}`, `Broadcast transaction to the ${c.network} network`, buildSendForm(c));
  }
  if (action === 'receive') {
    openModal('recv-crypto', `Receive ${c.symbol}`, `Share this address to receive ${c.symbol}`, buildReceiveHtml(c));
  }
  if (action === 'swap') {
    openModal('swap-crypto', 'Swap Crypto', 'Cross-asset exchange via integrated DEX', buildSwapForm(c));
  }
};

// Add wallet button
window.openAddWallet = function () {
  openModal('add-wallet', 'Connect Wallet', 'Add a new crypto wallet or address', buildAddWalletHtml());
};

// Build send form
function buildSendForm(c) {
  return `
    <form id="send-form">
      <div class="field">
        <label>Recipient Address *</label>
        <div class="f-wrap mono">
          <input name="addr" id="sf-addr" placeholder="${c.network === 'Bitcoin' ? 'bc1... or 1...' : c.network === 'Solana' ? 'Solana address' : '0x...'}" autocomplete="off" required>
        </div>
      </div>
      <div class="field">
        <label>Amount (${esc(c.symbol)}) *</label>
        <div class="f-wrap">
          <div class="f-prefix">${esc(c.symbol)}</div>
          <input name="amt" id="sf-amt" type="number" step="any" min="0.000001" placeholder="0.0000" required>
        </div>
      </div>
      <div class="field">
        <label>Memo / Note</label>
        <div class="f-wrap">
          <input name="memo" placeholder="Optional transaction note">
        </div>
      </div>
      <div style="background:var(--card2);border:1px solid var(--b1);border-radius:var(--r2);padding:11px 14px;margin-bottom:14px;font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="color:var(--sub)">Network Fee (est.)</span>
          <span style="font-family:var(--mono);color:var(--amber)">~$2.40</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--sub)">Available Balance</span>
          <span style="font-family:var(--mono);color:var(--text)">${fmt(c.balance, 6)} ${esc(c.symbol)}</span>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Confirm & Send</button>
      </div>
    </form>
  `;
}

// Build receive HTML
function buildReceiveHtml(c) {
  return `
    <div style="text-align:center;padding:8px 0 18px">
      <div style="width:130px;height:130px;margin:0 auto 16px;background:var(--card2);border-radius:10px;border:1px solid var(--b1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px">
        <div style="font-size:11px;color:var(--dim)">QR Code</div>
        <div style="font-size:36px;color:${c.color || 'var(--blue)'}">${esc(c.symbol)}</div>
        <div style="font-size:10px;color:var(--dim);font-family:var(--mono)">${esc(c.network)}</div>
      </div>
      <div class="addr-box" style="margin-bottom:14px;text-align:left">${esc(c.address)}</div>
      <button class="btn btn-dark" onclick="navigator.clipboard.writeText('${c.address}').then(() => toast('Address copied!', 'success'))">
        ⊕ Copy Address
      </button>
    </div>
  `;
}

// Build swap form
function buildSwapForm(c) {
  const cryptoData = window.CRYPTO_DATA || [];
  const opts = cryptoData.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)} (${esc(x.symbol)})</option>`).join('');
  const opts2 = cryptoData.filter(x => x.id !== c.id).map(x => `<option value="${x.id}">${esc(x.name)} (${esc(x.symbol)})</option>`).join('');

  return `
    <form id="swap-form">
      <div class="field">
        <label>From</label>
        <div class="f-wrap">
          <select id="sw-from">${opts}</select>
        </div>
      </div>
      <div class="field">
        <label>To</label>
        <div class="f-wrap">
          <select id="sw-to">${opts2}</select>
        </div>
      </div>
      <div class="field">
        <label>Amount to Swap *</label>
        <div class="f-wrap">
          <input name="swamt" id="sw-amt" type="number" step="any" min="0.0001" placeholder="0.0000" required>
        </div>
      </div>
      <div style="background:var(--card2);border:1px solid var(--b1);border-radius:var(--r2);padding:11px;margin-bottom:14px;font-size:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--sub)">DEX Fee</span>
          <span style="font-family:var(--mono);color:var(--amber)">0.3%</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--sub)">Slippage Tolerance</span>
          <span style="font-family:var(--mono);color:var(--text)">0.5%</span>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Execute Swap</button>
      </div>
    </form>
  `;
}

// Build add wallet HTML
function buildAddWalletHtml() {
  const wallets = [
    { n: 'MetaMask', i: '🦊', d: 'Browser extension' },
    { n: 'WalletConnect', i: '🔗', d: 'Mobile scan' },
    { n: 'Coinbase Wallet', i: '🔵', d: 'Coinbase app' },
    { n: 'Trust Wallet', i: '🛡', d: 'Multi-chain' },
    { n: 'Ledger Hardware', i: '🔒', d: 'Cold storage' },
    { n: 'Manual Address', i: '✏', d: 'Enter manually' },
  ];

  let html = '<div class="wallet-connect-grid">';
  wallets.forEach(w => {
    html += `
      <button class="wc-btn" onclick="toast('${esc(w.n)} connection initiated', 'info'); closeModal();">
        <div class="icon">${esc(w.i)}</div>
        <div>
          <div class="name">${esc(w.n)}</div>
          <div class="desc">${esc(w.d)}</div>
        </div>
      </button>
    `;
  });
  html += `
    </div>
    <div class="field">
      <label>Or Enter Address</label>
      <div class="f-wrap mono">
        <input id="manual-address" placeholder="0x… / bc1… / bnb1…">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="toast('Wallet added', 'success'); closeModal();">Add Wallet</button>
    </div>
  `;
  return html;
}

// Form submissions
$(document).on('submit', '#send-form', function (e) {
  e.preventDefault();
  const c = getSelectedCrypto();
  if (!c) return;
  closeModal();
  toast(`Send ${$('#sf-amt').val()} ${c.symbol} initiated`, 'info');
});

$(document).on('submit', '#swap-form', function (e) {
  e.preventDefault();
  closeModal();
  toast('Swap executed — processing on DEX', 'success');
});

$(document).on('click', '.wc-btn', function () {
  // Handle wallet connection
  const walletName = $(this).find('.name').text();
  if (walletName === 'Manual Address') {
    const address = $('#manual-address').val();
    if (!address) {
      toast('Please enter a wallet address', 'error');
      return;
    }
    // Add manual wallet logic here
  } else {
    // Handle other wallet connections (e.g., MetaMask, WalletConnect)
    toast(`${walletName} connection initiated`, 'info');
  }
});