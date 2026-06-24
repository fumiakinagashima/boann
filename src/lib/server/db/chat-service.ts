import { eq, asc, desc, isNull, or } from 'drizzle-orm';
import { chats, chatMessages } from './schema';
import type { Db } from '.';
import type { MessageContent } from '$lib/types/chat';

export type ChatRow = {
	id: string;
	title: string;
	accountId: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ChatMessageRow = {
	id: string;
	chatId: string;
	role: 'user' | 'assistant';
	contents: MessageContent[];
	createdAt: Date;
};

function toChatRow(r: typeof chats.$inferSelect): ChatRow {
	return {
		id: r.id,
		title: r.title,
		accountId: r.accountId,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt
	};
}

function toChatMessageRow(r: typeof chatMessages.$inferSelect): ChatMessageRow {
	return {
		id: r.id,
		chatId: r.chatId,
		role: r.role,
		contents: JSON.parse(r.contents) as MessageContent[],
		createdAt: r.createdAt
	};
}

export async function ensureChat(
	db: Db,
	input: { id: string; title?: string; accountId?: string }
): Promise<void> {
	await db
		.insert(chats)
		.values({
			id: input.id,
			title: input.title ?? '',
			accountId: input.accountId ?? null
		})
		.onConflictDoNothing();
}

export async function listChats(db: Db, accountId?: string, limit = 50): Promise<ChatRow[]> {
	const rows = await db
		.select()
		.from(chats)
		.where(accountId ? or(isNull(chats.accountId), eq(chats.accountId, accountId)) : undefined)
		.orderBy(desc(chats.updatedAt))
		.limit(limit);
	return rows.map(toChatRow);
}

export async function getChat(db: Db, id: string): Promise<ChatRow | null> {
	const [r] = await db.select().from(chats).where(eq(chats.id, id));
	return r ? toChatRow(r) : null;
}

export async function listChatMessages(db: Db, chatId: string): Promise<ChatMessageRow[]> {
	const rows = await db
		.select()
		.from(chatMessages)
		.where(eq(chatMessages.chatId, chatId))
		.orderBy(asc(chatMessages.createdAt));
	return rows.map(toChatMessageRow);
}

export async function upsertChatMessage(
	db: Db,
	input: { id: string; chatId: string; role: 'user' | 'assistant'; contents: MessageContent[] }
): Promise<void> {
	const contents = JSON.stringify(input.contents);
	await db.batch([
		db
			.insert(chatMessages)
			.values({
				id: input.id,
				chatId: input.chatId,
				role: input.role,
				contents
			})
			.onConflictDoUpdate({
				target: chatMessages.id,
				set: { contents }
			}),
		db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, input.chatId))
	]);
}

export async function updateChatTitle(db: Db, id: string, title: string): Promise<void> {
	await db.update(chats).set({ title }).where(eq(chats.id, id));
}

export async function deleteChat(db: Db, id: string): Promise<void> {
	await db.batch([
		db.delete(chatMessages).where(eq(chatMessages.chatId, id)),
		db.delete(chats).where(eq(chats.id, id))
	]);
}
