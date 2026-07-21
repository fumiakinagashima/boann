-- ページ機能（カスタムページビルダー）を廃止する。
-- entity_types 単位の汎用データ管理画面（/apps/[id]/tables/[tableId]）が既に
-- ページなしでテーブルの閲覧・登録・編集・削除を提供しており、app_pages は冗長だった。
DROP TABLE `app_pages`;
