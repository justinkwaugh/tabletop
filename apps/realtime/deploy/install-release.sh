#!/bin/bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
version=$1
lib=/usr/local/lib/realtime

[[ -f $lib/realtime ]] && cp -p "$lib/realtime" "$lib/realtime.previous"
bash "$here/setup-vm.sh"
systemctl restart realtime
bash "$here/relay-ready.sh" "$version" && exit 0

if [[ -f $lib/realtime.previous ]]; then
	echo "restoring the previous relay" >&2
	install -m 0755 "$lib/realtime.previous" "$lib/realtime"
	systemctl restart realtime
	bash "$lib/relay-ready.sh" || true
fi
exit 1
