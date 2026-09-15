// Mask value used when sending secret fields (authConfig's value/password, etc.) to the client.
// If this value is sent back in a PATCH request, the existing value is kept (treated as unchanged).
export const MASKED_SECRET = '********';
