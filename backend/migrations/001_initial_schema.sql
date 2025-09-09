-- AI Story Generation App - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Created: 2025-09-09

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team', 'enterprise')),
    storage_quota INTEGER DEFAULT 10,
    monthly_token_usage INTEGER DEFAULT 0,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Stories table
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    premise TEXT NOT NULL,
    genre VARCHAR(100) NOT NULL CHECK (genre IN ('Romance', 'Thriller', 'Fantasy', 'SciFi', 'Mystery', 'Horror', 'LiteraryFiction')),
    subgenre VARCHAR(100),
    target_length INTEGER NOT NULL CHECK (target_length BETWEEN 100 AND 500000),
    actual_length INTEGER DEFAULT 0,
    target_age_group VARCHAR(50) CHECK (target_age_group IN ('Children', 'YA', 'Adult')),
    content_rating VARCHAR(20) CHECK (content_rating IN ('G', 'PG', 'PG13', 'R')),
    reading_level VARCHAR(50),
    themes JSONB DEFAULT '[]',
    tone VARCHAR(50),
    writing_style VARCHAR(100),
    pov VARCHAR(50) CHECK (pov IN ('FirstPerson', 'ThirdLimited', 'ThirdOmniscient', 'SecondPerson')),
    tense VARCHAR(20) CHECK (tense IN ('Past', 'Present')),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'planning', 'generating', 'complete', 'archived')),
    generation_started_at TIMESTAMP,
    generation_completed_at TIMESTAMP,
    quality_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Story plans table
CREATE TABLE story_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
    total_chapters INTEGER NOT NULL,
    act_structure JSONB NOT NULL,
    chapter_summaries JSONB NOT NULL,
    story_arc JSONB NOT NULL,
    thematic_progression JSONB,
    pacing_map JSONB,
    estimated_generation_time INTEGER,
    approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_chapter_count CHECK (total_chapters > 0)
);

-- Chapters table
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title VARCHAR(500),
    planned_summary TEXT,
    content TEXT,
    word_count INTEGER DEFAULT 0,
    target_word_count INTEGER,
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'generating', 'generated', 'revised')),
    generation_attempts INTEGER DEFAULT 0,
    last_generated_at TIMESTAMP,
    quality_metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(story_id, chapter_number)
);

-- Characters table
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('protagonist', 'antagonist', 'supporting', 'minor')),
    archetype VARCHAR(100),
    description TEXT,
    backstory TEXT,
    goal TEXT,
    flaw TEXT,
    arc_type VARCHAR(50) CHECK (arc_type IN ('flat', 'positive', 'negative', 'transformation')),
    relationships JSONB DEFAULT '{}',
    first_appearance INTEGER,
    prominence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(story_id, name)
);

-- AI configurations table
CREATE TABLE ai_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(2,1) DEFAULT 0.7 CHECK (temperature BETWEEN 0 AND 2),
    max_tokens INTEGER DEFAULT 4000,
    top_p DECIMAL(2,1) DEFAULT 1.0,
    frequency_penalty DECIMAL(2,1) DEFAULT 0,
    presence_penalty DECIMAL(2,1) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    monthly_usage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API keys table (encrypted storage)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ai_config_id UUID REFERENCES ai_configurations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
    encrypted_key TEXT NOT NULL,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    iv VARCHAR(32) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    last_validated TIMESTAMP,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    rotated_at TIMESTAMP
);

-- Prompt templates table
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system templates
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('planning', 'chapter', 'character', 'revision')),
    genre VARCHAR(100),
    task_type VARCHAR(100) NOT NULL,
    template_content TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    example_output TEXT,
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    average_rating DECIMAL(2,1),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Exports table
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'epub', 'docx', 'markdown')),
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_url VARCHAR(1000),
    options JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    processing_time INTEGER,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Supporting tables for tracking
CREATE TABLE generation_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_cost DECIMAL(10,4),
    provider VARCHAR(50),
    model VARCHAR(100),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    success BOOLEAN,
    error TEXT
);

CREATE TABLE plot_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_plan_id UUID REFERENCES story_plans(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('inciting', 'rising', 'climax', 'falling', 'resolution')),
    description TEXT NOT NULL,
    impact VARCHAR(20) CHECK (impact IN ('minor', 'moderate', 'major')),
    order_in_chapter INTEGER NOT NULL
);

