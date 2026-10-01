<script lang="ts">
    import type { Snippet } from 'svelte'

    // One choice row of an action menu: read left to right, its buttons after the name.
    let {
        image,
        imageAlt,
        name,
        shape = 'symbol',
        marked = false,
        children
    }: {
        image: string
        imageAlt: string
        name: string
        /** A suit symbol, a landscape card such as a site, or an upright card such as a back. */
        shape?: 'symbol' | 'wide' | 'card'
        marked?: boolean
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
    class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
    class:ring-2={marked}
    class:ring-oath-accent={marked}
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
