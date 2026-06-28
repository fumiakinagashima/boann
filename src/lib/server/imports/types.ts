// Queue に流すアプリ取り込みジョブのメッセージ。
// プラン・本文はメッセージに載せず、import_jobs（ドラフト）から読む。
//  - design: アップロード本文を読み AI でプランを設計する
//  - apply : ドラフトのプランを決定的に反映してアプリを作成する
export type ImportJobMessage = {
	type: 'design' | 'apply';
	jobId: string;
};
