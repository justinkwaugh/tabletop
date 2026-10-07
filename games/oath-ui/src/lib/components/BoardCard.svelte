<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import type { Attachment } from 'svelte/attachments'
    import CardImage from '$lib/components/CardImage.svelte'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'

    // Rule 1 — a card on the board is for looking: a press enlarges it and never chooses it,
    // except a lit Travel destination on a phone, where the map is the menu (`onpick`).
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
        title,
        previewSlotId,
        onpick
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
        title?: string
        previewSlotId?: string
        /** A press chooses this card instead of enlarging it. */
        onpick?: () => void
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

    const picks =
        (pick: () => void): Attachment<HTMLElement> =>
        (node) => {
            const press = (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                pick()
            }
            node.addEventListener('click', press)
            return () => node.removeEventListener('click', press)
        }
</script>

<!-- Not a control: the keyboard reaches the panel's rows, never the table's cards. -->
<div
    class="board-card"
    class:offered
    class:pointed
    class:picked
    class:pickable={onpick !== undefined}
    role="presentation"
    {style}
    title={tooltip}
    use:inspectImage={{
        preview,
        enabled: onpick === undefined && (cardId !== undefined || back !== undefined)
    }}
    {@attach onpick ? picks(onpick) : undefined}
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

    .board-card.pickable {
        cursor: pointer;
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
