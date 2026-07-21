-- ワークフローの宣言された入力パラメータ（FieldDef[]のJSON）。steps と同じパターン。
ALTER TABLE workflows ADD COLUMN input_schema TEXT NOT NULL DEFAULT '[]';
