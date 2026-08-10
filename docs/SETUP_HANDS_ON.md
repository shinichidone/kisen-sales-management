# 手作業セットアップ手順（初心者向け）

Phase1 を動かすために、あなた側で行う設定です。

**方針:** 社員名簿・家計簿と**同じ既存 Supabase プロジェクト**を使います。  
コードリポジトリ（`kisen-sales-management`）は独立のままです。

---

## 0. 重要（共有 Supabase の注意）

同じプロジェクトにテーブルを追加しますが、既存の `profiles` 等には触れません。

Phase1 は検証のため、暫定で `anon` から施設の閲覧・登録を許可しています。  
**anon キーは他アプリのフロントにも載るため、本番公開前に必ず RLS を締め直してください（STEP7）。**

---

## 1. 既存 Supabase の API 情報を控える

1. ブラウザで https://supabase.com/dashboard を開く
2. **社員名簿・家計簿で使っているプロジェクト**を選ぶ（新規作成しない）
3. 左下の **Project Settings**（歯車）→ **API**
4. 次をコピー（チャットには貼らない）:
   - **Project URL** → `.env` の `VITE_SUPABASE_URL`
   - **anon public** → `.env` の `VITE_SUPABASE_ANON_KEY`
5. **service_role** は使わない・フロントに置かない

社員名簿の `.env` に同じ値があれば、それを転記しても構いません。

---

## 2. SQL を実行（テーブル追加）

1. 左メニュー **SQL Editor**
2. **New query**
3. このリポジトリの  
   `supabase/migrations/20260310000000_phase1_facilities.sql`  
   を**すべて**貼り付け
4. **Run**（成功メッセージが出ること）
5. 左メニュー **Table Editor** で確認:
   - `services` … 3件（昭栄町 / 南花台 / 訪問看護）
   - `facilities` … 空でよい
   - `facility_target_services` … 空でよい

### もしエラーが出たら

| メッセージの例 | 対処 |
|---|---|
| `type "facility_type" already exists` | 以前実行済みの可能性。Table Editor で表があるか確認 |
| `relation "services" already exists` | 同上。中身が喜仙向け3件か確認 |
| 権限エラー | プロジェクトの Owner / 十分な権限で実行 |

既存テーブルを消さないでください。

---

## 3. Google Cloud / Maps API

1. https://console.cloud.google.com/ を開く
2. プロジェクトを作成または選択（例: `kisen-sales-management`）
3. 課金アカウントをリンク（無料枠内運用想定。**予算アラート必須**）

### API を有効化

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

## 4. ローカルの .env

プロジェクト直下で:

```bash
cd /Users/nakac/src/kisen-sales-management
cp .env.example .env
```

`.env` を編集:

```env
VITE_SUPABASE_URL=（既存プロジェクトの URL）
VITE_SUPABASE_ANON_KEY=（既存プロジェクトの anon key）
VITE_GOOGLE_MAPS_API_KEY=（Maps の API キー）
```

起動:

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く。

---

## 5. Supabase Auth URL（後でログインを入れるとき）

今は Phase1 でログイン必須にしていません。  
STEP7 で認証を入れるときは:

**Authentication → URL Configuration → Redirect URLs** に追加のみ（Site URL は社員名簿のまま推奨）:

```
http://localhost:5173/**
https://（営業管理の Netlify URL）/**
```

Site URL を営業管理だけに書き換えると、社員名簿のメールリンクが壊れます。

---

## 6. GitHub リポジトリ（未作成の場合）

1. https://github.com/new
2. Repository name: `kisen-sales-management`
3. Private 推奨 / README は追加しない
4. 表示されるコマンドで `git remote add origin` → `git push`

---

## 7. 動作確認チェックリスト

- [ ] 地図が表示される
- [ ] 施設名検索で候補が出る
- [ ] 候補選択で住所・緯度経度が入る
- [ ] 施設種別・サービスを選んで保存できる
- [ ] 再読み込み後もピンが残る
- [ ] 同じ施設を再度保存すると重複警告が出る
- [ ] 手動登録ができる
- [ ] スマホ幅でも操作できる
- [ ] Table Editor の `facilities` に行が増えている
