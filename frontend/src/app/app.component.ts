import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type DocumentStatus = 'processing' | 'completed' | 'failed';

type DocumentItem = {
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

type ChatSource = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number;
  contentPreview: string;
};

type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  readonly documents = signal<DocumentItem[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly isUploading = signal(false);
  readonly isLoadingDocuments = signal(false);
  readonly isSending = signal(false);
  readonly documentError = signal('');
  readonly chatError = signal('');
  readonly chatResponse = signal<ChatResponse | null>(null);

  chatMessage = '';
  topK = 5;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    this.documentError.set('');
  }

  uploadDocument(): void {
    const file = this.selectedFile();
    if (!file) {
      this.documentError.set('PDFファイルを選択してください。');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    this.isUploading.set(true);
    this.documentError.set('');

    this.http.post<DocumentItem>('/api/documents/upload', formData).subscribe({
      next: () => {
        this.selectedFile.set(null);
        this.isUploading.set(false);
        this.loadDocuments();
      },
      error: (error: HttpErrorResponse) => {
        this.isUploading.set(false);
        this.documentError.set(this.extractErrorMessage(error));
        this.loadDocuments();
      },
    });
  }

  loadDocuments(): void {
    this.isLoadingDocuments.set(true);

    this.http.get<DocumentItem[]>('/api/documents').subscribe({
      next: (documents) => {
        this.documents.set(documents);
        this.isLoadingDocuments.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.documentError.set(this.extractErrorMessage(error));
        this.isLoadingDocuments.set(false);
      },
    });
  }

  deleteDocument(documentId: string): void {
    this.http.delete(`/api/documents/${documentId}`).subscribe({
      next: () => this.loadDocuments(),
      error: (error: HttpErrorResponse) => {
        this.documentError.set(this.extractErrorMessage(error));
      },
    });
  }

  sendChat(): void {
    const message = this.chatMessage.trim();
    if (!message) {
      this.chatError.set('質問を入力してください。');
      return;
    }

    this.isSending.set(true);
    this.chatError.set('');
    this.chatResponse.set(null);

    this.http
      .post<ChatResponse>('/api/chat', {
        message,
        topK: this.topK,
      })
      .subscribe({
        next: (response) => {
          this.chatResponse.set(response);
          this.isSending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.chatError.set(this.extractErrorMessage(error));
          this.isSending.set(false);
        },
      });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  statusLabel(status: DocumentStatus): string {
    const labels: Record<DocumentStatus, string> = {
      processing: '処理中',
      completed: '完了',
      failed: '失敗',
    };

    return labels[status];
  }

  pageLabel(source: Pick<ChatSource, 'pageStart' | 'pageEnd'>): string {
    if (source.pageStart === null) {
      return 'ページ不明';
    }

    if (source.pageEnd === null || source.pageStart === source.pageEnd) {
      return `${source.pageStart}ページ`;
    }

    return `${source.pageStart}-${source.pageEnd}ページ`;
  }

  percent(value: number): string {
    return `${Math.round(value * 1000) / 10}%`;
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    const response = error.error as { message?: string | string[] } | undefined;
    if (Array.isArray(response?.message)) {
      return response.message.join(' ');
    }

    return response?.message ?? error.message ?? 'エラーが発生しました。';
  }
}
