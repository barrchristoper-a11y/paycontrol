async function renderTransactions() {
  try {
    // Filter chips
    const filters = ['all', 'receive', 'send', 'swap', 'alloc'];
    let chipHtml = '';
    filters.forEach(f => {
      chipHtml += `
        <button class="btn btn-sm ${STATE.txFilter === f ? 'btn-primary' : ''}" data-txf="${f}">
          ${f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      `;
    });
    $('#tx-filters').html(chipHtml);

    // Fetch transactions
    const transactions = await safeApiFetch(
      `/transactions?type=${STATE.txFilter !== 'all' ? STATE.txFilter : ''}&limit=50`
    );

    // Filter by search
    const filtered = (transactions || []).filter(tx => {
      const matchesFilter = STATE.txFilter === 'all' || tx.type === STATE.txFilter;
      const matchesSearch = !STATE.txSearch ||
        tx.from_address?.toLowerCase().includes(STATE.txSearch.toLowerCase()) ||
        tx.description?.toLowerCase().includes(STATE.txSearch.toLowerCase()) ||
        tx.id?.toLowerCase().includes(STATE.txSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    // Render table
    let html = `
      <table>
        <thead>
          <tr>
            <th>TX ID</th>
            <th>Date / Time</th>
            <th>Type</th>
            <th>Gateway</th>
            <th>Amount</th>
            <th>Description</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (filtered.length === 0) {
      html += `
        <tr>
          <td colspan="7" style="text-align:center;padding:32px;color:var(--dim)">No transactions match your filters</td>
        </tr>
      `;
    } else {
      filtered.forEach(tx => {
        const tc = tx.type === 'receive' ? 'var(--green)' : tx.type === 'send' ? 'var(--red)' : 'var(--purple)';
        html += `
          <tr>
            <td class="mono" style="color:var(--blue)">${esc(tx.id || '—')}</td>
            <td class="mono">${tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</td>
            <td>${typePill(tx.type)}</td>
            <td>${esc(tx.gateway || '—')}</td>
            <td class="mono" style="font-weight:700;color:${tc}">${tx.type === 'send' ? '-' : '+'}${fmtUSD(tx.amount_usd)}</td>
            <td><span class="tov">${esc(tx.description || tx.from_address || '—')}</span></td>
            <td>${statusPill(tx.status)}</td>
          </tr>
        `;
      });
    }
    html += '</tbody></table>';
    $('#tx-table').html(html);

  } catch (error) {
    console.error('Failed to render transactions:', error);
    toast('Failed to load transactions', 'error');
  }
}

// Filter click handler
$(document).on('click', '[data-txf]', function () {
  STATE.txFilter = $(this).data('txf');
  renderTransactions();
});

// Search input handler
$(document).on('input', '#tx-search', function () {
  STATE.txSearch = $(this).val();
  renderTransactions();
});