import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequest, ChatResponse } from './chat.types';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      throw new BadRequestException('message is required');
    }

    const topK = this.normalizeTopK(body.topK);
    return this.chatService.chat(body.message.trim(), topK);
  }

  private normalizeTopK(value: number | undefined): number {
    if (value === undefined) {
      return 5;
    }

    if (!Number.isInteger(value) || value < 1 || value > 20) {
      throw new BadRequestException('topK must be an integer from 1 to 20');
    }

    return value;
  }
}
