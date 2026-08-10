// Login
async function login(email, password) {
  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      credentials: 'include',  // Include cookies
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.user) {
      // Store only user info (NOT tokens - those are in httpOnly cookies)
      sessionStorage.setItem('user', JSON.stringify(response.user));

      // Update sidebar user info
      updateSidebarUser();

      // Redirect to overview
      window.location.href = '/';
      return response.user;
    }
    throw new Error('Login failed: Invalid response');
  } catch (error) {
    throw new Error(error.message);
  }
}

// Logout
async function logout() {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear session storage
    sessionStorage.removeItem('user');
    // Redirect to login (cookies are automatically cleared by server)
    window.location.href = '/login.html';
  }
}

// Check authentication on page load
// The server validates tokens from cookies, so we just check if we can access protected endpoints
async function checkAuth() {
  try {
    // Try to fetch user info from protected endpoint
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include'  // Include cookies
    });

    if (response.status === 401) {
      // Token expired or invalid
      if (window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
      }
      return false;
    }

    if (response.ok) {
      const user = await response.json();
      sessionStorage.setItem('user', JSON.stringify(user));
      return true;
    }

    return false;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

// Get current user from session storage
function getCurrentUser() {
  const user = sessionStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Update sidebar user info
function updateSidebarUser() {
  const user = getCurrentUser();
  if (!user) return;

  $('.sb-uname').text(`${user.first_name} ${user.last_name}`);
  $('.sb-urole').text(user.role === 'admin' ? 'Admin · Full Access' : 'User');
  $('.sb-av').text(user.first_name[0] + user.last_name[0]);
}

// Initialize auth on page load
$(document).ready(function () {
  checkAuth();
  updateSidebarUser();

  if ($('#logoutButton').length) {
    $('#logoutButton').on('click', async function () {
      await logout();
    });
  }

  if ($('#loginForm').length) {
    $('#loginForm').on('submit', async function (e) {
      e.preventDefault();
      const email = $('#email').val().trim();
      const password = $('#password').val().trim();
      try {
        await login(email, password);
      } catch (error) {
        if (typeof toast === 'function') {
          toast(error.message, 'error');
        } else {
          alert(error.message);
        }
      }
    });
  }
});