#!/bin/bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

if [[ ! -f /swapfile ]]; then
	fallocate -l 512M /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
fi
swapon --show=NAME --noheadings | grep -qx /swapfile || swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

if ! command -v caddy > /dev/null; then
	curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /usr/share/keyrings/caddy-stable.asc
	cat > /etc/apt/sources.list.d/caddy-stable.sources <<'SOURCES'
Types: deb
URIs: https://dl.cloudsmith.io/public/caddy/stable/deb/debian
Suites: any-version
Components: main
Signed-By: /usr/share/keyrings/caddy-stable.asc
SOURCES
	apt-get update
	apt-get install -y caddy
fi

install -m 0644 "$here/unattended-upgrades.conf" /etc/apt/apt.conf.d/52realtime-unattended-upgrades
install -m 0644 "$here/Caddyfile" /etc/caddy/Caddyfile
install -d -m 0755 /usr/local/lib/realtime /etc/realtime
install -m 0755 "$here/fetch-secrets" /usr/local/lib/realtime/fetch-secrets
install -m 0755 "$here/relay-ready.sh" /usr/local/lib/realtime/relay-ready.sh
install -m 0755 "$here/rollback-release.sh" /usr/local/lib/realtime/rollback-release.sh
[[ -f /etc/realtime/relay.env ]] || install -m 0644 "$here/relay.env.example" /etc/realtime/relay.env
install -m 0644 "$here/realtime.service" /etc/systemd/system/realtime.service
[[ -f $here/realtime ]] && install -m 0755 "$here/realtime" /usr/local/lib/realtime/realtime

systemctl daemon-reload
systemctl enable realtime
systemctl reload caddy
