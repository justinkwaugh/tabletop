<script lang="ts">
    import {
        cargoCapacity,
        type HydratedStellarHorizonsGameState,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { SETTLEMENT_ART } from '$lib/art/manifest.js'
    import { plural } from '$lib/utils/presentation.js'

    let {
        gameState,
        ship,
        carried = ship.settlements,
        width = 79,
        showEmpty = false
    }: {
        gameState: HydratedStellarHorizonsGameState
        ship: ShipState
        carried?: number
        width?: number | 'auto'
        showEmpty?: boolean
    } = $props()

    const faction = $derived(gameState.getPlayerState(ship.playerId).faction)
    const capacity = $derived(Math.max(cargoCapacity(gameState, ship), carried))
    const slots = $derived(Array.from({ length: capacity }, (_, index) => index < carried))
    const label = $derived(
        carried > 0
            ? `Carrying ${plural(carried, 'settlement')}, capacity ${capacity}`
            : `Empty hold, capacity ${capacity}`
    )
</script>

{#if capacity > 0 && (showEmpty || carried > 0)}
    <span
        class="hold"
        role="img"
        aria-label={label}
        title={label}
        style:width={width === 'auto' ? undefined : `${width}px`}
    >
        {#each slots as filled, index (index)}
            <span class="slot" class:filled>
                {#if filled && faction}
                    <img src={SETTLEMENT_ART[faction]} alt="" />
                {/if}
            </span>
        {/each}
    </span>
{/if}

<style>
    /* Cargo slots sit four to a row, exactly as wide as the ship tile above them. */
    .hold {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 2px;
    }

    .slot {
        display: block;
        aspect-ratio: 1;
        border-radius: 3px;
        border: 1px dashed #3a4a68;
        box-sizing: border-box;
    }

    .slot.filled {
        border: none;
    }

    .slot img {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 3px;
    }
</style>
