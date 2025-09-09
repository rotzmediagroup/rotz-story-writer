import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type ExportFormat = 'pdf' | 'epub' | 'docx' | 'markdown';
export type ExportStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface PDFOptions {
  fontSize?: number;
  fontFamily?: string;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeChapterHeadings?: boolean;
  includeTitlePage?: boolean;
  includeTableOfContents?: boolean;
  pageOrientation?: 'portrait' | 'landscape';
}

export interface EPUBOptions {
  includeMetadata?: boolean;
  includeTableOfContents?: boolean;
  chapterBreaks?: 'page' | 'section';
  css?: string;
  coverImage?: string;
}

export interface DOCXOptions {
  includeChapterHeadings?: boolean;
  includeTitlePage?: boolean;
  includeTableOfContents?: boolean;
  fontSize?: number;
  fontFamily?: string;
  pageOrientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface MarkdownOptions {
  includeMetadata?: boolean;
  chapterHeadingLevel?: number;
  includeTableOfContents?: boolean;
  frontMatter?: 'yaml' | 'toml' | 'none';
}

export type FormatOptions = PDFOptions | EPUBOptions | DOCXOptions | MarkdownOptions;

export interface Export {
  id: string;
  storyId: string;
  userId: string;
  format: ExportFormat;
  fileName: string;
  fileSize?: number;
  fileUrl?: string;
  options: FormatOptions;
  status: ExportStatus;
  processingTime?: number;
  downloadCount: number;
  expiresAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface CreateExportData {
  storyId: string;
  userId: string;
  format: ExportFormat;
  options?: FormatOptions;
}

export interface UpdateExportData {
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  status?: ExportStatus;
  processingTime?: number;
  downloadCount?: number;
  expiresAt?: Date;
  error?: string;
}

export interface ExportSummary {
  id: string;
  format: ExportFormat;
  fileName: string;
  status: ExportStatus;
  fileSize?: number;
  downloadCount: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ExportFilters {
  storyId?: string;
  userId?: string;
  format?: ExportFormat;
  status?: ExportStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  includeExpired?: boolean;
}

export class ExportModel {
  private static readonly DEFAULT_EXPIRY_DAYS = 7;

  /**
   * Create a new export request
   */
  static async create(exportData: CreateExportData): Promise<Export> {
    const id = uuidv4();
    
    // Validate format
    if (!this.isValidFormat(exportData.format)) {
      throw new Error(`Invalid export format: ${exportData.format}`);
    }

    // Validate options for the specific format
    if (exportData.options && !this.validateFormatOptions(exportData.format, exportData.options)) {
      throw new Error(`Invalid options for format: ${exportData.format}`);
    }

    // Generate filename
    const fileName = await this.generateFileName(exportData.storyId, exportData.format);

    try {
      const result = await query(`
        INSERT INTO exports (
          id, story_id, user_id, format, file_name, options, status,
          download_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *
      `, [
        id,
        exportData.storyId,
        exportData.userId,
        exportData.format,
        fileName,
        exportData.options ? JSON.stringify(exportData.options) : null,
        'pending' as ExportStatus,
        0, // initial download count
      ]);

      const exportRecord = this.mapDatabaseRowToExport(result.rows[0]);
      logger.info('Export request created successfully', { 
        exportId: id, 
        storyId: exportData.storyId,
        format: exportData.format
      });
      
      return exportRecord;
    } catch (error) {
      logger.error('Failed to create export request', { error, exportData });
      throw error;
    }
  }

