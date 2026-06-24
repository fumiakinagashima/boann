// authConfig の value / password 等の秘匿フィールドをクライアントに送る際のマスク値。
// PATCH時にこの値が送られてきた場合は既存値を保持する（未変更として扱う）。
export const MASKED_SECRET = '********';
