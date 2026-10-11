<script lang="ts">
    import { hasArrived, moveOptions, shipDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CargoHold from '../CargoHold.svelte'
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
    {#if ready.length > 0}
        <div class="prompt">
            {selected ? 'Choose a highlighted destination on the map' : 'Choose a ship to move'}
        </div>
    {/if}
    <div class="cards">
        {#each ready as ship (ship.shipId)}
            <ShipTile
                ship={shipDefinition(ship.shipId)}
                named={false}
                selected={selected?.shipId === ship.shipId}
                onclick={() => gameSession.selectShip(ship.shipId)}
            >
                <CargoHold {gameState} {ship} />
            </ShipTile>
        {:else}
            <p class="empty">No ships can move this turn.</p>
        {/each}
    </div>
</div>
