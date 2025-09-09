import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: GET /api/v1/chapters/{id}', () => {
  const validChapterId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidChapterId = 'invalid-uuid';
  const nonExistentChapterId = '550e8400-e29b-41d4-a716-446655440999';

  describe('Request/Response Schema Validation', () => {
    it('should return detailed chapter information', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      // Response should match OpenAPI schema for ChapterResponse
      expect(response.body).toHaveProperty('id', validChapterId);
      expect(response.body).toHaveProperty('chapterNumber');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('wordCount');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('qualityMetrics');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Data type validations
      expect(typeof response.body.chapterNumber).toBe('number');
      expect(typeof response.body.title).toBe('string');
      expect(typeof response.body.content).toBe('string');
      expect(typeof response.body.wordCount).toBe('number');
      expect(typeof response.body.status).toBe('string');
      expect(typeof response.body.qualityMetrics).toBe('object');

      // Number validations
      expect(response.body.chapterNumber).toBeGreaterThan(0);
      expect(response.body.wordCount).toBeGreaterThanOrEqual(0);

      // Status enum validation
      expect(['planned', 'generating', 'generated', 'revised']).toContain(response.body.status);

      // Timestamp validations
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should include quality metrics for generated chapters', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'generated' || response.body.status === 'revised') {
        expect(response.body.qualityMetrics).toHaveProperty('readabilityScore');
        expect(response.body.qualityMetrics).toHaveProperty('coherenceScore');
        expect(response.body.qualityMetrics).toHaveProperty('sentimentScore');
        expect(response.body.qualityMetrics).toHaveProperty('vocabularyDiversity');
        
        // Validate metric ranges
        expect(response.body.qualityMetrics.readabilityScore).toBeGreaterThanOrEqual(0);
        expect(response.body.qualityMetrics.readabilityScore).toBeLessThanOrEqual(100);
        expect(response.body.qualityMetrics.coherenceScore).toBeGreaterThanOrEqual(0);
        expect(response.body.qualityMetrics.coherenceScore).toBeLessThanOrEqual(100);
        expect(response.body.qualityMetrics.sentimentScore).toBeGreaterThanOrEqual(-1);
        expect(response.body.qualityMetrics.sentimentScore).toBeLessThanOrEqual(1);
        expect(response.body.qualityMetrics.vocabularyDiversity).toBeGreaterThan(0);
      }
    });

    it('should handle different chapter statuses correctly', async () => {
      const statusTests = [
        { status: 'planned', shouldHaveContent: false },
        { status: 'generating', shouldHaveContent: false },
        { status: 'generated', shouldHaveContent: true },
        { status: 'revised', shouldHaveContent: true }
      ];

      for (const { status, shouldHaveContent } of statusTests) {
        const response = await request(app)
          .get(`/api/v1/chapters/${validChapterId}`)
          .expect(200);

        expect(response.body.status).toBe(status);
        
        if (shouldHaveContent) {
          expect(response.body.content).toBeTruthy();
          expect(response.body.wordCount).toBeGreaterThan(0);
        } else if (status === 'planned') {
          expect(response.body.content).toBe('');
          expect(response.body.wordCount).toBe(0);
        }
      }
    });

    it('should return chapter content with proper formatting', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.content) {
        // Content should be a string
        expect(typeof response.body.content).toBe('string');
        
        // Should not contain HTML tags (plain text or markdown)
        expect(response.body.content).not.toMatch(/<[^>]+>/);
        
        // Word count should be reasonably accurate
        const estimatedWordCount = response.body.content.split(/\s+/).length;
        const actualWordCount = response.body.wordCount;
        const tolerance = Math.max(10, actualWordCount * 0.1); // 10% tolerance
        
        expect(Math.abs(estimatedWordCount - actualWordCount)).toBeLessThan(tolerance);
      }
    });

    it('should reject invalid chapter ID format', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${invalidChapterId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should return 404 for non-existent chapter', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${nonExistentChapterId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toMatch(/chapter.*not.*found/i);
    });
  });

  describe('Content Access Control', () => {
    it('should show full content for generated chapters', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'generated' || response.body.status === 'revised') {
        expect(response.body.content).toBeTruthy();
        expect(response.body.content.length).toBeGreaterThan(100); // Should have substantial content
      }
    });

    it('should show placeholder for planned chapters', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'planned') {
        expect(response.body.content).toBe('');
        expect(response.body.wordCount).toBe(0);
        expect(response.body).toHaveProperty('title'); // Should still have planning info
      }
    });

    it('should show partial content for generating chapters', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'generating') {
        // May have partial content or none
        expect(typeof response.body.content).toBe('string');
        expect(response.body.wordCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Story Context Integration', () => {
    it('should include story context information', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'story' })
        .expect(200);

      expect(response.body).toHaveProperty('story');
      expect(response.body.story).toHaveProperty('id');
      expect(response.body.story).toHaveProperty('title');
      expect(response.body.story).toHaveProperty('status');
    });

    it('should validate chapter belongs to accessible story', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      expect(response.body).toHaveProperty('chapterNumber');
      expect(response.body.chapterNumber).toBeGreaterThan(0);
    });

    it('should include navigation information', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'navigation' })
        .expect(200);

      if (response.body.chapterNumber > 1) {
        expect(response.body).toHaveProperty('previousChapter');
      }
      
      // May have next chapter if not the last
      if (response.body.nextChapter) {
        expect(response.body.nextChapter).toHaveProperty('id');
        expect(response.body.nextChapter).toHaveProperty('title');
      }
    });
  });

  describe('Query Parameters', () => {
    it('should support include parameter for related data', async () => {
      const includeOptions = ['story', 'navigation', 'characters', 'revisions'];
      
      for (const include of includeOptions) {
        const response = await request(app)
          .get(`/api/v1/chapters/${validChapterId}`)
          .query({ include })
          .expect(200);

        expect(response.body).toHaveProperty('id');
        // Related data should be included based on the parameter
      }
    });

    it('should support multiple include values', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'story,navigation,characters' })
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject invalid include values', async () => {
      await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'invalid_relation' })
        .expect(400);
    });

    it('should support content format parameter', async () => {
      const formats = ['plain', 'markdown', 'html'];
      
      for (const format of formats) {
        const response = await request(app)
          .get(`/api/v1/chapters/${validChapterId}`)
          .query({ format })
          .expect(200);

        expect(response.body).toHaveProperty('content');
        
        if (format === 'html' && response.body.content) {
          expect(response.body.content).toMatch(/<[^>]+>/); // Should contain HTML tags
        }
      }
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);
    });

    it('should reject access to chapters from stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body.error.message).toMatch(/access.*denied/i);
    });
  });

  describe('Content Type Requirements', () => {
    it('should return application/json response', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle accept header preferences', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${invalidChapterId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });

    it('should return standard error format for not found errors', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${nonExistentChapterId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for forbidden requests', async () => {
      const otherUserToken = 'other-user-jwt-token';
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);
      const endTime = Date.now();

      // Should respond within 1 second for single chapter retrieval
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle large chapter content efficiently', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);
      const endTime = Date.now();

      // Even large chapters should load quickly
      expect(endTime - startTime).toBeLessThan(2000);
      
      if (response.body.content) {
        expect(response.body.content.length).toBeDefined();
      }
    });
  });

  describe('Caching and Optimization', () => {
    it('should include appropriate cache headers for generated content', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'generated') {
        // Generated content can be cached
        expect(response.headers).toHaveProperty('cache-control');
        expect(response.headers['cache-control']).toMatch(/max-age=/);
      }
    });

    it('should not cache generating content', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.status === 'generating') {
        expect(response.headers['cache-control']).toMatch(/no-cache|max-age=0/);
      }
    });

    it('should support conditional requests with ETags', async () => {
      const response1 = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response1.headers.etag) {
        const response2 = await request(app)
          .get(`/api/v1/chapters/${validChapterId}`)
          .set('If-None-Match', response1.headers.etag)
          .expect(304);

        expect(response2.body).toEqual({});
      }
    });
  });

  describe('Content Analysis', () => {
    it('should provide accurate word count for content', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .expect(200);

      if (response.body.content && response.body.wordCount > 0) {
        const contentWords = response.body.content.trim().split(/\s+/).filter(word => word.length > 0);
        const reportedWordCount = response.body.wordCount;
        
        // Word count should be within reasonable tolerance
        const tolerance = Math.max(5, reportedWordCount * 0.05); // 5% tolerance
        expect(Math.abs(contentWords.length - reportedWordCount)).toBeLessThan(tolerance);
      }
    });

    it('should include character count information', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'stats' })
        .expect(200);

      if (response.body.content) {
        expect(response.body).toHaveProperty('characterCount');
        expect(response.body.characterCount).toBe(response.body.content.length);
      }
    });

    it('should calculate reading time estimate', async () => {
      const response = await request(app)
        .get(`/api/v1/chapters/${validChapterId}`)
        .query({ include: 'stats' })
        .expect(200);

      if (response.body.wordCount > 0) {
        expect(response.body).toHaveProperty('estimatedReadingTime');
        expect(response.body.estimatedReadingTime).toBeGreaterThan(0);
        
        // Reading time should be reasonable (250 words per minute average)
        const expectedMinutes = Math.ceil(response.body.wordCount / 250);
        const tolerance = Math.max(1, expectedMinutes * 0.2);
        expect(Math.abs(response.body.estimatedReadingTime - expectedMinutes)).toBeLessThan(tolerance);
      }
    });
  });
});