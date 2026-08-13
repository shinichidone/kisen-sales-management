# 手作業セットアップ手順（初心者向け）

Phase1 を動かすために、あなた側で行う設定です。

**方針:** 社員名簿・家計簿と**同じ既存 Supabase プロジェクト**を使います。  
コードリポジトリ（`kisen-sales-management`）は独立のままです。

---

## 0. 重要（共有 Supabase の注意）

同じプロジェクトにテーブルを追加しますが、既存の `profiles` 等には触れません。

Phase1〜6 は検証のため、暫定で `anon` から施設の閲覧・登録を許可していました。  
**STEP7 でログイン必須の役割ベース RLS に締め直し済みです。** 未実行の場合は「STEP7 SQL・認証設定」章を参照してください。

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
| `permission denied for table services` | 下の「権限付与SQL」を追加実行 |
| 権限エラー | プロジェクトの Owner / 十分な権限で実行 |

既存テーブルを消さないでください。

### 権限付与SQL（permission denied が出るとき）

最初のマイグレーション後に、次も **SQL Editor で実行**してください。

`supabase/migrations/20260310000001_phase1_grants.sql`

または以下をそのまま実行:

```sql
grant usage on schema public to anon, authenticated;
grant select on table public.services to anon, authenticated;
grant select, insert, update on table public.facilities to anon, authenticated;
grant select, insert, delete on table public.facility_target_services to anon, authenticated;
```

---

## STEP2 SQL（担当者・メモ履歴）

Phase1 のあとに、次も **SQL Editor で実行**してください。

`supabase/migrations/20260311000000_phase2_contacts.sql`

成功後、Table Editor で次があることを確認:

- `contacts`
- `facility_affiliations`
- `facility_memo_histories`

続けて、担当者の削除機能のために次も実行してください。

`supabase/migrations/20260311000001_phase2_contacts_delete.sql`

---

## STEP3 SQL（営業履歴）

`supabase/migrations/20260312000000_phase3_sales_visits.sql`

成功後、Table Editor で次があることを確認:

- `sales_visits`
- `sales_visit_contacts`
- `sales_visit_services`

※ 営業履歴の削除UIは意図的に未実装です（指示書上、削除はシステム管理者のみの権限のため、STEP7でログイン・権限管理を入れてから対応します）。

---

## STEP4（次回フォロー管理）

STEP4は新しいテーブルを追加しません。STEP3の `sales_visits` にある
`next_follow_up_on` / `follow_up_note` / `follow_up_assignee` をそのまま使います。
追加のSQL実行は不要です。

画面上部のナビゲーションに「フォロー管理」タブが増えているので、それを開いて確認してください。

---

## STEP5 SQL（紹介案件）

`supabase/migrations/20260313000000_phase5_referral_cases.sql`

成功後、Table Editor で `referral_cases` テーブルがあることを確認してください。

施設詳細に「紹介案件」タブが増えます。案件番号（例: `RC-00001`）は自動採番されます。

---

## STEP6（営業分析一覧）

STEP6は新しいテーブルを追加しません。既存の `facilities` / `sales_visits` / `referral_cases`
から集計するだけなので、追加のSQL実行は不要です。

画面上部のナビゲーションに「分析」タブが増えます。列見出しをクリックすると並び替えができます。

---

## STEP7 SQL・認証設定（ログイン・権限管理・スマホUI）

**重要: このSTEPを実行すると、ログインしないと一切データが見えなくなります（意図的な破壊的変更）。**
実行前に他の作業者に共有してください。

### 7-1. SQLを2つ実行

1. `supabase/migrations/20260314000000_phase7_auth_roles.sql` を SQL Editor で実行
   - `app_users` / `app_user_services` テーブル、新規登録時の自動作成トリガー、権限判定用の関数が追加されます
2. 続けて `supabase/migrations/20260314000001_phase7_rls_tighten.sql` を実行
   - これまでの「anon全開放」ポリシーが削除され、ログイン済み・承認済み（`active`）ユーザーのみアクセスできるポリシーに置き換わります
3. 続けて `supabase/migrations/20260315000000_phase7_skip_email_confirm.sql` を実行
   - 確認メールなしで登録でき、利用開始は管理者承認だけで制御されます

成功後、Table Editor で `app_users` / `app_user_services` テーブルがあることを確認してください。

### 7-2. Supabase Authの設定

**Authentication → Sign In / Providers → Email**:

- **Confirm email** は **OFF 推奨**（社内ツールのため確認メールは使わない。利用開始は管理者承認で制御する）

**Authentication → URL Configuration → Redirect URLs** に追加（Site URLは社員名簿のまま変更しないこと）:

```
http://localhost:5173/**
https://（営業管理の Netlify URL）/**
```

### 7-3. 最初のシステム管理者をブートストラップする

このアプリにはメール送信によるユーザー招待機能がないため、**最初の1人だけ**手動でシステム管理者にします。

1. 営業管理アプリの画面で「新規登録」タブから、自分の名前・メールアドレス・パスワードで登録する
2. 登録後は承認待ち画面になる（確認メールは使わない）
3. Supabase の **SQL Editor** で、自分のメールアドレスを使って次を実行する:

   ```sql
   update public.app_users
   set role = 'system_admin', status = 'active'
   where email = '自分のメールアドレス@example.com';
   ```

4. 営業管理アプリに戻ってログインし直す（一度ログアウト→ログイン、またはページ再読み込み）
5. ヘッダーに「ユーザー管理」タブが表示されればシステム管理者への昇格が成功しています

以降の他のメンバーは、各自「新規登録」→ **システム管理者が「ユーザー管理」画面で承認・役割・所属事業所を設定** という流れで利用開始できます。確認メールは不要です。

### 動作確認チェックリスト（STEP7）

- [ ] 未ログインで開くとログイン画面が出る
- [ ] 新規登録すると承認待ち画面が出る（確認メールは不要）
- [ ] 上記手順で自分をシステム管理者にできる
- [ ] ログイン後、ホーム画面が表示される
- [ ] 「ユーザー管理」タブでほかの登録者を承認・役割変更できる
- [ ] スマホ幅で下部タブバー（ホーム/MAP/フォロー/分析）が表示される

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

## 5. Supabase Auth URL

STEP7でログインを導入済みです。設定手順は「STEP7 SQL・認証設定」章を参照してください。

Site URL を営業管理だけに書き換えると、社員名簿のメールリンクが壊れるため変更しないこと。

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
