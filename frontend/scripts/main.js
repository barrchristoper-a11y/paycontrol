// Initialize the app
$(document).ready(async function () {
  // Check auth
  if (!checkAuth()) return;

  // Load global data
  try {
    const [wallets, banks, gateways, rules, transactions] = await Promise.all([
      safeApiFetch('/crypto/wallets'),
      safeApiFetch('/banks/accounts'),
      safeApiFetch('/gateways'),
      safeApiFetch('/allocation/rules'),
      safeApiFetch('/transactions?limit=50'),
    ]);

    // Store global data for reference
    window.CRYPTO_DATA = wallets || [];
    window.BANK_DATA = banks || [];
    window.GATEWAY_DATA = gateways || [];
    window.ALLOC_RULES = rules || [];
    window.TX_DATA = transactions || [];

    // Initialize state
    STATE.rules = rules || [];

  } catch (error) {
    console.error('Failed to load global data:', error);
  }

  // Set up topbar date
  const now = new Date();
  $('#tb-date').text(now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }));

  // Initial render
  renderPage(STATE.page);

  // Stagger card entrance
  setTimeout(function () {
    $('.kpi').each(function (i) {
      $(this).css({ opacity: 0, transform: 'translateY(10px)' });
      setTimeout(function () {
        $(this).css({
          transition: 'opacity .4s ease, transform .4s ease',
          opacity: 1,
          transform: 'translateY(0)',
        });
      }.bind(this), i * 70);
    });
  }, 150);

  // Price ticker live update (simulated)
  setInterval(function () {
    const prices = [
      ['$' + Math.round(63000 + Math.random() * 2000).toLocaleString(),
      '$' + Math.round(2900 + Math.random() * 300).toLocaleString(),
        '$1.00']
    ];
    $('.price-item b').each(function (i) {
      if (prices[0][i]) $(this).text(prices[0][i]);
    });
  }, 8000);
});

// Navigation
$(document).on('click', '.sb-btn[data-page]', function () {
  const p = $(this).data('page');
  STATE.page = p;
  $('.sb-btn').removeClass('active');
  $(this).addClass('active');
  $('.page').removeClass('active');
  $(`#page-${p}`).addClass('active');
  $('#tb-title').text($(this).text().trim());
  renderPage(p);
});

// Render page based on state
function renderPage(p) {
  if (p === 'overview') renderOverview();
  if (p === 'crypto') renderCrypto();
  if (p === 'banks') renderBanks();
  if (p === 'gateways') renderGateways();
  if (p === 'allocation') renderAllocation();
  if (p === 'transactions') renderTransactions();
}

// Load Plaid script dynamically
function loadPlaidScript() {
  if (window.Plaid) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
  script.onload = function () {
    window.Plaid.create = function (options) {
      return {
        open: function () {
          console.log('Plaid Link opened with options:', options);
          // In production, this would open the real Plaid Link modal
          toast('Plaid Link opened (simulated)', 'info');
        },
      };
    };
  };
  document.head.appendChild(script);
}

// Call this when needed (e.g., when clicking "Link Bank Account")
loadPlaidScript();