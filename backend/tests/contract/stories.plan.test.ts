import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: POST /api/v1/stories/{id}/plan', () => {
  const validStoryId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoryId = 'invalid-uuid';
  const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440999';

  const validPlanRequest = {
    regenerate: false,
    preferences: {
      plotComplexity: 'moderate',
      characterDevelopment: 'detailed',
      pacing: 'steady',
      conflictStyle: 'internal_external',
      narrativeStructure: 'three_act'
    }
  };

  describe('Request/Response Schema Validation', () => {
    it('should accept valid plan generation request', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(201);

      // Response should match OpenAPI schema for StoryPlanResponse
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('storyId', validStoryId);
      expect(response.body).toHaveProperty('totalChapters');
      expect(response.body).toHaveProperty('actStructure');
      expect(response.body).toHaveProperty('chapterSummaries');
      expect(response.body).toHaveProperty('storyArc');
      expect(response.body).toHaveProperty('thematicProgression');
      expect(response.body).toHaveProperty('pacingMap');
      expect(response.body).toHaveProperty('estimatedGenerationTime');
      expect(response.body).toHaveProperty('approved', false); // Default false
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Data type validations
      expect(typeof response.body.totalChapters).toBe('number');
      expect(typeof response.body.actStructure).toBe('object');
      expect(Array.isArray(response.body.chapterSummaries)).toBe(true);
      expect(typeof response.body.storyArc).toBe('object');
      expect(typeof response.body.estimatedGenerationTime).toBe('number');
      expect(typeof response.body.approved).toBe('boolean');

      // ID should be UUID format
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Chapter summaries validation
      if (response.body.chapterSummaries.length > 0) {
        const summary = response.body.chapterSummaries[0];
        expect(summary).toHaveProperty('chapterNumber');
        expect(summary).toHaveProperty('title');
        expect(summary).toHaveProperty('summary');
        expect(summary).toHaveProperty('keyEvents');
        expect(typeof summary.chapterNumber).toBe('number');
        expect(typeof summary.title).toBe('string');
        expect(Array.isArray(summary.keyEvents)).toBe(true);
      }

      // Act structure validation
      expect(response.body.actStructure).toHaveProperty('acts');
      expect(Array.isArray(response.body.actStructure.acts)).toBe(true);
      if (response.body.actStructure.acts.length > 0) {
        const act = response.body.actStructure.acts[0];
        expect(act).toHaveProperty('number');
        expect(act).toHaveProperty('title');
        expect(act).toHaveProperty('startChapter');
        expect(act).toHaveProperty('endChapter');
        expect(act).toHaveProperty('purpose');
      }

      // Timestamps validation
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should accept minimal request with defaults', async () => {
      const minimalRequest = {
        regenerate: false
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(minimalRequest)
        .expect(201);

      expect(response.body).toHaveProperty('totalChapters');
      expect(response.body).toHaveProperty('actStructure');
      expect(response.body).toHaveProperty('approved', false);
    });

    it('should handle regenerate flag correctly', async () => {
      const regenerateRequest = {
        ...validPlanRequest,
        regenerate: true
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(regenerateRequest)
        .expect(201);

      expect(response.body).toHaveProperty('storyId', validStoryId);
    });

    it('should reject request with invalid story ID format', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/plan`)
        .send(validPlanRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should reject request with invalid preferences', async () => {
      const invalidRequest = {
        ...validPlanRequest,
        preferences: {
          plotComplexity: 'invalid_complexity', // Invalid enum
          characterDevelopment: 123, // Should be string
          pacing: null // Should be string
        }
      };

      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should return 404 for non-existent story', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${nonExistentStoryId}/plan`)
        .send(validPlanRequest)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toMatch(/story.*not.*found/i);
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject planning for already complete story', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(409); // Conflict

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_STATE');
      expect(response.body.error.message).toMatch(/story.*already.*complete/i);
    });

    it('should allow re-planning draft stories', async () => {
      // Assuming story is in draft state
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(201);
    });

    it('should validate target length compatibility', async () => {
      // Test that very short target lengths generate appropriate chapter counts
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(201);

      expect(response.body.totalChapters).toBeGreaterThan(0);
      expect(response.body.estimatedGenerationTime).toBeGreaterThan(0);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validPlanRequest)
        .expect(201);
    });

    it('should reject access to stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(validPlanRequest)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Content Type Requirements', () => {
    it('should require application/json content type', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send('not json')
        .expect(400);
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/plan`)
        .send(validPlanRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for business logic errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_STATE');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time for planning', async () => {
      const startTime = Date.now();
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(201);
      const endTime = Date.now();

      // Planning can take longer but should complete within 30 seconds
      expect(endTime - startTime).toBeLessThan(30000);
    });
  });

  describe('AI Integration Requirements', () => {
    it('should handle AI service failures gracefully', async () => {
      // This test assumes AI service is unavailable
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(503); // Service Unavailable

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AI_SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/ai.*service.*unavailable/i);
    });

    it('should handle AI service rate limits', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/plan`)
        .send(validPlanRequest)
        .expect(429); // Too Many Requests

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(response.headers).toHaveProperty('retry-after');
    });
  });
});