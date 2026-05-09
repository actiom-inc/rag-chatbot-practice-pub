export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type ChunkMetadata = {
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  charStart: number;
  charEnd: number;
};

export type DocumentChunkDraft = {
  chunkIndex: number;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  metadata: ChunkMetadata;
};

type PageSpan = {
  pageNumber: number;
  start: number;
  end: number;
};

export type ChunkPagesOptions = {
  targetChars?: number;
  overlapChars?: number;
};

const DEFAULT_TARGET_CHARS = 4200;
const DEFAULT_OVERLAP_CHARS = 700;

export function chunkPages(
  pages: ExtractedPage[],
  options: ChunkPagesOptions = {},
): DocumentChunkDraft[] {
  const targetChars = options.targetChars ?? DEFAULT_TARGET_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const { text, pageSpans } = combinePages(pages);

  if (!text) {
    return [];
  }

  const chunks: DocumentChunkDraft[] = [];
  let start = 0;

  while (start < text.length) {
    const rawEnd = Math.min(start + targetChars, text.length);
    const end = chooseChunkEnd(text, start, rawEnd, targetChars);
    const rawChunk = text.slice(start, end);
    const leadingWhitespace = rawChunk.length - rawChunk.trimStart().length;
    const trailingWhitespace = rawChunk.length - rawChunk.trimEnd().length;
    const contentStart = start + leadingWhitespace;
    const contentEnd = end - trailingWhitespace;
    const content = text.slice(contentStart, contentEnd);

    if (content) {
      const { pageStart, pageEnd } = getPageRange(
        pageSpans,
        contentStart,
        contentEnd,
      );
      const chunkIndex = chunks.length;

      chunks.push({
        chunkIndex,
        content,
        pageStart,
        pageEnd,
        metadata: {
          chunkIndex,
          pageStart,
          pageEnd,
          charStart: contentStart,
          charEnd: contentEnd,
        },
      });
    }

    if (end >= text.length) {
      break;
    }

    start = moveToReadableStart(text, Math.max(end - overlapChars, start + 1));
  }

  return chunks;
}

function combinePages(pages: ExtractedPage[]): {
  text: string;
  pageSpans: PageSpan[];
} {
  const pageSpans: PageSpan[] = [];
  let text = '';

  for (const page of pages) {
    const pageText = normalizeText(page.text);
    if (!pageText) {
      continue;
    }

    if (text) {
      text += '\n\n';
    }

    const start = text.length;
    text += pageText;
    pageSpans.push({
      pageNumber: page.pageNumber,
      start,
      end: text.length,
    });
  }

  return { text, pageSpans };
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function chooseChunkEnd(
  text: string,
  start: number,
  rawEnd: number,
  targetChars: number,
): number {
  if (rawEnd >= text.length) {
    return text.length;
  }

  const minEnd = start + Math.floor(targetChars * 0.65);
  const boundary = findLastBoundary(text, minEnd, rawEnd);
  return boundary > start ? boundary : rawEnd;
}

function findLastBoundary(text: string, minEnd: number, maxEnd: number): number {
  const boundaries = ['\n\n', '\n', '。', '．', '.', '！', '!', '？', '?'];
  const window = text.slice(minEnd, maxEnd);
  let best = -1;

  for (const boundary of boundaries) {
    const index = window.lastIndexOf(boundary);
    if (index >= 0) {
      best = Math.max(best, minEnd + index + boundary.length);
    }
  }

  return best;
}

function getPageRange(
  pageSpans: PageSpan[],
  contentStart: number,
  contentEnd: number,
): { pageStart: number | null; pageEnd: number | null } {
  const matchingPages = pageSpans
    .filter((page) => page.end > contentStart && page.start < contentEnd)
    .map((page) => page.pageNumber);

  if (matchingPages.length === 0) {
    return { pageStart: null, pageEnd: null };
  }

  return {
    pageStart: Math.min(...matchingPages),
    pageEnd: Math.max(...matchingPages),
  };
}

function moveToReadableStart(text: string, start: number): number {
  const nextNewline = text.indexOf('\n', start);
  if (nextNewline >= 0 && nextNewline - start < 120) {
    return nextNewline + 1;
  }

  return start;
}
