const createCorsOptions = (env = process.env) => {
  const origins = new Set([
    'https://hakoware.xyz', 'https://www.hakoware.xyz', 'https://hakoware.vercel.app',
    ...`${env.CORS_ORIGINS || ''},${env.FRONTEND_URL || ''}`.split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean)
  ]);
  const preview = /^https:\/\/hakoware-v2-[a-z0-9-]+-ghostts-projects-0d589912\.vercel\.app$/i;
  return {
    origin(origin, callback) {
      if (!origin || origins.has(origin) || preview.test(origin)) return callback(null, true);
      if (env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token']
  };
};
module.exports = { createCorsOptions };
