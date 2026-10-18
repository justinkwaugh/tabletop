<script lang="ts">
    import {
        cargoCapacity,
        type HydratedStellarHorizonsGameState,
        type ShipState,
        type TradeGood
    } from '@tabletop/stellar-horizons-2'
    import { SETTLEMENT_ART, TRADE_GOOD_ART } from '$lib/art/manifest.js'
    import { plural } from '$lib/utils/presentation.js'
    import { goodsText } from '$lib/utils/trade.js'

    let {
        gameState,
        ship,
        carried = ship.settlements,
        goods = ship.goods,
        width = 79,
        showEmpty = false
    }: {
        gameState: HydratedStellarHorizonsGameState
        ship: ShipState
        carried?: number
        goods?: readonly TradeGood[]
        width?: number | 'auto'
        showEmpty?: boolean
    } = $props()

    const faction = $derived(gameState.getPlayerState(ship.playerId).faction)
    const capacity = $derived(Math.max(cargoCapacity(gameState, ship), carried + goods.length))
    // Settlements fill the hold first, then goods, then the empty slots.
    const slots = $derived(
        Array.from({ length: capacity }, (_, index) =>
            index < carried ? 'settlement' : goods[index - carried]
        )
    )
    const label = $derived.by(() => {
        const cargo = [
            carried > 0 ? plural(carried, 'settlement') : '',
            goods.length > 0 ? goodsText(goods) : ''
        ].filter(Boolean)
        return cargo.length > 0
            ? `Carrying ${cargo.join(', ')}, capacity ${capacity}`
            : `Empty hold, capacity ${capacity}`
    })
</script>

{#if capacity > 0 && (showEmpty || carried > 0 || goods.length > 0)}
    <span
        class="hold"
        role="img"
        aria-label={label}
        title={label}
        style:width={width === 'auto' ? undefined : `${width}px`}
    >
        {#each slots as slot, index (index)}
            <span class="slot" class:filled={slot !== undefined} class:good={slot !== 'settlement'}>
                {#if slot === 'settlement'}
                    {#if faction}<img src={SETTLEMENT_ART[faction]} alt="" />{/if}
                {:else if slot !== undefined}
                    <img src={TRADE_GOOD_ART[slot]} alt="" />
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

    .slot.good img {
        object-fit: contain;
        border-radius: 0;
    }
</style>
