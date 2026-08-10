# 喜仙 営業活動管理ツール

株式会社カラダのミカタ（介護部門）向けの社内Webアプリです。

デイサービス喜仙 昭栄町・南花台、訪問看護ステーション喜仙の営業活動を一元管理し、  
**営業情報を個人の記憶から会社のデータ資産へ**変えることを目的とします。

> このリポジトリは使い捨てデモではありません。Phase1（MAP基盤）から同じコードベースで最終MVPまで育てます。

---

## プロジェクト目的

- 誰が・いつ・どこへ・誰と・何を・次に何をするかを会社として把握する
- 重複訪問・紹介元の放置・成果の見えなさを減らす
- 訪問 → 面会 → 関係構築 → 紹介 → 利用開始 をデータとして残す

単なる件数記録アプリではありません。

---

## 技術構成

| 領域 | 技術 |
|------|------|
| フロントエンド | React + TypeScript（Vite） |
| BaaS | Supabase（DB / 将来: 認証・RLS） |
| 地図 | Google Maps Platform（Maps JavaScript API / Places API） |
| ホスティング | Netlify |
| ソース管理 | GitHub |

運用コスト目標: **月額0円**（難しい部分のみ有料化し、できれば月5,000円以内）

---

## 開発ロードマップ

| STEP | 内容 | 状態 |
|------|------|------|
| 1 | MAP基盤 | 実装中 |
| 2 | 施設・担当者管理 | 未着手 |
| 3 | 営業履歴 | 未着手 |
| 4 | フォロー管理 | 未着手 |
| 5 | 紹介案件 | 未着手 |
| 6 | 営業分析 | 未着手 |
| 7 | ログイン・権限・スマホUI仕上げ | 未着手 |
| 8 | MVP完成 | 未着手 |

---

## 環境構築

### 前提

- Node.js 22 推奨
- npm
- Supabase プロジェクト
- Google Cloud プロジェクト（Maps / Places）

### インストール

```bash
git clone <このリポジトリのURL>
cd kisen-sales-management
npm install
cp .env.example .env
```

`.env` に値を入れたあと:

```bash
npm run dev
```

---

## 環境変数

| 変数 | 説明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key（**service_role は使わない**） |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API キー |
| `VITE_MAP_DEFAULT_LAT` | 初期緯度（既定: 河内長野付近） |
| `VITE_MAP_DEFAULT_LNG` | 初期経度 |
| `VITE_MAP_DEFAULT_ZOOM` | 初期ズーム |

`.env` は Git 管理対象外です。必ず `.env.example` だけをコミットします。

---

## Supabase 設定

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. **Project Settings → API** で URL と `anon` `public` キーをコピーし `.env` へ
3. **SQL Editor** を開き、`supabase/migrations/20260310000000_phase1_facilities.sql` の内容を実行
4. Table Editor で `services` に3件、`facilities` が空であることを確認

### Phase1 の RLS について

Phase1 はログインなしでMAP検証するため、`anon` に select/insert を一時開放しています。  
**STEP7（権限管理）で本番向けRLSへ締め直します。** service_role キーはフロントに置かないでください。

---

## Google Maps 設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. 課金アカウントをリンク（無料枠内運用を想定。予算アラート推奨）
3. 次の API のみ有効化
   - **Maps JavaScript API**
   - **Places API**（Autocomplete / Place Details 用）
4. 認証情報 → APIキー作成
5. キー制限（推奨）
   - アプリケーション制限: HTTPリファラ  
     例: `http://localhost:5173/*` / `https://YOUR_NETLIFY_SITE.netlify.app/*`
   - API制限: 上記2つのみ
6. キーを `.env` の `VITE_GOOGLE_MAPS_API_KEY` に設定

ルート最適化・Directions は MVP では使いません。

---

## 開発方法

```bash
npm run dev      # 開発サーバ
npm run build    # 本番ビルド
npm run preview  # ビルド確認
npm run lint     # lint
```

---

## GitHub 運用

- `main` … 安定版
- 機能開発は `feature/*` ブランチ
- 意味のある単位でコミット → 動作確認 → PR → `main` へマージ

例:

- `feature/map-foundation`
- `feature/facilities`
- `feature/sales-history`

---

## デプロイ方法（Netlify）

1. GitHub リポジトリを Netlify に連携
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variables に `.env` と同じ値を設定
5. Google Maps API キーのリファラに Netlify ドメインを追加

`netlify.toml` 済みです。

---

## Phase1 完成条件

1. Google Maps が表示される  
2. 施設名検索 → 候補選択 → 住所・緯度経度取得  
3. 施設種別・営業対象サービスを選んで Supabase 保存  
4. 再読み込み後もピン再表示  
5. 同一施設の重複警告  
6. Mapsに無い場合の手動登録  
7. PC / スマホで確認  

---

## セキュリティ注意

- APIキー・`.env` をコミットしない
- Supabase `service_role` をフロントに置かない
- 利用者の詳細個人情報は保存しない（営業管理ツール）
- Maps の利用量上限・予算アラートを設定する
