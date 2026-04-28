# Dockerfile Cloud Run — version minimaliste et éprouvée.
# node:20-slim (Debian) : meilleure compat avec grpc-js / firebase-admin.
# On n'utilise PAS --omit=optional : ça déclenche un bug npm qui élague
# des sous-deps de firebase-admin (@google-cloud/firestore/build/src/path).
# Playwright reste installé (juste son code JS, pas Chromium, ~50 Mo de plus).

FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# Empêche playwright de DL Chromium à l'installation (on n'en a pas besoin).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

EXPOSE 8080
CMD ["node", "src/server.js"]
