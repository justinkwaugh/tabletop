#!/bin/bash
set -euo pipefail
set -a
. /etc/realtime/relay.env
. /run/realtime-relay/secrets.env
set +a
REALTIME_SIGNING_KEY=${REALTIME_SIGNING_KEYS%%,*} exec "$(dirname "$0")/loadtest" \
	-relay https://events.boardtogether.games -dial 127.0.0.1:443 \
	-redis "$REDIS_HOST:$REDIS_PORT" -stats http://127.0.0.1:8091 -processes caddy,realtime \
	-connections "${1:-1000}" -games 100 -messages 20 "${@:2}"
