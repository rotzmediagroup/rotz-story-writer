import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? (error as any).path : undefined,
        message: error.msg,
        value: error.type === 'field' ? (error as any).value : undefined
      }))
    });
  }
  
  next();
};

/**
 * Common validation rules
 */
export const validation = {
  // UUID validation
  uuid: (field: string) => param(field).isUUID().withMessage(`${field} must be a valid UUID`),

  // Pagination validation
  pagination: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],

  // User validation
  registerUser: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('subscriptionTier')
      .isIn(['free', 'premium', 'enterprise'])
      .withMessage('Subscription tier must be free, premium, or enterprise')
  ],

  loginUser: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('subscriptionTier')
      .optional()
      .isIn(['free', 'premium', 'enterprise'])
      .withMessage('Subscription tier must be free, premium, or enterprise')
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],

  // Story validation
  createStory: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Description must be between 1 and 2000 characters'),
    body('genre')
      .isIn([
        'Romance', 'Thriller', 'Fantasy', 'Science Fiction', 'Mystery',
        'Horror', 'Literary Fiction', 'Historical Fiction', 'Adventure',
        'Young Adult', 'Children', 'Biography', 'Comedy', 'Drama',
        'Western', 'Crime', 'Supernatural', 'Dystopian', 'Contemporary', 'Erotic'
      ])
      .withMessage('Invalid genre'),
    body('targetWordCount')
      .optional()
      .isInt({ min: 1000, max: 500000 })
      .withMessage('Target word count must be between 1,000 and 500,000'),
    body('targetChapters')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Target chapters must be between 1 and 100'),
    body('setting')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Setting must be less than 500 characters'),
    body('style')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Style must be less than 500 characters'),
    body('themes')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Themes must be an array with maximum 10 items')
  ],

  updateStory: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Description must be between 1 and 2000 characters'),
    body('genre')
      .optional()
      .isIn([
        'Romance', 'Thriller', 'Fantasy', 'Science Fiction', 'Mystery',
        'Horror', 'Literary Fiction', 'Historical Fiction', 'Adventure',
        'Young Adult', 'Children', 'Biography', 'Comedy', 'Drama',
        'Western', 'Crime', 'Supernatural', 'Dystopian', 'Contemporary', 'Erotic'
      ])
      .withMessage('Invalid genre'),
    body('targetWordCount')
      .optional()
      .isInt({ min: 1000, max: 500000 })
      .withMessage('Target word count must be between 1,000 and 500,000'),
    body('targetChapters')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Target chapters must be between 1 and 100'),
    body('status')
      .optional()
      .isIn(['planning', 'planned', 'generating', 'generated', 'published', 'archived', 'cancelled'])
      .withMessage('Invalid status')
  ],

  generatePlan: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Description must be between 1 and 2000 characters'),
    body('genre')
      .isIn([
        'Romance', 'Thriller', 'Fantasy', 'Science Fiction', 'Mystery',
        'Horror', 'Literary Fiction', 'Historical Fiction', 'Adventure',
        'Young Adult', 'Children', 'Biography', 'Comedy', 'Drama',
        'Western', 'Crime', 'Supernatural', 'Dystopian', 'Contemporary', 'Erotic'
      ])
      .withMessage('Invalid genre'),
    body('targetChapters')
      .isInt({ min: 1, max: 100 })
      .withMessage('Target chapters must be between 1 and 100')
  ],

  // AI Configuration validation
  createAIConfig: [
    body('provider')
      .isIn(['openai', 'anthropic', 'google'])
      .withMessage('Provider must be openai, anthropic, or google'),
    body('model')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Model name is required and must be less than 100 characters'),
    body('apiKey')
      .trim()
      .isLength({ min: 10 })
      .withMessage('API key must be at least 10 characters'),
    body('maxTokens')
      .optional()
      .isInt({ min: 100, max: 100000 })
      .withMessage('Max tokens must be between 100 and 100,000'),
    body('temperature')
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage('Temperature must be between 0 and 2'),
    body('topP')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Top P must be between 0 and 1')
  ],

  updateAIConfig: [
    body('model')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Model name must be less than 100 characters'),
    body('apiKey')
      .optional()
      .trim()
      .isLength({ min: 10 })
      .withMessage('API key must be at least 10 characters'),
    body('maxTokens')
      .optional()
      .isInt({ min: 100, max: 100000 })
      .withMessage('Max tokens must be between 100 and 100,000'),
    body('temperature')
      .optional()
      .isFloat({ min: 0, max: 2 })
      .withMessage('Temperature must be between 0 and 2'),
    body('topP')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Top P must be between 0 and 1')
  ],

  // Export validation
  exportStory: [
    body('format')
      .isIn(['pdf', 'epub', 'docx', 'markdown'])
      .withMessage('Format must be pdf, epub, docx, or markdown'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],

  // Generation validation
  generateChapter: [
    body('contextChapters')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Context chapters must be between 0 and 10'),
    body('regenerate')
      .optional()
      .isBoolean()
      .withMessage('Regenerate must be a boolean')
  ],

  generateStory: [
    body('startFromChapter')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Start from chapter must be between 1 and 100'),
    body('maxChapters')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Max chapters must be between 1 and 100'),
    body('contextChapters')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Context chapters must be between 0 and 10')
  ],

  reviseChapter: [
    body('feedback')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Feedback must be between 1 and 1000 characters')
  ],

  // Search and filter validation
  searchStories: [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('genre')
      .optional()
      .isIn([
        'Romance', 'Thriller', 'Fantasy', 'Science Fiction', 'Mystery',
        'Horror', 'Literary Fiction', 'Historical Fiction', 'Adventure',
        'Young Adult', 'Children', 'Biography', 'Comedy', 'Drama',
        'Western', 'Crime', 'Supernatural', 'Dystopian', 'Contemporary', 'Erotic'
      ])
      .withMessage('Invalid genre'),
    query('status')
      .optional()
      .isIn(['planning', 'planned', 'generating', 'generated', 'published', 'archived', 'cancelled'])
      .withMessage('Invalid status'),
    query('sortBy')
      .optional()
      .isIn(['title', 'createdAt', 'updatedAt', 'wordCount'])
      .withMessage('Sort by must be title, createdAt, updatedAt, or wordCount'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ]
};

/**
 * Rate limiting validation
 */
export const rateLimitValidation = {
  // Strict limits for resource-intensive operations
  generation: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many generation requests. Please try again later.'
    }
  },

  // Moderate limits for API calls
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many API requests. Please try again later.'
    }
  },

  // Lenient limits for authentication
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per 15 minutes
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many authentication attempts. Please try again later.'
    }
  }
};