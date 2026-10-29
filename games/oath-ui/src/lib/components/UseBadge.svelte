<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { boardZoom } from '$lib/model/boardZoom.js'
    import { cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.2 — the gold "Use" at the foot of a card whose power Use a power lists: a tap opens Use
    // a power on that card, and a tap on the card still enlarges it. On the board it keeps its
    // screen size whatever the board's zoom.
    let { cardId, board = false }: { cardId: string; board?: boolean } = $props()

    let gameSession = getGameSession()

    // Heard on the button itself: a board card enlarges on any click that reaches it and stops it
    // there, before a handler Svelte delegates to the document would hear it.
    const press: Attachment<HTMLButtonElement> = (node) => {
        const click = (event: MouseEvent) => {
            event.stopPropagation()
            gameSession.openCardPower(cardId)
        }
        node.addEventListener('click', click)
        return () => node.removeEventListener('click', click)
    }
</script>

<button
    type="button"
    class="use-badge"
    class:use-badge--board={board}
    aria-label="Use {cardName(cardId)}"
    disabled={gameSession.busy}
    data-use-badge={cardId}
    {@attach board ? boardZoom : undefined}
    {@attach press}
>
    <span class="use-badge__face">Use</span>
</button>

<style>
    /* Centred on the card's foot, the face from 12 px above its edge to 6 px past it. The tap area
       is the face, on a phone 44 px tall from the face down, so the card above keeps its own tap;
       as wide as its label. */
    .use-badge {
        position: absolute;
        left: 50%;
        top: calc(100% - 12px);
        z-index: 7;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 0;
        border: 0;
        background: transparent;
        line-height: 1;
        cursor: pointer;
        transform: translateX(-50%);
        transform-origin: 50% 0;
    }
    .use-badge--board {
        top: calc(100% - 12px / var(--board-zoom, 1));
        transform: translateX(-50%) scale(calc(1 / var(--board-zoom, 1)));
    }
    .use-badge__face {
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
    .use-badge:hover .use-badge__face {
        background: #fde047;
    }
    .use-badge:disabled {
        cursor: default;
    }
    .use-badge:disabled .use-badge__face {
        opacity: 0.6;
    }

    @media (max-width: 640px) and (orientation: portrait),
        (max-height: 520px) and (orientation: landscape) {
        .use-badge {
            min-height: 44px;
        }
    }
</style>
