async function renderAllocation() {
  try {
    const rules = await safeApiFetch('/allocation/rules');

    // Calculate total
    const total = (rules || []).reduce((sum, r) => sum + r.percentage, 0);
    const ok = total === 100;

    // Show warning if total !== 100
    if (!ok) {
      $('#alloc-warn').removeClass('hide');
      $('#alloc-warn-text').text(
        `Rules sum to ${total}% — must equal exactly 100% before running. ${total < 100 ? 'Remaining: ' + (100 - total) + '%' : 'Over by ' + (total - 100) + '%'}`
      );
    } else {
      $('#alloc-warn').addClass('hide');
    }

    // Rules list
    let html = '';
    (rules || []).forEach(r => {
      html += `
        <div class="alloc-rule" style="border-left-color:${r.color}">
          <div class="alloc-rule-head">
            <div>
              <div class="alloc-rule-name">${esc(r.name)}</div>
              <div class="alloc-rule-meta">${r.is_locked ? '🔒 Locked' : 'Adjustable'} · ${r.is_auto ? 'Auto-run' : 'Manual only'}</div>
            </div>
            <span class="pill pill-blue" style="background:${r.color}22;color:${r.color};border-color:${r.color}33">${r.percentage}%</span>
            ${!r.is_locked ? `<button class="btn btn-sm btn-danger" data-rid="${r.id}">Remove</button>` : ''}
          </div>
          ${!r.is_locked ? `
            <div class="alloc-slider-row" style="--bar-color:${r.color}">
              <input type="range" min="0" max="50" value="${r.percentage}" style="accent-color:${r.color}" data-rid="${r.id}" class="alloc-range">
              <input type="number" min="0" max="100" value="${r.percentage}" class="alloc-pct-input" data-rid="${r.id}" style="width:58px">
              <span class="pct-hint">%</span>
            </div>
          ` : `
            <div style="height:5px;background:var(--card2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${r.percentage}%;background:${r.color}"></div>
            </div>
          `}
        </div>
      `;
    });
    $('#alloc-rules-list').html(html);

    // Donut + legend
    renderDonut('#alloc-donut2', rules || [], 48, 16);
    $('#alloc-total-pct').text(`${total}%`).css('color', ok ? 'var(--green)' : 'var(--red)');

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
    $('#alloc-legend2').html(legHtml);

    // Last run breakdown
    let lrHtml = '';
    (rules || []).forEach(r => {
      lrHtml += `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
          <span style="color:var(--sub)">${esc(r.name)}</span>
          <span style="font-family:var(--mono);color:${r.color};font-weight:600">${fmtUSD(28400 * r.percentage / 100)}</span>
        </div>
      `;
    });
    $('#last-run-items').html(lrHtml);

  } catch (error) {
    console.error('Failed to render allocation:', error);
    toast('Failed to load allocation data', 'error');
  }
}

// Range slider
$(document).on('input', '.alloc-range', function () {
  const rid = +$(this).data('rid');
  const val = clamp(parseInt($(this).val()) || 0, 0, 100);
  $(this).siblings('.alloc-pct-input').val(val);

  // Update state and re-render
  STATE.rules = (STATE.rules || []).map(r => r.id === rid ? { ...r, percentage: val } : r);
  renderAllocation();
});

// Number input
$(document).on('change', '.alloc-pct-input', function () {
  const rid = +$(this).data('rid');
  const val = clamp(parseInt($(this).val()) || 0, 0, 100);
  $(this).siblings('.alloc-range').val(val);

  STATE.rules = (STATE.rules || []).map(r => r.id === rid ? { ...r, percentage: val } : r);
  renderAllocation();
});

// Remove rule
$(document).on('click', '.alloc-rule .btn-danger', async function () {
  const rid = +$(this).data('rid');
  try {
    await apiFetch(`/allocation/rules/${rid}`, { method: 'DELETE' });
    STATE.rules = (STATE.rules || []).filter(r => r.id !== rid);
    renderAllocation();
    toast('Rule removed', 'info');
  } catch (error) {
    toast('Failed to remove rule', 'error');
  }
});

