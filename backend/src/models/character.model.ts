import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { logger } from '../config/logger';

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';
export type CharacterArcType = 'flat' | 'positive' | 'negative' | 'transformation';

export interface CharacterRelationship {
  characterId: string;
  characterName: string;
  relationshipType: 'family' | 'friend' | 'enemy' | 'lover' | 'mentor' | 'student' | 'rival' | 'ally' | 'neutral' | 'complex';
  description: string;
  strength: number; // 1-10 scale
  changesThroughStory: boolean;
}

export interface CharacterAppearance {
  age?: number;
  gender?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string;
  clothing?: string;
  accessories?: string[];
}

export interface CharacterPersonality {
  traits: string[];
  strengths: string[];
  weaknesses: string[];
  fears: string[];
  desires: string[];
  values: string[];
  habits: string[];
  speechPattern?: string;
  mannerisms?: string[];
}

export interface CharacterDevelopment {
  chapterNumber: number;
  developmentNotes: string;
  emotionalState: string;
  relationshipChanges?: string[];
  goalProgress: number; // 0-100 percentage
  characterGrowth: string;
  keyEvents: string[];
}

export interface Character {
  id: string;
  storyId: string;
  name: string;
  role: CharacterRole;
  archetype?: string;
  description?: string;
  backstory?: string;
  goal?: string;
  flaw?: string;
  arcType?: CharacterArcType;
  relationships: CharacterRelationship[];
  appearance?: CharacterAppearance;
  personality?: CharacterPersonality;
  firstAppearance?: number;
  prominence?: number;
  development: CharacterDevelopment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterData {
  storyId: string;
  name: string;
  role: CharacterRole;
  archetype?: string;
  description?: string;
  backstory?: string;
  goal?: string;
  flaw?: string;
  arcType?: CharacterArcType;
  appearance?: CharacterAppearance;
  personality?: CharacterPersonality;
  firstAppearance?: number;
  prominence?: number;
}

export interface UpdateCharacterData {
  name?: string;
  role?: CharacterRole;
  archetype?: string;
  description?: string;
  backstory?: string;
  goal?: string;
  flaw?: string;
  arcType?: CharacterArcType;
  relationships?: CharacterRelationship[];
  appearance?: CharacterAppearance;
  personality?: CharacterPersonality;
  firstAppearance?: number;
  prominence?: number;
  development?: CharacterDevelopment[];
}

export interface CharacterSummary {
  id: string;
  name: string;
  role: CharacterRole;
  archetype?: string;
  firstAppearance?: number;
  prominence?: number;
}

export class CharacterModel {
  /**
   * Create a new character
   */
  static async create(characterData: CreateCharacterData): Promise<Character> {
    const id = uuidv4();
    
    // Validate prominence if provided
    if (characterData.prominence !== undefined && !this.isValidProminence(characterData.prominence)) {
      throw new Error('Prominence must be between 0 and 100');
    }

    try {
      const result = await query(`
        INSERT INTO characters (
          id, story_id, name, role, archetype, description, backstory,
          goal, flaw, arc_type, relationships, appearance, personality,
          first_appearance, prominence, development, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING *
      `, [
        id,
        characterData.storyId,
        characterData.name.trim(),
        characterData.role,
        characterData.archetype || null,
        characterData.description || null,
        characterData.backstory || null,
        characterData.goal || null,
        characterData.flaw || null,
        characterData.arcType || null,
        JSON.stringify([]), // initial empty relationships
        characterData.appearance ? JSON.stringify(characterData.appearance) : null,
        characterData.personality ? JSON.stringify(characterData.personality) : null,
        characterData.firstAppearance || null,
        characterData.prominence || null,
        JSON.stringify([]), // initial empty development
      ]);

      const character = this.mapDatabaseRowToCharacter(result.rows[0]);
      logger.info('Character created successfully', { 
        characterId: id, 
        storyId: characterData.storyId,
        name: characterData.name
      });
      
      return character;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`Character with name "${characterData.name}" already exists in this story`);
      }
      logger.error('Failed to create character', { error, characterData });
      throw error;
    }
  }

  /**
   * Find character by ID
   */
  static async findById(id: string): Promise<Character | null> {
    try {
      const result = await query(`
        SELECT * FROM characters WHERE id = $1
      `, [id]);

      return result.rows.length > 0 ? this.mapDatabaseRowToCharacter(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find character by ID', { error, characterId: id });
      throw error;
    }
  }

  /**
   * Find character by story ID and name
   */
  static async findByStoryAndName(storyId: string, name: string): Promise<Character | null> {
    try {
      const result = await query(`
        SELECT * FROM characters 
        WHERE story_id = $1 AND LOWER(name) = LOWER($2)
      `, [storyId, name.trim()]);

      return result.rows.length > 0 ? this.mapDatabaseRowToCharacter(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find character by story and name', { error, storyId, name });
      throw error;
    }
  }

  /**
   * Find all characters for a story
   */
  static async findByStoryId(storyId: string): Promise<Character[]> {
    try {
      const result = await query(`
        SELECT * FROM characters 
        WHERE story_id = $1 
        ORDER BY role ASC, prominence DESC, name ASC
      `, [storyId]);

      return result.rows.map(row => this.mapDatabaseRowToCharacter(row));
    } catch (error) {
      logger.error('Failed to find characters by story ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Get character summaries for a story
   */
  static async getStorySummaries(storyId: string): Promise<CharacterSummary[]> {
    try {
      const result = await query(`
        SELECT id, name, role, archetype, first_appearance, prominence
        FROM characters 
        WHERE story_id = $1 
        ORDER BY role ASC, prominence DESC, name ASC
      `, [storyId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        role: row.role as CharacterRole,
        archetype: row.archetype || undefined,
        firstAppearance: row.first_appearance || undefined,
        prominence: row.prominence || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get character summaries', { error, storyId });
      throw error;
    }
  }

  /**
   * Update character
   */
  static async update(id: string, updateData: UpdateCharacterData): Promise<Character | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Validate prominence if provided
    if (updateData.prominence !== undefined && !this.isValidProminence(updateData.prominence)) {
      throw new Error('Prominence must be between 0 and 100');
    }

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = this.getDbFieldName(key);
        if (this.isJsonField(key)) {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramIndex++}`);
          values.push(value);
        }
      }
    });

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const result = await query(`
        UPDATE characters 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      const character = this.mapDatabaseRowToCharacter(result.rows[0]);
      logger.info('Character updated successfully', { characterId: id });
      
      return character;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new Error(`Character name already exists in this story`);
      }
      logger.error('Failed to update character', { error, characterId: id, updateData });
      throw error;
    }
  }

  /**
   * Add relationship between characters
   */
  static async addRelationship(
    characterId: string, 
    relationship: CharacterRelationship
  ): Promise<Character | null> {
    const character = await this.findById(characterId);
    if (!character) {
      return null;
    }

    // Check if relationship already exists
    const existingRelIndex = character.relationships.findIndex(
      rel => rel.characterId === relationship.characterId
    );

    if (existingRelIndex >= 0) {
      // Update existing relationship
      character.relationships[existingRelIndex] = relationship;
    } else {
      // Add new relationship
      character.relationships.push(relationship);
    }

    return this.update(characterId, { relationships: character.relationships });
  }

  /**
   * Remove relationship between characters
   */
  static async removeRelationship(characterId: string, otherCharacterId: string): Promise<Character | null> {
    const character = await this.findById(characterId);
    if (!character) {
      return null;
    }

    character.relationships = character.relationships.filter(
      rel => rel.characterId !== otherCharacterId
    );

    return this.update(characterId, { relationships: character.relationships });
  }

  /**
   * Add character development entry
   */
  static async addDevelopment(
    characterId: string, 
    developmentEntry: CharacterDevelopment
  ): Promise<Character | null> {
    const character = await this.findById(characterId);
    if (!character) {
      return null;
    }

    // Check if development for this chapter already exists
    const existingIndex = character.development.findIndex(
      dev => dev.chapterNumber === developmentEntry.chapterNumber
    );

    if (existingIndex >= 0) {
      // Update existing development
      character.development[existingIndex] = developmentEntry;
    } else {
      // Add new development and sort by chapter number
      character.development.push(developmentEntry);
      character.development.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    return this.update(characterId, { development: character.development });
  }

  /**
   * Delete character
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await query(`
        DELETE FROM characters WHERE id = $1
      `, [id]);

      const success = result.rowCount > 0;
      if (success) {
        logger.info('Character deleted successfully', { characterId: id });
      }
      
      return success;
    } catch (error) {
      logger.error('Failed to delete character', { error, characterId: id });
      throw error;
    }
  }

  /**
   * Delete all characters for a story
   */
  static async deleteByStoryId(storyId: string): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM characters WHERE story_id = $1
      `, [storyId]);

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        logger.info('Characters deleted for story', { storyId, deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete characters by story ID', { error, storyId });
      throw error;
    }
  }

  /**
   * Find characters by role
   */
  static async findByRole(storyId: string, role: CharacterRole): Promise<Character[]> {
    try {
      const result = await query(`
        SELECT * FROM characters 
        WHERE story_id = $1 AND role = $2 
        ORDER BY prominence DESC, name ASC
      `, [storyId, role]);

      return result.rows.map(row => this.mapDatabaseRowToCharacter(row));
    } catch (error) {
      logger.error('Failed to find characters by role', { error, storyId, role });
      throw error;
    }
  }

  /**
   * Get main characters for a story (protagonists and antagonists)
   */
  static async getMainCharacters(storyId: string): Promise<Character[]> {
    try {
      const result = await query(`
        SELECT * FROM characters 
        WHERE story_id = $1 AND role IN ('protagonist', 'antagonist')
        ORDER BY role ASC, prominence DESC, name ASC
      `, [storyId]);

      return result.rows.map(row => this.mapDatabaseRowToCharacter(row));
    } catch (error) {
      logger.error('Failed to get main characters', { error, storyId });
      throw error;
    }
  }

  /**
   * Get character count by role for a story
   */
  static async getCharacterCountByRole(storyId: string): Promise<{
    protagonist: number;
    antagonist: number;
    supporting: number;
    minor: number;
  }> {
    try {
      const result = await query(`
        SELECT 
          role,
          COUNT(*) as count
        FROM characters 
        WHERE story_id = $1
        GROUP BY role
      `, [storyId]);

      const counts = {
        protagonist: 0,
        antagonist: 0,
        supporting: 0,
        minor: 0,
      };

      result.rows.forEach(row => {
        counts[row.role as CharacterRole] = parseInt(row.count);
      });

      return counts;
    } catch (error) {
      logger.error('Failed to get character count by role', { error, storyId });
      throw error;
    }
  }

  /**
   * Validate story has at least one protagonist
   */
  static async validateStoryCharacters(storyId: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    try {
      const counts = await this.getCharacterCountByRole(storyId);
      const issues: string[] = [];

      if (counts.protagonist === 0) {
        issues.push('Story must have at least one protagonist');
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Failed to validate story characters', { error, storyId });
      throw error;
    }
  }

  /**
   * Get characters appearing in specific chapter
   */
  static async getCharactersInChapter(storyId: string, chapterNumber: number): Promise<Character[]> {
    try {
      const result = await query(`
        SELECT * FROM characters 
        WHERE story_id = $1 
        AND (first_appearance <= $2 OR first_appearance IS NULL)
        AND (
          development::text LIKE $3 
          OR first_appearance = $2
        )
        ORDER BY role ASC, prominence DESC, name ASC
      `, [
        storyId, 
        chapterNumber, 
        `%"chapterNumber":${chapterNumber}%`
      ]);

      return result.rows.map(row => this.mapDatabaseRowToCharacter(row));
    } catch (error) {
      logger.error('Failed to get characters in chapter', { error, storyId, chapterNumber });
      throw error;
    }
  }

  /**
   * Get available character archetypes
   */
  static getAvailableArchetypes(): string[] {
    return [
      'Hero', 'Mentor', 'Threshold Guardian', 'Herald', 'Shapeshifter',
      'Shadow', 'Ally', 'Trickster', 'Innocent', 'Explorer', 'Sage',
      'Outlaw', 'Magician', 'Regular Guy', 'Lover', 'Jester', 'Caregiver',
      'Creator', 'Ruler'
    ];
  }

  /**
   * Get available relationship types
   */
  static getAvailableRelationshipTypes(): string[] {
    return [
      'family', 'friend', 'enemy', 'lover', 'mentor', 'student', 
      'rival', 'ally', 'neutral', 'complex'
    ];
  }

  /**
   * Validate prominence value
   */
  static isValidProminence(prominence: number): boolean {
    return prominence >= 0 && prominence <= 100;
  }

  /**
   * Check if field is JSON field
   */
  private static isJsonField(field: string): boolean {
    const jsonFields = [
      'relationships', 'appearance', 'personality', 'development'
    ];
    return jsonFields.includes(field);
  }

  /**
   * Map TypeScript field name to database field name
   */
  private static getDbFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
      storyId: 'story_id',
      arcType: 'arc_type',
      firstAppearance: 'first_appearance',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    return fieldMap[field] || field;
  }

  /**
   * Parse JSON field safely
   */
  private static parseJsonField<T>(value: any): T | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Map database row to Character object
   */
  private static mapDatabaseRowToCharacter(row: any): Character {
    return {
      id: row.id,
      storyId: row.story_id,
      name: row.name,
      role: row.role as CharacterRole,
      archetype: row.archetype || undefined,
      description: row.description || undefined,
      backstory: row.backstory || undefined,
      goal: row.goal || undefined,
      flaw: row.flaw || undefined,
      arcType: row.arc_type as CharacterArcType || undefined,
      relationships: this.parseJsonField<CharacterRelationship[]>(row.relationships) || [],
      appearance: this.parseJsonField<CharacterAppearance>(row.appearance),
      personality: this.parseJsonField<CharacterPersonality>(row.personality),
      firstAppearance: row.first_appearance || undefined,
      prominence: row.prominence || undefined,
      development: this.parseJsonField<CharacterDevelopment[]>(row.development) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}