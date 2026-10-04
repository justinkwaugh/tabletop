<script lang="ts">
    import { hasArrived, moveOptions, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const ready = $derived(
        gameState
            .shipsOf(playerId)
            .filter((ship) => hasArrived(ship) && moveOptions(gameState, ship).length > 0)
    )
    const selected = $derived(gameSession.selectedShip)
</script>

<div class="sh-step">
    <div class="cards">
        {#each ready as ship (ship.shipId)}
            <ShipTile
                ship={shipDefinition(ship.shipId)}
                selected={selected?.shipId === ship.shipId}
                onclick={() => gameSession.selectShip(ship.shipId)}
            >
                <div class="stats">
                    {systemName(ship.systemId)}{ship.settlements > 0
                        ? ` · ${ship.settlements} aboard`
                        : ''}
                </div>
            </ShipTile>
        {:else}
            <p class="empty">No ships can move this turn.</p>
        {/each}
    </div>
    {#if selected}
        <div class="buttons">
            <span class="hint">Send {shipDefinition(selected.shipId).name} to:</span>
            {#each gameSession.moveTargets as target (target.systemId)}
                <button type="button" onclick={() => gameSession.moveSelectedShip(target.systemId)}>
                    {systemName(target.systemId)} ({plural(target.turns, 'turn')})
                </button>
            {/each}
        </div>
    {:else if ready.length > 0}
        <p class="hint">Pick a ship, then a highlighted destination on the map.</p>
    {/if}
</div>
