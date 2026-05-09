import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { DatabaseService } from './database/database.service';
import { DocumentsController } from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { OpenaiService } from './openai/openai.service';
import { PdfTextService } from './pdf/pdf-text.service';

@Module({
  imports: [],
  controllers: [AppController, DocumentsController, ChatController],
  providers: [DatabaseService, OpenaiService, PdfTextService, DocumentsService, ChatService],
})
export class AppModule {}
