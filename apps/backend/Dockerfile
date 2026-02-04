# Run the container with `docker run -p 3000:3000 -t backend`.

# Build/deps stage.
FROM docker.io/node:22-bookworm AS builder

ENV HOST=0.0.0.0

WORKDIR /app

RUN apt-get update && apt-get install -y make gcc g++ python3 curl

COPY package.json /app/package.json
COPY pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
COPY apps/backend/package.json /app/apps/backend/package.json
COPY libs/common/package.json /app/libs/common/package.json
COPY libs/backend-services/package.json /app/libs/backend-services/package.json
COPY libs/email/package.json /app/libs/email/package.json
COPY config/config-games/package.json /app/config/config-games/package.json

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
RUN pnpm install --frozen-lockfile --prod

COPY libs/common /app/libs/common
COPY libs/backend-services /app/libs/backend-services
COPY libs/email /app/libs/email
COPY config/config-games /app/config/config-games

COPY apps/backend/.env.prod /app/apps/backend/.env
COPY apps/backend/dist /app/apps/backend/dist

# Runtime stage.
FROM docker.io/node:22-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0

WORKDIR /app/apps/backend

RUN addgroup --system backend && adduser --system --ingroup backend backend

COPY --from=builder --chown=backend:backend /app /app

USER backend

EXPOSE 8080

CMD [ "node", "--env-file=.env", "dist/main.js" ]
