# Run the container with `docker run -p 3000:3000 -t backend`.
FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0

WORKDIR /app

RUN addgroup --system backend && \
          adduser --system -G backend backend
          
RUN apk add make gcc g++ python3 curl

COPY apps/backend/package.json backend/package.json
COPY package-lock.json backend/package-lock.json

RUN npm --prefix backend --omit=dev ci

RUN curl -sfS https://dotenvx.sh/install.sh | sh 

COPY libs/common backend/node_modules/@tabletop/common
COPY libs/backend-services backend/node_modules/@tabletop/backend-services
COPY libs/email backend/node_modules/@tabletop/email
COPY games/fresh-fish backend/node_modules/@tabletop/fresh-fish
COPY games/fresh-fish backend/node_modules/@tabletop/bridges-of-shangri-la

COPY apps/backend/.env.prod backend/.env
COPY apps/backend/dist backend
COPY apps/frontend/build backend/app/static

RUN chown -R backend:backend .

EXPOSE 8080

CMD [ "dotenvx", "run", "--env-file", "backend/.env", "--", "node", "backend/main.js" ]
