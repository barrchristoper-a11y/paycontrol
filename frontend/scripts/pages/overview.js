async function renderOverview() {
  try {
    // Fetch data in parallel
    const [wallets, banks, gateways, transactions, rules] = await Promise.all([
      safeApiFetch('/crypto/wallets'),
      safeApiFetch('/banks/accounts'),
      safeApiFetch('/gateways'),
      safeApiFetch('/transactions?limit=6'),
      safeApiFetch('/allocation/rules'),
    ]);

    // Calculate totals
    const totalCrypto = wallets?.reduce((sum, w) => sum + (w.balance_usd || 0), 0) || 0;
    const totalBank = banks?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;
    const totalGW = gateways?.filter(g => g.is_enabled).reduce((sum, g) => sum + (g.monthly_volume || 0), 0) || 0;
    const total = totalCrypto + totalBank + totalGW;

    // Update sidebar total
    $('#sb-total').text(`${fmtUSD(total)} total`);

    // KPI cards
    const kpis = [
      { label: 'Total Portfolio', val: fmtUSD(total), sub: 'All sources combined', cls: 'blue' },
      { label: 'Crypto Holdings', val: fmtUSD(totalCrypto), sub: `${wallets?.length || 0} digital assets`, cls: 'cyan' },
      { label: 'Bank Balances', val: fmtUSD(totalBank), sub: `${banks?.length || 0} linked accounts`, cls: 'green' },
      { label: 'Gateway Volume', val: `${fmtUSD(totalGW)}/mo`, sub: `${gateways?.filter(g => g.is_enabled).length || 0} active`, cls: 'purple' },
    ];

    let kpiHtml = '';
    kpis.forEach((k, i) => {
      kpiHtml += `
        <div class="kpi ${k.cls}" style="transition-delay: ${i * 70}ms">
          <div class="kpi-label">${esc(k.label)}</div>
          <div class="kpi-val" style="color:var(--${k.cls})">${esc(k.val)}</div>
          <div class="kpi-sub">${esc(k.sub)}</div>
        </div>
      `;
    });
    $('#kpi-grid').html(kpiHtml);

    // Portfolio bars
    const bars = [
      { label: 'Crypto', val: totalCrypto, color: 'var(--gold)' },
      { label: 'Chase 4821', val: banks?.[0]?.balance || 0, color: 'var(--blue)' },
      { label: 'Mercury', val: banks?.[3]?.balance || 0, color: 'var(--cyan)' },
      { label: 'Bank of America', val: banks?.[1]?.balance || 0, color: 'var(--green)' },
      { label: 'Wise', val: banks?.[2]?.balance || 0, color: 'var(--purple)' },
      { label: 'GW Volume', val: totalGW, color: 'var(--purple)' },
    ];
    const bmax = Math.max(...bars.map(b => b.val), 1);

    let pbHtml = '';
    bars.forEach(b => {
      const pct = Math.round(b.val / bmax * 100);
      pbHtml += `
        <div class="hbar-row">
          <div class="hbar-lbl">${esc(b.label)}</div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:0%;background:${b.color}" data-w="${pct}">
              <span>${fmtUSD(b.val)}</span>
            </div>
          </div>
        </div>
      `;
    });
    $('#portfolio-bars').html(pbHtml);

    // Animate bars
    setTimeout(() => {
      $('#portfolio-bars .hbar-fill').each(function () {
        $(this).css('width', $(this).data('w') + '%');
      });
    }, 100);

    // Alloc donut
    renderDonut('#alloc-donut', rules || [], 52, 12);

    // Alloc legend
    let legHtml = '';
    (rules || []).forEach(r => {
      legHtml += `
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:8px;height:8px;border-radius:2px;background:${r.color}"></div>
            <span style="color:var(--sub)">${esc(r.name)}</span>
          </div>
          <span style="font-family:var(--mono);color:var(--text);font-weight:600">${r.percentage}%</span>
        </div>
      `;
    });
    $('#alloc-legend').html(legHtml);

    // Overview TX table
    let txHtml = `
      <table>
        <thead>
          <tr>
            <th>TX ID</th>
            <th>Time</th>
            <th>Type</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    (transactions || []).slice(0, 6).forEach(tx => {
      const tc = tx.type === 'receive' ? 'var(--green)' : tx.type === 'send' ? 'var(--red)' : 'var(--purple)';
      txHtml += `
        <tr>
          <td class="mono" style="color:var(--blue)">${esc(tx.id || '—')}</td>
          <td class="mono">${tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : '—'}</td>
          <td>${typePill(tx.type)}</td>
          <td>${esc(tx.method || '—')}</td>
          <td class="mono" style="font-weight:700;color:${tc}">${tx.type === 'send' ? '-' : '+'}${fmtUSD(tx.amount_usd)}</td>
          <td><span class="tov">${esc(tx.description || tx.from_address || '—')}</span></td>
          <td>${statusPill(tx.status)}</td>
        </tr>
      `;
    });
    txHtml += '</tbody></table>';
    $('#overview-tx-table').html(txHtml);

  } catch (error) {
    console.error('Failed to render overview:', error);
    toast('Failed to load overview data', 'error');
  }
}

// Donut chart renderer
function renderDonut(selector, rules, r, sw) {
  const circ = 2 * Math.PI * r;
  const cx = r + sw, cy = r + sw;
  const vb = 2 * (r + sw);
  const svg = $(selector);
  svg.attr('viewBox', `0 0 ${vb} ${vb}`).attr('width', vb).attr('height', vb);
  svg.empty();

  // BG ring
  svg.append(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${sw}"/>`);

  let offset = 0;
  (rules || []).forEach(ru => {
    const d = circ * ru.percentage / 100;
    svg.append(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ru.color}" stroke-width="${sw}" stroke-dasharray="${d} ${circ - d}" stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`);
    offset += d;
  });
}