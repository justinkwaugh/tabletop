# Run the container with `docker run -p 3000:3000 -t backend`.

# Build/deps stage.
FROM docker.io/node:22-bookworm AS builder

ENV HOST=0.0.0.0

WORKDIR /app

RUN apt-get update && apt-get install -y make gcc g++ python3 curl

COPY apps/backend/package.json backend/package.json
COPY package-lock.json backend/package-lock.json

RUN npm --prefix backend --omit=dev ci

COPY libs/common backend/node_modules/@tabletop/common
COPY libs/backend-services backend/node_modules/@tabletop/backend-services
COPY libs/email backend/node_modules/@tabletop/email
COPY config/config-games backend/node_modules/@tabletop/games-config

COPY apps/backend/.env.prod backend/.env
COPY apps/backend/dist backend

# Runtime stage.
FROM docker.io/node:22-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0

WORKDIR /app/backend

RUN addgroup --system backend && adduser --system --ingroup backend backend

COPY --from=builder --chown=backend:backend /app/backend /app/backend

USER backend

EXPOSE 8080

CMD [ "node", "--env-file=.env", "main.js" ]
