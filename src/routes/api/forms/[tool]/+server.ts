import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// 既知のツールに対するサーバー定義フォームを返す（動的なフィールド構造・選択肢が必要な場合に使う拡張点）。
// FormDialog/FormPanel はこのエンドポイントからフィールド構造を取得し、AIが提供した値をプリフィルとして適用する。
// 404の場合はAIが inline で提供したフィールド定義にフォールバックする（呼び出し側で処理済み）。
// 現在登録済みのツールはない。
export const GET: RequestHandler = async () => {
	return json({ error: 'Not found' }, { status: 404 });
};
