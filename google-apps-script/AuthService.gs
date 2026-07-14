function validateCredential_(credential) {
  required_(credential, 'Google ID Token');
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_CLIENT_ID');
  const allowedEmails = (props.getProperty('ALLOWED_EMAILS') || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!clientId || !allowedEmails.length) throw new AppError_('CONFIG_ERROR', '尚未設定 GOOGLE_CLIENT_ID 或 ALLOWED_EMAILS。');
  let payload;
  try { const response=UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { muteHttpExceptions: true }); if (response.getResponseCode() !== 200) throw new Error(response.getContentText()); payload=JSON.parse(response.getContentText()); } catch (_) { throw new AppError_('UNAUTHORIZED', 'Google 登入憑證無效或已過期，請重新登入。'); }
  if (payload.aud !== clientId || !['accounts.google.com','https://accounts.google.com'].includes(payload.iss) || Number(payload.exp) * 1000 <= Date.now() || !(payload.email_verified === true || payload.email_verified === 'true')) throw new AppError_('UNAUTHORIZED','Google 登入憑證驗證失敗。');
  const email=String(payload.email || '').toLowerCase(); if (!allowedEmails.includes(email)) throw new AppError_('FORBIDDEN','此 Google 帳號未獲授權使用本辦公室。');
  return { id: payload.sub, email: email, name: payload.name || email, picture: payload.picture || '' };
}
