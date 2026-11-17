FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node index.js ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node config ./config
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node models ./models
COPY --chown=node:node routes ./routes
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node services ./services

USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5001) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
