#!/bin/bash
set -uo pipefail
want=${1:-}

for _ in $(seq 30); do
	stats=$(curl -fsS 127.0.0.1:8091 2> /dev/null) || stats=
	if [[ -n $stats ]] && curl -fsS -o /dev/null 127.0.0.1:8090/health 2> /dev/null; then
		version=$(jq -r '.version // empty' <<< "$stats")
		if [[ -z $want || $version == "$want" ]]; then
			echo "relay ${version:-without a version} is up and connected to Redis"
			exit 0
		fi
	fi
	sleep 1
done
echo "the relay did not report ${want:-any version} with Redis connected within 30 s" >&2
exit 1
