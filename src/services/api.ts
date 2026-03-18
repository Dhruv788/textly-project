import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    createdAt: string;
  };
  token: string;
}

interface HistoryResponse {
  history: Array<{
    id: string;
    email: string;
    status: 'success' | 'failed';
    timestamp: string;
    device: string;
    browser: string;
    os?: string;
    location: string;
    ipAddress: string;
    failureReason?: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach JWT token to every request
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('taskly_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 - token expired
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('taskly_token');
          localStorage.removeItem('taskly_user');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // ── AUTH
  auth = {
    login: async (
      email: string,
      password: string
    ): Promise<ApiResponse<AuthResponse>> => {
      const response: AxiosResponse<ApiResponse<AuthResponse>> =
        await this.client.post('/api/auth/login', { email, password });
      return response.data;
    },

    signup: async (
      name: string,
      email: string,
      password: string
    ): Promise<ApiResponse<AuthResponse>> => {
      const response: AxiosResponse<ApiResponse<AuthResponse>> =
        await this.client.post('/api/auth/signup', { name, email, password });
      return response.data;
    },

    verify: async (token: string): Promise<ApiResponse<{ user: any }>> => {
      const response: AxiosResponse<ApiResponse<{ user: any }>> =
        await this.client.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
      return response.data;
    },
  };

  // ── HISTORY
  history = {
    getHistory: async (
      limit: number = 50,
      page: number = 1,
      status?: 'success' | 'failed'
    ): Promise<ApiResponse<HistoryResponse>> => {
      const params: Record<string, string | number> = { limit, page };
      if (status) params.status = status;
      const response: AxiosResponse<ApiResponse<HistoryResponse>> =
        await this.client.get('/api/history', { params });
      return response.data;
    },

    getStats: async (): Promise<ApiResponse<any>> => {
      const response: AxiosResponse<ApiResponse<any>> =
        await this.client.get('/api/history/stats');
      return response.data;
    },

    clearHistory: async (): Promise<ApiResponse> => {
      const response: AxiosResponse<ApiResponse> =
        await this.client.delete('/api/history');
      return response.data;
    },

    deleteEntry: async (id: string): Promise<ApiResponse> => {
      const response: AxiosResponse<ApiResponse> =
        await this.client.delete(`/api/history/${id}`);
      return response.data;
    },
  };

  // ── USERS
  users = {
    // Search users
    search: async (q: string): Promise<ApiResponse> => {
      const response = await this.client.get(
        `/api/users/search?q=${encodeURIComponent(q)}`
      );
      return response.data;
    },

    // Get my profile
    getMe: async (): Promise<ApiResponse> => {
      const response = await this.client.get('/api/users/me');
      return response.data;
    },

    // Update profile (name, vibeStatus, avatar)
    updateProfile: async (data: {
      name?: string;
      vibeStatus?: string;
      avatar?: string;
    }): Promise<ApiResponse> => {
      const response = await this.client.put('/api/users/me', data);
      return response.data;
    },

    // Update privacy settings
    updatePrivacy: async (data: {
      showLastSeen?: boolean;
      showOnlineStatus?: boolean;
      showProfilePhoto?: boolean;
      showVibeStatus?: boolean;
      showReadReceipts?: boolean;
      showTyping?: boolean;
    }): Promise<ApiResponse> => {
      const response = await this.client.put('/api/users/privacy', data);
      return response.data;
    },

    // Submit rating
    submitRating: async (data: {
      stars: number;
      review?: string;
    }): Promise<ApiResponse> => {
      const response = await this.client.post('/api/users/rating', data);
      return response.data;
    },

    // Get my rating
    getRating: async (): Promise<ApiResponse> => {
      const response = await this.client.get('/api/users/rating');
      return response.data;
    },
  };

  // ── CONVERSATIONS
 // ── CONVERSATIONS
conversations = {
  // Get all conversations
  getAll: async (): Promise<ApiResponse> => {
    const response = await this.client.get('/api/conversations');
    return response.data;
  },

  // Create direct chat
  createDirect: async (userId: string): Promise<ApiResponse> => {
    const response = await this.client.post(
      '/api/conversations/direct',
      { userId }
    );
    return response.data;
  },

  // Create group chat
  createGroup: async (
    name: string,
    participantIds: string[]
  ): Promise<ApiResponse> => {
    const response = await this.client.post(
      '/api/conversations/group',
      { name, participantIds }
    );
    return response.data;
  },

  // ✅ Add members to existing group
  addMembers: async (
    conversationId: string,
    participantIds: string[]
  ): Promise<ApiResponse> => {
    const response = await this.client.post(
      `/api/conversations/${conversationId}/add-members`,
      { participantIds }
    );
    return response.data;
  },
};

  // ── MESSAGES
  messages = {
    // GET all messages in a conversation
    getMessages: async (conversationId: string): Promise<ApiResponse> => {
      const response = await this.client.get(
        `/api/messages/${conversationId}`
      );
      return response.data;
    },

    // POST send a message
    send: async (
      conversationId: string,
      text: string
    ): Promise<ApiResponse> => {
      const response = await this.client.post(
        '/api/messages/send',
        { conversationId, text }
      );
      return response.data;
    },
  };

  // ── HEALTH CHECK
  health = async (): Promise<ApiResponse> => {
    const response: AxiosResponse<ApiResponse> =
      await this.client.get('/health');
    return response.data;
  };
}

const api = new ApiService();
export default api;