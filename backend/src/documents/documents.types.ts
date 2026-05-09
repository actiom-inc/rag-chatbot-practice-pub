export type DocumentStatus = 'processing' | 'completed' | 'failed';

export type DocumentListItem = {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
};

export type ChunkSearchResult = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number;
  content: string;
};