CREATE TABLE character_arcs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_plan_id UUID REFERENCES story_plans(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    start_state TEXT NOT NULL,
    end_state TEXT NOT NULL,
    key_moments JSONB DEFAULT '[]',
    arc_type VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_stories_user_status ON stories(user_id, status);
CREATE INDEX idx_chapters_story_id ON chapters(story_id);
CREATE INDEX idx_chapters_story_number ON chapters(story_id, chapter_number);
CREATE INDEX idx_characters_story_id ON characters(story_id);
CREATE INDEX idx_ai_configs_user_id ON ai_configurations(user_id);
CREATE INDEX idx_ai_configs_default ON ai_configurations(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_exports_story_id ON exports(story_id);
CREATE INDEX idx_exports_created_at ON exports(created_at);

-- Full text search indexes
CREATE INDEX idx_stories_title_search ON stories USING gin(to_tsvector('english', title));
CREATE INDEX idx_stories_premise_search ON stories USING gin(to_tsvector('english', premise));
CREATE INDEX idx_chapters_content_search ON chapters USING gin(to_tsvector('english', content));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_story_plans_updated_at BEFORE UPDATE ON story_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON chapters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_configs_updated_at BEFORE UPDATE ON ai_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update story word count from chapters
CREATE OR REPLACE FUNCTION update_story_word_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stories 
    SET actual_length = (
        SELECT COALESCE(SUM(word_count), 0)
        FROM chapters 
        WHERE story_id = COALESCE(NEW.story_id, OLD.story_id)
        AND status IN ('generated', 'revised')
    )
    WHERE id = COALESCE(NEW.story_id, OLD.story_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_story_word_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON chapters
    FOR EACH ROW EXECUTE FUNCTION update_story_word_count();

-- Constraints to ensure only one default AI config per user
CREATE UNIQUE INDEX idx_ai_configs_user_default ON ai_configurations(user_id) 
WHERE is_default = true;

-- Constraints to ensure only one default prompt template per category/genre
CREATE UNIQUE INDEX idx_prompt_templates_default ON prompt_templates(user_id, category, COALESCE(genre, '')) 
WHERE is_default = true;

-- Insert default system prompt templates
INSERT INTO prompt_templates (name, category, task_type, template_content, variables, is_default, is_public) VALUES 
('Default Story Planning', 'planning', 'story_outline', 
'Create a detailed story plan for a {{genre}} story with {{target_length}} words.

Target audience: {{age_group}}
Themes: {{themes}}
Tone: {{tone}}

Generate:
1. High-level story arc with major plot points
2. Chapter breakdown (approximately {{estimated_chapters}} chapters)
3. Character development timeline
4. Key turning moments
5. Thematic development

Ensure the structure follows {{genre}} conventions and maintains {{tone}} throughout.',
'[{"name": "genre", "required": true}, {"name": "target_length", "required": true}, {"name": "age_group", "required": true}, {"name": "themes", "required": false}, {"name": "tone", "required": false}, {"name": "estimated_chapters", "required": true}]',
true, true),

('Default Chapter Generation', 'chapter', 'chapter_content',
'Generate Chapter {{chapter_number}} for this {{genre}} story.

STORY CONTEXT:
{{story_plan}}

PREVIOUS CHAPTERS SUMMARY:
{{previous_chapters}}

THIS CHAPTER GOALS:
{{chapter_summary}}

CHARACTERS:
{{character_profiles}}

REQUIREMENTS:
- Target length: {{target_word_count}} words
- POV: {{pov}}
- Tone: {{tone}}
- Age rating: {{content_rating}}

Generate the full chapter content with proper pacing and character development.',
'[{"name": "chapter_number", "required": true}, {"name": "genre", "required": true}, {"name": "story_plan", "required": true}, {"name": "previous_chapters", "required": false}, {"name": "chapter_summary", "required": true}, {"name": "character_profiles", "required": true}, {"name": "target_word_count", "required": true}, {"name": "pov", "required": true}, {"name": "tone", "required": false}, {"name": "content_rating", "required": true}]',
true, true);

-- Migration complete
INSERT INTO schema_migrations (version, applied_at) VALUES ('001_initial_schema', NOW());

-- Create migrations tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
);