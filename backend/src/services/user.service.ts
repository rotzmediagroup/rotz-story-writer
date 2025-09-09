import jwt from 'jsonwebtoken';
import { UserModel, CreateUserData, User, UserWithoutPassword, UserPreferences } from '../models/user.model';
import { AIConfigModel, CreateAIConfigData } from '../models/ai-config.model';
import { logger } from '../config/logger';
import { encrypt, decrypt } from '../lib/crypto';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserWithoutPassword;
  token: string;
  expiresAt: Date;
}

export interface SessionInfo {
  userId: string;
  email: string;
  subscriptionTier: User['subscriptionTier'];
  iat: number;
  exp: number;
}

export interface UserStats {
  totalStories: number;
  totalTokensUsed: number;
  aiConfigurations: number;
  storiesThisMonth: number;
  tokensThisMonth: number;
  accountAge: number;
}

export interface APIKeyInfo {
  id: string;
  provider: string;
  model: string;
  maskedKey: string;
  isDefault: boolean;
  usage: {
    totalTokens: number;
    totalCost: number;
    lastUsed?: Date;
  };
  createdAt: Date;
}

export class UserService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string = '7d';

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set in environment, using default (INSECURE for production)');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: CreateUserData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Validate subscription tier
      if (!['free', 'premium', 'enterprise'].includes(userData.subscriptionTier)) {
        throw new Error('Invalid subscription tier');
      }

      // Create user
      const user = await UserModel.create(userData);

      // Generate JWT token
      const token = this.generateToken(user);
      const decoded = jwt.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier
      });

      return {
        user,
        token,
        expiresAt
      };

    } catch (error) {
      logger.error('User registration failed', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Find user and validate password
      const user = await UserModel.findByEmailWithPassword(credentials.email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isPasswordValid = await UserModel.validatePassword(credentials.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Remove password from response
      const { passwordHash, ...userWithoutPassword } = user;

      // Generate JWT token
      const token = this.generateToken(userWithoutPassword);
      const decoded = jwt.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email
      });

      return {
        user: userWithoutPassword,
        token,
        expiresAt
      };

    } catch (error) {
      logger.error('User login failed', { error, email: credentials.email });
      throw error;
    }
  }

  /**
   * Verify JWT token and get user session
   */
  async verifyToken(token: string): Promise<SessionInfo> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as SessionInfo;
      
      // Verify user still exists and is active
      const user = await UserModel.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('Invalid or expired token');
      }

      return decoded;

    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh user token
   */
  async refreshToken(token: string): Promise<AuthResponse> {
    try {
      const session = await this.verifyToken(token);
      const user = await UserModel.findById(session.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const newToken = this.generateToken(user);
      const decoded = jwt.decode(newToken) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      return {
        user,
        token: newToken,
        expiresAt
      };

    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'subscriptionTier'>>
  ): Promise<UserWithoutPassword> {
    try {
      // If email is being updated, check for conflicts
      if (updates.email) {
        const existingUser = await UserModel.findByEmail(updates.email);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Email already in use by another account');
        }
      }

      const updatedUser = await UserModel.update(userId, updates);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      logger.info('User profile updated', {
        userId,
        updates: Object.keys(updates)
      });

      return updatedUser;

    } catch (error) {
      logger.error('Profile update failed', { error, userId });
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserWithoutPassword> {
    try {
      const updatedUser = await UserModel.updatePreferences(userId, preferences);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      logger.info('User preferences updated', {
        userId,
        preferences: Object.keys(preferences)
      });

      return updatedUser;

    } catch (error) {
      logger.error('Preferences update failed', { error, userId });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user with password hash
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userWithPassword = await UserModel.findByEmailWithPassword(user.email);
      if (!userWithPassword) {
        throw new Error('User not found');
      }

      // Validate current password
      const isCurrentPasswordValid = await UserModel.validatePassword(currentPassword, userWithPassword.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await UserModel.updatePassword(userId, newPassword);

      logger.info('User password changed', { userId });

    } catch (error) {
      logger.error('Password change failed', { error, userId });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const stats = await UserModel.getStats(userId);
      const user = await UserModel.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const accountAge = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...stats,
        accountAge
      };

    } catch (error) {
      logger.error('Failed to get user stats', { error, userId });
      throw error;
    }
  }

  /**
   * Add AI configuration for user
   */
  async addAIConfiguration(userId: string, configData: Omit<CreateAIConfigData, 'userId'>): Promise<string> {
    try {
      const fullConfigData: CreateAIConfigData = {
        ...configData,
        userId
      };

      const configId = await AIConfigModel.create(fullConfigData);

      logger.info('AI configuration added', {
        userId,
        configId,
        provider: configData.provider,
        model: configData.model
      });

      return configId;

    } catch (error) {
      logger.error('Failed to add AI configuration', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's AI configurations with masked keys
   */
  async getAIConfigurations(userId: string): Promise<APIKeyInfo[]> {
    try {
      const configs = await AIConfigModel.findByUserId(userId);

      const configsWithInfo: APIKeyInfo[] = await Promise.all(
        configs.map(async (config) => {
          const usage = await AIConfigModel.getUsageStats(config.id);
          
          return {
            id: config.id,
            provider: config.provider,
            model: config.model,
            maskedKey: this.maskApiKey(config.apiKey),
            isDefault: config.isDefault,
            usage: {
              totalTokens: usage.totalTokens,
              totalCost: usage.totalCost,
              lastUsed: usage.lastUsed
            },
            createdAt: config.createdAt
          };
        })
      );

      return configsWithInfo;

    } catch (error) {
      logger.error('Failed to get AI configurations', { error, userId });
      throw error;
    }
  }

  /**
   * Update AI configuration
   */
  async updateAIConfiguration(
    userId: string,
    configId: string,
    updates: Partial<Omit<CreateAIConfigData, 'userId' | 'apiKey'>> & { apiKey?: string }
  ): Promise<void> {
    try {
      // Verify configuration belongs to user
      const config = await AIConfigModel.findById(configId);
      if (!config || config.userId !== userId) {
        throw new Error('AI configuration not found');
      }

      await AIConfigModel.update(configId, updates);

      logger.info('AI configuration updated', {
        userId,
        configId,
        updates: Object.keys(updates)
      });

    } catch (error) {
      logger.error('Failed to update AI configuration', { error, userId, configId });
      throw error;
    }
  }

  /**
   * Delete AI configuration
   */
  async deleteAIConfiguration(userId: string, configId: string): Promise<void> {
    try {
      // Verify configuration belongs to user
      const config = await AIConfigModel.findById(configId);
      if (!config || config.userId !== userId) {
        throw new Error('AI configuration not found');
      }

      // Don't allow deletion of default config if it's the only one
      if (config.isDefault) {
        const userConfigs = await AIConfigModel.findByUserId(userId);
        if (userConfigs.length === 1) {
          throw new Error('Cannot delete the only AI configuration');
        }
      }

      await AIConfigModel.delete(configId);

      logger.info('AI configuration deleted', {
        userId,
        configId,
        provider: config.provider
      });

    } catch (error) {
      logger.error('Failed to delete AI configuration', { error, userId, configId });
      throw error;
    }
  }

  /**
   * Set default AI configuration
   */
  async setDefaultAIConfiguration(userId: string, configId: string): Promise<void> {
    try {
      // Verify configuration belongs to user
      const config = await AIConfigModel.findById(configId);
      if (!config || config.userId !== userId) {
        throw new Error('AI configuration not found');
      }

      await AIConfigModel.setDefault(userId, configId);

      logger.info('Default AI configuration set', {
        userId,
        configId,
        provider: config.provider
      });

    } catch (error) {
      logger.error('Failed to set default AI configuration', { error, userId, configId });
      throw error;
    }
  }

  /**
   * Test AI configuration
   */
  async testAIConfiguration(userId: string, configId: string): Promise<{
    success: boolean;
    provider: string;
    model: string;
    responseTime: number;
    error?: string;
  }> {
    try {
      // Verify configuration belongs to user
      const config = await AIConfigModel.findById(configId);
      if (!config || config.userId !== userId) {
        throw new Error('AI configuration not found');
      }

      // Import AIProviderManager dynamically to avoid circular dependency
      const { AIProviderManager } = await import('./ai-provider-manager');
      const aiManager = new AIProviderManager();
      
      const result = await aiManager.testConfiguration(configId);

      logger.info('AI configuration tested', {
        userId,
        configId,
        success: result.success,
        responseTime: result.responseTime
      });

      return result;

    } catch (error) {
      logger.error('Failed to test AI configuration', { error, userId, configId });
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    try {
      await UserModel.update(userId, { isActive: false });

      logger.info('User account deactivated', { userId });

    } catch (error) {
      logger.error('Failed to deactivate account', { error, userId });
      throw error;
    }
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(user: UserWithoutPassword): string {
    const payload: Omit<SessionInfo, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'rotz-story-writer',
      audience: 'rotz-story-writer-users'
    });
  }

  /**
   * Mask API key for display
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  /**
   * Check if user can perform action based on subscription tier
   */
  async checkSubscriptionLimits(userId: string, action: 'create_story' | 'generate_chapter' | 'export_story'): Promise<{
    allowed: boolean;
    reason?: string;
    currentUsage?: number;
    limit?: number;
  }> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const stats = await UserModel.getStats(userId);
      
      // Define limits based on subscription tier
      const limits = {
        free: {
          stories: 5,
          chaptersPerStory: 10,
          exportsPerMonth: 3
        },
        premium: {
          stories: 100,
          chaptersPerStory: 50,
          exportsPerMonth: 50
        },
        enterprise: {
          stories: Infinity,
          chaptersPerStory: Infinity,
          exportsPerMonth: Infinity
        }
      };

      const userLimits = limits[user.subscriptionTier];

      switch (action) {
        case 'create_story':
          if (stats.totalStories >= userLimits.stories) {
            return {
              allowed: false,
              reason: `Story limit reached for ${user.subscriptionTier} tier`,
              currentUsage: stats.totalStories,
              limit: userLimits.stories
            };
          }
          break;

        case 'export_story':
          if (stats.exportsThisMonth >= userLimits.exportsPerMonth) {
            return {
              allowed: false,
              reason: `Monthly export limit reached for ${user.subscriptionTier} tier`,
              currentUsage: stats.exportsThisMonth,
              limit: userLimits.exportsPerMonth
            };
          }
          break;
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Failed to check subscription limits', { error, userId, action });
      throw error;
    }
  }
}

export const userService = new UserService();