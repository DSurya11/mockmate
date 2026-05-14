const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return fetch(`${this.baseUrl}${endpoint}`, { ...options, headers, credentials: 'include' });
        }
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    return response;
  }

  async refreshToken() {
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async get(endpoint) {
    const res = await this.request(endpoint);
    return res.json();
  }

  async post(endpoint, body) {
    const isFormData = body instanceof FormData;
    const res = await this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
    return res.json();
  }

  async patch(endpoint, body) {
    const res = await this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async del(endpoint) {
    const res = await this.request(endpoint, { method: 'DELETE' });
    return res.json();
  }
}

const api = new ApiClient();
export default api;
