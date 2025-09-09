import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: POST /api/v1/stories/{id}/export', () => {
  const validStoryId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoryId = 'invalid-uuid';
  const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440999';

  const validExportRequest = {
    format: 'pdf',
    options: {
      fontSize: 12,
      pageSize: 'A4',
      includeTableOfContents: true,
      includeMetadata: true
    }
  };

  describe('Request/Response Schema Validation', () => {
    it('should accept valid PDF export request', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      // Response should match OpenAPI schema for ExportJobResponse
      expect(response.body).toHaveProperty('exportId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('format');
      expect(response.body).toHaveProperty('estimatedTime');
      expect(response.body).toHaveProperty('downloadUrl');

      // Data type validations
      expect(response.body.exportId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(['pending', 'processing', 'complete', 'failed']).toContain(response.body.status);
      expect(['pdf', 'epub', 'docx', 'markdown']).toContain(response.body.format);
      expect(typeof response.body.estimatedTime).toBe('number');
      expect(response.body.estimatedTime).toBeGreaterThan(0);
      expect(typeof response.body.downloadUrl).toBe('string');
      expect(response.body.downloadUrl).toMatch(/^https?:\/\/.+\/exports\/.+\/download$/);
    });

    it('should accept EPUB export request with custom options', async () => {
      const epubRequest = {
        format: 'epub',
        options: {
          includeTableOfContents: true,
          includeMetadata: false,
          fontSize: 14
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(epubRequest)
        .expect(202);

      expect(response.body.format).toBe('epub');
      expect(response.body).toHaveProperty('exportId');
      expect(response.body).toHaveProperty('downloadUrl');
    });

    it('should accept DOCX export request', async () => {
      const docxRequest = {
        format: 'docx',
        options: {
          pageSize: 'Letter',
          fontSize: 11,
          includeTableOfContents: false,
          includeMetadata: true
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(docxRequest)
        .expect(202);

      expect(response.body.format).toBe('docx');
      expect(response.body).toHaveProperty('exportId');
    });

    it('should accept markdown export request', async () => {
      const markdownRequest = {
        format: 'markdown',
        options: {
          includeMetadata: true
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(markdownRequest)
        .expect(202);

      expect(response.body.format).toBe('markdown');
      expect(response.body.estimatedTime).toBeLessThan(60); // Markdown should be faster
    });

    it('should accept minimal export request with defaults', async () => {
      const minimalRequest = {
        format: 'pdf'
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(minimalRequest)
        .expect(202);

      expect(response.body.format).toBe('pdf');
      expect(response.body).toHaveProperty('exportId');
      expect(response.body).toHaveProperty('downloadUrl');
    });

    it('should reject missing format field', async () => {
      const invalidRequest = {
        options: {
          fontSize: 12
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toMatch(/format.*required/i);
    });

    it('should reject invalid export format', async () => {
      const invalidRequest = {
        format: 'invalid_format'
      };

      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should reject invalid story ID format', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should return 404 for non-existent story', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${nonExistentStoryId}/export`)
        .send(validExportRequest)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toMatch(/story.*not.*found/i);
    });
  });

  describe('Export Options Validation', () => {
    it('should validate fontSize ranges', async () => {
      const invalidFontSizes = [0, -1, 5, 100]; // Too small or too large

      for (const fontSize of invalidFontSizes) {
        const request_data = {
          format: 'pdf',
          options: { fontSize }
        };

        await request(app)
          .post(`/api/v1/stories/${validStoryId}/export`)
          .send(request_data)
          .expect(400);
      }
    });

    it('should validate pageSize options for PDF/DOCX', async () => {
      const validPageSizes = ['A4', 'A5', 'Letter', 'Legal'];
      
      for (const pageSize of validPageSizes) {
        const request_data = {
          format: 'pdf',
          options: { pageSize }
        };

        const response = await request(app)
          .post(`/api/v1/stories/${validStoryId}/export`)
          .send(request_data)
          .expect(202);

        expect(response.body).toHaveProperty('exportId');
      }
    });

    it('should reject invalid pageSize options', async () => {
      const invalidRequest = {
        format: 'pdf',
        options: {
          pageSize: 'InvalidSize'
        }
      };

      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should ignore pageSize for non-applicable formats', async () => {
      const request_data = {
        format: 'markdown',
        options: {
          pageSize: 'A4' // Should be ignored for markdown
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(request_data)
        .expect(202);

      expect(response.body.format).toBe('markdown');
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject export for incomplete stories', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'STORY_INCOMPLETE');
      expect(response.body.error.message).toMatch(/story.*not.*complete/i);
    });

    it('should allow export for complete stories', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.status).toBe('pending');
    });

    it('should handle duplicate export requests', async () => {
      // First request
      const response1 = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      // Duplicate request with same format
      const response2 = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(200); // Should return existing export

      expect(response2.body.exportId).toBe(response1.body.exportId);
      expect(response2.body).toHaveProperty('downloadUrl');
    });

    it('should create new export for different formats', async () => {
      // First request - PDF
      const response1 = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send({ format: 'pdf' })
        .expect(202);

      // Second request - EPUB (different format)
      const response2 = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send({ format: 'epub' })
        .expect(202);

      expect(response2.body.exportId).not.toBe(response1.body.exportId);
      expect(response2.body.format).toBe('epub');
    });

    it('should validate story has chapters before export', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NO_CONTENT_TO_EXPORT');
      expect(response.body.error.message).toMatch(/no.*content.*export/i);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validExportRequest)
        .expect(202);
    });

    it('should reject access to stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(validExportRequest)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Content Type Requirements', () => {
    it('should require application/json content type', async () => {
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send('not json')
        .expect(400);
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${invalidStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for business logic errors', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'STORY_INCOMPLETE');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time for export job creation', async () => {
      const startTime = Date.now();
      await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);
      const endTime = Date.now();

      // Export job creation should be fast (under 3 seconds)
      expect(endTime - startTime).toBeLessThan(3000);
    });

    it('should provide accurate time estimates for different formats', async () => {
      const formats = [
        { format: 'markdown', maxTime: 30 },
        { format: 'pdf', maxTime: 300 },
        { format: 'epub', maxTime: 180 },
        { format: 'docx', maxTime: 120 }
      ];

      for (const { format, maxTime } of formats) {
        const response = await request(app)
          .post(`/api/v1/stories/${validStoryId}/export`)
          .send({ format })
          .expect(202);

        expect(response.body.estimatedTime).toBeGreaterThan(0);
        expect(response.body.estimatedTime).toBeLessThan(maxTime);
      }
    });
  });

  describe('File Size and Quality Validation', () => {
    it('should handle large stories gracefully', async () => {
      // Assuming large story (>100k words)
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.estimatedTime).toBeGreaterThan(30); // Larger files take longer
    });

    it('should validate export file size limits', async () => {
      // Very large export that exceeds limits
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FILE_TOO_LARGE');
      expect(response.body.error.message).toMatch(/file.*too.*large/i);
    });
  });

  describe('Queue Management', () => {
    it('should handle export queue limits', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'EXPORT_QUEUE_FULL');
      expect(response.body.error.message).toMatch(/export.*queue.*full/i);
      expect(response.headers).toHaveProperty('retry-after');
    });

    it('should provide queue position information', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body.status).toBe('pending');
    });
  });

  describe('Export Service Integration', () => {
    it('should handle export service failures gracefully', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'EXPORT_SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/export.*service.*unavailable/i);
    });

    it('should validate export service capabilities', async () => {
      const unsupportedRequest = {
        format: 'pdf',
        options: {
          fontSize: 8,
          customTemplate: 'advanced_template' // Not supported
        }
      };

      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(unsupportedRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNSUPPORTED_OPTION');
    });
  });

  describe('Download URL Generation', () => {
    it('should generate secure download URLs', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      expect(response.body.downloadUrl).toMatch(/^https:\/\/.+\/exports\/[0-9a-f-]+\/download$/);
      expect(response.body.downloadUrl).not.toContain(validStoryId); // Should not expose story ID
    });

    it('should include expiration information', async () => {
      const response = await request(app)
        .post(`/api/v1/stories/${validStoryId}/export`)
        .send(validExportRequest)
        .expect(202);

      expect(response.body).toHaveProperty('downloadUrl');
      // URL should be accessible immediately after creation
      expect(response.body.downloadUrl).toBeTruthy();
    });
  });
});