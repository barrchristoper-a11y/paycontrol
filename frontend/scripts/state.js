// Global state
const STATE = {
  page: 'overview',
  selectedCrypto: null,
  txFilter: 'all',
  txSearch: '',
  // Add other state variables as needed
};

// Helper to update state and re-render
function updateState(newState) {
  Object.assign(STATE, newState);
  renderPage(STATE.page);
}