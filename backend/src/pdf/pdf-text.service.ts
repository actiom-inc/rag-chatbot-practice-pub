import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ExtractedPage } from './chunker';

@Injectable()
export class PdfTextService {
  async extractPages(buffer: Buffer): Promise<ExtractedPage[]> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });

    try {
      const result = await parser.getText({
        lineEnforce: true,
        cellSeparator: ' ',
        pageJoiner: '\n',
      });

      const pages = result.pages.map((page) => ({
        pageNumber: page.num,
        text: page.text,
      }));

      if (pages.every((page) => !page.text.trim()) && result.text.trim()) {
        return [{ pageNumber: 1, text: result.text }];
      }

      return pages;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`PDF text extraction failed: ${message}`);
    } finally {
      await parser.destroy();
    }
  }
}
