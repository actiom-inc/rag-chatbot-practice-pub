import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { DocumentListItem } from './documents.types';

@Controller('api/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentListItem> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!this.isPdf(file)) {
      throw new BadRequestException('PDFファイルのみアップロードできます。');
    }

    return this.documentsService.uploadPdf(file);
  }

  @Get()
  async list(): Promise<DocumentListItem[]> {
    return this.documentsService.listDocuments();
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.documentsService.deleteDocument(id);
    return { ok: true };
  }

  private isPdf(file: Express.Multer.File): boolean {
    return (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    );
  }
}
