import { 
  ApiResponse, 
  LoginCredentials, 
  RegisterData, 
  User, 
  AuthTokens, 
  UpdateProfileRequest 
} from './types';

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    // In browser, prefer same-origin relative API path so cookies and sessions work via Next proxy
    return '/api';
  }

  return 'http://localhost:3001/api';
};

class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken') || this.getCookieValue('accessToken');
    }
  }

  private buildCookieAttributes(maxAgeSeconds?: number) {
    const attributes: string[] = ['path=/'];
    if (typeof maxAgeSeconds === 'number' && Number.isFinite(maxAgeSeconds)) {
      attributes.push(`max-age=${Math.floor(maxAgeSeconds)}`);
    }

    const isSecureContext = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isSecureContext) {
      attributes.push('Secure');
    }

    attributes.push('SameSite=Strict');
    return attributes.join('; ');
  }

  private getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private saveTokenToStorage(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      const attributes = this.buildCookieAttributes(24 * 60 * 60);
      document.cookie = `accessToken=${token}; ${attributes}`;
    }
  }

  private removeTokenFromStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Also remove cookie
      const attributes = this.buildCookieAttributes();
      document.cookie = `accessToken=; ${attributes}; max-age=0`;
    }
  }

  setAccessToken(token: string) {
    this.accessToken = token;
    this.saveTokenToStorage(token);
  }

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      defaultHeaders.Authorization = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry the request with new token
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${this.accessToken}`,
            };
            const retryResponse = await fetch(url, config);
            if (retryResponse.ok) {
              return await retryResponse.json();
            }
          }
          // Refresh failed, redirect to login
          this.removeTokenFromStorage();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setAccessToken(data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        const attributes = this.buildCookieAttributes(24 * 60 * 60);
        document.cookie = `refreshToken=${data.data.refreshToken}; ${attributes}`;
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }

  // Build query string from params, removing undefined/null/empty values
  private buildQuery(params?: Record<string, any>): string {
    if (!params) return '';
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      // Skip empty string values to avoid sending "param=" or "param=undefined"
      if (typeof value === 'string' && value.trim() === '') continue;
      // Convert non-string values to string for URLSearchParams
      cleaned[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
    const qs = new URLSearchParams(cleaned).toString();
    return qs;
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.makeRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data) {
      this.setAccessToken(response.data.tokens.accessToken);
      localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
      const attributes = this.buildCookieAttributes(24 * 60 * 60);
      document.cookie = `refreshToken=${response.data.tokens.refreshToken}; ${attributes}`;
    }

    return response;
  }

  async register(userData: RegisterData): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/auth/logout', { method: 'POST' });
    } finally {
      this.accessToken = null;
      this.removeTokenFromStorage();
      // Also clear refresh token cookie
      document.cookie = 'refreshToken=; path=/; max-age=0';
    }
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.makeRequest('/auth/me');
  }

  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<User>> {
    return this.makeRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.makeRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Generic CRUD methods
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const query = this.buildQuery(params);
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.makeRequest<T>(url);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create singleton instance
const API_BASE_URL = resolveApiBaseUrl();
export const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;