// Add rule
window.openAddRule = function () {
  const body = `
    <form id="add-rule-form">
      <div class="field">
        <label>Rule Name *</label>
        <div class="f-wrap">
          <input name="rname" id="ar-name" placeholder="e.g. Tax Reserve" required>
        </div>
      </div>
      <div class="field">
        <label>Percentage (%) *</label>
        <div class="f-wrap">
          <div class="f-prefix">%</div>
          <input name="rpct" id="ar-pct" type="number" min="1" max="99" placeholder="0–100" required>
        </div>
      </div>
      <div class="field">
        <label>Execution</label>
        <div class="f-wrap">
          <select id="ar-auto">
            <option value="1">Auto — runs with each allocation</option>
            <option value="0">Manual — triggered manually</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Rule</button>
      </div>
    </form>
  `;
  openModal('add-rule', 'Add Allocation Rule', 'Create a new profit distribution rule', body);

  $('#add-rule-form').on('submit', async function (e) {
    e.preventDefault();
    const name = $('#ar-name').val().trim();
    const percentage = parseInt($('#ar-pct').val());
    const isAuto = $('#ar-auto').val() === '1';

    if (!name || percentage < 1 || percentage > 99) {
      toast('Please fill all fields with valid values', 'error');
      return;
    }

    try {
      const colors = ['#3D8EF0', '#00E5A0', '#00D4FF', '#FFB800', '#A855F7', '#F5C518', '#FF4757'];
      const newRule = {
        id: Date.now(),
        name,
        percentage,
        color: colors[(STATE.rules || []).length % colors.length],
        is_locked: false,
        is_auto: isAuto,
      };

      const response = await apiFetch('/allocation/rules', {
        method: 'POST',
        body: JSON.stringify(newRule),
      });

      STATE.rules = [...(STATE.rules || []), response];
      closeModal();
      renderAllocation();
      toast('Rule added', 'success');
    } catch (error) {
      toast('Failed to add rule', 'error');
    }
  });
};

// Run allocation
window.openRunAllocation = function () {
  const body = `
    <form id="run-alloc-form">
      <div class="field">
        <label>Amount to Allocate *</label>
        <div class="f-wrap">
          <div class="f-prefix">$</div>
          <input name="ramt" id="ra-amt" type="number" min="1" step="0.01" value="50000" required>
        </div>
      </div>
      <div class="field">
        <label>Source</label>
        <div class="f-wrap">
          <select>
            <option>All Sources (Crypto + Bank + Gateways)</option>
            <option>Crypto Holdings Only</option>
            <option>Bank Accounts Only</option>
            <option>Gateway Settlements Only</option>
          </select>
        </div>
      </div>
      <div id="ra-preview"></div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Execute Allocation</button>
      </div>
    </form>
  `;
  openModal('run-alloc', 'Run Profit Allocation', 'Distribute profits per current rules', body);

  function updatePreview() {
    const amt = parseFloat($('#ra-amt').val()) || 0;
    const total = (STATE.rules || []).reduce((sum, r) => sum + r.percentage, 0);

    let html = '';
    if (total !== 100) {
      html += `<div class="warn-box">⚠ Rules sum to ${total}% — results may be unexpected.</div>`;
    }
    html += '<div style="background:var(--card2);border:1px solid var(--b1);border-radius:var(--r2);padding:11px 14px;margin-bottom:14px">';
    (STATE.rules || []).forEach(r => {
      html += `
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px">
          <span style="color:var(--sub)">${esc(r.name)}</span>
          <span style="font-family:var(--mono);color:${r.color};font-weight:700">${fmtUSD(amt * r.percentage / 100)}</span>
        </div>
      `;
    });
    html += '</div>';
    $('#ra-preview').html(html);
  }

  $('#ra-amt').on('input', updatePreview);
  updatePreview();

  $('#run-alloc-form').on('submit', async function (e) {
    e.preventDefault();
    const amt = parseFloat($('#ra-amt').val()) || 0;

    try {
      const response = await apiFetch('/allocation/run', {
        method: 'POST',
        body: JSON.stringify({ amount: amt }),
      });

      closeModal();

      // Show result modal
      let resHtml = `
        <div style="text-align:center;padding:8px 0 20px">
          <div style="font-size:40px;margin-bottom:8px">✓</div>
          <div style="font-family:var(--mono);font-size:30px;font-weight:700;color:var(--green)">${fmtUSD(amt)}</div>
          <div style="font-size:13px;color:var(--dim);margin-top:4px">Successfully distributed</div>
        </div>
      `;
      (response.allocations || []).forEach(a => {
        resHtml += `
          <div class="run-result-item">
            <div>
              <div class="run-result-name">${esc(a.ruleName)}</div>
              <div class="run-result-pct">${a.percentage}%</div>
            </div>
            <div class="run-result-val" style="color:${a.color}">${fmtUSD(a.amount)}</div>
          </div>
        `;
      });
      resHtml += `
        <div class="form-actions">
          <button class="btn btn-success" style="width:100%;justify-content:center" onclick="closeModal()">Done</button>
        </div>
      `;
      openModal('alloc-result', 'Allocation Complete', '', resHtml);
      toast(`Profit allocation executed — ${fmtUSD(amt)} distributed`, 'success');
    } catch (error) {
      toast('Failed to run allocation', 'error');
    }
  });
};