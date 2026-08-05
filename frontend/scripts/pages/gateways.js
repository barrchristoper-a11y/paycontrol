async function renderGateways() {
  try {
    const gateways = await safeApiFetch('/gateways');

    // Calculate total
    const total = (gateways || []).filter(g => g.is_enabled).reduce((sum, g) => sum + (g.monthly_volume || 0), 0);
    $('#gw-total').html(`${fmtUSD(total)}<span style="font-size:13px;color:var(--dim)">/mo</span>`);

    // Render gateway cards
    let html = '';
    (gateways || []).forEach(gw => {
      const opac = gw.is_enabled ? '1' : '0.55';
      const symbolColors = {
        Stripe: '#635BFF',
        PayPal: '#009CDE',
        Wise: '#9FE870',
        CashApp: '#00D64F',
        Coinbase: '#3B82F6',
        Revolut: '#E50914',
      };
      const color = symbolColors[gw.name] || gw.color || '#3D8EF0';

      html += `
        <div class="gw-card" style="opacity:${opac}">
          <div class="gw-card-head">
            <div class="gw-icon" style="background:${color}18;border:1px solid ${color}33;color:${color}">${esc(gw.name.charAt(0))}</div>
            <div style="flex:1">
              <div class="gw-name">${esc(gw.name)}</div>
              <div class="gw-fee">Fee: ${esc(gw.fee)}%${gw.fixed_fee ? ' + $' + fmtUSD(gw.fixed_fee) : ''}</div>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" ${gw.is_enabled ? 'checked' : ''} data-gwid="${gw.id}">
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div class="gw-stats">
            <div class="gw-stat-box">
              <div class="gw-stat-label">Monthly Volume</div>
              <div class="gw-stat-val" style="color:${color}">${fmtUSD(gw.monthly_volume)}</div>
            </div>
            <div class="gw-stat-box">
              <div class="gw-stat-label">Transactions</div>
              <div class="gw-stat-val">${(gw.transaction_count || 0).toLocaleString()}</div>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-sm" onclick="openGwConfig('${gw.id}')">Configure</button>
            <button class="btn btn-sm btn-dark" onclick="toast('${esc(gw.name)} webhook test sent', 'success')">Test</button>
          </div>
        </div>
      `;
    });
    $('#gw-cards').html(html);

    // Volume chart
    const active = (gateways || []).filter(g => g.monthly_volume > 0);
    const vmax = Math.max(...active.map(g => g.monthly_volume), 1);

    let vcHtml = '';
    active.forEach(gw => {
      const pct = Math.round(gw.monthly_volume / vmax * 100);
      const color = symbolColors[gw.name] || gw.color || '#3D8EF0';
      vcHtml += `
        <div class="hbar-row">
          <div class="hbar-lbl">${esc(gw.name)}</div>
          <div class="hbar-track">
            <div class="hbar-fill" data-w="${pct}" style="width:0%;background:${color}">
              <span>${fmtUSD(gw.monthly_volume)}</span>
            </div>
          </div>
        </div>
      `;
    });
    $('#gw-vol-chart').html(vcHtml);

    // Animate bars
    setTimeout(() => {
      $('#gw-vol-chart .hbar-fill').each(function () {
        $(this).css('width', $(this).data('w') + '%');
      });
    }, 100);

  } catch (error) {
    console.error('Failed to render gateways:', error);
    toast('Failed to load gateway data', 'error');
  }
}

// Toggle gateway
$(document).on('change', 'input[data-gwid]', async function () {
  const id = $(this).data('gwid');
  const isEnabled = $(this).is(':checked');

  try {
    await apiFetch(`/gateways/${id}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled }),
    });
    toast(`${$(this).closest('.gw-card').find('.gw-name').text()} ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
    renderGateways();
  } catch (error) {
    toast('Failed to update gateway', 'error');
    $(this).prop('checked', !isEnabled); // Revert checkbox
  }
});

// Open gateway config
window.openGwConfig = function (id) {
  const gw = (window.GATEWAY_DATA || []).find(g => g.id === id);
  if (!gw) return;

  const body = `
    <div class="field">
      <label>API Key</label>
      <div class="f-wrap mono">
        <input value="${esc(id)}_live_sk_••••••••••••••••" type="password" readonly>
      </div>
    </div>
    <div class="field">
      <label>Webhook Secret</label>
      <div class="f-wrap mono">
        <input value="whsec_••••••••••••••••" type="password" readonly>
      </div>
    </div>
    <div class="field">
      <label>Webhook Endpoint</label>
      <div class="f-wrap">
        <input value="https://api.atrpay.io/api/gateways/stripe/webhook" readonly>
      </div>
    </div>
    <div class="field">
      <label>Settlement Currency</label>
      <div class="f-wrap">
        <select>
          <option>USD</option>
          <option>EUR</option>
          <option>GBP</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="toast('${esc(gw.name)} config saved', 'success'); closeModal();">Save Config</button>
    </div>
  `;
  openModal('gw-config', `Configure ${gw.name}`, 'API keys, webhooks & settings', body);
};

// Add gateway
window.openAddGateway = function () {
  const gws = ['Braintree', 'Square', 'Adyen', 'Checkout.com', 'Klarna', 'Afterpay', 'Crypto.com Pay', 'Binance Pay', 'Stripe (2nd account)', 'Worldpay'];

  let html = '<div class="wallet-connect-grid">';
  gws.forEach(g => {
    html += `
      <button class="wc-btn" onclick="toast('${esc(g)} integration started', 'info'); closeModal();">
        <div class="name">${esc(g)}</div>
      </button>
    `;
  });
  html += '</div>';
  openModal('add-gw', 'Add Payment Gateway', 'Connect a new payment processor', html);
};