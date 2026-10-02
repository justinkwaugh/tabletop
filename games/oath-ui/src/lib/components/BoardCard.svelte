<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'

    // A dynamic tag cannot carry a role Svelte can infer, so a pickable card is a `<button>`.
    // On touch a pickable card's tap is its pick and a hold opens the preview.
    let {
        cardId,
        back,
        label,
        x,
        y,
        width,
        zIndex = 0,
        pickable = false,
        picked = false,
        pointed = false,
        onpick,
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
        pickable?: boolean
        /** A pick the player has made and may still change. */
        picked?: boolean
        /** A menu row naming this card is pointed at (rule 3). */
        pointed?: boolean
        onpick?: () => void
        title?: string
        previewSlotId?: string
    } = $props()

    let preview = $derived<CardPreview>({
        cardId,
        back,
        label,
        slotId: previewSlotId
    })

    // R-9.4 — a facedown card's front is private, so there is nothing to enlarge.
    let inspectable = $derived(back === undefined && cardId !== undefined)

    const style = $derived(`left:${x}px; top:${y}px; width:${width}px; z-index:${zIndex};`)

    // R-9.4 — the caller's label never names a facedown card.
    let tooltip = $derived(title ?? label)
</script>

{#if pickable}
    <button
        type="button"
        class="board-card pickable"
        class:picked
        class:pointed
        {style}
        title={tooltip}
        onclick={() => onpick?.()}
        use:inspectImage={{ preview, enabled: inspectable, pickable: true, focus: true }}
    >
        <CardImage {cardId} {back} {label} {width} />
    </button>
{:else}
    <!-- An inert card is not a control, so
         it cannot be inspected from the keyboard; a pickable one can. -->
    <div
        class="board-card"
        role="presentation"
        {style}
        title={tooltip}
        use:inspectImage={{ preview, enabled: inspectable, pickable: false }}
    >
        <CardImage {cardId} {back} {label} {width} />
    </div>
{/if}

<style>
    .board-card {
        position: absolute;
        display: block;
        padding: 0;
        border: 0;
        background: none;
        line-height: 0;
        border-radius: 5px;
    }

    .board-card.pickable {
        cursor: pointer;
        outline: 3px solid #fbbf24;
        outline-offset: 1px;
        box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.28);
    }

    /* A wider hit area, drawn nowhere; `--hit-pad` is set on the board surface
       from its on-screen scale (`Board.svelte`). */
    .board-card.pickable::after {
        content: '';
        position: absolute;
        inset: calc(-1 * var(--hit-pad, 0px));
    }

    .board-card.pickable:hover,
    .board-card.pickable:focus-visible,
    .board-card.pickable.pointed {
        outline-color: #fde68a;
        box-shadow: 0 0 0 9px rgba(253, 230, 138, 0.36);
    }

    .board-card.pickable.picked {
        outline: 5px solid var(--oath-accent);
        box-shadow: 0 0 18px 6px rgba(252, 211, 77, 0.55);
    }

    .board-card.pickable:focus {
        outline-offset: 1px;
    }
</style>
