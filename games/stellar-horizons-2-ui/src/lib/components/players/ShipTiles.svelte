<script lang="ts">
    import { shipDefinition } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ConsoleShip } from '$lib/utils/playerArea.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
    import ShipCounter from '../board/ShipCounter.svelte'

    // A console's ships as their counters, explorers then crew vehicles in one flow, each
    // with only what its counter does not show: when it arrives, crippled, explored this turn.
    // A ship in transit has a dashed outline. Clicking one zooms the star map into its system (its
    // destination while it travels) and outlines it in the system's panel; clicking it again
    // zooms back out.
    let { ships }: { ships: ConsoleShip[] } = $props()

    const SIZE = 64
    const gameSession = getGameSession()

    function label({ ship, crippled }: ConsoleShip): string {
        const where =
            ship.transit > 0
                ? `arriving at ${systemName(ship.systemId)} in ${plural(ship.transit, 'turn')}`
                : `at ${systemName(ship.systemId)}`
        return [shipDefinition(ship.shipId).name, where, crippled ? 'crippled' : '']
            .filter(Boolean)
            .join(', ')
    }
</script>

<div class="ship-tiles">
    {#each ships as entry (entry.ship.shipId)}
        {@const ship = entry.ship}
        <button
            type="button"
            class="tile"
            class:moving={ship.transit > 0}
            class:pointed={gameSession.isPointedTo(ship.shipId)}
            aria-pressed={gameSession.isPointedTo(ship.shipId)}
            title={label(entry)}
            aria-label={label(entry)}
            onclick={() => gameSession.pointToShip(ship.shipId)}
        >
            <svg width={SIZE} height={SIZE} aria-hidden="true"
                ><ShipCounter {ship} size={SIZE} /></svg
            >
            {#if ship.transit > 0}
                <span class="status">arrives in {ship.transit}</span>
            {:else if entry.crippled}
                <span class="status bad">crippled</span>
            {:else if ship.explored}
                <span class="status">explored</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .ship-tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, 72px);
        gap: 6px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 4px 2px;
        border-radius: 6px;
    }

    .tile:hover {
        background: rgba(127, 211, 255, 0.08);
    }

    .tile.pointed {
        background: rgba(255, 214, 90, 0.14);
    }

    /* A ship in transit keeps its full colour inside a dashed outline. */
    .tile.moving svg {
        border-radius: 6px;
        outline: 2px dashed #7fd3ff;
        outline-offset: 2px;
    }

    .status {
        color: #9fb4d0;
        font-size: 11px;
    }

    .status.bad {
        color: #f08a7a;
    }
</style>
