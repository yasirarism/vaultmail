// Storage keys for API key system
export const apiKeyPrefix = () => 'apikey:';
export const apiKeyUserListKey = (userId: string) => `apikeys:user:${userId}`;
export const apiKeyHashKey = (keyHash: string) => `apikey:hash:${keyHash}`;
export const githubStateKey = (state: string) => `github:oauth:${state}`;
export const sessionKey = (sessionId: string) => `session:${sessionId}`;