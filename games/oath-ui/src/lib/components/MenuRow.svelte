<script lang="ts">
    import type { Snippet } from 'svelte'
    import { CardKind } from '@tabletop/oath'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { CARD_ASPECT } from '$lib/images/cardShape.js'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'
    import { pointsAt, type MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'

    let {
        image,
        imageAlt,
        name,
        nameEnd = undefined,
        shape = 'symbol',
        preview = undefined,
        points = undefined,
        children
    }: {
        image: string
        imageAlt: string
        name: string
        /** The name's last words, kept together on one line when the name wraps ("space 1"). */
        nameEnd?: string
        shape?: 'symbol' | 'wide' | 'card' | 'relic'
        /** A face or a banner has a corner magnifier that enlarges it; a back has none. */
        preview?: CardPreview & { label: string }
        points?: MenuPointerTarget
        children: Snippet
    } = $props()

    // A banner is its whole tile (2:1), 56 px tall, and 44 px below a 360 px screen so its button
    // stays to its right; a relic is its card, as tall as the tile.
    const SHAPES = {
        symbol: 'h-8 w-8',
        wide: 'h-14 w-28 rounded-[4px] max-[359px]:h-11 max-[359px]:w-[88px]',
        card: 'h-10 rounded',
        relic: 'h-14 w-14 rounded'
    }
</script>

<!-- As wide as its content: the picture, then the name and the buttons to its right, on one line
     on a desktop and the name over the buttons on a phone. -->
<div
    role="listitem"
    {@attach pointsAt(points)}
    class="flex w-fit max-w-full items-center gap-x-3.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
>
    <span class="relative inline-flex shrink-0">
        <img
            class={SHAPES[shape]}
            style:aspect-ratio={shape === 'card' ? CARD_ASPECT[CardKind.Denizen] : undefined}
            src={image}
            alt={imageAlt}
        />
        {#if preview}
            <Magnifier {preview} label={preview.label} />
        {/if}
    </span>
    <div
        class="flex min-w-0 items-center gap-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1.5"
    >
        <span class="w-56 shrink-0 text-[15px] font-bold max-sm:w-auto"
            >{name}{#if nameEnd}{' '}<span class="whitespace-nowrap">{nameEnd}</span>{/if}</span
        >
        <span class="flex flex-wrap gap-1.5">
            {@render children()}
        </span>
    </div>
</div>
