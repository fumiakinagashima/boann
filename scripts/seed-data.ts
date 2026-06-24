// 顧客・担当者・案件のデモデータ生成。
// ローカルD1への投入（seed-demo-data.ts）と本番D1向けSQL生成（generate-seed-sql.ts）の両方から利用する。

export type CustomerSeed = {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
	postalCode: string;
	website: string;
	status: 'active' | 'inactive';
	notes: string;
};

export type ContactSeed = {
	id: string;
	customerId: string;
	name: string;
	nameKana: string;
	email: string;
	phone: string;
	role: string;
	department: string;
};

export type DealSeed = {
	id: string;
	customerId: string;
	title: string;
	amount: number;
	status: 'open' | 'won' | 'lost';
	closedAt: Date | null;
	plannedStart: string;
	plannedEnd: string;
	notes: string;
};

export type ActivitySeed = {
	id: string;
	customerId: string;
	type: 'note' | 'call' | 'email' | 'meeting';
	content: string;
	createdBy: string;
	createdAt: Date;
};

export type SeedData = {
	customers: CustomerSeed[];
	contacts: ContactSeed[];
	deals: DealSeed[];
	activities: ActivitySeed[];
};

const TODAY = new Date(2026, 5, 16); // 2026-06-16

function fmtDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + days);
	return r;
}

function randInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
	return arr[randInt(0, arr.length - 1)];
}

