<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import MagnifierGlass from '$lib/components/MagnifierGlass.svelte'
    import { boardZoom } from '$lib/model/boardZoom.js'
    import { cardPreview, type CardPreview } from '$lib/model/cardPreview.svelte.js'

    // Rule 4 — on a phone a tap on a lit Travel destination travels; the magnifier straddling
    // its top-left corner enlarges the site instead, as a panel card's magnifier does.
    let { preview, label }: { preview: CardPreview; label: string } = $props()

    const owner = {}
    const releaseOnUnmount: Attachment = () => () => cardPreview.release(owner)
</script>

<button
    type="button"
    class="site-magnifier"
    aria-label="Enlarge {label}"
    title="Enlarge {label}"
    {@attach boardZoom}
    {@attach releaseOnUnmount}
    onclick={(event) => {
        event.stopPropagation()
        cardPreview.toggle(owner, () => preview)
    }}
>
    <span
        class="site-magnifier__face flex items-center justify-center rounded-full border
               border-oath-accent bg-oath-surface-raised shadow-md"
    >
        <MagnifierGlass />
    </span>
</button>

<style>
    /* At screen size whatever the board's zoom: a tap area 42 by 30 from the card's top edge
       down, 20 px out past its left edge and 22 px in; the 28 px face pokes 6 px out, 2 px down.
       The card's corner is the origin, so undoing the zoom keeps it there. */
    .site-magnifier {
        position: absolute;
        left: -20px;
        top: 0;
        z-index: 20;
        width: 42px;
        height: 30px;
        transform-origin: 20px 0;
        transform: scale(calc(1 / var(--board-zoom, 1)));
        color: var(--oath-accent);
    }
    .site-magnifier__face {
        position: absolute;
        left: 14px;
        top: 2px;
        width: 28px;
        height: 28px;
    }
    .site-magnifier:hover .site-magnifier__face {
        background: var(--oath-control);
    }
</style>
