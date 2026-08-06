// API Base URL
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = isLocalhost
  ? 'http://localhost:3000/api'
  : 'https://paycontrol-backend.onrender.com/api'; // Render backend URL

// Sentry for error tracking
const isBrowserProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
if (isBrowserProduction) {
  import('https://browser.sentry-cdn.com/7.0.0/bundle.min.js').then(Sentry => {
    Sentry.init({ dsn: 'YOUR_SENTRY_DSN' });
  });
}

// Get CSRF token from cookies
function getCSRFToken() {
  const name = 'csrfToken=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  for (let i = 0; i < cookieArray.length; i++) {
    const cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }
  return null;
}

// Fetch wrapper with auth and CSRF protection
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Always include credentials (cookies)
  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include'  // Include cookies
  };

  const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

  // Handle 401 (Unauthorized)
  if (response.status === 401) {
    // Token expired or invalid, redirect to login
    sessionStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }

  // Handle 403 (Forbidden - CSRF token issue)
  if (response.status === 403) {
    const error = await response.json();
    if (error.error && error.error.includes('CSRF')) {
      console.error('CSRF token validation failed:', error.error);
      throw new Error('Security validation failed. Please refresh the page.');
    }
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'API request failed');
  }

  return await response.json();
}

// Helper to handle errors
async function safeApiFetch(endpoint, options = {}) {
  try {
    return await apiFetch(endpoint, options);
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error.message);
    toast(error.message, 'error');
    return null;
  }
}