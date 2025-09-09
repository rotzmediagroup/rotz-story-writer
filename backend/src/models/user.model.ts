import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  defaultGenre?: string;
  defaultWritingStyle?: string;
  autoSave?: boolean;
  notifications?: {
    email?: boolean;
    generation?: boolean;
    export?: boolean;
  };
  dashboard?: {
    layout?: 'grid' | 'list';
    itemsPerPage?: number;
  };
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  subscriptionTier: SubscriptionTier;
  storageQuota: number;
  monthlyTokenUsage: number;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  subscriptionTier?: SubscriptionTier;
  preferences?: UserPreferences;
}

export interface UpdateUserData {
  email?: string;
  subscriptionTier?: SubscriptionTier;
  storageQuota?: number;
  monthlyTokenUsage?: number;
  preferences?: UserPreferences;
  lastLoginAt?: Date;
}

export interface UserWithoutPassword extends Omit<User, 'passwordHash'> {}

export class UserModel {
  /**
   * Create a new user with hashed password
   */
  static async create(userData: CreateUserData): Promise<UserWithoutPassword> {
    const id = uuidv4();
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);
    
    const defaultPreferences: UserPreferences = {
      theme: 'auto',
      autoSave: true,
      notifications: {
        email: true,
        generation: true,
        export: true,
      },
      dashboard: {
        layout: 'grid',
        itemsPerPage: 12,
      },
      ...userData.preferences,
    };

    const subscriptionTier = userData.subscriptionTier || 'free';
    const storageQuota = this.getDefaultStorageQuota(subscriptionTier);

