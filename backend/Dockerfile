# Dockerfile Cloud Run ready.
# Léger (~150 MB), uniquement moteur fetch (pas de Playwright).
# Pour Leboncoin + AutoScout24 (live sans proxy), c'est parfait.
# Pour les sources "needs_proxy" → utiliser Dockerfile.cloudrun qui embarque Chromium.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# On retire les optionalDependencies (playwright) pour garder l'image compacte.
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN apk add --no-cache wget tini
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health > /dev/null || exit 1

# tini comme init process → gestion propre de SIGTERM par Cloud Run
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
