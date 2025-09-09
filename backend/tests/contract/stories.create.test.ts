import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: POST /api/v1/stories', () => {
  const validStoryData = {
    title: 'My Test Story',
    premise: 'A story about testing APIs and creating amazing applications.',
    genre: 'Fantasy',
    subgenre: 'Epic Fantasy',
    targetLength: 50000,
    targetAgeGroup: 'Adult',
    contentRating: 'PG-13',
    readingLevel: 'Advanced',
    themes: ['Adventure', 'Friendship'],
    tone: 'Dramatic',
    writingStyle: 'Descriptive',
    pov: 'Third Limited',
    tense: 'Past',
  };

  describe('Request/Response Schema Validation', () => {
    it('should accept valid story creation request', async () => {
      const response = await request(app)
        .post('/api/v1/stories')
        .send(validStoryData)
        .expect(201);

      // Response should match OpenAPI schema
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', validStoryData.title);
      expect(response.body).toHaveProperty('premise', validStoryData.premise);
      expect(response.body).toHaveProperty('genre', validStoryData.genre);
      expect(response.body).toHaveProperty('targetLength', validStoryData.targetLength);
      expect(response.body).toHaveProperty('status', 'draft');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      
      // ID should be UUID format
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Timestamps should be ISO strings
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should reject request with missing required fields', async () => {
      const invalidData = {
        title: 'Test Story',
        // Missing premise, genre, targetLength
      };

      const response = await request(app)
        .post('/api/v1/stories')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('details');
    });

    it('should reject request with invalid field types', async () => {
      const invalidData = {
        ...validStoryData,
        targetLength: 'not a number', // Should be integer
        themes: 'not an array', // Should be array
      };

      await request(app)
        .post('/api/v1/stories')
        .send(invalidData)
        .expect(400);
    });

    it('should reject request with invalid enum values', async () => {
      const invalidData = {
        ...validStoryData,
        genre: 'InvalidGenre',
        pov: 'InvalidPOV',
        tense: 'InvalidTense',
      };

      await request(app)
        .post('/api/v1/stories')
        .send(invalidData)
        .expect(400);
    });

    it('should reject request with targetLength out of bounds', async () => {
      const tooShort = {
        ...validStoryData,
        targetLength: 50, // Below minimum
      };

      await request(app)
        .post('/api/v1/stories')
        .send(tooShort)
        .expect(400);

      const tooLong = {
        ...validStoryData,
        targetLength: 600000, // Above maximum
      };

      await request(app)
        .post('/api/v1/stories')
        .send(tooLong)
        .expect(400);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/stories')
        .send(validStoryData)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      // This test assumes JWT token authentication
      // Will be implemented when auth middleware is created
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .post('/api/v1/stories')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validStoryData)
        .expect(201);
    });
  });

  describe('Content Type Requirements', () => {
    it('should require application/json content type', async () => {
      await request(app)
        .post('/api/v1/stories')
        .send('not json')
        .expect(400);
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post('/api/v1/stories')
        .send(validStoryData);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/stories')
        .send({})
        .expect(400);

      // Standard error response format per OpenAPI spec
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .post('/api/v1/stories')
        .send(validStoryData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});