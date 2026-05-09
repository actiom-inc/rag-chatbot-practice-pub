import { Injectable } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { ChunkSearchResult } from '../documents/documents.types';
import { OpenaiService } from '../openai/openai.service';
import { ChatResponse, ChatSource } from './chat.types';

@Injectable()
export class ChatService {
  constructor(
    private readonly openai: OpenaiService,
    private readonly documents: DocumentsService,
  ) {}

  async chat(message: string, topK: number): Promise<ChatResponse> {
    const embedding = await this.openai.createEmbedding(message);
    const chunks = await this.documents.searchSimilarChunks(embedding, topK);
    const sources = chunks.map((chunk) => this.toSource(chunk));

    if (chunks.length === 0) {
      return {
        answer: '文書内では確認できません',
        sources,
      };
    }

    const context = chunks
      .map((chunk, index) => this.formatContextChunk(chunk, index + 1))
      .join('\n\n');
    const answer = await this.openai.answerWithContext(message, context);

    return {
      answer,
      sources,
    };
  }

  private formatContextChunk(chunk: ChunkSearchResult, sourceNumber: number): string {
    const pageRange = this.formatPageRange(chunk.pageStart, chunk.pageEnd);

    return [
      `[source ${sourceNumber}]`,
      `documentId: ${chunk.documentId}`,
      `filename: ${chunk.filename}`,
      `chunkIndex: ${chunk.chunkIndex}`,
      `pages: ${pageRange}`,
      `similarity: ${chunk.similarity.toFixed(4)}`,
      'content:',
      chunk.content,
    ].join('\n');
  }

  private toSource(chunk: ChunkSearchResult): ChatSource {
    return {
      documentId: chunk.documentId,
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      similarity: chunk.similarity,
      contentPreview: this.preview(chunk.content),
    };
  }

  private formatPageRange(
    pageStart: number | null,
    pageEnd: number | null,
  ): string {
    if (pageStart === null) {
      return 'unknown';
    }

    if (pageEnd === null || pageStart === pageEnd) {
      return String(pageStart);
    }

    return `${pageStart}-${pageEnd}`;
  }

  private preview(content: string): string {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
  }
}
