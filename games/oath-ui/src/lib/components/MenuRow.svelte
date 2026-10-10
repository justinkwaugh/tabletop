<script lang="ts">
    import type { Snippet } from 'svelte'
    import { CardKind } from '@tabletop/oath'
    import { CARD_ASPECT } from '$lib/images/cardShape.js'
    import { pointsAt, type MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'

    let {
        image,
        imageAlt,
        name,
        shape = 'symbol',
        points = undefined,
        children
    }: {
        image: string
        imageAlt: string
        name: string
        shape?: 'symbol' | 'wide' | 'card' | 'relic'
        points?: MenuPointerTarget
        children: Snippet
    } = $props()

    const SHAPES = {
        symbol: 'h-8 w-8',
        wide: 'h-8 w-11 rounded object-cover',
        card: 'h-10 rounded',
        relic: 'h-10 w-10 rounded'
    }
</script>

<!-- As wide as its content: the picture, then the name and the buttons to its right, on one line
     on a desktop and the name over the buttons on a phone. -->
<div
    role="listitem"
    {@attach pointsAt(points)}
    class="flex w-fit max-w-full items-center gap-x-3.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
>
    <img
        class="shrink-0 {SHAPES[shape]}"
        style:aspect-ratio={shape === 'card' ? CARD_ASPECT[CardKind.Denizen] : undefined}
        src={image}
        alt={imageAlt}
    />
    <div
        class="flex min-w-0 items-center gap-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1.5"
    >
        <span class="w-56 shrink-0 text-[15px] font-bold max-sm:w-auto">{name}</span>
        <span class="flex flex-wrap gap-1.5">
            {@render children()}
        </span>
    </div>
</div>
