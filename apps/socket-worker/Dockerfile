FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/socket-worker/package.json ./apps/socket-worker/package.json
COPY packages/db/package.json ./packages/db/package.json
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN pnpm --filter @sneaker-drop/db build && pnpm --filter @sneaker-drop/socket-worker build

EXPOSE 3002
CMD ["pnpm", "--filter", "@sneaker-drop/socket-worker", "start"]
