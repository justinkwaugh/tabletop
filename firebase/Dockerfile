FROM node:22-alpine
ARG FIREBASE_VERSION=14.23.0
RUN apk --no-cache add openjdk21 bash curl openssl gettext nano sudo && \
    npm cache clean --force && \
    npm i -g firebase-tools@$FIREBASE_VERSION
WORKDIR /srv/firebase
ENTRYPOINT ["firebase", "emulators:start", "--import", "data/export", "--export-on-exit"]