    try {
      const result = await query(`
        INSERT INTO users (
          id, email, password_hash, subscription_tier, 
          storage_quota, monthly_token_usage, preferences, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, email, subscription_tier, storage_quota, 
                  monthly_token_usage, preferences, created_at, updated_at, last_login_at
      `, [
        id,
        userData.email.toLowerCase().trim(),
        passwordHash,
        subscriptionTier,
        storageQuota,
        0, // initial monthly token usage
        JSON.stringify(defaultPreferences),
      ]);

      const user = this.mapDatabaseRowToUser(result.rows[0]);
      logger.info('User created successfully', { userId: id, email: userData.email });
      
      return user;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error('Email already exists');
      }
      logger.error('Failed to create user', { error, email: userData.email });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<UserWithoutPassword | null> {
    try {
      const result = await query(`
        SELECT id, email, subscription_tier, storage_quota, 
               monthly_token_usage, preferences, created_at, updated_at, last_login_at
        FROM users 
        WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find user by ID', { error, userId: id });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    try {
      const result = await query(`
        SELECT id, email, subscription_tier, storage_quota, 
               monthly_token_usage, preferences, created_at, updated_at, last_login_at
        FROM users 
        WHERE email = $1
      `, [email.toLowerCase().trim()]);

      return result.rows.length > 0 ? this.mapDatabaseRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find user by email', { error, email });
      throw error;
    }
  }

  /**
   * Find user by email with password hash (for authentication)
   */
  static async findByEmailWithPassword(email: string): Promise<User | null> {
    try {
      const result = await query(`
        SELECT id, email, password_hash, subscription_tier, storage_quota, 
               monthly_token_usage, preferences, created_at, updated_at, last_login_at
        FROM users 
        WHERE email = $1
      `, [email.toLowerCase().trim()]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        subscriptionTier: row.subscription_tier as SubscriptionTier,
        storageQuota: row.storage_quota,
        monthlyTokenUsage: row.monthly_token_usage,
        preferences: typeof row.preferences === 'string' 
          ? JSON.parse(row.preferences) 
          : row.preferences || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at || undefined,
      };
    } catch (error) {
      logger.error('Failed to find user by email with password', { error, email });
      throw error;
    }
  }

  /**
   * Update user data
   */
  static async update(id: string, updateData: UpdateUserData): Promise<UserWithoutPassword | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(updateData.email.toLowerCase().trim());
    }

    if (updateData.subscriptionTier !== undefined) {
      updates.push(`subscription_tier = $${paramIndex++}`);
      values.push(updateData.subscriptionTier);
      
      // Update storage quota based on new subscription tier
      const newQuota = this.getDefaultStorageQuota(updateData.subscriptionTier);
      updates.push(`storage_quota = $${paramIndex++}`);
      values.push(newQuota);
    }

    if (updateData.storageQuota !== undefined) {
      updates.push(`storage_quota = $${paramIndex++}`);
      values.push(updateData.storageQuota);
    }

    if (updateData.monthlyTokenUsage !== undefined) {
      updates.push(`monthly_token_usage = $${paramIndex++}`);
      values.push(updateData.monthlyTokenUsage);
    }

    if (updateData.preferences !== undefined) {
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.preferences));
    }

    if (updateData.lastLoginAt !== undefined) {
      updates.push(`last_login_at = $${paramIndex++}`);
      values.push(updateData.lastLoginAt);
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE users 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING id, email, subscription_tier, storage_quota, 
                  monthly_token_usage, preferences, created_at, updated_at, last_login_at
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const user = this.mapDatabaseRowToUser(result.rows[0]);
      logger.info('User updated successfully', { userId: id });
      
      return user;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error('Email already exists');
      }
      logger.error('Failed to update user', { error, userId: id });
      throw error;
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    try {
      const result = await query(`
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `, [passwordHash, id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('User password updated successfully', { userId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to update user password', { error, userId: id });
      throw error;
    }
  }

  /**
   * Verify user password
   */
  static async verifyPassword(email: string, password: string): Promise<UserWithoutPassword | null> {
    const userWithPassword = await this.findByEmailWithPassword(email);
    
    if (!userWithPassword) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, userWithPassword.passwordHash);
    
    if (!isValidPassword) {
      return null;
    }

    // Update last login time
    await this.update(userWithPassword.id, { lastLoginAt: new Date() });

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = userWithPassword;
    return userWithoutPassword as UserWithoutPassword;
  }

  /**
   * Delete user (soft delete - could be implemented as status change)
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM users 
        WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('User deleted successfully', { userId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: id });
      throw error;
    }
  }

  /**
   * Reset monthly token usage for all users (called monthly by cron job)
   */
  static async resetMonthlyTokenUsage(): Promise<number> {
    try {
      const result = await query(`
        UPDATE users 
        SET monthly_token_usage = 0, updated_at = NOW()
        WHERE monthly_token_usage > 0
      `);

      const updatedCount = result.rowCount || 0;
      logger.info('Monthly token usage reset', { usersUpdated: updatedCount });
      
      return updatedCount;
    } catch (error) {
      logger.error('Failed to reset monthly token usage', { error });
      throw error;
    }
  }

  /**
   * Increment monthly token usage
   */
  static async incrementTokenUsage(id: string, tokens: number): Promise<void> {
    try {
      await query(`
        UPDATE users 
        SET monthly_token_usage = monthly_token_usage + $1, updated_at = NOW()
        WHERE id = $2
      `, [tokens, id]);
    } catch (error) {
      logger.error('Failed to increment token usage', { error, userId: id, tokens });
      throw error;
    }
  }

  /**
   * Get users by subscription tier
   */
  static async findBySubscriptionTier(tier: SubscriptionTier): Promise<UserWithoutPassword[]> {
    try {
      const result = await query(`
        SELECT id, email, subscription_tier, storage_quota, 
               monthly_token_usage, preferences, created_at, updated_at, last_login_at
        FROM users 
        WHERE subscription_tier = $1
        ORDER BY created_at DESC
      `, [tier]);

      return result.rows.map(row => this.mapDatabaseRowToUser(row));
    } catch (error) {
      logger.error('Failed to find users by subscription tier', { error, tier });
      throw error;
    }
  }

  /**
   * Get user count
   */
  static async getCount(): Promise<number> {
    try {
      const result = await query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get user count', { error });
      throw error;
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default storage quota based on subscription tier
   */
  private static getDefaultStorageQuota(tier: SubscriptionTier): number {
    const quotas = {
      free: 10,
      pro: 50,
      team: 200,
      enterprise: 1000,
    };
    return quotas[tier] || quotas.free;
  }

  /**
   * Map database row to User object
   */
  private static mapDatabaseRowToUser(row: any): UserWithoutPassword {
    return {
      id: row.id,
      email: row.email,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      storageQuota: row.storage_quota,
      monthlyTokenUsage: row.monthly_token_usage,
      preferences: typeof row.preferences === 'string' 
        ? JSON.parse(row.preferences) 
        : row.preferences || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at || undefined,
    };
  }
}