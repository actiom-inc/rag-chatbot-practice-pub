import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { OpenaiService } from '../openai/openai.service';
import { chunkPages } from '../pdf/chunker';
import { PdfTextService } from '../pdf/pdf-text.service';
import { toVectorLiteral } from '../vector/vector.utils';
import {
  ChunkSearchResult,
  DocumentListItem,
  DocumentStatus,
} from './documents.types';

type DocumentRow = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  chunkCount: string;
};

type ChunkSearchRow = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number | string;
  content: string;
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly openai: OpenaiService,
    private readonly pdfText: PdfTextService,
  ) {}

  async uploadPdf(file: Express.Multer.File): Promise<DocumentListItem> {
    const documentId = randomUUID();

    await this.database.query(
      `
        INSERT INTO documents (id, filename, mime_type, file_size, status)
        VALUES ($1, $2, $3, $4, 'processing')
      `,
      [documentId, file.originalname, file.mimetype, file.size],
    );

    try {
      const pages = await this.pdfText.extractPages(file.buffer);
      const chunks = chunkPages(pages);

      if (chunks.length === 0) {
        throw new BadRequestException('PDFから抽出できるテキストがありません。');
      }

      const embeddings = await this.openai.createEmbeddings(
        chunks.map((chunk) => chunk.content),
      );

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`,
        );
      }

      const client = await this.database.connect();
      try {
        await client.query('BEGIN');

        for (const [index, chunk] of chunks.entries()) {
          await client.query(
            `
              INSERT INTO document_chunks (
                id,
                document_id,
                chunk_index,
                content,
                page_start,
                page_end,
                metadata,
                embedding
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector)
            `,
            [
              randomUUID(),
              documentId,
              chunk.chunkIndex,
              chunk.content,
              chunk.pageStart,
              chunk.pageEnd,
              JSON.stringify(chunk.metadata),
              toVectorLiteral(embeddings[index]),
            ],
          );
        }

        await client.query(
          `
            UPDATE documents
            SET status = 'completed',
                error_message = NULL,
                updated_at = now()
            WHERE id = $1
          `,
          [documentId],
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return this.getDocumentOrThrow(documentId);
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.logger.error(`PDF ingestion failed for ${documentId}: ${message}`);

      await this.markDocumentFailed(documentId, message);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(message);
    }
  }

  async listDocuments(): Promise<DocumentListItem[]> {
    const result = await this.database.query<DocumentRow>(
      `
        SELECT
          d.id,
          d.filename,
          d.mime_type AS "mimeType",
          d.file_size AS "fileSize",
          d.status,
          d.error_message AS "errorMessage",
          d.created_at AS "createdAt",
          d.updated_at AS "updatedAt",
          count(dc.id) AS "chunkCount"
        FROM documents d
        LEFT JOIN document_chunks dc ON dc.document_id = d.id
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `,
    );

    return result.rows.map((row) => this.mapDocumentRow(row));
  }

  async deleteDocument(id: string): Promise<void> {
    const result = await this.database.query('DELETE FROM documents WHERE id = $1', [
      id,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException('Document not found');
    }
  }

  async searchSimilarChunks(
    embedding: number[],
    topK: number,
  ): Promise<ChunkSearchResult[]> {
    const result = await this.database.query<ChunkSearchRow>(
      `
        SELECT
          dc.document_id AS "documentId",
          d.filename,
          dc.chunk_index AS "chunkIndex",
          dc.page_start AS "pageStart",
          dc.page_end AS "pageEnd",
          1 - (dc.embedding::halfvec(3072) <=> $1::halfvec(3072)) AS similarity,
          dc.content
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.status = 'completed'
        ORDER BY dc.embedding::halfvec(3072) <=> $1::halfvec(3072)
        LIMIT $2
      `,
      [toVectorLiteral(embedding), topK],
    );

    return result.rows.map((row) => ({
      documentId: row.documentId,
      filename: row.filename,
      chunkIndex: row.chunkIndex,
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
      similarity: Number(row.similarity),
      content: row.content,
    }));
  }

  private async getDocumentOrThrow(id: string): Promise<DocumentListItem> {
    const result = await this.database.query<DocumentRow>(
      `
        SELECT
          d.id,
          d.filename,
          d.mime_type AS "mimeType",
          d.file_size AS "fileSize",
          d.status,
          d.error_message AS "errorMessage",
          d.created_at AS "createdAt",
          d.updated_at AS "updatedAt",
          count(dc.id) AS "chunkCount"
        FROM documents d
        LEFT JOIN document_chunks dc ON dc.document_id = d.id
        WHERE d.id = $1
        GROUP BY d.id
      `,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Document not found');
    }

    return this.mapDocumentRow(row);
  }

  private async markDocumentFailed(
    documentId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.database.query(
        `
          UPDATE documents
          SET status = 'failed',
              error_message = $2,
              updated_at = now()
          WHERE id = $1
        `,
        [documentId, errorMessage.slice(0, 4000)],
      );
    } catch (error) {
      this.logger.error(
        `Failed to update document status for ${documentId}: ${this.getErrorMessage(
          error,
        )}`,
      );
    }
  }

  private mapDocumentRow(row: DocumentRow): DocumentListItem {
    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      chunkCount: Number(row.chunkCount),
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
