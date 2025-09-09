# Tasks: AI Story Generation App

**Input**: Design documents from `/specs/001-ai-story-generation/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript, React, Express, PostgreSQL, Redis
   → Structure: Web application (frontend + backend)
   → Libraries: story-generator, ai-provider-manager, export-engine, prompt-templates, story-validator
2. Load optional design documents ✓
   → data-model.md: 12 core entities identified
   → contracts/openapi.yaml: 25+ endpoints across 6 tag groups
   → research.md: Multi-provider AI, SSE progress, secure storage decisions
3. Generate tasks by category ✓
   → Setup: Project structure, dependencies, database
   → Tests: Contract tests [P], integration tests [P]
   → Core: Models [P], services, libraries
   → Integration: API endpoints, middleware, real-time features
   → Polish: Unit tests [P], performance validation, documentation
4. Apply task rules ✓
   → Different files = [P] for parallel execution
   → Tests before implementation (TDD enforced)
   → Dependencies properly ordered
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
   → All major endpoints have contract tests
   → All entities have model tasks
   → Core user flows have integration tests
9. Return: SUCCESS (52 tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths for all tasks

## Path Conventions (Web Application)
- Backend: `backend/src/`, `backend/tests/`
- Frontend: `frontend/src/`, `frontend/tests/`
- Shared: Root level configuration files

## Phase 3.1: Project Setup

- [ ] T001 Create backend project structure with TypeScript, Express, and PostgreSQL setup
- [ ] T002 Create frontend project structure with React 18, TypeScript, and Material-UI
- [ ] T003 [P] Configure ESLint, Prettier, and TypeScript config for backend in `backend/tsconfig.json`, `backend/.eslintrc.js`
- [ ] T004 [P] Configure ESLint, Prettier, and TypeScript config for frontend in `frontend/tsconfig.json`, `frontend/.eslintrc.js`
- [ ] T005 Set up PostgreSQL database schema with migrations in `backend/migrations/001_initial_schema.sql`
- [ ] T006 Configure Redis connection and session management in `backend/src/config/redis.ts`
- [ ] T007 Set up environment configuration files `backend/.env.example` and `frontend/.env.example`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - API Schema Validation
- [ ] T008 [P] Contract test POST /api/v1/stories in `backend/tests/contract/stories.create.test.ts`
- [ ] T009 [P] Contract test GET /api/v1/stories in `backend/tests/contract/stories.list.test.ts`
- [ ] T010 [P] Contract test GET /api/v1/stories/{id} in `backend/tests/contract/stories.get.test.ts`
- [ ] T011 [P] Contract test POST /api/v1/stories/{id}/plan in `backend/tests/contract/stories.plan.test.ts`
- [ ] T012 [P] Contract test POST /api/v1/stories/{id}/generate in `backend/tests/contract/stories.generate.test.ts`
- [ ] T013 [P] Contract test GET /api/v1/stories/{id}/progress in `backend/tests/contract/stories.progress.test.ts`
- [ ] T014 [P] Contract test POST /api/v1/stories/{id}/export in `backend/tests/contract/stories.export.test.ts`
- [ ] T015 [P] Contract test POST /api/v1/ai-configs in `backend/tests/contract/ai-configs.test.ts`
- [ ] T016 [P] Contract test GET /api/v1/chapters/{id} in `backend/tests/contract/chapters.test.ts`

### Integration Tests [P] - User Flow Scenarios
- [ ] T017 [P] Integration test complete story creation flow in `backend/tests/integration/story-creation.test.ts`
- [ ] T018 [P] Integration test story planning and approval flow in `backend/tests/integration/story-planning.test.ts`
- [ ] T019 [P] Integration test chapter generation with progress tracking in `backend/tests/integration/story-generation.test.ts`
- [ ] T020 [P] Integration test multi-format export system in `backend/tests/integration/export-system.test.ts`
- [ ] T021 [P] Integration test AI provider switching and fallback in `backend/tests/integration/ai-provider.test.ts`
- [ ] T022 [P] Integration test user authentication and API key management in `backend/tests/integration/auth-keys.test.ts`

### Frontend Integration Tests [P]
- [ ] T023 [P] Frontend integration test story wizard component in `frontend/tests/integration/story-wizard.test.tsx`
- [ ] T024 [P] Frontend integration test story editor with real-time updates in `frontend/tests/integration/story-editor.test.tsx`
- [ ] T025 [P] Frontend integration test export panel with download flow in `frontend/tests/integration/export-panel.test.tsx`

## Phase 3.3: Data Layer (ONLY after tests are failing)

### Database Models [P] - Core Entities
- [ ] T026 [P] User model with authentication in `backend/src/models/user.model.ts`
- [ ] T027 [P] Story model with metadata and relationships in `backend/src/models/story.model.ts`
- [ ] T028 [P] StoryPlan model with JSON fields in `backend/src/models/story-plan.model.ts`
- [ ] T029 [P] Chapter model with content and status in `backend/src/models/chapter.model.ts`
- [ ] T030 [P] Character model with development tracking in `backend/src/models/character.model.ts`
- [ ] T031 [P] AIConfiguration model with encrypted keys in `backend/src/models/ai-config.model.ts`
- [ ] T032 [P] PromptTemplate model with variables in `backend/src/models/prompt-template.model.ts`
- [ ] T033 [P] Export model with file tracking in `backend/src/models/export.model.ts`

## Phase 3.4: Service Libraries

### Core Libraries
- [ ] T034 Story generator library with hierarchical generation in `backend/src/services/story-generator/index.ts`
- [ ] T035 AI provider manager library with multi-provider fallback in `backend/src/services/ai-provider-manager/index.ts`
- [ ] T036 Export engine library with PDF/EPUB/DOCX support in `backend/src/services/export-engine/index.ts`
- [ ] T037 Prompt templates library with variable interpolation in `backend/src/services/prompt-templates/index.ts`
- [ ] T038 Story validator library with consistency checks in `backend/src/lib/story-validator/index.ts`

### Service Layer
- [ ] T039 User service with authentication and API key management in `backend/src/services/user.service.ts`
- [ ] T040 Story service with CRUD operations in `backend/src/services/story.service.ts`
- [ ] T041 Generation service orchestrating story creation pipeline in `backend/src/services/generation.service.ts`

## Phase 3.5: API Layer

### REST Endpoints - Stories
- [ ] T042 POST /api/v1/stories endpoint in `backend/src/api/routes/stories.ts`
- [ ] T043 GET /api/v1/stories endpoint with filtering in `backend/src/api/routes/stories.ts`
- [ ] T044 GET /api/v1/stories/{id} endpoint with detailed response in `backend/src/api/routes/stories.ts`
- [ ] T045 PATCH /api/v1/stories/{id} endpoint for metadata updates in `backend/src/api/routes/stories.ts`

### Generation Endpoints
- [ ] T046 POST /api/v1/stories/{id}/plan endpoint for story planning in `backend/src/api/routes/generation.ts`
- [ ] T047 POST /api/v1/stories/{id}/generate endpoint for story generation in `backend/src/api/routes/generation.ts`
- [ ] T048 GET /api/v1/stories/{id}/progress SSE endpoint for real-time updates in `backend/src/api/routes/generation.ts`

### Export and Configuration Endpoints
- [ ] T049 POST /api/v1/stories/{id}/export endpoint in `backend/src/api/routes/export.ts`
- [ ] T050 AI configurations CRUD endpoints in `backend/src/api/routes/ai-configs.ts`

## Phase 3.6: Frontend Components

### Core UI Components [P]
- [ ] T051 [P] Story creation wizard component in `frontend/src/components/story-wizard/StoryWizard.tsx`
- [ ] T052 [P] Story editor with chapter management in `frontend/src/components/story-editor/StoryEditor.tsx`
- [ ] T053 [P] Export panel with format options in `frontend/src/components/export-panel/ExportPanel.tsx`
- [ ] T054 [P] Real-time progress component with SSE in `frontend/src/components/progress/ProgressTracker.tsx`

## Dependencies

### Phase Blocking
- Setup (T001-T007) must complete before Tests
- Tests (T008-T025) must fail before Core implementation
- Models (T026-T033) before Services (T034-T041)
- Services before API endpoints (T042-T050)
- Backend APIs before Frontend components (T051-T054)

### Specific Dependencies
- T005 (database schema) blocks T026-T033 (models)
- T034-T038 (libraries) needed for T041 (generation service)
- T039-T041 (services) needed for T042-T050 (endpoints)
- T048 (SSE endpoint) needed for T054 (progress component)
- T042-T050 (APIs) needed for T051-T053 (frontend components)

## Parallel Execution Examples

### Setup Phase (can run together after T001-T002)
```
Task: "Configure ESLint and TypeScript for backend"
Task: "Configure ESLint and TypeScript for frontend" 
Task: "Set up environment configuration files"
```

### Contract Tests (independent files, run in parallel)
```
Task: "Contract test POST /api/v1/stories in backend/tests/contract/stories.create.test.ts"
Task: "Contract test GET /api/v1/stories in backend/tests/contract/stories.list.test.ts"
Task: "Contract test POST /api/v1/stories/{id}/plan in backend/tests/contract/stories.plan.test.ts"
Task: "Contract test POST /api/v1/ai-configs in backend/tests/contract/ai-configs.test.ts"
```

### Database Models (different entities, independent)
```
Task: "User model with authentication in backend/src/models/user.model.ts"
Task: "Story model with metadata in backend/src/models/story.model.ts"
Task: "Chapter model with content in backend/src/models/chapter.model.ts"
Task: "Character model with tracking in backend/src/models/character.model.ts"
```

### Frontend Components (different files, independent)
```
Task: "Story creation wizard in frontend/src/components/story-wizard/StoryWizard.tsx"
Task: "Story editor component in frontend/src/components/story-editor/StoryEditor.tsx"
Task: "Export panel component in frontend/src/components/export-panel/ExportPanel.tsx"
```

## Validation Checklist
*GATE: All must be checked before execution*

- [x] All major contracts have corresponding tests (Stories, Generation, Export, AI Config)
- [x] All core entities have model tasks (User, Story, Chapter, Character, etc.)
- [x] All tests come before implementation (Phase 3.2 before 3.3+)
- [x] Parallel tasks are truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD enforced with failing tests requirement
- [x] Complete user journey covered (creation → planning → generation → export)

## Notes
- **[P] tasks**: Different files, no dependencies, can run in parallel
- **Critical**: Verify all tests FAIL before implementing (TDD requirement)
- **Libraries**: Each core library exposes CLI interface per constitution
- **Real-time**: SSE implementation for progress tracking (not WebSocket)
- **Security**: API keys encrypted with AES-256-GCM per research decisions
- **Performance**: Target <2min micro stories, <4hr novels per specifications