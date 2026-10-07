<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import MagnifierGlass from '$lib/components/MagnifierGlass.svelte'
    import { cardPreview, type CardPreview } from '$lib/model/cardPreview.svelte.js'

    // Rule 4 — a card offered in a panel is chosen by a tap; its corner magnifier enlarges it.
    let { preview, label }: { preview: CardPreview; label: string } = $props()

    const owner = {}
    const releaseOnUnmount: Attachment = () => () => cardPreview.release(owner)
</script>

<button
    type="button"
    class="magnifier absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center
           rounded-full border border-oath-accent bg-oath-surface-raised shadow-md hover:bg-oath-control"
    aria-label="Enlarge {label}"
    title="Enlarge {label}"
    {@attach releaseOnUnmount}
    onclick={(event) => {
        event.stopPropagation()
        cardPreview.toggle(owner, () => preview)
    }}
>
    <MagnifierGlass />
</button>

<style>
    .magnifier {
        color: var(--oath-accent);
    }
</style>
