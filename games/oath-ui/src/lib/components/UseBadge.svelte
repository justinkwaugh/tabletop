<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { boardZoom } from '$lib/model/boardZoom.js'
    import { cardNameInPlay } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.2, R-7.4 — the gold "Use" at the foot of a card the seat can use now: a tap opens Use a
    // power on that card, or the action it changes with it in use, and a tap on the card still
    // enlarges it. Ringed while it would make the dimmed action whose reason shows possible, and
    // read with that reason. On the board it keeps its screen size whatever the board's zoom.
    let { cardId, board = false }: { cardId: string; board?: boolean } = $props()

    let gameSession = getGameSession()
    let ringed = $derived(gameSession.ringedUses.includes(cardId))

    // Heard on the button itself: a board card enlarges on any click that reaches it and stops it
    // there, before a handler Svelte delegates to the document would hear it.
    const press: Attachment<HTMLButtonElement> = (node) => {
        const click = (event: MouseEvent) => {
            event.stopPropagation()
            gameSession.useCard(cardId)
        }
        node.addEventListener('click', click)
        return () => node.removeEventListener('click', click)
    }
</script>

<button
    type="button"
    class="use-badge"
    class:use-badge--board={board}
    class:use-badge--ring={ringed}
    aria-label="Use {cardNameInPlay(gameSession.gameState, cardId)}"
    aria-describedby={ringed ? gameSession.useRingReason : undefined}
    disabled={gameSession.busy}
    data-use-badge={cardId}
    {@attach board ? boardZoom : undefined}
    {@attach press}
>
    <span class="use-badge__face">Use</span>
</button>

<style>
    /* Centred on the card's foot, the face from 12 px above its edge to 6 px past it. The tap area
       is 44 px tall from the face down, at every width, so the card above keeps its own tap; as
       wide as its label, and never under 44 px.
       In a seat the button is no layer of its own (no z-index, no transform): an item that comes
       later in the seat, such as a held relic or banner on the next line or under an adviser, is
       drawn over the transparent part of the area and keeps its own tap, while the face, a layer
       of its own, stays drawn on top. The face centres itself with the transform the button had,
       so it is drawn as before. On the board each card is a layer, and a card that comes later
       covers the area there. */
    .use-badge {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% - 12px);
        display: flex;
        width: max-content;
        min-width: 44px;
        min-height: 44px;
        margin-inline: auto;
        align-items: flex-start;
        /* From the start, so the face's own centring (half the area, back half its width) holds
           where the area is wider than the face. */
        justify-content: flex-start;
        padding: 0;
        border: 0;
        background: transparent;
        line-height: 1;
        cursor: pointer;
    }
    .use-badge--board {
        left: 50%;
        right: auto;
        top: calc(100% - 12px / var(--board-zoom, 1));
        z-index: 7;
        margin-inline: 0;
        justify-content: center;
        transform: translateX(-50%) scale(calc(1 / var(--board-zoom, 1)));
        transform-origin: 50% 0;
    }
    .use-badge__face {
        position: relative;
        left: 50%;
        z-index: 7;
        transform: translateX(-50%);
        display: block;
        padding: 3px 8px;
        border-radius: 5px;
        background: #facc15;
        color: #1c1917;
        font-size: 12px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.53);
    }
    .use-badge--board .use-badge__face {
        left: 0;
        transform: none;
    }
    .use-badge:hover .use-badge__face {
        background: #fde047;
    }
    /* R-7.4 — the card would make the dimmed action possible. */
    .use-badge--ring .use-badge__face {
        box-shadow:
            0 0 0 2px #1c1917,
            0 0 0 4px #fcd34d;
    }
    .use-badge:disabled {
        cursor: default;
    }
    .use-badge:disabled .use-badge__face {
        opacity: 0.6;
    }
</style>
