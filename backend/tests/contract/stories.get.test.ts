import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: GET /api/v1/stories/{id}', () => {
  const validStoryId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoryId = 'invalid-uuid';
  const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440999';

  describe('Request/Response Schema Validation', () => {
    it('should return detailed story information', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .expect(200);

      // Response should match OpenAPI schema for StoryDetailResponse
      expect(response.body).toHaveProperty('id', validStoryId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('premise');
      expect(response.body).toHaveProperty('genre');
      expect(response.body).toHaveProperty('subgenre');
      expect(response.body).toHaveProperty('targetLength');
      expect(response.body).toHaveProperty('actualLength');
      expect(response.body).toHaveProperty('targetAgeGroup');
      expect(response.body).toHaveProperty('contentRating');
      expect(response.body).toHaveProperty('readingLevel');
      expect(response.body).toHaveProperty('themes');
      expect(response.body).toHaveProperty('tone');
      expect(response.body).toHaveProperty('writingStyle');
      expect(response.body).toHaveProperty('pov');
      expect(response.body).toHaveProperty('tense');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Data type validations
      expect(typeof response.body.title).toBe('string');
      expect(typeof response.body.premise).toBe('string');
      expect(typeof response.body.genre).toBe('string');
      expect(typeof response.body.targetLength).toBe('number');
      expect(typeof response.body.actualLength).toBe('number');
      expect(Array.isArray(response.body.themes)).toBe(true);

      // Enum validations
      expect(['draft', 'planning', 'generating', 'complete', 'archived']).toContain(response.body.status);
      expect(['Children', 'YA', 'Adult']).toContain(response.body.targetAgeGroup);
      expect(['G', 'PG', 'PG-13', 'R']).toContain(response.body.contentRating);
      expect(['First', 'Third Limited', 'Omniscient']).toContain(response.body.pov);
      expect(['Past', 'Present']).toContain(response.body.tense);

      // Timestamp validations
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should include related data when available', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .expect(200);

      // Should include chapters array (may be empty for new stories)
      expect(response.body).toHaveProperty('chapters');
      expect(Array.isArray(response.body.chapters)).toBe(true);

      // Should include characters array (may be empty)
      expect(response.body).toHaveProperty('characters');
      expect(Array.isArray(response.body.characters)).toBe(true);

      // Should include plan if story has been planned
      if (response.body.status !== 'draft') {
        expect(response.body).toHaveProperty('plan');
        if (response.body.plan) {
          expect(response.body.plan).toHaveProperty('totalChapters');
          expect(response.body.plan).toHaveProperty('actStructure');
          expect(response.body.plan).toHaveProperty('approved');
        }
      }

      // Validate chapter structure if chapters exist
      if (response.body.chapters.length > 0) {
        const chapter = response.body.chapters[0];
        expect(chapter).toHaveProperty('id');
        expect(chapter).toHaveProperty('number');
        expect(chapter).toHaveProperty('title');
        expect(chapter).toHaveProperty('status');
        expect(chapter).toHaveProperty('wordCount');
        expect(chapter.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }

      // Validate character structure if characters exist
      if (response.body.characters.length > 0) {
        const character = response.body.characters[0];
        expect(character).toHaveProperty('id');
        expect(character).toHaveProperty('name');
        expect(character).toHaveProperty('role');
        expect(character).toHaveProperty('description');
        expect(character.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }
    });

    it('should reject invalid story ID format', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${invalidStoryId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should return 404 for non-existent story', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${nonExistentStoryId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error.message).toMatch(/story.*not.*found/i);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);
    });

    it('should reject access to stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
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
        .get(`/api/v1/stories/${validStoryId}`);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Query Parameters', () => {
    it('should accept include parameter for related data', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .query({ include: 'chapters,characters,plan' })
        .expect(200);

      expect(response.body).toHaveProperty('chapters');
      expect(response.body).toHaveProperty('characters');
      expect(response.body).toHaveProperty('plan');
    });

    it('should reject invalid include parameter values', async () => {
      await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .query({ include: 'invalid_relation' })
        .expect(400);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${invalidStoryId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });

    it('should return standard error format for not found errors', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${nonExistentStoryId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for forbidden requests', async () => {
      const otherUserToken = 'other-user-jwt-token';
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}`)
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
        .get(`/api/v1/stories/${validStoryId}`)
        .expect(200);
      const endTime = Date.now();

      // Should respond within 1 second for single story retrieval
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});