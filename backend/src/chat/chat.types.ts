export type ChatRequest = {
  message: string;
  topK?: number;
};

export type ChatSource = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number;
  contentPreview: string;
};

export type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};
