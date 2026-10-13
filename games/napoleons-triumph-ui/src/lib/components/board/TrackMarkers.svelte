<script lang="ts">
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TRACK_MARKER_RADIUS } from '$lib/utils/trackMarker.js'

    const gameSession = getGameSession()

    const BLACK = '#1d1b18'
</script>

{#snippet marker(track: string, at: Point, fill: string)}
    <circle
        cx={at.x}
        cy={at.y}
        r={TRACK_MARKER_RADIUS}
        {fill}
        filter="url(#nt-contact-shadow)"
        data-track-marker={track}
    ></circle>
{/snippet}

<g class="pointer-events-none">
    {#each gameSession.commandDiscs as disc (`${disc.x}:${disc.y}`)}
        {@render marker('command', disc, BLACK)}
    {/each}
    {@render marker('time', gameSession.timeMarker, BLACK)}
    {#each gameSession.moraleMarkers as { playerId, at } (playerId)}
        {@render marker('morale', at, gameSession.armyColors(playerId).block)}
    {/each}
</g>
