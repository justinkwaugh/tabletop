<script lang="ts">
    import { eventDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import EventTile from '../EventTile.svelte'

    const gameSession = getGameSession()
    const placement = $derived(gameSession.gameState.eventPlacement)
</script>

{#if placement}
    {@const definition = eventDefinition(placement.eventId)}
    <div class="sh-step">
        <div class="row">
            <EventTile eventId={placement.eventId} width={96} />
            <p class="hint">
                {definition.name} must go to a system with one of your bases, as you have the worst initiative
                among the factions with a base. Choose one of the highlighted systems on the map. Anyone
                may resolve it, for {definition.influence} IP.
            </p>
        </div>
    </div>
{/if}

<style>
    .row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }
</style>
