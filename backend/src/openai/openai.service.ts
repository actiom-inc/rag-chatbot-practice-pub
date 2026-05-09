import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { EMBEDDING_DIMENSIONS } from '../vector/vector.utils';

type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

type ResponseContent = {
  type?: string;
  text?: string;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseContent[];
};

type ResponseWithOutputText = {
  output_text?: string;
  output?: ResponseOutputItem[];
};

@Injectable()
export class OpenaiService {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly client = this.apiKey
    ? new OpenAI({ apiKey: this.apiKey })
    : null;

  readonly chatModel = process.env.OPENAI_CHAT_MODEL ?? 'gpt-5.5';
  readonly embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-large';
  readonly reasoningEffort = this.parseReasoningEffort(
    process.env.OPENAI_REASONING_EFFORT ?? 'low',
  );

  async createEmbeddings(inputs: string[]): Promise<number[][]> {
    const client = this.getClient();

    if (inputs.length === 0) {
      return [];
    }

    const response = await client.embeddings.create({
      model: this.embeddingModel,
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: 'float',
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async createEmbedding(input: string): Promise<number[]> {
    const [embedding] = await this.createEmbeddings([input]);
    if (!embedding) {
      throw new Error('OpenAI Embeddings API did not return an embedding');
    }

    return embedding;
  }

  async answerWithContext(message: string, context: string): Promise<string> {
    const client = this.getClient();

    const response = await client.responses.create({
      model: this.chatModel,
      instructions: [
        'あなたは文書検索結果だけを根拠に回答するRAGチャットボットです。',
        'contextにない内容は推測しないでください。',
        '不明な場合は「文書内では確認できません」と答えてください。',
        '日本語で回答してください。',
        '可能なら参照元ファイル名・ページ番号を示してください。',
      ].join('\n'),
      input: [
        '以下のcontextを根拠に質問へ回答してください。',
        '',
        '<context>',
        context || '関連する文書チャンクは見つかりませんでした。',
        '</context>',
        '',
        '<question>',
        message,
        '</question>',
      ].join('\n'),
      reasoning: {
        effort: this.reasoningEffort,
      },
    });

    return this.extractOutputText(response);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured. Set it in .env before using RAG APIs.',
      );
    }

    return this.client;
  }

  private parseReasoningEffort(value: string): ReasoningEffort {
    const allowed: ReasoningEffort[] = [
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ];

    if (allowed.includes(value as ReasoningEffort)) {
      return value as ReasoningEffort;
    }

    return 'low';
  }

  private extractOutputText(response: unknown): string {
    const output = response as ResponseWithOutputText;
    if (output.output_text) {
      return output.output_text.trim();
    }

    const text = output.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text' && content.text)
      .map((content) => content.text)
      .join('\n')
      .trim();

    return text || '文書内では確認できません';
  }
}
