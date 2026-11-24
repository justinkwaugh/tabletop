<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { keepWheelIn } from '$lib/utils/wheelKeeper.js'
    import type { Snippet } from 'svelte'
    import { seatOrder } from '$lib/model/seatPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SupplyCard from './SupplyCard.svelte'
    import SymbolKeyCard from './SymbolKeyCard.svelte'

    /** Contract, Symbol key, Supply, Desk layout: looking-only cards; one open at a time. */
    let { row, end = false }: { row?: Snippet; end?: boolean } = $props()

    const gameSession = getGameSession()

    const layers = gameSession.layers
    let open = $derived(layers.corner)
    let supplyToggle: HTMLButtonElement | undefined = $state()

    let paint = $derived.by(() => {
        const playerId = gameSession.myPlayerId ?? seatOrder(gameSession.gameState)[0]
        assertExists(playerId, 'R-1.4 The table has a seat')
        return paintOf(playerId)
    })

    const { paintOf } = gameSession

    function closeOnPress(event: PointerEvent) {
        const onToggle = event.target instanceof Node && supplyToggle?.contains(event.target)
        if (open === 'supply' && !onToggle) {
            layers.closeCorner()
        }
    }

    const keepWheelOnCard = keepWheelIn('.card')

    function openWrits() {
        layers.closeCorner()
        layers.openWrits()
    }
</script>

<svelte:window onpointerdown={closeOnPress} />

<div class="layer" class:end onwheel={keepWheelOnCard}>
    {#if open === 'key'}
        <div
            class="card"
            id="feudum-symbol-key"
            role="presentation"
            onpointerdown={(event) => event.stopPropagation()}
        >
            <SymbolKeyCard {paint} />
        </div>
    {:else if open === 'supply'}
        <div
            class="card closes"
            id="feudum-supply"
            role="presentation"
            onpointerdown={(event) => event.stopPropagation()}
            onclick={() => layers.closeCorner()}
        >
            <SupplyCard
                state={gameSession.gameState}
                {paintOf}
                colourPaintOf={gameSession.colourPaintOf}
                nameOf={(playerId) => gameSession.getPlayerName(playerId)}
                {openWrits}
            />
        </div>
    {/if}
    <div class="toggles">
        <button
            type="button"
            class="toggle"
            aria-expanded={open === 'key'}
            aria-controls="feudum-symbol-key"
            aria-label="Symbol key"
            title="Symbol key"
            data-symbol-key-toggle
            onclick={() => layers.toggleCorner('key')}
        >
            Key
        </button>
        <button
            type="button"
            class="toggle"
            bind:this={supplyToggle}
            aria-expanded={open === 'supply'}
            aria-controls="feudum-supply"
            title="General supply"
            data-supply-toggle
            onclick={() => layers.toggleCorner('supply')}
        >
            Supply
        </button>
        {@render row?.()}
    </div>
</div>

<style>
    .layer {
        position: absolute;
        inset: 0.5rem 0 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-start;
        gap: 0.25rem;
        pointer-events: none;
        z-index: 10;
    }

    .layer.end {
        align-items: flex-end;
    }

    .card {
        display: flex;
        flex-direction: column;
        min-height: 0;
        max-width: calc(100% - 0.5rem);
        margin-left: 0.25rem;
        pointer-events: auto;
    }

    .toggles {
        display: flex;
        align-self: stretch;
        align-items: center;
        gap: 0.25rem;
        margin-left: 7.25rem;
        margin-right: 0.25rem;
    }

    .closes {
        cursor: pointer;
    }

    .end .card {
        margin-right: 0.25rem;
        margin-left: 0;
    }

    .end .toggles {
        justify-content: flex-end;
        margin-right: 7.25rem;
        margin-left: 0.25rem;
    }

    .toggle {
        position: relative;
        height: 2.25rem;
        min-width: 2.75rem;
        padding: 0 0.75rem;
        border: 2px solid var(--feudum-frame);
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 0.875rem;
        font-weight: 600;
        pointer-events: auto;
    }

    .toggle[aria-expanded='true'] {
        border-color: var(--feudum-accent);
        background: var(--feudum-primary);
    }

    .toggle::after {
        content: '';
        position: absolute;
        inset: -0.25rem 0;
    }
</style>
