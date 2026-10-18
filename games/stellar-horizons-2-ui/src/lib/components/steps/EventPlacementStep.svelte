<script lang="ts">
    import { eventDefinition, eventPlacementSystems } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import EventTile from '../EventTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const placement = $derived(gameState.eventPlacement)
    const systems = $derived(placement ? eventPlacementSystems(gameState, placement.playerId) : [])
</script>

{#if placement}
    {@const definition = eventDefinition(placement.eventId)}
    <div class="sh-step">
        <div class="row">
            <EventTile eventId={placement.eventId} width={96} />
            <div class="body">
                <p class="hint">
                    {definition.name} must go to a system with one of your bases, as you have the worst
                    initiative among the factions with a base. Anyone may resolve it, for {definition.influence}
                    IP.
                </p>
                <div class="systems">
                    {#each systems as systemId (systemId)}
                        <button type="button" onclick={() => gameSession.placeEvent(systemId)}
                            >{systemName(systemId)}</button
                        >
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .systems {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
