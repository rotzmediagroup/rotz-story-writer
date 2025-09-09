import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: GET /api/v1/stories', () => {
  describe('Request/Response Schema Validation', () => {
    it('should return paginated list of stories', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .expect(200);

      // Response should match OpenAPI schema for StoriesListResponse
      expect(response.body).toHaveProperty('stories');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.stories)).toBe(true);

      // Pagination schema
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(typeof response.body.pagination.total).toBe('number');
      expect(typeof response.body.pagination.page).toBe('number');
      expect(typeof response.body.pagination.limit).toBe('number');
      expect(typeof response.body.pagination.totalPages).toBe('number');

      // Each story should have required fields
      if (response.body.stories.length > 0) {
        const story = response.body.stories[0];
        expect(story).toHaveProperty('id');
        expect(story).toHaveProperty('title');
        expect(story).toHaveProperty('premise');
        expect(story).toHaveProperty('genre');
        expect(story).toHaveProperty('status');
        expect(story).toHaveProperty('createdAt');
        expect(story).toHaveProperty('updatedAt');

        // ID should be UUID format
        expect(story.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        
        // Status should be valid enum
        expect(['draft', 'planning', 'generating', 'complete', 'archived']).toContain(story.status);
      }
    });

    it('should accept valid query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .query({
          status: 'draft',
          genre: 'Fantasy',
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body).toHaveProperty('stories');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should apply limit parameter correctly', async () => {
      const limit = 5;
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ limit })
        .expect(200);

      expect(response.body.pagination.limit).toBe(limit);
      expect(response.body.stories.length).toBeLessThanOrEqual(limit);
    });

    it('should apply offset parameter correctly', async () => {
      const offset = 10;
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ offset })
        .expect(200);

      expect(response.body.pagination.page).toBeGreaterThan(0);
    });

    it('should reject invalid status parameter', async () => {
      await request(app)
        .get('/api/v1/stories')
        .query({ status: 'invalid_status' })
        .expect(400);
    });

    it('should reject invalid limit parameter', async () => {
      await request(app)
        .get('/api/v1/stories')
        .query({ limit: 0 })
        .expect(400);

      await request(app)
        .get('/api/v1/stories')
        .query({ limit: 150 }) // Above maximum
        .expect(400);

      await request(app)
        .get('/api/v1/stories')
        .query({ limit: 'not_a_number' })
        .expect(400);
    });

    it('should reject invalid offset parameter', async () => {
      await request(app)
        .get('/api/v1/stories')
        .query({ offset: -1 })
        .expect(400);

      await request(app)
        .get('/api/v1/stories')
        .query({ offset: 'not_a_number' })
        .expect(400);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/stories')
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .get('/api/v1/stories')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ status: 'complete' })
        .expect(200);

      // All returned stories should have 'complete' status
      response.body.stories.forEach((story: any) => {
        expect(story.status).toBe('complete');
      });
    });

    it('should filter by genre', async () => {
      const genre = 'Fantasy';
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ genre })
        .expect(200);

      // All returned stories should have the specified genre
      response.body.stories.forEach((story: any) => {
        expect(story.genre).toBe(genre);
      });
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ 
          status: 'draft',
          genre: 'Romance'
        })
        .expect(200);

      response.body.stories.forEach((story: any) => {
        expect(story.status).toBe('draft');
        expect(story.genre).toBe('Romance');
      });
    });
  });

  describe('Content Type Requirements', () => {
    it('should return application/json response', async () => {
      const response = await request(app)
        .get('/api/v1/stories');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .query({ limit: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .get('/api/v1/stories')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/api/v1/stories')
        .expect(200);
      const endTime = Date.now();

      // Should respond within 2 seconds for list endpoint
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});