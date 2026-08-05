async function renderBanks() {
  try {
    const [banks, transactions] = await Promise.all([
      safeApiFetch('/banks/accounts'),
      safeApiFetch('/transactions?gateway=Stripe,Wise,Internal'),
    ]);

    // Calculate total
    const total = (banks || []).reduce((sum, b) => sum + (b.balance || 0), 0);
    $('#bank-total').text(fmtUSD(total));

    // Render bank cards
    let html = '';
    (banks || []).forEach(b => {
      html += `
        <div class="bank-card card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:13px">
            <div style="display:flex;gap:10px;align-items:center">
              <div style="width:40px;height:40px;border-radius:8px;background:rgba(61,142,240,.12);display:flex;align-items:center;justify-content:center;font-size:20px">🏦</div>
              <div>
                <div style="font-weight:700;font-size:14px">${esc(b.name)}</div>
                <div style="font-size:12px;color:var(--dim)">${esc(b.bank_name)}</div>
              </div>
            </div>
            ${statusPill(b.status)}
          </div>
          <div style="font-family:var(--mono);font-size:25px;font-weight:700;color:var(--green);margin-bottom:10px">${fmtUSD(b.balance)}</div>
          <div class="divider"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
            <div class="info-row">
              <span class="key">Account</span>
              <span class="val">••••${esc(b.last4)}</span>
            </div>
            <div class="info-row">
              <span class="key">Type</span>
              <span class="val" style="text-transform:capitalize">${esc(b.account_type)}</span>
            </div>
            ${b.routing_number !== 'N/A' ? `
              <div class="info-row">
                <span class="key">Routing</span>
                <span class="val">${esc(b.routing_number)}</span>
              </div>
            ` : ''}
            <div class="info-row">
              <span class="key">Currency</span>
              <span class="val">${esc(b.currency)}</span>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-sm btn-dark" onclick="toast('Statement for ${esc(b.name)} generating…', 'info')">Statement</button>
            <button class="btn btn-sm btn-primary" onclick="openModal('transfer', 'Internal Transfer', 'Move funds between accounts', buildTransferForm())">Transfer</button>
          </div>
        </div>
      `;
    });
    $('#bank-cards').html(html);

    // Render bank transactions table
    let txHtml = `
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Date</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    (transactions || []).forEach(tx => {
      const tc = tx.type === 'receive' ? 'var(--green)' : 'var(--red)';
      txHtml += `
        <tr>
          <td><span class="tov">${esc(tx.from_address || tx.description || '—')}</span></td>
          <td class="mono">${tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</td>
          <td>${esc(tx.method || '—')}</td>
          <td class="mono" style="font-weight:700;color:${tc}">${tx.type === 'send' ? '-' : '+'}${fmtUSD(tx.amount_usd)}</td>
          <td>${statusPill(tx.status)}</td>
        </tr>
      `;
    });
    txHtml += '</tbody></table>';
    $('#bank-tx-table').html(txHtml);

  } catch (error) {
    console.error('Failed to render banks:', error);
    toast('Failed to load bank data', 'error');
  }
}

// Build transfer form
window.buildTransferForm = function () {
  const banks = window.BANK_DATA || [];
  const opts = banks.map(b => `<option value="${b.id}">${esc(b.name)} (${fmtUSD(b.balance)})</option>`).join('');

  return `
    <form id="transfer-form">
      <div class="field">
        <label>From Account *</label>
        <div class="f-wrap">
          <select id="tf-from">${opts}</select>
        </div>
      </div>
      <div class="field">
        <label>To Account *</label>
        <div class="f-wrap">
          <select id="tf-to">${opts}</select>
        </div>
      </div>
      <div class="field">
        <label>Amount (USD) *</label>
        <div class="f-wrap">
          <div class="f-prefix">$</div>
          <input name="tfamt" id="tf-amt" type="number" step="0.01" min="1" placeholder="0.00" required>
        </div>
      </div>
      <div class="field">
        <label>Reference / Memo</label>
        <div class="f-wrap">
          <input placeholder="Optional transfer note">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Confirm Transfer</button>
      </div>
    </form>
  `;
};

// Build link bank form
window.buildLinkBankForm = function () {
  const methods = [
    { n: 'Plaid Link', i: '🔗', d: 'Instant · Most banks' },
    { n: 'Manual Entry', i: '✏', d: 'Enter details manually' },
    { n: 'Micro-deposit', i: '💰', d: '2–3 business days' },
    { n: 'Open Banking', i: '🏛', d: 'EU/UK banks (PSD2)' },
  ];

  let html = '<div class="wallet-connect-grid">';
  methods.forEach(m => {
    html += `
      <button class="wc-btn" onclick="openPlaidLink()">
        <div class="icon">${esc(m.i)}</div>
        <div>
          <div class="name">${esc(m.n)}</div>
          <div class="desc">${esc(m.d)}</div>
        </div>
      </button>
    `;
  });
  html += `
    </div>
    <form id="link-bank-form">
      <div class="form-row">
        <div class="field">
          <label>Account Nickname *</label>
          <div class="f-wrap">
            <input name="nick" id="lb-nick" placeholder="e.g. Chase Business" required>
          </div>
        </div>
        <div class="field">
          <label>Account Type</label>
          <div class="f-wrap">
            <select id="lb-type">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Routing Number *</label>
          <div class="f-wrap mono">
            <input name="routing" id="lb-routing" placeholder="9 digits" maxlength="9" required>
          </div>
        </div>
        <div class="field">
          <label>Account Number *</label>
          <div class="f-wrap mono">
            <input name="acct" id="lb-acct" placeholder="Account number" type="password" required>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-success">Link Account</button>
      </div>
    </form>
  `;
  return html;
};

// Open Plaid Link
async function openPlaidLink() {
  try {
    const { link_token } = await apiFetch('/banks/link-token');
    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (publicToken, metadata) => {
        await apiFetch('/banks/exchange-token', {
          method: 'POST',
          body: JSON.stringify({ publicToken, metadata }),
        });
        toast('Bank account connected!', 'success');
        renderBanks();
        closeModal();
      },
      onExit: (err, metadata) => {
        if (err) toast(err.display_message || 'Error connecting bank', 'error');
      },
    });
    handler.open();
  } catch (error) {
    toast('Failed to initialize Plaid Link', 'error');
  }
}

// Form submissions
$(document).on('submit', '#link-bank-form', function (e) {
  e.preventDefault();
  closeModal();
  toast('Bank account linked — pending micro-deposit verification', 'success');
});

$(document).on('submit', '#transfer-form', function (e) {
  e.preventDefault();
  const amt = parseFloat($('#tf-amt').val()) || 0;
  closeModal();
  toast(`Transfer of ${fmtUSD(amt)} initiated`, 'success');
});