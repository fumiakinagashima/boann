-- set_resultアクションで組み立てられた結果オブジェクト（JSON）。run_workflow_*のMCPレスポンス
-- （structuredContent）と「今すぐ実行」の結果表示に使う。未使用のワークフローはnullのまま。
ALTER TABLE workflow_runs ADD COLUMN result TEXT;
