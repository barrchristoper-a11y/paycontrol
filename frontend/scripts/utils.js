// Format USD
function fmtUSD(n) {
  return '$' + parseFloat(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format number with decimals
function fmt(n, d = 4) {
  return parseFloat(n || 0).toFixed(d);
}

// Escape HTML
function esc(s) {
  return $('<div>').text(s || '').html();
}

// Shorten address
function short(s, l = 16) {
  return s.length > l ? s.slice(0, 8) + '…' + s.slice(-6) : s;
}

// Clamp value between min and max
function clamp(v, mn, mx) {
  return Math.min(mx, Math.max(mn, v));
}

// Toast notifications
function toast(msg, type = 'info') {
  const colors = {
    success: '#00E5A0',
    error: '#FF4757',
    warning: '#FFB800',
    info: '#3D8EF0',
  };
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const $t = $(
    `<div class="toast">
      <div class="toast-ic" style="background:${colors[type]}22;color:${colors[type]}">${icons[type]}</div>
      <span>${esc(msg)}</span>
    </div>`
  );

  $('#toast-box').append($t);
  setTimeout(() => $t.addClass('show'), 30);
  setTimeout(() => {
    $t.removeClass('show');
    setTimeout(() => $t.remove(), 400);
  }, 3500);
}

// Pill HTML generator
function pillHtml(text, cls) {
  return `<span class="pill ${cls}"><span class="dot"></span>${esc(text)}</span>`;
}

// Status pill
function statusPill(s) {
  if (s === 'active' || s === 'confirmed' || s === 'settled' || s === 'verified') {
    return pillHtml(s, 'pill-green');
  }
  if (s === 'processing' || s === 'pending') {
    return pillHtml(s, 'pill-amber');
  }
  if (s === 'inactive' || s === 'failed' || s === 'error') {
    return pillHtml(s, 'pill-red');
  }
  return pillHtml(s, 'pill-gray');
}

// Type pill
function typePill(t) {
  if (t === 'receive') return pillHtml('RECEIVE', 'pill-green');
  if (t === 'send') return pillHtml('SEND', 'pill-red');
  if (t === 'swap') return pillHtml('SWAP', 'pill-purple');
  if (t === 'alloc') return pillHtml('ALLOC', 'pill-amber');
  return pillHtml(t.toUpperCase(), 'pill-gray');
}

// Modal functions
function openModal(id, title, sub, bodyHtml) {
  $('#modal-title').text(title);
  $('#modal-sub').text(sub || '');
  $('#modal-body').html(bodyHtml);
  $('#overlay').addClass('open');
}

function closeModal() {
  $('#overlay').removeClass('open');
}

// Close modal on backdrop click
$('#overlay').on('click', function (e) {
  if ($(e.target).is('#overlay')) closeModal();
});

// Make functions globally available
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;