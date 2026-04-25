FROM node:20-alpine AS deps
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY api/package*.json ./
RUN npm ci
COPY api/tsconfig.json api/tsconfig.scripts.json ./
COPY api/src ./src
COPY api/scripts ./scripts
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY api/package.json ./
COPY infra/database/migrations ./migrations
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
