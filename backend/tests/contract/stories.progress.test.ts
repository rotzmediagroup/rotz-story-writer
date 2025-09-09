import request from 'supertest';
import { app } from '../../src/index';

describe('Contract Test: GET /api/v1/stories/{id}/progress', () => {
  const validStoryId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoryId = 'invalid-uuid';
  const nonExistentStoryId = '550e8400-e29b-41d4-a716-446655440999';

  describe('Server-Sent Events Schema Validation', () => {
    it('should establish SSE connection for active generation', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .set('Cache-Control', 'no-cache')
        .expect(200);

      req.expect('Content-Type', /text\/event-stream/)
        .expect('Connection', 'keep-alive')
        .expect('Cache-Control', 'no-cache')
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
    });

    it('should stream progress events in correct SSE format', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let eventCount = 0;
      let receivedData = '';

      req.on('data', (chunk) => {
        receivedData += chunk.toString();
        
        // Check for proper SSE format
        if (receivedData.includes('event: progress\n')) {
          eventCount++;
          
          // Validate SSE event structure
          expect(receivedData).toMatch(/event: progress\n/);
          expect(receivedData).toMatch(/data: \{.*\}\n\n/);
          
          // Parse the JSON data
          const dataMatch = receivedData.match(/data: (\{.*\})\n/);
          if (dataMatch) {
            try {
              const progressData = JSON.parse(dataMatch[1]);
              
              // Validate progress data schema
              expect(progressData).toHaveProperty('stage');
              expect(progressData).toHaveProperty('progress');
              expect(typeof progressData.progress).toBe('number');
              expect(progressData.progress).toBeGreaterThanOrEqual(0);
              expect(progressData.progress).toBeLessThanOrEqual(100);
              
              // Validate stage values
              expect(['planning', 'generating', 'complete', 'error']).toContain(progressData.stage);
              
              // Chapter information (optional)
              if (progressData.chapter !== null) {
                expect(typeof progressData.chapter).toBe('number');
                expect(progressData.chapter).toBeGreaterThan(0);
              }
              
              // Additional progress details
              if (progressData.stage === 'generating') {
                expect(progressData).toHaveProperty('currentChapter');
                expect(progressData).toHaveProperty('totalChapters');
                expect(progressData).toHaveProperty('estimatedTimeRemaining');
              }
              
              if (eventCount >= 2) {
                req.destroy();
                done();
              }
            } catch (parseError) {
              done(parseError);
            }
          }
        }
      });

      req.on('error', done);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        req.destroy();
        if (eventCount === 0) {
          done(new Error('No progress events received within timeout'));
        } else {
          done();
        }
      }, 10000);
    });

    it('should handle completion event correctly', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let completionReceived = false;
      let receivedData = '';

      req.on('data', (chunk) => {
        receivedData += chunk.toString();
        
        if (receivedData.includes('event: complete\n')) {
          completionReceived = true;
          
          expect(receivedData).toMatch(/event: complete\n/);
          expect(receivedData).toMatch(/data: \{.*\}\n\n/);
          
          const dataMatch = receivedData.match(/data: (\{.*\})\n/);
          if (dataMatch) {
            const completionData = JSON.parse(dataMatch[1]);
            
            expect(completionData).toHaveProperty('status', 'complete');
            expect(completionData).toHaveProperty('totalWords');
            expect(completionData).toHaveProperty('chaptersGenerated');
            expect(completionData).toHaveProperty('completedAt');
            expect(typeof completionData.totalWords).toBe('number');
            expect(typeof completionData.chaptersGenerated).toBe('number');
            expect(new Date(completionData.completedAt)).toBeInstanceOf(Date);
          }
          
          req.destroy();
          done();
        }
      });

      req.on('error', done);
      
      setTimeout(() => {
        req.destroy();
        if (!completionReceived) {
          done(new Error('No completion event received within timeout'));
        }
      }, 15000);
    });

    it('should handle error events correctly', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let errorReceived = false;
      let receivedData = '';

      req.on('data', (chunk) => {
        receivedData += chunk.toString();
        
        if (receivedData.includes('event: error\n')) {
          errorReceived = true;
          
          expect(receivedData).toMatch(/event: error\n/);
          expect(receivedData).toMatch(/data: \{.*\}\n\n/);
          
          const dataMatch = receivedData.match(/data: (\{.*\})\n/);
          if (dataMatch) {
            const errorData = JSON.parse(dataMatch[1]);
            
            expect(errorData).toHaveProperty('error');
            expect(errorData.error).toHaveProperty('code');
            expect(errorData.error).toHaveProperty('message');
            expect(errorData).toHaveProperty('stage');
            expect(errorData).toHaveProperty('chapter'); // Chapter where error occurred
            expect(errorData).toHaveProperty('retry'); // Whether retry is possible
            expect(typeof errorData.retry).toBe('boolean');
          }
          
          req.destroy();
          done();
        }
      });

      req.on('error', done);
      
      setTimeout(() => {
        req.destroy();
        if (!errorReceived) {
          done(new Error('No error event received within timeout'));
        }
      }, 10000);
    });

    it('should reject invalid story ID format', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${invalidStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_PARAMETER');
      expect(response.body.error.message).toMatch(/invalid.*id/i);
    });

    it('should return 404 for non-existent story', async () => {
      const response = await request(app)
        .get(`/api/v1/stories/${nonExistentStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toMatch(/story.*not.*found/i);
    });

    it('should return 204 when no generation is active', async () => {
      await request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .expect(204);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .expect(401);
    });

    it('should accept valid authentication token', async () => {
      const mockToken = 'valid-jwt-token';
      
      await request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Authorization', `Bearer ${mockToken}`)
        .set('Accept', 'text/event-stream')
        .expect(200);
    });

    it('should reject access to stories owned by other users', async () => {
      const otherUserToken = 'other-user-jwt-token';
      
      const response = await request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .set('Accept', 'text/event-stream')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Content Type Requirements', () => {
    it('should require text/event-stream accept header', async () => {
      await request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'application/json')
        .expect(406);
    });

    it('should return text/event-stream content type', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream')
        .expect('Content-Type', /text\/event-stream/)
        .end((err) => {
          if (err) return done(err);
          done();
        });
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnect gracefully', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      req.on('data', () => {
        // Simulate client disconnect
        req.destroy();
        done();
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNRESET') {
          done(); // Expected behavior
        } else {
          done(err);
        }
      });
    });

    it('should send keep-alive heartbeat', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let heartbeatReceived = false;
      let receivedData = '';

      req.on('data', (chunk) => {
        receivedData += chunk.toString();
        
        if (receivedData.includes('event: heartbeat\n')) {
          heartbeatReceived = true;
          req.destroy();
          done();
        }
      });

      req.on('error', done);
      
      // Heartbeat should arrive within 30 seconds
      setTimeout(() => {
        req.destroy();
        if (!heartbeatReceived) {
          done(new Error('No heartbeat received within timeout'));
        }
      }, 30000);
    });

    it('should handle multiple concurrent connections', (done) => {
      const connections = [];
      const numConnections = 3;
      let completedConnections = 0;

      for (let i = 0; i < numConnections; i++) {
        const req = request(app)
          .get(`/api/v1/stories/${validStoryId}/progress`)
          .set('Accept', 'text/event-stream');

        req.on('data', () => {
          completedConnections++;
          req.destroy();
          
          if (completedConnections === numConnections) {
            done();
          }
        });

        req.on('error', done);
        connections.push(req);
      }

      // Cleanup after timeout
      setTimeout(() => {
        connections.forEach(req => req.destroy());
        if (completedConnections < numConnections) {
          done(new Error(`Only ${completedConnections}/${numConnections} connections received data`));
        }
      }, 10000);
    });
  });

  describe('Performance Requirements', () => {
    it('should establish connection within reasonable time', (done) => {
      const startTime = Date.now();
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      req.on('data', () => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(2000); // Under 2 seconds
        req.destroy();
        done();
      });

      req.on('error', done);
    });

    it('should maintain low latency for progress updates', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let firstEventTime: number;
      let eventTimes: number[] = [];

      req.on('data', (chunk) => {
        const now = Date.now();
        if (!firstEventTime) {
          firstEventTime = now;
        } else {
          const timeDiff = now - eventTimes[eventTimes.length - 1] || firstEventTime;
          expect(timeDiff).toBeLessThan(5000); // Updates should come within 5 seconds
        }
        eventTimes.push(now);

        if (eventTimes.length >= 3) {
          req.destroy();
          done();
        }
      });

      req.on('error', done);
      
      setTimeout(() => {
        req.destroy();
        if (eventTimes.length === 0) {
          done(new Error('No events received within timeout'));
        } else {
          done();
        }
      }, 15000);
    });
  });

  describe('Error Recovery', () => {
    it('should handle temporary network interruptions', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let dataReceived = false;

      req.on('data', () => {
        dataReceived = true;
        req.destroy();
        done();
      });

      req.on('error', (err) => {
        if (!dataReceived) {
          done(err);
        }
      });

      setTimeout(() => {
        if (!dataReceived) {
          done(new Error('No data received - potential network issue'));
        }
      }, 5000);
    });

    it('should gracefully handle server shutdown', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      let receivedData = '';

      req.on('data', (chunk) => {
        receivedData += chunk.toString();
        
        if (receivedData.includes('event: shutdown\n')) {
          expect(receivedData).toMatch(/event: shutdown\n/);
          expect(receivedData).toMatch(/data: \{.*\}\n\n/);
          
          req.destroy();
          done();
        }
      });

      req.on('error', done);
    });
  });

  describe('Data Validation', () => {
    it('should validate progress percentage bounds', (done) => {
      const req = request(app)
        .get(`/api/v1/stories/${validStoryId}/progress`)
        .set('Accept', 'text/event-stream');

      req.on('data', (chunk) => {
        const data = chunk.toString();
        const dataMatch = data.match(/data: (\{.*\})\n/);
        
        if (dataMatch) {
          const progressData = JSON.parse(dataMatch[1]);
          if (progressData.progress !== undefined) {
            expect(progressData.progress).toBeGreaterThanOrEqual(0);
            expect(progressData.progress).toBeLessThanOrEqual(100);
            expect(typeof progressData.progress).toBe('number');
            expect(Number.isInteger(progressData.progress) || Number.isFinite(progressData.progress)).toBe(true);
          }
        }
        
        req.destroy();
        done();
      });

      req.on('error', done);
    });
  });
});