<script lang="ts">
    import type { Snippet } from 'svelte'
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
        shape?: 'symbol' | 'wide' | 'card'
        points?: MenuPointerTarget
        children: Snippet
    } = $props()

    const SHAPES = {
        symbol: 'h-8 w-8',
        wide: 'h-8 w-11 rounded object-cover',
        card: 'h-10 w-auto rounded'
    }
</script>

<div
    role="listitem"
    {@attach pointsAt(points)}
    class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
>
    <img class="shrink-0 {SHAPES[shape]}" src={image} alt={imageAlt} />
    <span
        class="w-56 min-w-0 shrink-0 text-[15px] font-bold max-sm:w-auto max-sm:basis-[calc(100%-3rem)]"
        >{name}</span
    >
    <span class="flex gap-1.5 max-sm:basis-full">
        {@render children()}
    </span>
</div>
