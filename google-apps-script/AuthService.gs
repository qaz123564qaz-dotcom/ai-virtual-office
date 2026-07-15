function validateCredential_(credential) {
  required_(credential, 'Google ID Token');
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw new AppError_('CONFIG_ERROR', '尚未設定 GOOGLE_CLIENT_ID。');

  const authCache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${clientId}|${credential}`);
  const cacheKey = `google-auth:${Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '')}`;
  const cachedUser = authCache.get(cacheKey);
  if (cachedUser) {
    try { return JSON.parse(cachedUser); } catch (_) { authCache.remove(cacheKey); }
  }

  let payload;
  try {
    const response = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error(response.getContentText());
    payload = JSON.parse(response.getContentText());
  } catch (_) {
    throw new AppError_('UNAUTHORIZED', 'Google 登入憑證無效或已過期，請重新登入。');
  }

  const validIssuer = ['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss);
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (payload.aud !== clientId || !validIssuer || Number(payload.exp) * 1000 <= Date.now() || !emailVerified || !payload.sub || !payload.email) {
    throw new AppError_('UNAUTHORIZED', 'Google 登入憑證驗證失敗。');
  }

  const user = {
    id: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    name: String(payload.name || payload.email),
    picture: String(payload.picture || '')
  };
  const secondsUntilExpiry = Number(payload.exp) - Math.floor(Date.now() / 1000) - 30;
  if (secondsUntilExpiry > 0) authCache.put(cacheKey, JSON.stringify(user), Math.min(300, secondsUntilExpiry));
  return user;
}
