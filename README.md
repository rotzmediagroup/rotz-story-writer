# StoryForge AI - AI Story Generation Platform

**From Idea to Published Story in Minutes to Hours**

StoryForge AI is a professional AI-powered story generation application that enables users to create high-quality stories across multiple genres, from short 500-word pieces to full 500-page novels. The app provides complete control over AI models, prompts, and story parameters while using a sophisticated hierarchical generation system to ensure narrative consistency and professional quality.

## Features

### 🎯 Core Capabilities
- **Multi-Genre Support**: Romance, Thriller, Fantasy, Sci-Fi, Mystery, Horror, Literary Fiction
- **Scalable Length**: 100 words to 200,000+ words with appropriate pacing
- **Hierarchical Generation**: Planning → Chapter Generation → Assembly → Export
- **Real-time Progress**: Live updates with Server-Sent Events
- **Professional Output**: Publication-ready exports in PDF, EPUB, DOCX, Markdown

### 🤖 AI Integration
- **Multi-Provider Support**: OpenAI, Anthropic, Google AI with smart fallback
- **Custom Prompts**: Viewable and editable prompt templates
- **Model Selection**: Choose specific models for different tasks
- **Parameter Control**: Temperature, creativity, and style settings

### ⚙️ Advanced Controls
- **Audience Settings**: Age group, content rating, reading level
- **Thematic Control**: Specific themes, tone, mood preferences
- **Style Settings**: Writing style, pacing, dialogue density
- **Character Development**: Archetype-based creation with relationship mapping

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- API keys for at least one AI provider

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/story-generator.git
   cd story-generator
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

3. **Set up environment files**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your configuration

   # Frontend
   cd ../frontend
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up database**
   ```bash
   createdb ai_story_app
   cd backend
   npm run migrate
   ```

5. **Start the application**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev

   # Terminal 2: Frontend
   cd frontend
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Development

### Project Structure

```
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic libraries
│   │   ├── api/           # REST endpoints
│   │   ├── config/        # Configuration
│   │   └── lib/           # Utilities
│   ├── tests/             # Test suites
│   └── migrations/        # Database migrations
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Route components
│   │   ├── services/      # API clients
│   │   ├── store/         # Redux store
│   │   └── types/         # TypeScript types
│   └── tests/             # Frontend tests
└── specs/                 # Feature specifications
```

### Available Scripts

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm test` - Run all tests
- `npm run test:contract` - Run contract tests
- `npm run test:integration` - Run integration tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations

**Frontend:**
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint

### Testing

The project follows Test-Driven Development (TDD):

1. **Contract Tests**: API schema validation
2. **Integration Tests**: End-to-end user flows
3. **Unit Tests**: Individual component testing

Run tests before implementing features:
```bash
# Backend
cd backend
npm run test:contract
npm run test:integration

# Frontend
cd frontend
npm test
```

### Database Migrations

Create new migrations:
```bash
cd backend/migrations
# Create new SQL file: 002_add_feature.sql
npm run migrate
```

## API Documentation

The API follows OpenAPI 3.0 specification. Key endpoints:

- `POST /api/v1/stories` - Create new story
- `POST /api/v1/stories/{id}/plan` - Generate story plan
- `POST /api/v1/stories/{id}/generate` - Start generation
- `GET /api/v1/stories/{id}/progress` - Real-time progress (SSE)
- `POST /api/v1/stories/{id}/export` - Export story

Full API documentation available at `/api/docs` when running.

## Performance Targets

| Story Length | Generation Time | Export Time |
|-------------|-----------------|-------------|
| 500 words   | < 2 minutes    | < 10 seconds |
| 5K words    | < 10 minutes   | < 30 seconds |
| 50K words   | < 2 hours      | < 2 minutes |
| 200K words  | < 4 hours      | < 5 minutes |

## Architecture

### Backend Services
- **story-generator**: Hierarchical generation engine
- **ai-provider-manager**: Multi-provider AI client
- **export-engine**: Multi-format export system
- **prompt-templates**: Template management
- **story-validator**: Quality and consistency checks

### Frontend Architecture
- **React 18** with TypeScript
- **Material-UI** for components
- **Redux Toolkit** for state management
- **React Query** for API data management

### Security
- AES-256-GCM encryption for API keys
- JWT authentication
- Rate limiting per user
- Input validation and sanitization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD)
4. Implement the feature
5. Run linting and tests
6. Submit a pull request

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://localhost:5432/ai_story_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key
# See .env.example for full list
```

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://localhost:3001/api/v1
REACT_APP_WS_URL=http://localhost:3001
# See .env.example for full list
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Documentation: [/docs](./docs)
- Issues: [GitHub Issues](https://github.com/your-org/story-generator/issues)
- API Reference: http://localhost:3001/api/docs

---

**Built with ❤️ using TypeScript, React, Express, PostgreSQL, and Redis**