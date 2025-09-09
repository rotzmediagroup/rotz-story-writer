# Deployment Guide

This guide covers deployment of the AI Story Generation Platform using different methods.

## Coolify Deployment (Recommended for Production)

[Coolify](https://coolify.io/) is a self-hosted alternative to Heroku/Netlify that supports Docker deployments.

### Prerequisites

1. Coolify instance running on your server
2. GitHub repository access
3. Domain name (optional)

### Deployment Steps

1. **Create New Project in Coolify**
   - Login to your Coolify instance
   - Create a new project: "ai-story-generator"

2. **Add GitHub Repository**
   - Connect your GitHub account
   - Select repository: `rotzmediagroup/rotz-story-writer`
   - Branch: `main`

3. **Configure Environment Variables**
   Set the following environment variables in Coolify:

   ```bash
   # Required Security Variables (generate random strings)
   JWT_SECRET=your-long-random-jwt-secret-here
   SESSION_SECRET=your-session-secret-here  
   ENCRYPTION_KEY=your-32-character-encryption-key
   
   # Database Configuration (auto-populated by Coolify)
   POSTGRES_PASSWORD=auto-generated-by-coolify
   POSTGRES_USER=postgres
   POSTGRES_DB=ai_story_app
   
   # Domain Configuration
   DOMAIN_NAME=your-domain.com
   FRONTEND_URL=https://your-domain.com
   
   # Optional: AI Provider API Keys (users can also provide their own)
   OPENAI_API_KEY=sk-your-openai-key
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   GOOGLE_AI_API_KEY=your-google-ai-key
   ```

4. **Deploy Services**
   - Deploy PostgreSQL service first
   - Deploy Redis service  
   - Deploy Backend service
   - Deploy Frontend service last

5. **Run Database Migration**
   After backend deployment, run the migration:
   ```bash
   npm run migrate
   ```

### Service Configuration

The application consists of 4 services:

- **PostgreSQL**: Database for storing stories, users, etc.
- **Redis**: Caching and session storage
- **Backend**: Express.js API server (port 3001)
- **Frontend**: React application served by nginx (port 80)

### Health Checks

All services include health checks:
- Backend: `GET /health`
- Frontend: `GET /`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

## Docker Compose Deployment (Development/Testing)

For local development or testing on a server:

### Prerequisites

- Docker and Docker Compose installed
- Git repository cloned

### Quick Start

1. **Clone Repository**
   ```bash
   git clone https://github.com/rotzmediagroup/rotz-story-writer.git
   cd rotz-story-writer
   ```

2. **Environment Setup**
   ```bash
   # Copy environment files
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   
   # Edit backend/.env with your values
   # At minimum, set secure JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
   ```

3. **Build and Deploy**
   ```bash
   # For local development
   docker-compose up --build
   
   # For production-like environment
   docker-compose -f docker-compose.production.yml up --build -d
   ```

4. **Initialize Database**
   ```bash
   # Run migrations (one time setup)
   docker-compose exec backend npm run migrate
   ```

5. **Access Application**
   - Frontend: http://localhost (or http://localhost:80)
   - Backend API: http://localhost:3001
   - Database: localhost:5432
   - Redis: localhost:6379

### Service Ports

- Frontend: 80 (nginx)
- Backend: 3001 (Express)
- PostgreSQL: 5432
- Redis: 6379

## Environment Variables Reference

### Backend Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `SESSION_SECRET` | Session cookie secret | Yes | - |
| `ENCRYPTION_KEY` | 32-char key for API encryption | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | redis://redis:6379 |
| `FRONTEND_URL` | Frontend URL for CORS | No | http://localhost:3000 |
| `ENABLE_REGISTRATION` | Allow user registration | No | true |
| `ENABLE_EXPORT` | Enable story export features | No | true |
| `ENABLE_COLLABORATION` | Enable collaboration features | No | false |

### AI Provider Keys (Optional)

Users can provide their own API keys through the application UI, or you can set defaults:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GOOGLE_AI_API_KEY` | Google AI API key |

## Security Considerations

1. **Generate Strong Secrets**: Use long, random strings for all secret keys
2. **HTTPS Only**: Always use HTTPS in production
3. **Database Security**: Use strong passwords and restrict database access
4. **Environment Variables**: Never commit secrets to version control
5. **Regular Updates**: Keep all dependencies and base images updated

## Backup and Recovery

### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres ai_story_app > backup.sql

# Restore backup  
docker-compose exec -T postgres psql -U postgres ai_story_app < backup.sql
```

### File Uploads Backup

```bash
# Backup uploaded files
docker cp $(docker-compose ps -q backend):/app/uploads ./uploads-backup
```

## Monitoring and Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Monitoring

The application includes built-in health checks accessible at:
- Backend API: `GET /health`
- Frontend: `GET /` (returns 200 OK)

## Scaling

For high-traffic deployments:

1. **Horizontal Scaling**: Run multiple backend instances behind a load balancer
2. **Database**: Consider PostgreSQL read replicas
3. **Caching**: Redis cluster for distributed caching
4. **CDN**: Use CDN for static assets and frontend
5. **File Storage**: Use object storage (S3) instead of local files

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running and accessible
   - Verify DATABASE_URL format
   - Check network connectivity between services

2. **Redis Connection Failed**  
   - Verify Redis service is running
   - Check REDIS_URL configuration

3. **Frontend Can't Reach Backend**
   - Verify backend is running on correct port
   - Check CORS configuration
   - Verify proxy configuration in nginx

4. **Build Failures**
   - Check Docker images are available
   - Verify Dockerfile syntax
   - Check for sufficient disk space

### Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Execute commands in containers
docker-compose exec backend bash
docker-compose exec postgres psql -U postgres

# Restart services
docker-compose restart [service-name]
```