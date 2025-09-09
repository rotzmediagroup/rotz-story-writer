# Quickstart: AI Story Generation App

**Date**: 2025-09-09  
**Feature**: AI Story Generation Platform  
**Branch**: `001-ai-story-generation`

## Prerequisites

- Node.js 18+ and npm installed
- PostgreSQL 14+ running locally or via Docker
- Redis 6+ running locally or via Docker
- API keys for at least one AI provider (OpenAI, Anthropic, or Google)

## Quick Setup (5 minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/story-generator.git
cd story-generator

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create database
createdb ai_story_app

# Run migrations
cd backend
npm run migrate

# Seed with sample data (optional)
npm run seed
```

### 3. Environment Configuration

Create `.env` files:

**backend/.env**
```env
DATABASE_URL=postgresql://localhost:5432/ai_story_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
PORT=3001
NODE_ENV=development
```

**frontend/.env**
```env
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_WS_URL=http://localhost:3001
```

### 4. Start Services

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Application will be available at http://localhost:3000

## Your First Story (10 minutes)

### Step 1: Create Account

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Verify email (check console in dev mode)

### Step 2: Configure AI Provider

1. Go to Settings → AI Configuration
2. Click "Add Provider"
3. Select your provider (e.g., OpenAI)
4. Enter your API key
5. Test connection

### Step 3: Create Your First Story

1. Click "Create New Story" on dashboard
2. Fill in basic information:
   - Title: "The Lost Expedition"
   - Premise: "A team of explorers discovers an ancient civilization"
   - Genre: Fantasy
   - Target Length: 5,000 words (short story)
3. Configure settings:
   - Age Group: Adult
   - Content Rating: PG-13
   - Themes: Adventure, Discovery
4. Click "Continue"

### Step 4: Generate Story Plan

1. Review AI configuration (uses your default)
2. Click "Generate Plan"
3. Wait ~30 seconds for plan generation
4. Review the generated outline:
   - Chapter breakdown
   - Character profiles
   - Plot points
5. Make any edits if desired
6. Click "Approve Plan"

### Step 5: Generate Story

1. Click "Generate Story"
2. Watch real-time progress:
   - Planning phase (already complete)
   - Chapter generation (1-2 minutes per chapter)
   - Assembly phase
3. Total time for 5,000 words: ~5 minutes

### Step 6: Export Your Story

1. Click "Export" when generation complete
2. Select format:
   - PDF for reading
   - DOCX for editing
   - EPUB for e-readers
3. Configure options (font size, etc.)
4. Click "Generate Export"
5. Download your story!

## Testing the API

### Quick API Test

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

# Create a story
curl -X POST http://localhost:3001/api/v1/stories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Story",
    "premise": "A test story created via API",
    "genre": "Fantasy",
    "targetLength": 1000
  }'

# Generate plan (returns job ID)
JOB_ID=$(curl -X POST http://localhost:3001/api/v1/stories/{storyId}/plan \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.jobId')

# Check progress (SSE endpoint)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/stories/{storyId}/progress
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run contract tests only
npm run test:contract

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Common Workflows

### Regenerate a Chapter

```javascript
// If chapter 3 needs revision
const response = await fetch('/api/v1/stories/{storyId}/chapters/3/regenerate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    preserveStyle: true,
    customInstructions: 'Add more dialogue between characters'
  })
});
```

### Batch Export Multiple Formats

```javascript
// Export story in all formats
const formats = ['pdf', 'epub', 'docx', 'markdown'];

const exports = await Promise.all(
  formats.map(format => 
    fetch('/api/v1/stories/{storyId}/export', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ format })
    })
  )
);
```

### Monitor Generation Progress

```javascript
// Connect to SSE endpoint
const eventSource = new EventSource(
  `/api/v1/stories/${storyId}/progress`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  console.log(`${data.stage}: ${data.progress}%`);
  
  if (data.chapter) {
    console.log(`Generating chapter ${data.chapter}`);
  }
});

eventSource.addEventListener('complete', () => {
  console.log('Story generation complete!');
  eventSource.close();
});
```

## Troubleshooting

### Issue: Generation Fails Mid-Story

**Solution**: Check AI provider rate limits and API key validity
```bash
# Check logs
tail -f backend/logs/error.log

# Verify API key
npm run test:ai-provider
```

### Issue: Export Takes Too Long

**Solution**: Check Redis connection and background job processing
```bash
# Monitor Redis
redis-cli monitor

# Check job queue
npm run jobs:status
```

### Issue: SSE Connection Drops

**Solution**: Ensure sticky sessions in load balancer
```bash
# Test SSE endpoint
curl -H "Accept: text/event-stream" \
     http://localhost:3001/api/v1/stories/{id}/progress
```

## Performance Benchmarks

Expected generation times:

| Story Length | Generation Time | Export Time |
|-------------|----------------|-------------|
| 500 words | 30 seconds | 5 seconds |
| 5,000 words | 5 minutes | 10 seconds |
| 50,000 words | 45 minutes | 30 seconds |
| 100,000 words | 2 hours | 60 seconds |

## Next Steps

1. **Customize Prompts**: Go to Settings → Prompt Templates
2. **Try Different Genres**: Each has unique structure
3. **Experiment with AI Models**: Compare outputs
4. **Join Community**: Share your stories and templates

## Support

- Documentation: http://localhost:3000/docs
- API Reference: http://localhost:3001/api/docs
- Issues: https://github.com/your-org/story-generator/issues

Happy story generation! 📚✨