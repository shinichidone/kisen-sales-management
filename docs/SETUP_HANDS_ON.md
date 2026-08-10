# 手作業セットアップ手順（初心者向け）

Phase1 を動かすために、あなた側で行う設定です。

---

## 1. Supabase プロジェクト作成

1. ブラウザで https://supabase.com/ を開く
2. **Start your project** / ログイン
3. **New project** を押す
4. 入力例:
   - Name: `kisen-sales-management`
   - Database Password: 強いパスワード（控えておく）
   - Region: `Northeast Asia (Tokyo)` があればそれを選択
5. **Create new project** を押して完了待ち

### APIキーを控える

1. 左メニュー **Project Settings**（歯車）
2. **API**
3. 次をコピー:
   - **Project URL** → `.env` の `VITE_SUPABASE_URL`
   - **anon public** → `.env` の `VITE_SUPABASE_ANON_KEY`
4. **service_role** はコピーしない・フロントに置かない

### SQLを実行

1. 左メニュー **SQL Editor**
2. **New query**
3. このリポジトリの  
   `supabase/migrations/20260310000000_phase1_facilities.sql`  
   をすべて貼り付け
4. **Run**
5. 左メニュー **Table Editor** で `services` に3件あることを確認

---

## 2. Google Cloud / Maps API

1. https://console.cloud.google.com/ を開く
2. 上部でプロジェクトを作成（例: `kisen-sales-management`）
3. 課金アカウントをリンク（無料枠内運用想定。必ず予算アラートを設定）

### APIを有効化

1. **APIとサービス** → **ライブラリ**
2. 次だけ有効化:
   - **Maps JavaScript API**
   - **Places API**

### APIキー作成

1. **APIとサービス** → **認証情報**
2. **認証情報を作成** → **APIキー**
3. キーを制限:
   - アプリケーション制限: **HTTPリファラー**
   - 例:
     - `http://localhost:5173/*`
     - `http://127.0.0.1:5173/*`
     - （後で）`https://YOUR_SITE.netlify.app/*`
   - API制限: 上記2つのAPIのみ
4. キーを `.env` の `VITE_GOOGLE_MAPS_API_KEY` に貼る

---

## 3. ローカルの .env

プロジェクト直下で:

```bash
cp .env.example .env
```

`.env` を編集して値を入れたら:

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く。

---

## 4. GitHub リポジトリ（未作成の場合）

ターミナルで（`gh` ログイン済みなら）:

```bash
cd /Users/nakac/src/kisen-sales-management
gh auth login
gh repo create kisen-sales-management --private --source=. --remote=origin --push
git push -u origin main
git push -u origin feature/map-foundation
```

Webから作る場合:

1. https://github.com/new
2. Repository name: `kisen-sales-management`
3. Private 推奨
4. READMEは追加しない（ローカルが本体）
5. 表示される `git remote add origin ...` と `git push` を実行

---

## 5. 動作確認チェックリスト

- [ ] 地図が表示される
- [ ] 施設名検索で候補が出る
- [ ] 候補選択で住所・緯度経度が入る
- [ ] 施設種別・サービスを選んで保存できる
- [ ] 再読み込み後もピンが残る
- [ ] 同じ施設を再度保存すると重複警告が出る
- [ ] 手動登録ができる
- [ ] スマホ幅でも操作できる
