import PDFDocument from 'pdfkit';
import EPub from 'epub-gen-memory';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { logger } from '../../config/logger';
import { StoryModel } from '../../models/story.model';
import { ChapterModel } from '../../models/chapter.model';
import { CharacterModel } from '../../models/character.model';
import { ExportModel, ExportFormat, FormatOptions, PDFOptions, EPUBOptions, DOCXOptions, MarkdownOptions } from '../../models/export.model';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportJob {
  exportId: string;
  storyId: string;
  format: ExportFormat;
  options: FormatOptions;
  outputPath: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  processingTime: number;
  error?: string;
}

export class ExportEngine {
  private readonly outputDir: string;

  constructor() {
    this.outputDir = process.env.EXPORT_OUTPUT_DIR || path.join(process.cwd(), 'exports');
    this.ensureOutputDirectory();
  }

  /**
   * Export story to specified format
   */
  async exportStory(job: ExportJob): Promise<ExportResult> {
    const startTime = Date.now();
    logger.info('Starting story export', { 
      exportId: job.exportId, 
      storyId: job.storyId, 
      format: job.format 
    });

    try {
      // Mark export as processing
      await ExportModel.markProcessing(job.exportId);

      // Load story data
      const storyData = await this.loadStoryData(job.storyId);
      
      // Export based on format
      let result: ExportResult;
      switch (job.format) {
        case 'pdf':
          result = await this.exportToPDF(storyData, job.options as PDFOptions, job.outputPath);
          break;
        case 'epub':
          result = await this.exportToEPUB(storyData, job.options as EPUBOptions, job.outputPath);
          break;
        case 'docx':
          result = await this.exportToDOCX(storyData, job.options as DOCXOptions, job.outputPath);
          break;
        case 'markdown':
          result = await this.exportToMarkdown(storyData, job.options as MarkdownOptions, job.outputPath);
          break;
        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      if (result.success && result.filePath) {
        // Update export record with success
        await ExportModel.markComplete(
          job.exportId,
          result.filePath,
          result.fileSize || 0,
          processingTime
        );

        logger.info('Story export completed successfully', {
          exportId: job.exportId,
          format: job.format,
          fileSize: result.fileSize,
          processingTime
        });
      } else {
        // Mark export as failed
        await ExportModel.markFailed(job.exportId, result.error || 'Unknown export error');
        
        logger.error('Story export failed', {
          exportId: job.exportId,
          format: job.format,
          error: result.error
        });
      }

      return { ...result, processingTime };

    } catch (error) {
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      
      // Mark export as failed
      await ExportModel.markFailed(job.exportId, error.message);
      
      logger.error('Story export error', {
        exportId: job.exportId,
        format: job.format,
        error: error.message
      });

      return {
        success: false,
        processingTime,
        error: error.message,
      };
    }
  }

  /**
   * Export story to PDF format
   */
  private async exportToPDF(
    storyData: StoryData,
    options: PDFOptions,
    outputPath: string
  ): Promise<ExportResult> {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: this.convertMargins(options.margin || { top: 1, right: 1, bottom: 1, left: 1 }),
        layout: options.pageOrientation || 'portrait',
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Title page
      if (options.includeTitlePage) {
        this.addPDFTitlePage(doc, storyData, options);
        doc.addPage();
      }

      // Table of contents
      if (options.includeTableOfContents) {
        this.addPDFTableOfContents(doc, storyData, options);
        doc.addPage();
      }

      // Chapters
      storyData.chapters.forEach((chapter, index) => {
        if (index > 0) doc.addPage();
        this.addPDFChapter(doc, chapter, options);
      });

      doc.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileSize: stats.size,
        processingTime: 0, // Will be calculated by caller
      };

    } catch (error) {
      return {
        success: false,
        processingTime: 0,
        error: error.message,
      };
    }
  }

  /**
   * Export story to EPUB format
   */
  private async exportToEPUB(
    storyData: StoryData,
    options: EPUBOptions,
    outputPath: string
  ): Promise<ExportResult> {
    try {
      const epubOptions = {
        title: storyData.story.title,
        author: `Generated by AI Story Generator`,
        publisher: 'AI Story Generator',
        cover: options.coverImage,
        css: options.css || this.getDefaultEPUBCSS(),
        content: storyData.chapters.map(chapter => ({
          title: chapter.title || `Chapter ${chapter.chapterNumber}`,
          data: this.formatChapterContent(chapter.content || '', 'html'),
        })),
        tocTitle: options.includeTableOfContents ? 'Table of Contents' : undefined,
      };

      const epub = new EPub(epubOptions);
      const buffer = await epub.genEpub();

      fs.writeFileSync(outputPath, buffer);
      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileSize: stats.size,
        processingTime: 0,
      };

    } catch (error) {
      return {
        success: false,
        processingTime: 0,
        error: error.message,
      };
    }
  }

  /**
   * Export story to DOCX format
   */
  private async exportToDOCX(
    storyData: StoryData,
    options: DOCXOptions,
    outputPath: string
  ): Promise<ExportResult> {
    try {
      const children: any[] = [];

      // Title page
      if (options.includeTitlePage) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: storyData.story.title,
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.TITLE,
            alignment: 'center',
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Genre: ${storyData.story.genre}`,
                size: 24,
              }),
            ],
            alignment: 'center',
            spacing: { after: 200 },
          })
        );

        if (storyData.story.premise) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: storyData.story.premise,
                  size: 20,
                  italics: true,
                }),
              ],
              alignment: 'center',
              spacing: { after: 400 },
            })
          );
        }

        // Page break
        children.push(new Paragraph({ pageBreakBefore: true }));
      }

      // Table of contents
      if (options.includeTableOfContents) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Table of Contents',
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          })
        );

        storyData.chapters.forEach(chapter => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Chapter ${chapter.chapterNumber}: ${chapter.title || 'Untitled'}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        });

        children.push(new Paragraph({ pageBreakBefore: true }));
      }

      // Chapters
      storyData.chapters.forEach((chapter, index) => {
        if (index > 0) {
          children.push(new Paragraph({ pageBreakBefore: true }));
        }

        // Chapter heading
        if (options.includeChapterHeadings) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: chapter.title || `Chapter ${chapter.chapterNumber}`,
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
            })
          );
        }

        // Chapter content
        if (chapter.content) {
          const paragraphs = chapter.content.split('\n\n');
          paragraphs.forEach(paragraphText => {
            if (paragraphText.trim()) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paragraphText.trim(),
                      size: (options.fontSize || 12) * 2, // DOCX uses half-points
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );
            }
          });
        }
      });

      const doc = new DocxDocument({
        sections: [{
          properties: {},
          children,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileSize: stats.size,
        processingTime: 0,
      };

    } catch (error) {
      return {
        success: false,
        processingTime: 0,
        error: error.message,
      };
    }
  }

  /**
   * Export story to Markdown format
   */
  private async exportToMarkdown(
    storyData: StoryData,
    options: MarkdownOptions,
    outputPath: string
  ): Promise<ExportResult> {
    try {
      let content = '';

      // Front matter
      if (options.frontMatter !== 'none') {
        const delimiter = options.frontMatter === 'yaml' ? '---' : '+++';
        content += `${delimiter}\n`;
        content += `title: "${storyData.story.title}"\n`;
        content += `genre: "${storyData.story.genre}"\n`;
        if (storyData.story.premise) {
          content += `premise: "${storyData.story.premise}"\n`;
        }
        content += `word_count: ${storyData.story.actualLength}\n`;
        content += `chapters: ${storyData.chapters.length}\n`;
        content += `generated_at: "${new Date().toISOString()}"\n`;
        content += `${delimiter}\n\n`;
      }

      // Title
      content += `# ${storyData.story.title}\n\n`;

      // Premise
      if (storyData.story.premise && options.includeMetadata) {
        content += `*${storyData.story.premise}*\n\n`;
      }

      // Metadata
      if (options.includeMetadata) {
        content += `**Genre:** ${storyData.story.genre}\n`;
        content += `**Word Count:** ${storyData.story.actualLength.toLocaleString()}\n`;
        content += `**Chapters:** ${storyData.chapters.length}\n\n`;
      }

      // Table of contents
      if (options.includeTableOfContents) {
        content += `## Table of Contents\n\n`;
        storyData.chapters.forEach(chapter => {
          const title = chapter.title || `Chapter ${chapter.chapterNumber}`;
          const anchor = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
          content += `- [${title}](#${anchor})\n`;
        });
        content += '\n';
      }

      // Chapters
      storyData.chapters.forEach(chapter => {
        const headingLevel = '#'.repeat(options.chapterHeadingLevel || 2);
        const title = chapter.title || `Chapter ${chapter.chapterNumber}`;
        
        content += `${headingLevel} ${title}\n\n`;
        
        if (chapter.content) {
          content += `${chapter.content}\n\n`;
        }
      });

      fs.writeFileSync(outputPath, content, 'utf8');
      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        fileSize: stats.size,
        processingTime: 0,
      };

    } catch (error) {
      return {
        success: false,
        processingTime: 0,
        error: error.message,
      };
    }
  }

  /**
   * Load complete story data
   */
  private async loadStoryData(storyId: string): Promise<StoryData> {
    const [story, chapters, characters] = await Promise.all([
      StoryModel.findById(storyId),
      ChapterModel.findByStoryId(storyId),
      CharacterModel.findByStoryId(storyId),
    ]);

    if (!story) {
      throw new Error('Story not found');
    }

    // Filter to only generated chapters and sort by chapter number
    const completedChapters = chapters
      .filter(chapter => chapter.status === 'generated' && chapter.content)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (completedChapters.length === 0) {
      throw new Error('No completed chapters found for export');
    }

    return {
      story,
      chapters: completedChapters,
      characters,
    };
  }

  /**
   * Add title page to PDF
   */
  private addPDFTitlePage(doc: PDFKit.PDFDocument, storyData: StoryData, options: PDFOptions): void {
    const fontSize = options.fontSize || 12;
    
    doc.fontSize(fontSize * 2).text(storyData.story.title, { align: 'center' });
    doc.moveDown(2);
    
    if (storyData.story.premise) {
      doc.fontSize(fontSize).text(storyData.story.premise, { align: 'center' });
      doc.moveDown(2);
    }
    
    doc.fontSize(fontSize * 0.8).text(`Genre: ${storyData.story.genre}`, { align: 'center' });
    doc.text(`Word Count: ${storyData.story.actualLength.toLocaleString()}`, { align: 'center' });
    doc.text(`Chapters: ${storyData.chapters.length}`, { align: 'center' });
  }

  /**
   * Add table of contents to PDF
   */
  private addPDFTableOfContents(doc: PDFKit.PDFDocument, storyData: StoryData, options: PDFOptions): void {
    const fontSize = options.fontSize || 12;
    
    doc.fontSize(fontSize * 1.5).text('Table of Contents', { align: 'center' });
    doc.moveDown(2);
    
    storyData.chapters.forEach(chapter => {
      const title = chapter.title || `Chapter ${chapter.chapterNumber}`;
      doc.fontSize(fontSize).text(`Chapter ${chapter.chapterNumber}: ${title}`);
      doc.moveDown(0.5);
    });
  }

  /**
   * Add chapter to PDF
   */
  private addPDFChapter(doc: PDFKit.PDFDocument, chapter: any, options: PDFOptions): void {
    const fontSize = options.fontSize || 12;
    
    if (options.includeChapterHeadings) {
      const title = chapter.title || `Chapter ${chapter.chapterNumber}`;
      doc.fontSize(fontSize * 1.2).text(title, { align: 'left' });
      doc.moveDown(1);
    }
    
    if (chapter.content) {
      doc.fontSize(fontSize).text(chapter.content, { align: 'justify' });
    }
  }

  /**
   * Convert margin object to PDFKit format
   */
  private convertMargins(margins: { top: number; right: number; bottom: number; left: number }): number {
    // Convert inches to points (1 inch = 72 points)
    return margins.top * 72;
  }

  /**
   * Get default EPUB CSS
   */
  private getDefaultEPUBCSS(): string {
    return `
      body {
        font-family: Georgia, serif;
        line-height: 1.6;
        margin: 1em;
      }
      h1, h2, h3 {
        color: #333;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      p {
        margin-bottom: 1em;
        text-align: justify;
      }
    `;
  }

  /**
   * Format chapter content for different output formats
   */
  private formatChapterContent(content: string, format: 'html' | 'text' = 'text'): string {
    if (format === 'html') {
      // Convert paragraphs to HTML
      return content
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.trim()}</p>`)
        .join('\n');
    }
    
    return content;
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

interface StoryData {
  story: any;
  chapters: any[];
  characters: any[];
}