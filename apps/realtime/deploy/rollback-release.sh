#!/bin/bash
set -euo pipefail
lib=/usr/local/lib/realtime

if [[ ! -f $lib/realtime.previous ]]; then
	echo "there is no previous relay to roll back to" >&2
	exit 1
fi
mv "$lib/realtime" "$lib/realtime.rolled-back"
mv "$lib/realtime.previous" "$lib/realtime"
mv "$lib/realtime.rolled-back" "$lib/realtime.previous"
systemctl restart realtime
bash "$lib/relay-ready.sh"
