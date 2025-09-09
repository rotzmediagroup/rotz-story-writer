import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: POST /api/v1/stories/{id}/generate', () => {
  const validStoryId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoryId = 'invalid-uuid';
  const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440999';

  const validGenerateRequest = {
    startChapter: 1,
    endChapter: 5,
    pauseOnError: false,
    customInstructions: 'Focus on character development in these chapters'
  };

  describe('Request/Response Schema Validation', () => {
    it('should accept valid generation request and start job', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(202);

      // Response should match OpenAPI schema for GenerationJobResponse
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progressUrl');
      expect(response.body).toHaveProperty('estimatedTime');

      // Data type validations
      expect(response.body.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(['queued', 'processing', 'completed', 'failed']).toContain(response.body.status);
      expect(typeof response.body.progressUrl).toBe('string');
      expect(typeof response.body.estimatedTime).toBe('number');
      expect(response.body.estimatedTime).toBeGreaterThan(0);

      // Progress URL should be properly formatted
      expect(response.body.progressUrl).toMatch(/^https?:\/\/.+\/api\/v1\/stories\/.+\/progress$/);
    });

    it('should accept minimal generation request with defaults', async () => {
      const minimalRequest = {};

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(minimalRequest)
        .expect(202);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progressUrl');
      expect(response.body).toHaveProperty('estimatedTime');
    });

    it('should accept partial chapter range', async () => {
      const partialRequest = {
        startChapter: 3,
        endChapter: 7,
        pauseOnError: true
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(partialRequest)
        .expect(202);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.estimatedTime).toBeGreaterThan(0);
    });

    it('should reject invalid story ID format', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should reject invalid chapter ranges', async () => {
      const invalidRanges = [
        { startChapter: 0, endChapter: 5 }, // Start chapter too low
        { startChapter: -1, endChapter: 5 }, // Negative start
        { startChapter: 5, endChapter: 3 }, // End before start
        { startChapter: 'not_a_number', endChapter: 5 }, // Invalid type
        { startChapter: 1, endChapter: 1000 } // End chapter too high
      ];

      for (const invalidRange of invalidRanges) {
        await request(app)
          .post(`/api/v1/stories/${validStoryId}/generate`)
          .send({ ...validGenerateRequest, ...invalidRange })
          .expect(400);
      }
    });

    it('should return 404 for non-existent story', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${nonExistentStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toMatch(/story.*not.*found/i);
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject generation for stories without approved plan', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'PLAN_NOT_APPROVED');
      expect(response.body.error.message).toMatch(/plan.*not.*approved/i);
    });

    it('should return conflict if generation already in progress', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'GENERATION_IN_PROGRESS');
      expect(response.body.error.message).toMatch(/generation.*already.*progress/i);
    });

    it('should validate chapter range against story plan', async () => {
      const invalidRequest = {
        startChapter: 1,
        endChapter: 50 // Exceeds planned chapters
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'CHAPTER_RANGE_INVALID');
      expect(response.body.error.message).toMatch(/chapter.*range.*exceeds.*plan/i);
    });

    it('should allow resuming generation from specific chapter', async () => {
      const resumeRequest = {
        startChapter: 3, // Resume from chapter 3
        endChapter: 10
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(resumeRequest)
        .expect(202);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.status).toBe('queued');
    });

    it('should validate AI configuration exists and is active', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AI_CONFIG_INVALID');
      expect(response.body.error.message).toMatch(/ai.*configuration.*not.*available/i);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validGenerateRequest)
        .expect(202);
    });

    it('should reject access to stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(validGenerateRequest)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Content Type Requirements', () => {
    it('should require application/json content type', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send('not json')
        .expect(400);
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for business logic errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'GENERATION_IN_PROGRESS');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time for job creation', async () => {
      const startTime = Date.now();
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(202);
      const endTime = Date.now();

      // Job creation should be fast (under 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should provide accurate time estimates', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send({ startChapter: 1, endChapter: 3 })
        .expect(202);

      expect(response.body.estimatedTime).toBeGreaterThan(0);
      expect(response.body.estimatedTime).toBeLessThan(300); // Should be under 5 hours for small stories
    });
  });

  describe('AI Integration Requirements', () => {
    it('should handle AI service failures gracefully', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'AI_SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/ai.*service.*unavailable/i);
    });

    it('should handle AI service rate limits', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(429);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(response.headers).toHaveProperty('retry-after');
    });

    it('should validate custom instructions length', async () => {
      const longInstructions = 'a'.repeat(5000); // Assuming max is 1000 chars
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send({ ...validGenerateRequest, customInstructions: longInstructions })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Queue Management', () => {
    it('should handle queue capacity limits', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'QUEUE_FULL');
      expect(response.body.error.message).toMatch(/queue.*full/i);
      expect(response.headers).toHaveProperty('retry-after');
    });

    it('should provide job priority information', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/generate`)
        .send(validGenerateRequest)
        .expect(202);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'queued');
    });
  });
});