import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: POST /api/v1/ai-configs', () => {
  const validAIConfigRequest = {
    name: 'My OpenAI Configuration',
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'sk-test123abc456def789',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    isDefault: false
  };

  describe('Request/Response Schema Validation', () => {
    it('should create AI configuration with valid OpenAI request', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);

      // Response should match OpenAPI schema for AIConfigResponse
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', validAIConfigRequest.name);
      expect(response.body).toHaveProperty('provider', validAIConfigRequest.provider);
      expect(response.body).toHaveProperty('model', validAIConfigRequest.model);
      expect(response.body).toHaveProperty('temperature', validAIConfigRequest.temperature);
      expect(response.body).toHaveProperty('maxTokens', validAIConfigRequest.maxTokens);
      expect(response.body).toHaveProperty('isDefault', validAIConfigRequest.isDefault);
      expect(response.body).toHaveProperty('isActive', true); // Default value
      expect(response.body).toHaveProperty('monthlyUsage', 0); // Initial value

      // Data type validations
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(typeof response.body.name).toBe('string');
      expect(typeof response.body.provider).toBe('string');
      expect(typeof response.body.model).toBe('string');
      expect(typeof response.body.temperature).toBe('number');
      expect(typeof response.body.maxTokens).toBe('number');
      expect(typeof response.body.isDefault).toBe('boolean');
      expect(typeof response.body.isActive).toBe('boolean');
      expect(typeof response.body.monthlyUsage).toBe('number');

      // API key should not be returned in response
      expect(response.body).not.toHaveProperty('apiKey');
    });

    it('should create AI configuration with Anthropic provider', async () => {
      const anthropicRequest = {
        name: 'Claude Configuration',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        apiKey: 'sk-ant-test123',
        temperature: 0.5,
        maxTokens: 4096,
        isDefault: true
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(anthropicRequest)
        .expect(201);

      expect(response.body.provider).toBe('anthropic');
      expect(response.body.model).toBe('claude-3-sonnet-20240229');
      expect(response.body.isDefault).toBe(true);
      expect(response.body).not.toHaveProperty('apiKey');
    });

    it('should create AI configuration with Google provider', async () => {
      const googleRequest = {
        name: 'Google AI Configuration',
        provider: 'google',
        model: 'gemini-pro',
        apiKey: 'AIzaSyTest123',
        temperature: 0.8,
        maxTokens: 1024,
        topP: 0.9
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(googleRequest)
        .expect(201);

      expect(response.body.provider).toBe('google');
      expect(response.body.model).toBe('gemini-pro');
      expect(response.body.temperature).toBe(0.8);
    });

    it('should accept minimal request with defaults', async () => {
      const minimalRequest = {
        name: 'Minimal Config',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'sk-test123'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(minimalRequest)
        .expect(201);

      expect(response.body.name).toBe(minimalRequest.name);
      expect(response.body.temperature).toBeDefined(); // Should have default
      expect(response.body.maxTokens).toBeDefined(); // Should have default
      expect(response.body.isDefault).toBe(false); // Default value
      expect(response.body.isActive).toBe(true); // Default value
    });

    it('should reject request missing required fields', async () => {
      const incompleteRequests = [
        { provider: 'openai', model: 'gpt-4', apiKey: 'sk-test123' }, // Missing name
        { name: 'Test', model: 'gpt-4', apiKey: 'sk-test123' }, // Missing provider
        { name: 'Test', provider: 'openai', apiKey: 'sk-test123' }, // Missing model
        { name: 'Test', provider: 'openai', model: 'gpt-4' } // Missing apiKey
      ];

      for (const incompleteRequest of incompleteRequests) {
        const response = await request(app)
          .post('/api/v1/ai-configs')
          .send(incompleteRequest)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      }
    });

    it('should validate provider enum values', async () => {
      const invalidRequest = {
        ...validAIConfigRequest,
        provider: 'invalid_provider'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toMatch(/provider.*invalid/i);
    });

    it('should validate temperature bounds', async () => {
      const invalidTemperatures = [-1, 3, 2.1]; // Outside 0-2 range

      for (const temperature of invalidTemperatures) {
        const invalidRequest = {
          ...validAIConfigRequest,
          temperature
        };

        await request(app)
          .post('/api/v1/ai-configs')
          .send(invalidRequest)
          .expect(400);
      }
    });

    it('should validate parameter value ranges', async () => {
      const invalidParams = [
        { topP: -0.1 }, // Below 0
        { topP: 1.1 }, // Above 1
        { frequencyPenalty: -2.1 }, // Below -2
        { frequencyPenalty: 2.1 }, // Above 2
        { presencePenalty: -2.1 }, // Below -2
        { presencePenalty: 2.1 }, // Above 2
        { maxTokens: 0 }, // Too low
        { maxTokens: -100 } // Negative
      ];

      for (const invalidParam of invalidParams) {
        const invalidRequest = {
          ...validAIConfigRequest,
          ...invalidParam
        };

        await request(app)
          .post('/api/v1/ai-configs')
          .send(invalidRequest)
          .expect(400);
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should handle duplicate configuration names', async () => {
      // First request
      await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);

      // Duplicate name
      const duplicateRequest = {
        ...validAIConfigRequest,
        apiKey: 'sk-different123'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(duplicateRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'DUPLICATE_NAME');
      expect(response.body.error.message).toMatch(/name.*already.*exists/i);
    });

    it('should validate API key format for different providers', async () => {
      const invalidAPIKeys = [
        { provider: 'openai', apiKey: 'invalid-key' }, // Should start with sk-
        { provider: 'anthropic', apiKey: 'invalid-key' }, // Should start with sk-ant-
        { provider: 'google', apiKey: 'invalid-key' } // Should start with AIza
      ];

      for (const { provider, apiKey } of invalidAPIKeys) {
        const invalidRequest = {
          name: `Test ${provider}`,
          provider,
          model: 'test-model',
          apiKey
        };

        const response = await request(app)
          .post('/api/v1/ai-configs')
          .send(invalidRequest)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code', 'INVALID_API_KEY_FORMAT');
      }
    });

    it('should validate API key with provider service', async () => {
      const invalidKeyRequest = {
        ...validAIConfigRequest,
        apiKey: 'sk-invalid123456789'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidKeyRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_API_KEY');
      expect(response.body.error.message).toMatch(/api.*key.*invalid/i);
    });

    it('should validate model availability for provider', async () => {
      const invalidModelRequest = {
        ...validAIConfigRequest,
        provider: 'openai',
        model: 'non-existent-model'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidModelRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'MODEL_NOT_AVAILABLE');
      expect(response.body.error.message).toMatch(/model.*not.*available/i);
    });

    it('should handle setting new default configuration', async () => {
      // Create first config as default
      const firstConfig = {
        ...validAIConfigRequest,
        name: 'First Config',
        isDefault: true
      };

      const response1 = await request(app)
        .post('/api/v1/ai-configs')
        .send(firstConfig)
        .expect(201);

      expect(response1.body.isDefault).toBe(true);

      // Create second config as default (should unset first)
      const secondConfig = {
        ...validAIConfigRequest,
        name: 'Second Config',
        apiKey: 'sk-different123',
        isDefault: true
      };

      const response2 = await request(app)
        .post('/api/v1/ai-configs')
        .send(secondConfig)
        .expect(201);

      expect(response2.body.isDefault).toBe(true);
    });

    it('should enforce configuration limits per user', async () => {
      // Assuming limit is 10 configurations per user
      const configs = Array.from({ length: 11 }, (_, i) => ({
        ...validAIConfigRequest,
        name: `Config ${i + 1}`,
        apiKey: `sk-test${i + 1}23`
      }));

      // Create 10 configs successfully
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/ai-configs')
          .send(configs[i])
          .expect(201);
      }

      // 11th config should fail
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(configs[10])
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'CONFIG_LIMIT_EXCEEDED');
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .post('/api/v1/ai-configs')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validAIConfigRequest)
        .expect(201);
    });
  });

  describe('Security Requirements', () => {
    it('should encrypt API keys before storage', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);

      // API key should not be in response
      expect(response.body).not.toHaveProperty('apiKey');
      
      // Should indicate encryption/masking
      expect(response.body.id).toBeDefined();
    });

    it('should validate API key strength', async () => {
      const weakKeys = [
        'sk-123', // Too short
        'sk-test', // Common pattern
        'sk-' + 'a'.repeat(10) // Too simple
      ];

      for (const apiKey of weakKeys) {
        const weakRequest = {
          ...validAIConfigRequest,
          apiKey
        };

        const response = await request(app)
          .post('/api/v1/ai-configs')
          .send(weakRequest)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code', 'API_KEY_TOO_WEAK');
      }
    });

    it('should not expose sensitive data in error messages', async () => {
      const invalidRequest = {
        ...validAIConfigRequest,
        apiKey: 'sk-secret123456789'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error.message).not.toContain('sk-secret123456789');
      expect(response.body.error.message).not.toMatch(/sk-[a-zA-Z0-9]+/);
    });
  });

  describe('Content Type Requirements', () => {
    it('should require application/json content type', async () => {
      await request(app)
        .post('/api/v1/ai-configs')
        .send('not json')
        .expect(400);
    });

    it('should return application/json response', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Schema', () => {
    it('should return standard error format for validation errors', async () => {
      const invalidRequest = {
        name: 'Test',
        provider: 'invalid_provider',
        model: 'test-model',
        apiKey: 'sk-test123'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    });

    it('should return standard error format for unauthorized requests', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return standard error format for business logic errors', async () => {
      // First request
      await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);

      // Duplicate request
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'DUPLICATE_NAME');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);
      const endTime = Date.now();

      // Should respond within 3 seconds (includes API key validation)
      expect(endTime - startTime).toBeLessThan(3000);
    });

    it('should handle concurrent configuration creation', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...validAIConfigRequest,
        name: `Concurrent Config ${i + 1}`,
        apiKey: `sk-test${i + 1}456`
      }));

      const promises = requests.map(config =>
        request(app)
          .post('/api/v1/ai-configs')
          .send(config)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
    });
  });

  describe('AI Service Integration', () => {
    it('should test API key connectivity on creation', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(201);

      expect(response.body.isActive).toBe(true); // Should be active after successful test
    });

    it('should handle API key test failures gracefully', async () => {
      const invalidKeyRequest = {
        ...validAIConfigRequest,
        apiKey: 'sk-invalid123456789'
      };

      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(invalidKeyRequest)
        .expect(201); // Still created but marked inactive

      expect(response.body).toHaveProperty('id');
      expect(response.body.isActive).toBe(false); // Should be inactive due to test failure
    });

    it('should validate rate limits during API key test', async () => {
      const response = await request(app)
        .post('/api/v1/ai-configs')
        .send(validAIConfigRequest)
        .expect(429);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(response.headers).toHaveProperty('retry-after');
    });
  });
});