-- A workflow's declared input parameters (JSON of FieldDef[]). Same pattern as steps.
ALTER TABLE workflows ADD COLUMN input_schema TEXT NOT NULL DEFAULT '[]';
