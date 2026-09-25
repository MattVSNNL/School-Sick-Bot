FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps chromium

COPY src ./src
COPY test/fixtures ./test/fixtures

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "src/server.js"]
