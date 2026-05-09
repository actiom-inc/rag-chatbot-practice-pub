# rag-chatbot-practice-pub

Angular frontend と NestJS backend で構成した、PDF RAG chatbot 開発用の雛形アプリです。

PDFをアップロードすると backend がテキスト抽出、チャンク分割、OpenAI Embeddings API によるベクトル化を行い、PostgreSQL + pgvector に保存します。チャットでは質問文をベクトル化して保存済みチャンクを cosine 類似度で検索し、検索結果を context として OpenAI Responses API に渡して回答します。

## 構成

- `frontend`: Angular アプリ。PDFアップロード、学習済みPDF一覧、チャット画面を提供します。
- `backend`: NestJS API サーバー。PDF学習、ドキュメント管理、RAGチャットを提供します。
- `db`: PostgreSQL + pgvector。`documents` と `document_chunks` を保存します。
- `backend/db/init`: DB 初期化SQL。`CREATE EXTENSION vector`、テーブル、index を作成します。

## セットアップ

### 前提条件

- Git
- Docker Desktop など、Docker Compose が使える Docker 環境
- OpenAI API キー

### 1. `.env` を作成する

```bash
cp .env.example .env
```

`.env` に OpenAI API キーを設定します。`.env` は `.gitignore` に含まれているため、リポジトリへコミットしないでください。

```env
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-5.5
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_REASONING_EFFORT=low
```

未指定時のデフォルト:

- `OPENAI_CHAT_MODEL`: `gpt-5.5`
- `OPENAI_EMBEDDING_MODEL`: `text-embedding-3-large`
- `OPENAI_REASONING_EFFORT`: `low`

Embedding 次元は `3072` 前提です。DB の `document_chunks.embedding` は `vector(3072)` です。pgvector の HNSW index は `vector(3072)` を直接 index 化できないため、`embedding::halfvec(3072)` の式 index を使います。

### 2. 起動する

```bash
docker compose up --build
```

起動後、ブラウザで以下にアクセスします。

```text
http://localhost:8080
```

停止する場合:

```bash
docker compose down
```

DB の永続化データも削除して初期化し直す場合:

```bash
docker compose down -v
```

## 使い方

1. `PDF学習` で PDF ファイルを選択してアップロードします。
2. backend が PDF からテキストを抽出し、チャンク分割して Embedding を作成します。
3. `学習済みPDF` の一覧に status、chunk 数、エラーが表示されます。
4. `チャット` に質問を入力して送信します。
5. 回答と参照元 chunk のファイル名、ページ番号、類似度、本文プレビューが表示されます。

OPENAI_API_KEY が未設定の場合、RAG API は `503 Service Unavailable` と分かりやすいエラーメッセージを返します。

## API

### `GET /api/message`

既存の疎通確認用 API です。

### `POST /api/documents/upload`

PDF 学習 API です。`multipart/form-data` で `file` を渡します。

```bash
curl -F "file=@sample.pdf" http://localhost:8080/api/documents/upload
```

主な処理:

- PDF以外は `400` を返す
- PDFテキストをページ単位で抽出
- 文字数ベースでチャンク分割
- `text-embedding-3-large` などで Embedding 作成
- `documents.status` を `processing`、`completed`、`failed` で更新
- 失敗時は `documents.error_message` に保存

### `GET /api/documents`

学習済みドキュメント一覧を返します。chunk 数も含みます。

```bash
curl http://localhost:8080/api/documents
```

### `DELETE /api/documents/:id`

指定したドキュメントと関連 chunk を削除します。

```bash
curl -X DELETE http://localhost:8080/api/documents/<document-id>
```

### `POST /api/chat`

保存済み chunk をベクトル検索し、OpenAI Responses API で回答します。

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"この文書の要点は？","topK":5}'
```

request:

```json
{
  "message": "string",
  "topK": 5
}
```

response:

```json
{
  "answer": "string",
  "sources": [
    {
      "documentId": "string",
      "filename": "string",
      "chunkIndex": 0,
      "pageStart": 1,
      "pageEnd": 2,
      "similarity": 0.82,
      "contentPreview": "string"
    }
  ]
}
```

回答ルール:

- contextにない内容は推測しない
- 不明な場合は「文書内では確認できません」と答える
- 日本語で回答する
- 可能なら参照元ファイル名・ページ番号を示す

## 開発用コマンド

backend:

```bash
cd backend
npm run build
npm test
```

frontend:

```bash
cd frontend
npm run build
```

compose 設定確認:

```bash
docker compose config
```
