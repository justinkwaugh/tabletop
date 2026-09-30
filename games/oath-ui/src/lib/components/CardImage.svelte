<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { cardName } from '$lib/model/names.js'

    let {
        cardId,
        width = 90,
        faceDown = false,
        backKind,
        label,
        inspect = false,
        class: className = ''
    }: {
        cardId?: string
        width?: number
        faceDown?: boolean
        // R-9.4 — a back must never be picked from the facedown card's own id.
        backKind?: CardKind
        label?: string
        inspect?: boolean
        class?: string
    } = $props()

    let inspectable = $derived(inspect && !faceDown && cardId !== undefined)
    // R-9.4 — a facedown card is never named from its own id.
    let name = $derived(
        label ?? (faceDown || cardId === undefined ? 'Face down' : cardName(cardId))
    )
    let preview = $derived({ cardId, faceDown, backKind, label: name })

    let src = $derived.by(() => {
        if (faceDown || !cardId) return undefined
        return cardImage(cardId)
    })

    let height = $derived(Math.round(width / cardAspect({ cardId, faceDown, backKind })))
</script>

{#if src}
    <img
        {src}
        alt={name}
        title={name}
        class="rounded-[4px] shadow-md object-cover {className}"
        style="width:{width}px; height:{height}px;"
        use:inspectImage={{ preview, enabled: inspectable }}
    />
{:else if faceDown}
    <!-- R-9.4 — the back and the fact of a card are public; the front is not. -->
    <img
        src={cardBack(backKind)}
        alt={name}
        title={name}
        class="rounded-[4px] shadow-md object-cover {className}"
        style="width:{width}px; height:{height}px;"
    />
{:else}
    <div
        class="rounded-[4px] border border-dashed border-stone-500 bg-stone-800/60
               flex items-center justify-center p-1 {className}"
        style="width:{width}px; height:{height}px;"
        title={name}
    >
        <span class="text-stone-300 text-[9px] leading-tight text-center break-all">
            {name}
        </span>
    </div>
{/if}
