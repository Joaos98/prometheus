FROM node:22-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/data/package.json packages/data/
COPY apps/self-hosted/package.json apps/self-hosted/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/engine packages/engine
COPY packages/data packages/data
COPY apps/self-hosted apps/self-hosted
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/self-hosted/package.json ./apps/self-hosted/
COPY --from=builder /app/apps/self-hosted/dist ./apps/self-hosted/dist
COPY --from=builder /app/apps/self-hosted/src ./apps/self-hosted/src
COPY --from=builder /app/node_modules ./node_modules
ENV PORT=3000 PROMETHEUS_DB=/data/prometheus.db
EXPOSE 3000
CMD ["npx", "tsx", "apps/self-hosted/src/server/index.ts"]
