<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import UseBadge from '$lib/components/UseBadge.svelte'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { boardZoom } from '$lib/model/boardZoom.js'

    // Rule 1 — a card on the board is for looking: a press enlarges it and never chooses it,
    // except a lit site where the map is the menu (`onpick`): Setup's start site, a Travel
    // destination, the spoils' banish, on a phone a Campaign's site target, and on a desktop the
    // Shrouded Wood ruler's pick. That pick is a button laid over the card, so the keyboard
    // reaches it and Enter or Space picks.
    // A card whose power Use a power lists wears the "Use" badge, its own button at the foot.
    let {
        cardId,
        back,
        label,
        x,
        y,
        width,
        zIndex = 0,
        offered = false,
        pointed = false,
        picked = false,
        previewSlotId,
        onpick,
        pickLabel,
        useBadge = false
    }: {
        cardId?: string
        back?: CardKind
        label: string
        x: number
        y: number
        width: number
        zIndex?: number
        /** Rule 3 — the open menu offers this card or site, so it wears the ring. */
        offered?: boolean
        pointed?: boolean
        /** The pick whose choices the panel shows now: a heavier ring. */
        picked?: boolean
        previewSlotId?: string
        /** A press chooses this card instead of enlarging it. */
        onpick?: () => void
        /** The pick's accessible name: the site and its chip ("Great Slum, 2 Supply"). */
        pickLabel?: string
        /** R-6.2 — Use a power lists the card's power: the "Use" badge opens it. */
        useBadge?: boolean
    } = $props()

    let preview = $derived<CardPreview>({
        cardId,
        back,
        label,
        slotId: previewSlotId
    })

    const style = $derived(`left:${x}px; top:${y}px; width:${width}px; z-index:${zIndex};`)
</script>

<!-- Not a control itself: the keyboard reaches the panel's rows, and a pick on the map's button. -->
<div
    class="board-card"
    class:offered
    class:pointed
    class:picked
    class:pickable={onpick !== undefined}
    role="presentation"
    {style}
    use:inspectImage={{
        preview,
        enabled: onpick === undefined && (cardId !== undefined || back !== undefined)
    }}
>
    <CardImage {cardId} {back} {label} {width} />
    {#if onpick}
        <button
            type="button"
            class="board-card__pick"
            aria-label={pickLabel ?? label}
            {@attach boardZoom}
            onclick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onpick()
            }}
        ></button>
    {/if}
    {#if useBadge && cardId}
        <UseBadge {cardId} board />
    {/if}
</div>

<style>
    .board-card {
        position: absolute;
        display: block;
        line-height: 0;
        border-radius: 5px;
        cursor: zoom-in;
    }

    .board-card.pickable {
        cursor: pointer;
    }

    /* Over the whole card and unseen: only the browser's focus ring shows. */
    .board-card__pick {
        position: absolute;
        inset: 0;
        padding: 0;
        border: 0;
        border-radius: inherit;
        background: transparent;
        cursor: pointer;
    }

    /* The browser's focus ring at screen size whatever the board's zoom, just outside the gold ring. */
    .board-card__pick:focus-visible {
        outline-width: calc(2px / var(--board-zoom, 1));
        outline-offset: calc(4px + 3px / var(--board-zoom, 1));
    }

    .board-card.offered {
        outline: 3px solid #fbbf24;
        outline-offset: 1px;
        box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.28);
    }

    .board-card.offered.pointed {
        outline-color: #fde68a;
        box-shadow: 0 0 0 9px rgba(253, 230, 138, 0.36);
    }

    .board-card.offered.picked {
        outline: 7px solid #d97706;
        outline-offset: 2px;
        box-shadow: 0 0 0 12px rgba(251, 191, 36, 0.4);
    }
</style>
