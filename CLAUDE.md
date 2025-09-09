# Claude Code Context for AI Story Generation App

## Project Overview
AI-powered story generation SaaS platform enabling users to create professional stories from 100 words to 200,000+ words across multiple genres using hierarchical generation (planning → chapter generation → assembly → export).

## Tech Stack
- **Frontend**: React 18 + TypeScript + Material-UI/Tailwind + Redux Toolkit
- **Backend**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **AI Integration**: OpenAI, Anthropic, Google AI APIs with multi-provider fallback
- **Testing**: Jest + React Testing Library + Supertest
- **Export**: Puppeteer (PDF), epub-gen-memory (EPUB), docx (Word)
- **Real-time**: Server-Sent Events for progress tracking

## Project Structure
```
backend/
├── src/
│   ├── models/          # Sequelize/Prisma models
│   ├── services/        # Business logic libraries
│   │   ├── story-generator/    # Core generation engine
│   │   ├── ai-provider-manager/    # Multi-AI client
│   │   ├── export-engine/      # PDF/EPUB/DOCX generation
│   │   └── prompt-templates/   # Template management
│   ├── api/routes/      # REST endpoints
│   └── lib/story-validator/    # Quality checks

frontend/
├── src/
│   ├── components/story-wizard/    # Story creation flow
│   ├── components/story-editor/    # Content editing
│   ├── pages/dashboard/        # User dashboard
│   └── services/api-client/    # HTTP client
```

## Key Libraries & Services
- **story-generator**: Hierarchical generation with genre-specific structures
- **ai-provider-manager**: Rate limiting, retry logic, cost optimization
- **export-engine**: Multi-format exports with streaming for large documents
- **prompt-templates**: Customizable generation prompts with variables
- **story-validator**: Consistency checks and quality metrics

## Development Workflow
1. **TDD Required**: Red-Green-Refactor cycle strictly enforced
2. **Contract Tests**: OpenAPI schema validation
3. **Integration Tests**: Real PostgreSQL/Redis, not mocks
4. **CLI Per Library**: Each service exposes CLI for testing
5. **Library-First**: All features as reusable libraries

## Core APIs
- `POST /api/v1/stories` - Create story with metadata
- `POST /api/v1/stories/{id}/plan` - Generate story outline
- `POST /api/v1/stories/{id}/generate` - Start chapter generation
- `GET /api/v1/stories/{id}/progress` - SSE progress stream
- `POST /api/v1/stories/{id}/export` - Export to PDF/EPUB/DOCX

## Database Entities
- **User**: Auth, subscription, preferences
- **Story**: Metadata, genre, themes, status
- **StoryPlan**: Outline, character arcs, plot points
- **Chapter**: Content, word count, generation status
- **Character**: Profiles, relationships, development arcs
- **AIConfiguration**: Provider settings, API keys (encrypted)
- **Export**: Generated files with download URLs

## Key Patterns
- **Multi-Provider AI**: Fallback between OpenAI/Anthropic/Google
- **SSE Progress**: Real-time generation updates with reconnection
- **Hierarchical Generation**: Plan → Chapters → Assembly workflow
- **Secure Key Storage**: AES-256-GCM with user-specific keys
- **Token Optimization**: Caching, model selection, batch processing

## Environment Setup
```bash
# Backend
cd backend && npm install
createdb ai_story_app
npm run migrate && npm run dev

# Frontend  
cd frontend && npm install && npm run dev
```

## Testing Commands
```bash
# Backend tests (with real DB)
npm test                    # All tests
npm run test:contract       # API contract tests
npm run test:integration    # Service integration tests

# Frontend tests
npm test                    # Component tests
npm run test:e2e           # End-to-end tests
```

## Performance Targets
- Micro stories (100-1K words): <2 minutes generation
- Novels (40K+ words): <4 hours generation  
- API responses: <200ms (excluding AI calls)
- 95%+ character/plot consistency across chapters
- 99%+ successful export reliability

## Recent Changes (Latest 3)
1. **2025-09-09**: Initial project setup with spec-driven development workflow
2. **2025-09-09**: Added comprehensive data model with 12 core entities
3. **2025-09-09**: Defined OpenAPI contract with 25+ endpoints and SSE support

## Current Focus
Implementing core story generation pipeline with TDD approach:
1. Database models and migrations
2. AI provider integration with retry logic
3. Story plan generation with approval workflow
4. Chapter-by-chapter generation with progress tracking
5. Multi-format export system

## Notes for Claude
- All AI generation uses hierarchical approach for consistency
- Each chapter maintains context of previous chapters and character states
- Export system handles documents up to 500 pages with streaming
- SSE endpoints require sticky sessions for load balancing
- API keys stored encrypted with user-specific derivation
- Genre-specific story structures (4-act romance, hero's journey fantasy, etc.)
- Real-time collaboration planned for future release