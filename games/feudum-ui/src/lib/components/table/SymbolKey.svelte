<script lang="ts">
    import { seatOrder } from '$lib/model/seatPanel.js'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SymbolKeyCard from './SymbolKeyCard.svelte'

    /**
     * Contract, Symbol key: a "Key" button beside the board's zoom controls opens the table's
     * vocabulary over the board's corner; a second press or Escape closes it. Looking only: it
     * offers no target and changes no offer.
     */
    const gameSession = getGameSession()

    let open = $state(false)

    /** The viewer's own colour; a spectator's key borrows the first seat's. */
    let paint = $derived.by(() => {
        const playerId = gameSession.myPlayerId ?? seatOrder(gameSession.gameState)[0] ?? ''
        return seatPaint(gameSession.colors, playerId, gameSession.getPlayerName(playerId))
    })

    function closeOnEscape(event: KeyboardEvent) {
        if (open && event.key === 'Escape') {
            open = false
        }
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="layer">
    {#if open}
        <!-- The card scrolls by itself: a wheel over it never zooms the board beneath. -->
        <div
            class="card"
            id="feudum-symbol-key"
            role="presentation"
            onwheel={(event) => event.stopPropagation()}
            onpointerdown={(event) => event.stopPropagation()}
        >
            <SymbolKeyCard {paint} />
        </div>
    {/if}
    <button
        type="button"
        class="toggle"
        aria-expanded={open}
        aria-controls="feudum-symbol-key"
        aria-label="Symbol key"
        title="Symbol key"
        data-symbol-key-toggle
        onclick={() => (open = !open)}
    >
        Key
    </button>
</div>

<style>
    /* Over the board's lower-left corner, the button beside the zoom controls, the card above it. */
    .layer {
        position: absolute;
        inset: 0.5rem auto 0 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-start;
        gap: 0.25rem;
        pointer-events: none;
        z-index: 10;
    }

    .card {
        display: flex;
        flex-direction: column;
        min-height: 0;
        margin-left: 0.25rem;
        pointer-events: auto;
    }

    .toggle {
        position: relative;
        height: 2.25rem;
        min-width: 2.75rem;
        margin-left: 7.25rem;
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

    /* 44 px to press, for a button drawn the zoom controls' height. */
    .toggle::after {
        content: '';
        position: absolute;
        inset: -0.25rem 0;
    }
</style>
