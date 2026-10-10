<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import MagnifierGlass from '$lib/components/MagnifierGlass.svelte'
    import { cardPreview, type CardPreview } from '$lib/model/cardPreview.svelte.js'

    // Rule 4 — a card in a panel carries a magnifier in its corner, which enlarges it. A small
    // card's glass is small and straddles its top-left corner, so it covers little of the card
    // and none of the words beside it; a mid-sized card's is a step down from the full glass.
    type Size = 'small' | 'medium' | 'large'
    let {
        preview,
        label,
        size = 'large'
    }: { preview: CardPreview; label: string; size?: Size } = $props()

    const SIZES: Record<Size, { place: string; glass: number }> = {
        small: { place: '-left-1.5 -top-1.5 h-[18px] w-[18px]', glass: 10 },
        medium: { place: '-right-[7px] -top-[7px] h-6 w-6', glass: 14 },
        large: { place: '-right-1.5 -top-1.5 h-7 w-7', glass: 16 }
    }

    const owner = {}
    const releaseOnUnmount: Attachment = () => () => cardPreview.release(owner)
</script>

<button
    type="button"
    class="magnifier absolute z-10 flex items-center justify-center rounded-full border
           border-oath-accent bg-oath-surface-raised shadow-md hover:bg-oath-control
           {SIZES[size].place}"
    aria-label="Enlarge {label}"
    title="Enlarge {label}"
    {@attach releaseOnUnmount}
    onclick={(event) => {
        event.stopPropagation()
        cardPreview.toggle(owner, () => preview)
    }}
>
    <MagnifierGlass size={SIZES[size].glass} />
</button>

<style>
    .magnifier {
        color: var(--oath-accent);
    }
</style>