function pickMany<T>(arr: T[], n: number): T[] {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

// メール誤送信防止のため、メールアドレスには実在しないドメイン（RFC 2606）を使用する
function dummyEmailDomain(domain: string): string {
	return `${domain.split('.')[0]}.example.test`;
}

type CompanyDef = {
	name: string;
	domain: string;
	phone: string;
	address: string;
	postalCode: string;
	status: 'active' | 'inactive';
	notes: string;
};

const companies: CompanyDef[] = [
	{ name: '株式会社サンライズテック', domain: 'sunrise-tech.co.jp', phone: '03-5468-1201', address: '東京都渋谷区渋谷2-21-1', postalCode: '150-0002', status: 'active', notes: 'Webから問い合わせ。クラウド移行に積極的。' },
	{ name: '西日本フードサービス株式会社', domain: 'west-food.co.jp', phone: '06-6451-2233', address: '大阪府大阪市北区梅田3-4-5', postalCode: '530-0001', status: 'active', notes: '関西エリアで飲食店を約50店舗展開。' },
	{ name: '株式会社グリーンビルド', domain: 'green-build.co.jp', phone: '03-3344-5566', address: '東京都新宿区西新宿1-6-1', postalCode: '160-0023', status: 'active', notes: 'オフィスビル・商業施設の建築・改修を手掛ける。' },
	{ name: '丸の内商事株式会社', domain: 'marunouchi-shoji.co.jp', phone: '03-3217-8800', address: '東京都千代田区丸の内1-9-2', postalCode: '100-0005', status: 'active', notes: '総合商社。海外取引が多い。' },
	{ name: '株式会社メディカルパートナーズ', domain: 'medical-partners.co.jp', phone: '045-222-3344', address: '神奈川県横浜市西区みなとみらい4-4-5', postalCode: '220-0012', status: 'active', notes: '医療機関向けコンサルティングを展開。' },
	{ name: '富士精密工業株式会社', domain: 'fuji-seimitsu.co.jp', phone: '053-455-7788', address: '静岡県浜松市中央区東伊場1-1-1', postalCode: '430-0928', status: 'active', notes: '自動車部品の精密加工を行う中堅メーカー。' },
	{ name: '株式会社クラウドナイン', domain: 'cloud9.co.jp', phone: '03-6406-9911', address: '東京都港区六本木6-10-1', postalCode: '106-0032', status: 'active', notes: '急成長中のSaaSスタートアップ。' },
	{ name: '横浜ロジスティクス株式会社', domain: 'yokohama-logi.co.jp', phone: '045-501-2200', address: '神奈川県横浜市鶴見区大黒ふ頭1-1', postalCode: '230-0054', status: 'active', notes: '国際物流・倉庫業を展開。' },
	{ name: '株式会社さくら不動産', domain: 'sakura-estate.co.jp', phone: '06-6264-3300', address: '大阪府大阪市中央区本町2-3-4', postalCode: '541-0053', status: 'active', notes: '関西圏の商業用不動産を中心に取扱い。' },
	{ name: '中央製薬株式会社', domain: 'chuo-pharma.co.jp', phone: '03-3270-4400', address: '東京都中央区日本橋本町3-8-2', postalCode: '103-0023', status: 'active', notes: '後発医薬品メーカー。' },
	{ name: '株式会社フューチャーデザイン', domain: 'future-design.co.jp', phone: '03-6452-5500', address: '東京都渋谷区恵比寿1-19-19', postalCode: '150-0013', status: 'active', notes: 'ブランディング・広告制作を行うデザイン会社。' },
	{ name: '名古屋自動車部品株式会社', domain: 'nagoya-autoparts.co.jp', phone: '052-587-6600', address: '愛知県名古屋市中村区名駅1-1-4', postalCode: '450-0002', status: 'active', notes: '大手自動車メーカーの一次サプライヤー。' },
	{ name: '株式会社エデュテック', domain: 'edutech.co.jp', phone: '092-441-7700', address: '福岡県福岡市博多区博多駅前2-1-1', postalCode: '812-0011', status: 'active', notes: 'オンライン学習サービスを運営。' },
	{ name: '関西電子工業株式会社', domain: 'kansai-electronics.co.jp', phone: '06-6789-8800', address: '大阪府東大阪市御厨栄町1-1-1', postalCode: '577-0034', status: 'active', notes: '産業用電子機器の製造を行う。' },
	{ name: '株式会社ハーモニーホテルズ', domain: 'harmony-hotels.co.jp', phone: '075-371-9900', address: '京都府京都市下京区東塩小路町721-1', postalCode: '600-8216', status: 'active', notes: '京都・大阪でホテルを5施設運営。' },
	{ name: '九州農産株式会社', domain: 'kyushu-nousan.co.jp', phone: '096-355-1100', address: '熊本県熊本市西区春日3-15-30', postalCode: '860-0047', status: 'inactive', notes: '農産物の生産・流通を行う。現在は取引休止中。' },
	{ name: '株式会社ネクストリテイル', domain: 'next-retail.co.jp', phone: '03-5759-2200', address: '東京都品川区大崎1-2-2', postalCode: '141-0032', status: 'active', notes: 'アパレル・雑貨の店舗を全国展開。' },
	{ name: '東京コンサルティンググループ株式会社', domain: 'tokyo-consulting.co.jp', phone: '03-3286-3300', address: '東京都千代田区大手町1-6-1', postalCode: '100-0004', status: 'active', notes: '経営戦略コンサルティングを提供。' },
	{ name: '株式会社スマートファクトリー', domain: 'smart-factory.co.jp', phone: '0565-28-4400', address: '愛知県豊田市西山町3-15', postalCode: '471-8571', status: 'inactive', notes: '工場IoT・スマートファクトリー化を推進。長期休眠中。' },
	{ name: '北海道水産株式会社', domain: 'hokkaido-suisan.co.jp', phone: '011-241-5500', address: '北海道札幌市中央区北一条西4-1', postalCode: '060-0001', status: 'active', notes: '水産加工品の製造・販売を行う。' }
];

type PersonDef = { name: string; kana: string; romaji: string };

const peoplePool: PersonDef[] = [
	{ name: '佐藤 健一', kana: 'さとう けんいち', romaji: 'sato.k' },
	{ name: '鈴木 美咲', kana: 'すずき みさき', romaji: 'suzuki.m' },
	{ name: '高橋 大輔', kana: 'たかはし だいすけ', romaji: 'takahashi.d' },
	{ name: '田中 由美子', kana: 'たなか ゆみこ', romaji: 'tanaka.y' },
	{ name: '渡辺 翔太', kana: 'わたなべ しょうた', romaji: 'watanabe.s' },
	{ name: '伊藤 香織', kana: 'いとう かおり', romaji: 'ito.k' },
	{ name: '山本 浩二', kana: 'やまもと こうじ', romaji: 'yamamoto.k' },
	{ name: '中村 真理', kana: 'なかむら まり', romaji: 'nakamura.m' },
	{ name: '小林 直樹', kana: 'こばやし なおき', romaji: 'kobayashi.n' },
	{ name: '加藤 麻衣', kana: 'かとう まい', romaji: 'kato.m' },
	{ name: '吉田 拓也', kana: 'よしだ たくや', romaji: 'yoshida.t' },
	{ name: '山田 恵子', kana: 'やまだ けいこ', romaji: 'yamada.k' },
	{ name: '佐々木 健太', kana: 'ささき けんた', romaji: 'sasaki.k' },
	{ name: '山口 智子', kana: 'やまぐち ともこ', romaji: 'yamaguchi.t' },
	{ name: '松本 隆', kana: 'まつもと たかし', romaji: 'matsumoto.t' },
	{ name: '井上 さくら', kana: 'いのうえ さくら', romaji: 'inoue.s' },
	{ name: '木村 雄一', kana: 'きむら ゆういち', romaji: 'kimura.y' },
	{ name: '林 優子', kana: 'はやし ゆうこ', romaji: 'hayashi.y' },
	{ name: '斎藤 和也', kana: 'さいとう かずや', romaji: 'saito.k' },
	{ name: '清水 久美子', kana: 'しみず くみこ', romaji: 'shimizu.k' },
	{ name: '森田 達也', kana: 'もりた たつや', romaji: 'morita.t' },
	{ name: '池田 千尋', kana: 'いけだ ちひろ', romaji: 'ikeda.c' },
	{ name: '橋本 誠', kana: 'はしもと まこと', romaji: 'hashimoto.m' },
	{ name: '阿部 美穂', kana: 'あべ みほ', romaji: 'abe.m' }
];

type RoleDef = { role: string; department: string };

const rolePool: RoleDef[] = [
	{ role: '代表取締役社長', department: '経営企画室' },
	{ role: '取締役', department: '経営企画室' },
	{ role: '営業部長', department: '営業部' },
	{ role: '営業課長', department: '営業部' },
	{ role: '営業担当', department: '営業部' },
	{ role: 'マーケティング部長', department: 'マーケティング部' },
	{ role: '購買担当', department: '購買部' },
	{ role: '総務部長', department: '総務部' },
	{ role: '情報システム部長', department: '情報システム部' },
	{ role: 'システム担当', department: '情報システム部' },
	{ role: '経理担当', department: '経理部' },
	{ role: '人事担当', department: '人事部' },
	{ role: '製造部長', department: '製造部' },
	{ role: '商品企画担当', department: '商品企画部' },
	{ role: '広報担当', department: '広報部' }
];

const dealTitles = [
	'基幹システム導入',
	'Webサイトリニューアル',
	'営業支援システム(SFA)導入',
	'年間保守契約更新',
	'クラウド移行プロジェクト',
	'在庫管理システム刷新',
	'ECサイト構築',
	'データ分析基盤構築',
	'社内ポータル開発',
	'セキュリティ強化対策',
	'モバイルアプリ開発',
	'RPA導入による業務自動化',
	'顧客管理システム(CRM)導入',
	'請求・経理システム連携',
	'ネットワーク機器リプレース',
	'BIツール導入',
	'採用管理システム導入',
	'ヘルプデスク業務委託'
];

const dealNotesByStatus: Record<'open' | 'won' | 'lost', string[]> = {
	open: [
		'提案書を提出済み、先方検討中。',
		'次回打ち合わせを調整中。',
		'予算承認待ち。',
		'競合と比較検討中。',
		'追加要件のヒアリングを実施予定。'
	],
	won: [
		'無事受注。来月よりキックオフ予定。',
		'契約締結済み。納品準備中。',
		'受注確定。担当者と詳細打ち合わせ中。'
	],
	lost: [
		'予算の都合により見送りとなった。',
		'競合他社に決定。',
		'社内方針変更により見送りとなった。'
	]
};

type ActivityTemplate = {
	type: 'note' | 'call' | 'email' | 'meeting';
	content: string;
};

// 顧客との商談進捗に沿った活動履歴テンプレート（時系列順）
const activitySequences: ActivityTemplate[][] = [
	// パターンA: メール → 架電 → 訪問 → 提案 → フォロー
	[
		{ type: 'email', content: '問い合わせへの返信メールを送付。サービス概要資料を添付。' },
		{ type: 'call', content: '担当者と電話。現状の課題と導入時期の意向を確認。来週のオンライン打ち合わせを設定。' },
		{ type: 'meeting', content: 'オンラインデモ実施。操作性について高評価をいただいた。詳細要件のヒアリングを次回実施予定。' },
		{ type: 'email', content: '提案書・見積書を送付。2週間以内に社内検討の上、回答いただく予定。' },
		{ type: 'call', content: '進捗確認の架電。担当者より「上長に確認中」との回答。来月上旬に再度連絡もらう予定。' },
	],
	// パターンB: 訪問 → 資料送付 → 再訪問 → 価格交渉 → メモ
	[
		{ type: 'meeting', content: '初回訪問。担当部長・システム担当と面談。現行システムの課題を詳しくヒアリングできた。' },
		{ type: 'email', content: 'ヒアリング内容をまとめた課題整理シートと提案書の第一稿を送付。' },
		{ type: 'meeting', content: '提案説明の訪問。導入効果のシミュレーション資料を使って説明。競合との比較質問あり。' },
		{ type: 'call', content: '価格交渉の連絡。初期費用の削減希望あり。社内で検討の上、修正見積もりを提出予定。' },
		{ type: 'note', content: '先方の決裁権限は部長まで。金額が500万円を超える場合は取締役承認が必要とのこと。' },
	],
	// パターンC: 架電 → メール → 会議 → ノート → 架電
	[
		{ type: 'call', content: '新規開拓の架電。担当者不在のため折り返し依頼。名刺交換済みの紹介経由。' },
		{ type: 'email', content: '後日改めてサービス紹介メールを送付。資料ダウンロードリンクを案内。' },
		{ type: 'meeting', content: '要件ヒアリング実施。現在Excelで管理している工程表のデジタル化ニーズが強い。カスタムテーブルでの対応可否を持ち帰り。' },
		{ type: 'note', content: '競合はkintoneを検討中とのこと。価格よりも使い勝手・サポート体制が重視される傾向。' },
		{ type: 'call', content: 'カスタマイズ可否の確認電話。対応可能な旨を伝え、詳細仕様書を来週中に送付予定。' },
	],
	// パターンD: 会議 → ノート → メール → 架電 → 会議
	[
		{ type: 'meeting', content: '展示会で名刺交換後のフォローアップ訪問。担当者の課題感が明確で、早期導入意向あり。' },
		{ type: 'note', content: '年度末（3月）までの導入を希望。予算は既に確保済みとのこと。スピード重視で進める。' },
		{ type: 'email', content: '標準導入スケジュール案と初期設定サポートの概要を送付。' },
		{ type: 'call', content: 'スケジュール確認の架電。来月中旬の契約を目処に進めることで合意。' },
		{ type: 'meeting', content: '契約前の最終確認MTG。追加要望として既存CSVデータの移行支援を依頼された。対応方針を検討中。' },
	],
	// パターンE: メール → ノート → 架電 → メール → ノート
	[
		{ type: 'email', content: 'Webお問い合わせフォームからの反応に返信。資料一式を送付。' },
		{ type: 'note', content: '問い合わせ内容：「現在のCRMが使いにくく、AIで自動化できる部分を増やしたい」。ニーズ合致度が高い。' },
		{ type: 'call', content: '担当者と初回通話。AIチャットでの操作方法に強い興味。来週のデモ日程を調整。' },
		{ type: 'email', content: 'デモ前の事前アンケートを送付。業種・規模・現状ツールを確認予定。' },
		{ type: 'note', content: 'アンケート回答確認。ユーザー数15名、Excelと別システムを併用中。移行コストの懸念あり。' },
	],
	// パターンF: 架電 → 会議 → ノート → 架電 → メール
	[
		{ type: 'call', content: '既存顧客からの紹介で架電。担当者は以前別会社でSFA導入経験あり、話が早かった。' },
		{ type: 'meeting', content: '対面デモ実施。AIがフォームを動的生成するデモに驚いていた。その場で上長への社内展開を約束。' },
		{ type: 'note', content: '意思決定者：情報システム部長（野村氏）。部長は来月まで海外出張中のため判断は来月以降。' },
		{ type: 'call', content: '部長帰国後のフォロー架電。デモ資料を部長と共有済みとのこと。来週回答予定。' },
		{ type: 'email', content: '改めてROI計算シートと導入事例資料を送付。部長向けの説明補足として。' },
	],
];

function generateActivitiesForCustomer(customerId: string, contactName: string, daysAgo: number): ActivitySeed[] {
	const sequence = pick(activitySequences);
	const count = randInt(4, 6);
	const selected = sequence.slice(0, count);

	return selected.map((tmpl, i) => {
		const daysOffset = daysAgo - Math.floor((daysAgo / count) * (count - 1 - i));
		const jitter = randInt(-3, 3);
		const createdAt = addDays(TODAY, -(daysOffset + jitter));
		return {
			id: crypto.randomUUID(),
			customerId,
			type: tmpl.type,
			content: tmpl.content,
			createdBy: '',
			createdAt: createdAt < TODAY ? createdAt : addDays(TODAY, -1)
		};
	});
}

export function generateSeedData(): SeedData {
	const customersOut: CustomerSeed[] = [];
	const contactsOut: ContactSeed[] = [];
	const dealsOut: DealSeed[] = [];
	const activitiesOut: ActivitySeed[] = [];

	for (const company of companies) {
		const customerId = crypto.randomUUID();
		customersOut.push({
			id: customerId,
			name: company.name,
			email: `info@${dummyEmailDomain(company.domain)}`,
			phone: company.phone,
			address: company.address,
			postalCode: company.postalCode,
			website: `https://${company.domain}`,
			status: company.status,
			notes: company.notes
		});

		const people = pickMany(peoplePool, randInt(1, 3));
		const primaryContact = people[0];
		for (const person of people) {
			const { role, department } = pick(rolePool);
			contactsOut.push({
				id: crypto.randomUUID(),
				customerId,
				name: person.name,
				nameKana: person.kana,
				email: `${person.romaji}@${dummyEmailDomain(company.domain)}`,
				phone: company.phone,
				role,
				department
			});
		}

		const daysAgo = randInt(30, 150);
		const acts = generateActivitiesForCustomer(customerId, primaryContact.name, daysAgo);
		activitiesOut.push(...acts);

		const titles = pickMany(dealTitles, randInt(3, 5));
		for (const title of titles) {
			const status: 'open' | 'won' | 'lost' = pick(['open', 'open', 'won', 'won', 'lost']);
			const amount = randInt(8, 300) * 100000;

			let plannedStart: Date;
			let plannedEnd: Date;
			let closedAt: Date | null = null;

			if (status === 'open') {
				plannedStart = addDays(TODAY, randInt(-60, 30));
				plannedEnd = addDays(plannedStart, randInt(30, 120));
			} else {
				plannedEnd = addDays(TODAY, -randInt(5, 90));
				plannedStart = addDays(plannedEnd, -randInt(30, 90));
				closedAt = addDays(plannedEnd, randInt(0, 3));
			}

			dealsOut.push({
				id: crypto.randomUUID(),
				customerId,
				title,
				amount,
				status,
				closedAt,
				plannedStart: fmtDate(plannedStart),
				plannedEnd: fmtDate(plannedEnd),
				notes: pick(dealNotesByStatus[status])
			});
		}
	}

	return { customers: customersOut, contacts: contactsOut, deals: dealsOut, activities: activitiesOut };
}
