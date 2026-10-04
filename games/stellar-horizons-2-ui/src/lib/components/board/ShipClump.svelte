<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { factionName, plural, systemName } from '$lib/utils/presentation.js'
    import type { ShipPip as PlacedPip } from '$lib/utils/shipPipLayout.js'
    import ShipPip from './ShipPip.svelte'

    let {
        systemId,
        playerId,
        pips,
        r
    }: { systemId: string; playerId: string; pips: PlacedPip[]; r: number } = $props()

    const HIT_RADIUS = 1.12

    const gameSession = getGameSession()
    const faction = $derived(gameSession.gameState.getPlayerState(playerId).faction)
    const open = $derived(
        gameSession.inspectedClump?.systemId === systemId &&
            gameSession.inspectedClump.playerId === playerId
    )
    const label = $derived(
        `${faction ? factionName(faction) : 'Ships'} at ${systemName(systemId)}: ${plural(pips.length, 'ship')}`
    )

    function onclick(event: MouseEvent) {
        event.stopPropagation()
        gameSession.toggleClump(systemId, playerId)
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<g class="clump" class:open role="button" tabindex="-1" aria-label={label} {onclick}>
    {#each pips as pip (pip.ship.shipId)}
        <circle cx={pip.x} cy={pip.y} r={r * HIT_RADIUS} class="hit"></circle>
    {/each}
    {#each pips as pip (pip.ship.shipId)}
        <ShipPip ship={pip.ship} x={pip.x} y={pip.y} {r} />
    {/each}
</g>

<style>
    .hit {
        fill: transparent;
    }

    .clump {
        cursor: pointer;
    }

    .clump:hover,
    .clump.open {
        filter: brightness(1.2) drop-shadow(0 0 6px #7fd3ff);
    }
</style>
