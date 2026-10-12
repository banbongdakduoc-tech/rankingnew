export function firebaseTarget(env = process.env) {
  const target = env.DPL_DEPLOYMENT_ENV || 'demo';
  const databasePath = env.DPL_DATABASE_PATH;
  if (!env.FIREBASE_DATABASE_URL || !env.FIREBASE_SERVICE_ACCOUNT_JSON || !databasePath) {
    throw new Error('Thiếu cấu hình Firebase: FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT_JSON và DPL_DATABASE_PATH.');
  }
  if (target === 'demo') {
    if (!/^environments\/demo(?:[-_a-zA-Z0-9]*)(?:\/|$)/.test(databasePath)) {
      throw new Error('Môi trường demo chỉ được ghi vào environments/demo…; không dùng root của giải thật.');
    }
  } else if (target === 'production') {
    if (env.DPL_PRODUCTION_DATABASE_URL !== env.FIREBASE_DATABASE_URL) {
      throw new Error('Cần xác nhận database main bằng DPL_PRODUCTION_DATABASE_URL khớp FIREBASE_DATABASE_URL.');
    }
    if (databasePath !== '/' && !/^environments\/production(?:[-_a-zA-Z0-9]*)(?:\/|$)/.test(databasePath)) {
      throw new Error('Môi trường main chỉ dùng root / hoặc environments/production….');
    }
  } else {
    throw new Error('DPL_DEPLOYMENT_ENV phải là demo hoặc production.');
  }
  return databasePath;
}
