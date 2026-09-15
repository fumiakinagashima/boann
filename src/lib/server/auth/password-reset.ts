export const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1 hour

type PasswordResetData = {
	accountId: string;
};

function passwordResetKey(token: string): string {
	return `password-reset:${token}`;
}

export async function createPasswordResetToken(kv: KVNamespace, accountId: string): Promise<string> {
	const token = crypto.randomUUID();
	const data: PasswordResetData = { accountId };
	await kv.put(passwordResetKey(token), JSON.stringify(data), { expirationTtl: PASSWORD_RESET_TTL_SECONDS });
	return token;
}

export async function getPasswordResetAccountId(kv: KVNamespace, token: string): Promise<string | null> {
	const raw = await kv.get(passwordResetKey(token));
	if (!raw) return null;
	const data = JSON.parse(raw) as PasswordResetData;
	return data.accountId;
}

export async function deletePasswordResetToken(kv: KVNamespace, token: string): Promise<void> {
	await kv.delete(passwordResetKey(token));
}