  /**
   * Find export by ID
   */
  static async findById(id: string): Promise<Export | null> {
    try {
      const result = await query(`
        SELECT * FROM exports WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToExport(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find export by ID', { error, exportId: id });
      throw error;
    }
  }

  /**
   * Find exports with filters
   */
  static async find(filters: ExportFilters = {}): Promise<ExportSummary[]> {
    const whereConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build where conditions
    if (filters.storyId) {
      whereConditions.push(`story_id = $${paramIndex++}`);
      values.push(filters.storyId);
    }

    if (filters.userId) {
      whereConditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.format) {
      whereConditions.push(`format = $${paramIndex++}`);
      values.push(filters.format);
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.createdAfter) {
      whereConditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      whereConditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.createdBefore);
    }

    // Exclude expired exports unless specifically requested
    if (!filters.includeExpired) {
      whereConditions.push(`(expires_at IS NULL OR expires_at > NOW())`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    try {
      const result = await query(`
        SELECT id, format, file_name, status, file_size, download_count, 
               expires_at, created_at
        FROM exports 
        ${whereClause}
        ORDER BY created_at DESC
      `, values);

      return result.rows.map(row => ({
        id: row.id,
        format: row.format as ExportFormat,
        fileName: row.file_name,
        status: row.status as ExportStatus,
        fileSize: row.file_size || undefined,
        downloadCount: row.download_count,
        expiresAt: row.expires_at || undefined,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Failed to find exports', { error, filters });
      throw error;
    }
  }

  /**
   * Update export
   */
  static async update(id: string, updateData: UpdateExportData): Promise<Export | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        updates.push(`${dbField} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    try {
      const result = await query(`
        UPDATE exports 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const exportRecord = this.mapDatabaseRowToExport(result.rows[0]);
      logger.info('Export updated successfully', { exportId: id });
      
      return exportRecord;
    } catch (error) {
      logger.error('Failed to update export', { error, exportId: id, updateData });
      throw error;
    }
  }

  /**
   * Mark export as complete with file details
   */
  static async markComplete(
    id: string, 
    fileUrl: string, 
    fileSize: number, 
    processingTime: number
  ): Promise<Export | null> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.DEFAULT_EXPIRY_DAYS);

    return this.update(id, {
      status: 'complete',
      fileUrl,
      fileSize,
      processingTime,
      expiresAt,
    });
  }

  /**
   * Mark export as failed with error message
   */
  static async markFailed(id: string, error: string): Promise<Export | null> {
    return this.update(id, {
      status: 'failed',
      error,
    });
  }

  /**
   * Mark export as processing
   */
  static async markProcessing(id: string): Promise<Export | null> {
    return this.update(id, {
      status: 'processing',
    });
  }

  /**
   * Increment download count
   */
  static async incrementDownloadCount(id: string): Promise<void> {
    try {
      await query(`
        UPDATE exports 
        SET download_count = download_count + 1
        WHERE id = $1
      `, [id]);
      
      logger.info('Export download count incremented', { exportId: id });
    } catch (error) {
      logger.error('Failed to increment download count', { error, exportId: id });
      throw error;
    }
  }

  /**
   * Delete export
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM exports WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Export deleted successfully', { exportId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete export', { error, exportId: id });
      throw error;
    }
  }

  /**
   * Clean up expired exports
   */
  static async cleanupExpired(): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM exports 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `);

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        logger.info('Expired exports cleaned up', { deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean up expired exports', { error });
      throw error;
    }
  }

  /**
   * Get pending exports for processing
   */
  static async getPendingExports(limit = 10): Promise<Export[]> {
    try {
      const result = await query(`
        SELECT * FROM exports 
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => this.mapDatabaseRowToExport(row));
    } catch (error) {
      logger.error('Failed to get pending exports', { error });
      throw error;
    }
  }

  /**
   * Get export statistics
   */
  static async getExportStats(userId?: string): Promise<{
    total: number;
    byFormat: Record<ExportFormat, number>;
    byStatus: Record<ExportStatus, number>;
    totalDownloads: number;
    avgProcessingTime: number;
  }> {
    const whereClause = userId ? 'WHERE user_id = $1' : '';
    const values = userId ? [userId] : [];

    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          format,
          status,
          SUM(download_count) as total_downloads,
          AVG(processing_time) as avg_processing_time
        FROM exports 
        ${whereClause}
        GROUP BY format, status
      `, values);

      const stats = {
        total: 0,
        byFormat: {} as Record<ExportFormat, number>,
        byStatus: {} as Record<ExportStatus, number>,
        totalDownloads: 0,
        avgProcessingTime: 0,
      };

      // Initialize counters
      (['pdf', 'epub', 'docx', 'markdown'] as ExportFormat[]).forEach(format => {
        stats.byFormat[format] = 0;
      });
      
      (['pending', 'processing', 'complete', 'failed'] as ExportStatus[]).forEach(status => {
        stats.byStatus[status] = 0;
      });

      // Aggregate results
      result.rows.forEach(row => {
        const count = parseInt(row.total || '0');
        stats.total += count;
        stats.byFormat[row.format as ExportFormat] += count;
        stats.byStatus[row.status as ExportStatus] += count;
        stats.totalDownloads += parseInt(row.total_downloads || '0');
        
        if (row.avg_processing_time) {
          stats.avgProcessingTime += parseFloat(row.avg_processing_time);
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get export statistics', { error, userId });
      throw error;
    }
  }

  /**
   * Validate export format
   */
  static isValidFormat(format: string): format is ExportFormat {
    return ['pdf', 'epub', 'docx', 'markdown'].includes(format);
  }

  /**
   * Validate format-specific options
   */
  static validateFormatOptions(format: ExportFormat, options: FormatOptions): boolean {
    switch (format) {
      case 'pdf':
        const pdfOptions = options as PDFOptions;
        return this.validatePDFOptions(pdfOptions);
      case 'epub':
        const epubOptions = options as EPUBOptions;
        return this.validateEPUBOptions(epubOptions);
      case 'docx':
        const docxOptions = options as DOCXOptions;
        return this.validateDOCXOptions(docxOptions);
      case 'markdown':
        const markdownOptions = options as MarkdownOptions;
        return this.validateMarkdownOptions(markdownOptions);
      default:
        return false;
    }
  }

  /**
   * Get default options for format
   */
  static getDefaultOptions(format: ExportFormat): FormatOptions {
    switch (format) {
      case 'pdf':
        return {
          fontSize: 12,
          fontFamily: 'Times New Roman',
          margin: { top: 1, right: 1, bottom: 1, left: 1 },
          includeChapterHeadings: true,
          includeTitlePage: true,
          includeTableOfContents: true,
          pageOrientation: 'portrait',
        } as PDFOptions;
      
      case 'epub':
        return {
          includeMetadata: true,
          includeTableOfContents: true,
          chapterBreaks: 'page',
        } as EPUBOptions;
      
      case 'docx':
        return {
          includeChapterHeadings: true,
          includeTitlePage: true,
          includeTableOfContents: true,
          fontSize: 12,
          fontFamily: 'Times New Roman',
          pageOrientation: 'portrait',
          margins: { top: 1, right: 1, bottom: 1, left: 1 },
        } as DOCXOptions;
      
      case 'markdown':
        return {
          includeMetadata: true,
          chapterHeadingLevel: 2,
          includeTableOfContents: true,
          frontMatter: 'yaml',
        } as MarkdownOptions;
      
      default:
        return {};
    }
  }

  /**
   * Generate filename based on story and format
   */
  private static async generateFileName(storyId: string, format: ExportFormat): Promise<string> {
    try {
      // Get story title
      const result = await query(`
        SELECT title FROM stories WHERE id = $1
      `, [storyId]);

      const storyTitle = result.rows[0]?.title || 'Untitled Story';
      
      // Sanitize filename
      const sanitizedTitle = storyTitle
        .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .toLowerCase();

      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      return `${sanitizedTitle}_${timestamp}.${format}`;
    } catch (error) {
      logger.error('Failed to generate filename', { error, storyId, format });
      return `story_${storyId.slice(0, 8)}_${Date.now()}.${format}`;
    }
  }

  /**
   * Validate PDF options
   */
  private static validatePDFOptions(options: PDFOptions): boolean {
    if (options.fontSize && (options.fontSize < 8 || options.fontSize > 24)) {
      return false;
    }
    if (options.pageOrientation && !['portrait', 'landscape'].includes(options.pageOrientation)) {
      return false;
    }
    return true;
  }

  /**
   * Validate EPUB options
   */
  private static validateEPUBOptions(options: EPUBOptions): boolean {
    if (options.chapterBreaks && !['page', 'section'].includes(options.chapterBreaks)) {
      return false;
    }
    return true;
  }

  /**
   * Validate DOCX options
   */
  private static validateDOCXOptions(options: DOCXOptions): boolean {
    if (options.fontSize && (options.fontSize < 8 || options.fontSize > 24)) {
      return false;
    }
    if (options.pageOrientation && !['portrait', 'landscape'].includes(options.pageOrientation)) {
      return false;
    }
    return true;
  }

  /**
   * Validate Markdown options
   */
  private static validateMarkdownOptions(options: MarkdownOptions): boolean {
    if (options.chapterHeadingLevel && (options.chapterHeadingLevel < 1 || options.chapterHeadingLevel > 6)) {
      return false;
    }
    if (options.frontMatter && !['yaml', 'toml', 'none'].includes(options.frontMatter)) {
      return false;
    }
    return true;
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      storyId: 'story_id',
      userId: 'user_id',
      fileName: 'file_name',
      fileSize: 'file_size',
      fileUrl: 'file_url',
      processingTime: 'processing_time',
      downloadCount: 'download_count',
      expiresAt: 'expires_at',
      createdAt: 'created_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Parse JSON field safely
   */
  private static parseJsonField<T>(value: any): T | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Map database row to Export object
   */
  private static mapDatabaseRowToExport(row: any): Export {
    return {
      id: row.id,
      storyId: row.story_id,
      userId: row.user_id,
      format: row.format as ExportFormat,
      fileName: row.file_name,
      fileSize: row.file_size || undefined,
      fileUrl: row.file_url || undefined,
      options: this.parseJsonField<FormatOptions>(row.options) || {},
      status: row.status as ExportStatus,
      processingTime: row.processing_time || undefined,
      downloadCount: row.download_count,
      expiresAt: row.expires_at || undefined,
      error: row.error || undefined,
      createdAt: row.created_at,
    };
  }
}