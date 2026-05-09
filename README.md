# rag-chatbot-practice-pub

Angular と NestJS を Docker Compose で起動する、RAG chatbot 開発用の雛形アプリです。

## 構成

- `frontend`: Angular アプリをビルドし、nginx で配信します。
- `backend`: NestJS API サーバーです。
- `docker-compose.yml`: フロントエンドとバックエンドをまとめて起動します。

## セットアップと起動

### 前提条件

以下がインストールされている必要があります。

- Git
- Docker Desktop など、Docker Compose が使える Docker 環境

### 1. リポジトリをクローンする

```bash
git clone https://github.com/actiom-inc/rag-chatbot-practice-pub.git
cd rag-chatbot-practice-pub
```

### 2. Docker Compose でアプリケーションを起動する

```bash
docker compose up --build
```

初回起動時は Docker イメージのビルドと依存パッケージのインストールが実行されるため、数分かかる場合があります。

### 3. ブラウザで確認する

起動後、ブラウザで以下にアクセスしてください。

```text
http://localhost:8080
```

フロントエンドは `GET /api/message` を呼び、バックエンドから返された文字列を画面に表示します。

API の応答だけを確認したい場合は、以下を実行してください。

```bash
curl http://localhost:8080/api/message
```

### 4. アプリケーションを停止する

起動中のターミナルで `Ctrl + C` を押すと停止できます。

バックグラウンド起動した場合や、コンテナを明示的に停止・削除したい場合は以下を実行してください。

```bash
docker compose down
```

## API

```http
GET /api/message
```

レスポンス:

```json
{
  "message": "このアプリケーションはrag-chatbotを開発するための雛形アプリです。"
}
```
