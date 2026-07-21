-- ワークフローの説明文。MCPツールとして公開する際のdescriptionに使う（未設定なら従来のフォールバック文言）。
ALTER TABLE workflows ADD COLUMN description TEXT;
