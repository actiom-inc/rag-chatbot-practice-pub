import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class AppController {
  @Get('message')
  getMessage(): { message: string } {
    return {
      message:
        'このアプリケーションはrag-chatbotを開発するための雛形アプリです。',
    };
  }
}

