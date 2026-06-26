# Boann

AIファーストなチャットベースの CRM/SFA。ユーザーはチャットで業務指示を出し、Claude AI が MCP ツールを介して動的にフォームやテーブル・チャートなどを生成して操作を完結させる。

## 主な機能

- **チャットAI**（`/`）— Claude API + MCP ツールによる顧客・商談・タスク等の検索・集計・分析、ノーコードUI（フォーム・テーブル・チャート・ガント・カンバン・タイムライン等）生成、資料データ素材生成（CSV/Markdown）
- **クイックアクション** — チャット入力欄の「+」から、AIを介さず一覧・集計系ツールを即時実行（トークン消費なし）
- **データ管理**（`/database`）— コア・カスタムテーブルのCRUD・スキーマ編集、申請（承認ルート）管理、アカウント管理、リマインダー管理
- **ワークフロー**（`/database/workflows`）— ノーコードで自動化ワークフローを作成（毎日定時トリガー、foreach/condition、AI生成・AIレビュー・手動実行）
- **名刺取り込み**（`/bizcard`）— カメラで撮影した名刺から顧客情報をAIで抽出し登録
- **設定**（`/settings`）— 外部API連携、メール送信設定、クイックアクション選択、自身のプロフィール編集
- **通知・リマインダー** — 通知センターと、Cron Triggerによるリマインダー自動配信（通知センター／メール／Slack）
- **認証・権限** — ログイン必須（全ルートガード）、`general`/`admin` 権限による管理画面・APIのアクセス制御

## 技術スタック

| 分類 | 技術 |
|------|------|
| パッケージマネージャー | Bun |
| フロントエンド | SvelteKit, TypeScript |
| バリデーション | Zod |
| ORM | DrizzleORM |
| インフラ | Cloudflare (Wrangler, D1, R2, KV, Queue) |
| AI | Claude API (Anthropic) |
| プロトコル | MCP (Model Context Protocol) |
| i18n | Paraglide-JS |
| テスト | Vitest（ユニット）, Playwright（E2E） |

## 開発環境のセットアップ

### 必要なもの

