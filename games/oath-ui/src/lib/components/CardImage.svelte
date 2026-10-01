<script lang="ts">
    import type { CardKind } from '@tabletop/oath'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { cardAspect } from '$lib/images/cardShape.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { cardName } from '$lib/model/names.js'

    let {
        cardId,
        width = 90,
        back,
        label,
        inspect = false,
        class: className = ''
    }: {
        cardId?: string
        width?: number
        // R-9.4 — a facedown card is drawn by the back it shows, never by its own id.
        back?: CardKind
        label?: string
        inspect?: boolean
        class?: string
    } = $props()

    let inspectable = $derived(inspect && back === undefined && cardId !== undefined)
    // R-9.4 — a facedown card is never named from its own id.
    let name = $derived(
        label ?? (back !== undefined || cardId === undefined ? 'Face down' : cardName(cardId))
    )
    let preview = $derived({ cardId, back, label: name })

    let src = $derived.by(() => {
        if (back !== undefined) return cardBack(back)
        return cardId ? cardImage(cardId) : undefined
    })

    let height = $derived(Math.round(width / cardAspect({ cardId, back })))
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
{:else}
    <div
        class="rounded-[4px] border border-dashed border-oath-text-muted/50 bg-oath-surface-raised
               flex items-center justify-center p-1 {className}"
        style="width:{width}px; height:{height}px;"
        title={name}
    >
        <span class="text-oath-text-muted text-[9px] leading-tight text-center break-all">
            {name}
        </span>
    </div>
{/if}
