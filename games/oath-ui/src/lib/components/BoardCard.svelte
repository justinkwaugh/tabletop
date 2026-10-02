<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'

    // Rule 1 — a card on the board is for looking: a press enlarges it and never chooses it.
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
        title,
        previewSlotId
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
        /** A menu row naming this card is pointed at. */
        pointed?: boolean
        title?: string
        previewSlotId?: string
    } = $props()

    let preview = $derived<CardPreview>({
        cardId,
        back,
        label,
        slotId: previewSlotId
    })

    const style = $derived(`left:${x}px; top:${y}px; width:${width}px; z-index:${zIndex};`)

    // R-9.4 — the caller's label never names a facedown card.
    let tooltip = $derived(title ?? label)
</script>

<!-- Not a control: the keyboard reaches the panel's rows, never the table's cards. -->
<div
    class="board-card"
    class:offered
    class:pointed
    role="presentation"
    {style}
    title={tooltip}
    use:inspectImage={{ preview, enabled: cardId !== undefined || back !== undefined }}
>
    <CardImage {cardId} {back} {label} {width} />
</div>

<style>
    .board-card {
        position: absolute;
        display: block;
        line-height: 0;
        border-radius: 5px;
        cursor: zoom-in;
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
</style>