- [Bun](https://bun.sh/) v1.x 以上
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. インストール

```sh
git clone https://github.com/your-org/boann.git
cd boann
bun install
```

### 2. 環境変数の設定

`.dev.vars.example` をコピーして `.dev.vars` を作成し、必要な値を入力する:

```sh
cp .dev.vars.example .dev.vars
```

最低限必要な設定:

```sh
ANTHROPIC_API_KEY="sk-ant-..."  # Anthropic API キー
MOCK_AI="false"                 # true にするとAPI不要でモックレスポンスで動作確認できる
```

メール機能を使う場合は `EMAIL_PROVIDER` と対応するキーも設定する（`resend` / `ses` / `smtp`）。

### 3. データベースのマイグレーション

D1 ローカルデータベースにマイグレーションを適用する（`.wrangler/state/` にSQLiteが作成される）:

```sh
bunx wrangler d1 migrations apply boann --local
```

マイグレーション完了時にテスト用アカウント5件と管理者アカウントが自動で作成される:

| メールアドレス | パスワード | 権限 |
|---|---|---|
| `info@alcogy.com` | `password` | admin |
| `user1@example.com` ～ `user5@example.com` | `password` | general |

### 4. デモデータの投入（任意）

顧客・担当者・商談・活動のサンプルデータを投入する場合:

```sh
bun run db:seed:demo
```

### 5. 開発サーバーの起動

```sh
bun dev   # Vite + platformProxy で HMR 付き起動
```

ブラウザで `http://localhost:5173` を開き、`/signin` からログインする。

KV・R2 はローカルでは `.wrangler/state/` に自動作成されるため、追加設定は不要。

> **メール送信（SMTP）の注意**: `/settings/email` のSMTPプロバイダーは `cloudflare:sockets`（workerdランタイム専用API）を使うため、`bun dev`（Node.js上のVite）では動作しない。ローカルで確認する場合は Resend または AWS SES を使用すること。

### その他のコマンド

```sh
bun run check          # 型チェック（svelte-check）
bun run test:unit      # ユニットテスト（Vitest）
bun run test:e2e       # E2Eテスト（Playwright）
bun run db:studio      # Drizzle Studio でローカルDBを確認
```

## UIコンポーネント

コンポーネントは2種類に分類される。

- **`src/lib/components/ui/`** — アプリ UI（デザインシステム）
- **`src/lib/components/chat/`** — AI がノーコードとしてレスポンスに返すコンポーネント

ライブデモは `/ui` ルートで確認できる。

---

### アプリ UI コンポーネント

#### Textbox

テキスト入力フィールド。

```svelte
<Textbox label="会社名" bind:value={name} placeholder="株式会社..." required />
<Textbox label="メール" bind:value={email} type="email" error="正しいメールアドレスを入力してください" />
```

| prop | 型 | 説明 |
|------|----|------|
| `label` | `string?` | ラベルテキスト |
| `value` | `string` (bindable) | 入力値 |
| `type` | `string?` | input の type 属性（デフォルト `text`） |
| `placeholder` | `string?` | プレースホルダー |
| `required` | `boolean?` | 必須マーク表示 |
| `disabled` | `boolean?` | 無効状態 |
| `error` | `string?` | エラーメッセージ |

---

#### Textarea

複数行テキスト入力。

```svelte
<Textarea label="メモ" bind:value={memo} rows={4} placeholder="自由記述..." />
```

| prop | 型 | 説明 |
|------|----|------|
| `rows` | `number?` | 行数（デフォルト `3`） |
| その他 | — | Textbox と同様 |

---

#### Select

ネイティブ select（カスタム矢印付き）。

```svelte
<Select label="ステータス" bind:value={status} options={[
  { value: 'active', label: 'アクティブ' },
  { value: 'inactive', label: '非アクティブ' }
]} />
```

| prop | 型 | 説明 |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | 選択肢 |
| `placeholder` | `string?` | 未選択時の表示テキスト |

---

#### SearchSelect

検索機能付きの Combobox。キーボードナビゲーション（↑↓ Enter Esc）対応。

```svelte
<SearchSelect label="国" bind:value={country} options={countryOptions} placeholder="検索または選択..." />
```

| prop | 型 | 説明 |
|------|----|------|
| `options` | `{ value: string; label: string }[]` | 選択肢 |
| `placeholder` | `string?` | プレースホルダー |

---

#### Toggle

オン/オフ切り替えスイッチ。

```svelte
<Toggle label="メール通知を受け取る" bind:checked={enabled} />
```

| prop | 型 | 説明 |
|------|----|------|
| `label` | `string?` | ラベルテキスト |
| `checked` | `boolean` (bindable) | 状態 |
| `disabled` | `boolean?` | 無効状態 |

---

#### MultiSelect

複数選択ボタン（チェックボックスの代替）。値は `string[]`。

```svelte
<MultiSelect label="タグ" bind:value={tags} options={[
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'パートナー' }
]} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string[]` (bindable) | 選択中の値の配列 |
| `options` | `{ value: string; label: string }[]` | 選択肢 |

---

#### SingleSelect

単一選択ボタン（ラジオボタンの代替）。セグメントコントロール風。

```svelte
<SingleSelect label="優先度" bind:value={priority} options={[
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]} />
```

---

#### DatePicker

日付入力（ネイティブ `<input type="date">`）。

```svelte
<DatePicker label="契約日" bind:value={date} min="2024-01-01" />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | ISO 8601 形式の日付文字列 |
| `min` / `max` | `string?` | 入力範囲 |

---

#### TimePicker

時刻入力（ネイティブ `<input type="time">`）。

```svelte
<TimePicker label="開始時刻" bind:value={time} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | `HH:MM` 形式 |

---

#### DateTimePicker

日時入力（ネイティブ `<input type="datetime-local">`）。

```svelte
<DateTimePicker label="予定日時" bind:value={datetime} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `string` (bindable) | `YYYY-MM-DDTHH:MM` 形式 |
| `min` / `max` | `string?` | 入力範囲 |

---

#### NumberInput

数値入力（−/＋ ステッパーボタン付き）。ブラウザのスピンボタンは非表示。

```svelte
<NumberInput label="数量" bind:value={qty} min={0} max={100} step={5} suffix="個" />
<NumberInput label="金額" bind:value={amount} prefix="¥" step={1000} />
```

| prop | 型 | 説明 |
|------|----|------|
| `value` | `number` (bindable) | 数値 |
| `min` / `max` | `number?` | 範囲（上下限でボタン無効化） |
| `step` | `number?` | ステップ量（デフォルト `1`） |
| `prefix` / `suffix` | `string?` | 前後の単位表示 |

---

#### FileUpload

ドラッグ&ドロップ対応のファイル選択エリア。

```svelte
<FileUpload label="添付ファイル" accept=".pdf,.xlsx" multiple />
```

| prop | 型 | 説明 |
|------|----|------|
| `accept` | `string?` | 許可する拡張子 |
| `multiple` | `boolean?` | 複数ファイル選択 |

---

#### Table

ソート・ページネーション付きのデータテーブル。

```svelte
<Table
  columns={[
    { key: 'name', label: '会社名', sortable: true },
    { key: 'status', label: 'ステータス' }
  ]}
  rows={tableData}
  pageSize={10}
/>
```

| prop | 型 | 説明 |
|------|----|------|
| `columns` | `{ key, label, sortable? }[]` | カラム定義 |
| `rows` | `Record<string, unknown>[]` | データ |
| `pageSize` | `number?` | 1ページの行数（デフォルト `10`） |

---

#### Pagination

ページネーションコントロール（Table 内でも使用）。

```svelte
<Pagination bind:page={currentPage} totalPages={20} />
```

| prop | 型 | 説明 |
|------|----|------|
| `page` | `number` (bindable) | 現在のページ（1始まり） |
| `totalPages` | `number` | 総ページ数 |

---

#### List

カード表示のリスト。ジェネリクス対応で型安全なスニペットを受け取る。

```svelte
<List items={customers} columns={3}>
  {#snippet card(c)}
    <p>{c.name}</p>
    <p>{c.contact}</p>
  {/snippet}
</List>
```

| prop | 型 | 説明 |
|------|----|------|
| `items` | `T[]` | データ配列 |
| `columns` | `number?` | グリッド列数（デフォルト `2`） |
| `card` | `Snippet<[T]>` | カードのレンダリングスニペット |

---

#### DataGrid

スプレッドシート型のグリッド入力。Tab/Enter キーでセル移動。

```svelte
<DataGrid
  bind:rows={gridRows}
  columns={[
    { key: 'name', label: '氏名', width: 160 },
    { key: 'dept', label: '部署', type: 'select', options: [
      { value: 'sales', label: '営業' },
      { value: 'eng', label: 'エンジニア' }
    ]},
    { key: 'age', label: '年齢', type: 'number', width: 90 },
    { key: 'note', label: '備考', readonly: true }
  ]}
  onchange={(rows) => console.log(rows)}
/>
```

| prop | 型 | 説明 |
|------|----|------|
| `columns` | `GridColumn[]` | カラム定義 |
| `rows` | `GridRow[]` (bindable) | データ（`Record<string, string\|number\|null>`） |
| `addable` | `boolean?` | 行追加ボタン表示（デフォルト `true`） |
| `deletable` | `boolean?` | 行削除ボタン表示（デフォルト `true`） |
| `onchange` | `(rows) => void?` | 変更コールバック |

**GridColumn のフィールド:**

| フィールド | 型 | 説明 |
|----------|----|------|
| `key` | `string` | データキー |
| `label` | `string` | ヘッダーテキスト |
| `type` | `'text'\|'number'\|'select'?` | セルの入力タイプ |
| `options` | `{ value, label }[]?` | type が `select` のときの選択肢 |
| `width` | `number?` | 列幅（px） |
| `readonly` | `boolean?` | 編集不可 |

**キーボード操作:**

| キー | 動作 |
|------|------|
| Tab / Shift+Tab | 次/前のセルへ移動 |
| Enter | 下のセルへ移動 |
| Esc | 編集を終了 |

---


#### TypingIndicator

AIのタイピング中アニメーション（3点ドット）。

```svelte
{#if isLoading}
  <TypingIndicator />
{/if}
```

---

### チャット UI コンポーネント（`src/lib/components/chat/`）

AI がレスポンスとして返す動的UIコンポーネント。システムプロンプトの仕様に従って AI が `<ui type="...">` タグを出力し、クライアント側でパースされて描画される。詳細な仕様は `src/lib/server/ai/` のシステムプロンプトで一元管理している。

#### Form（チャット用）

```
<ui type="form" title="顧客登録">
[{"key":"name","label":"会社名","type":"text","required":true},{"key":"industry","label":"業種","type":"select","options":[...]}]
</ui>
```

フィールドタイプ: `text` / `email` / `number` / `textarea` / `select` / `date` / `datetime-local` / `recordSelect`（リレーション先を検索選択）/ `hidden`

#### Table（チャット用）

```
<ui type="table" title="顧客一覧">
{"columns":[{"key":"name","label":"会社名"},...],"rows":[...]}
</ui>
```

#### ActionSelector

```
<ui type="actions" title="どうしますか？">
[{"id":"create","label":"顧客を登録する","description":"新規顧客情報をフォームで入力します"}]
</ui>
```

ユーザーがアクションを選択すると、そのラベルがチャット入力として送信される。

#### その他のコンポーネント

| コンポーネント | 用途 |
|------|------|
| `Values` | キー・バリュー形式のサマリー表示（健全性スコア等） |
| `Gantt` | プロジェクト・タスクのガントチャート表示 |
| `Timeline` | 活動履歴の時系列ビジュアル表示 |
| `Kanban` | 商談ステータス等のカンバンボード表示 |
| `Workflow` | ワークフロー定義の表示・編集（`WorkflowEditorDialog` を開く） |
| `Link` | レコードへのリンク。`newTab="true"` で別タブ表示（会話を中断させない） |
| `Reply` | AIが質問・選択肢を提示する際のインライン回答UI（単一選択・複数選択・テキスト入力） |
| `Bizcard` | 名刺画像のスキャン・読取結果表示 |
| `DocHandoff` | 資料データファイル（CSV/Markdown）のDLリンクと外部AIツール向けプロンプト表示 |
| `DocumentJob` | 非同期資料生成ジョブの進行状況・完了通知表示（`DocHandoff` 移行後は非推奨） |

---

## ディレクトリ構成

```
boann/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte    # サイドバー・テーマ切り替え
│   │   ├── +page.svelte      # チャット画面（/）
│   │   ├── signin/           # ログイン・パスワードリセット
│   │   ├── ui/               # UIコンポーネントデモ（/ui）
│   │   ├── bizcard/          # 名刺取り込み（/bizcard）
│   │   ├── settings/         # 設定画面（/settings, /settings/integrations, /settings/quick-actions, /settings/email, /settings/account）
│   │   ├── database/         # データ管理（/database, /database/[type], /database/approvals, /database/accounts, /database/reminders 等）
│   │   └── api/
│   │       ├── chat/         # チャット API エンドポイント
│   │       ├── auth/         # ログイン・サインアウト・パスワードリセット
│   │       ├── bizcard/      # 名刺画像 → Claude vision → JSON 抽出
│   │       ├── integrations/ # 外部API連携 CRUD
│   │       ├── quick-actions/# クイックアクション実行
│   │       ├── database/     # データ管理 REST API（tables, records CRUD）
│   │       ├── documents/    # 資料生成ジョブ
│   │       ├── reminders/    # リマインダー配信
│   │       ├── notifications/# 通知センター
│   │       └── email/        # メール送信・設定
│   └── lib/
│       ├── components/
│       │   ├── ui/           # アプリUIコンポーネント（デザインシステム）
│       │   ├── chat/         # AI がレスポンスとして返すコンポーネント
│       │   ├── dialog/       # 詳細・編集・登録の中央ダイアログ群（チャットと/databaseで共有）
│       │   ├── database/     # データ管理画面専用コンポーネント
│       │   ├── icon/         # SVGアイコンコンポーネント
│       │   └── bizcard/      # 名刺スキャン専用コンポーネント
│       ├── quick-actions/    # クイックアクションのカタログ定義
│       ├── server/
│       │   ├── db/           # DrizzleORM スキーマ・クエリ
│       │   ├── mcp/          # MCP ツール定義
│       │   ├── ai/           # Claude API 連携・システムプロンプト
│       │   ├── auth/         # セッション・パスワードハッシュ
│       │   ├── documents/    # 資料データファイル生成・R2保存
│       │   ├── reminders/    # リマインダー配信
│       │   ├── email/        # システムメール送信
│       │   ├── slack/        # Slack Incoming Webhook 送信
│       │   ├── workflow/     # ワークフロー実行エンジン
│       │   └── quick-actions/# クイックアクションの実行・整形
│       ├── styles/           # グローバルスタイル・テーマ
│       └── types/            # 共通型定義
├── messages/                 # i18n リソース（ja.json）
├── drizzle/                  # マイグレーションファイル
├── docs/
│   └── ROADMAP.md
├── worker.ts                 # Cloudflare Workers エントリポイント（Cron Trigger対応）
├── wrangler.toml
└── wrangler.build.jsonc
```

## テーマ

ダーク / ライト / システム（OS 設定追従）の3択。サイドバー下部のスイッチで切り替え。CSS カスタムプロパティ（`--color-*`）でトークンを定義し `data-theme` 属性で切り替える。

## i18n

`messages/ja.json` に日本語リソースを定義し `m.key()` 形式で参照する（Paraglide-JS）。

## ロードマップ

開発の進行状況は [`docs/ROADMAP.md`](docs/ROADMAP.md) を参照。v1（コア機能）は完了済みで、残課題は同ファイル末尾の「v2 TODO」にまとめている。
