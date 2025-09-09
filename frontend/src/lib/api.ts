import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  genre: string;
  status: 'planning' | 'planned' | 'generating' | 'generated' | 'published' | 'archived' | 'cancelled';
  targetWordCount: number;
  targetChapters: number;
  setting?: string;
  style?: string;
  themes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryWithDetails extends Story {
  plan?: any;
  chapters: Array<{
    id: string;
    title: string;
    chapterNumber: number;
    status: string;
    wordCount: number;
    createdAt: string;
  }>;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    prominence: number;
  }>;
  statistics: {
    totalChapters: number;
    completedChapters: number;
    totalWordCount: number;
    averageChapterLength: number;
    progressPercentage: number;
  };
}

export interface CreateStoryRequest {
  title: string;
  description: string;
  genre: string;
  targetWordCount?: number;
  targetChapters?: number;
  setting?: string;
  style?: string;
  themes?: string[];
}

export interface AIConfiguration {
  id: string;
  provider: string;
  model: string;
  maskedKey: string;
  isDefault: boolean;
  usage: {
    totalTokens: number;
    totalCost: number;
    lastUsed?: string;
  };
  createdAt: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.token = localStorage.getItem('authToken');
    this.updateAuthHeader();

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  private updateAuthHeader() {
    if (this.token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
    this.updateAuthHeader();
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
    this.updateAuthHeader();
  }

  getToken() {
    return this.token;
  }

  // Authentication endpoints
  async register(userData: {
    name: string;
    email: string;
    password: string;
    subscriptionTier?: string;
  }): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/register', userData);
    return response.data.data!;
  }

  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    return response.data.data!;
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/refresh');
    return response.data.data!;
  }

  async getMe(): Promise<{ user: User; stats: any }> {
    const response = await this.client.get<ApiResponse<{ user: User; stats: any }>>('/auth/me');
    return response.data.data!;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await this.client.put<ApiResponse<{ user: User }>>('/auth/profile', updates);
    return response.data.data!.user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.put('/auth/password', { currentPassword, newPassword });
  }

  // Story endpoints
  async getStories(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    genre?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{
    stories: Story[];
    total: number;
    hasMore: boolean;
  }> {
    const response = await this.client.get<ApiResponse<{
      stories: Story[];
      total: number;
      hasMore: boolean;
    }>>('/stories', { params });
    return response.data.data!;
  }

  async getStory(storyId: string): Promise<StoryWithDetails> {
    const response = await this.client.get<ApiResponse<{ story: StoryWithDetails }>>(`/stories/${storyId}`);
    return response.data.data!.story;
  }

  async createStory(storyData: CreateStoryRequest): Promise<string> {
    const response = await this.client.post<ApiResponse<{ storyId: string }>>('/stories', storyData);
    return response.data.data!.storyId;
  }

  async updateStory(storyId: string, updates: Partial<CreateStoryRequest>): Promise<Story> {
    const response = await this.client.put<ApiResponse<{ story: Story }>>(`/stories/${storyId}`, updates);
    return response.data.data!.story;
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.client.delete(`/stories/${storyId}`);
  }

  async generateStoryPlan(storyId: string, planData: {
    title: string;
    description: string;
    genre: string;
    targetChapters: number;
    setting?: string;
    style?: string;
    themes?: string[];
  }): Promise<any> {
    const response = await this.client.post<ApiResponse<{ plan: any }>>(`/stories/${storyId}/plan`, planData);
    return response.data.data!.plan;
  }

  async startStoryGeneration(storyId: string): Promise<void> {
    await this.client.post(`/stories/${storyId}/generate`);
  }

  async getStoryStatistics(storyId: string): Promise<any> {
    const response = await this.client.get<ApiResponse<{ statistics: any }>>(`/stories/${storyId}/statistics`);
    return response.data.data!.statistics;
  }

  async exportStory(storyId: string, format: string, options?: any): Promise<string> {
    const response = await this.client.post<ApiResponse<{ exportId: string }>>(
      `/stories/${storyId}/export`,
      { format, options }
    );
    return response.data.data!.exportId;
  }

  async getGenres(): Promise<string[]> {
    const response = await this.client.get<ApiResponse<{ genres: string[] }>>('/stories/genres');
    return response.data.data!.genres;
  }

  // Generation endpoints
  async generateChapter(chapterId: string, options?: {
    contextChapters?: number;
    regenerate?: boolean;
  }): Promise<any> {
    const response = await this.client.post<ApiResponse<{ chapter: any }>>(
      `/generation/chapter/${chapterId}`,
      options
    );
    return response.data.data!.chapter;
  }

  async generateStory(storyId: string, options?: {
    startFromChapter?: number;
    maxChapters?: number;
    contextChapters?: number;
  }): Promise<void> {
    await this.client.post(`/generation/story/${storyId}`, options);
  }

  async getGenerationStatus(storyId: string): Promise<{ isGenerating: boolean; progress?: any }> {
    const response = await this.client.get<ApiResponse<{ status: any }>>(`/generation/story/${storyId}/status`);
    return response.data.data!.status;
  }

  async abortGeneration(storyId: string): Promise<void> {
    await this.client.delete(`/generation/story/${storyId}`);
  }

  async reviseChapter(chapterId: string, feedback: string): Promise<any> {
    const response = await this.client.post<ApiResponse<{ chapter: any }>>(
      `/generation/chapter/${chapterId}/revise`,
      { feedback }
    );
    return response.data.data!.chapter;
  }

  // Server-Sent Events for real-time progress
  createProgressStream(storyId: string): EventSource {
    const token = this.getToken();
    const url = new URL(`/generation/progress/${storyId}`, this.client.defaults.baseURL);
    
    const eventSource = new EventSource(url.toString(), {
      withCredentials: false,
    });

    // Add authorization header if available (note: EventSource doesn't support custom headers)
    // This would need to be handled differently in production (e.g., via query parameter or WebSocket)

    return eventSource;
  }

  // AI Configuration endpoints
  async getAIConfigurations(): Promise<AIConfiguration[]> {
    const response = await this.client.get<ApiResponse<{ configurations: AIConfiguration[] }>>('/ai-config');
    return response.data.data!.configurations;
  }

  async createAIConfiguration(configData: {
    provider: string;
    model: string;
    apiKey: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    isDefault?: boolean;
  }): Promise<string> {
    const response = await this.client.post<ApiResponse<{ configId: string }>>('/ai-config', configData);
    return response.data.data!.configId;
  }

  async updateAIConfiguration(configId: string, updates: any): Promise<void> {
    await this.client.put(`/ai-config/${configId}`, updates);
  }

  async deleteAIConfiguration(configId: string): Promise<void> {
    await this.client.delete(`/ai-config/${configId}`);
  }

  async setDefaultAIConfiguration(configId: string): Promise<void> {
    await this.client.put(`/ai-config/${configId}/default`);
  }

  async testAIConfiguration(configId: string): Promise<any> {
    const response = await this.client.post<ApiResponse<{ testResult: any }>>(`/ai-config/${configId}/test`);
    return response.data.data!.testResult;
  }

  async getAIProviders(): Promise<any> {
    const response = await this.client.get<ApiResponse<{ providers: any }>>('/ai-config/providers');
    return response.data.data!.providers;
  }
}

export const apiClient = new ApiClient();