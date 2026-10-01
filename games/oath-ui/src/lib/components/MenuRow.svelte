<script lang="ts">
    import type { Snippet } from 'svelte'

    // One choice row of an action menu: read left to right, its buttons after the name.
    let {
        image,
        imageAlt,
        name,
        wide = false,
        marked = false,
        children
    }: {
        image: string
        imageAlt: string
        name: string
        /** A landscape card, such as a site, drawn as a thumbnail rather than a symbol. */
        wide?: boolean
        marked?: boolean
        children: Snippet
    } = $props()
</script>

<div
    role="listitem"
    class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md bg-oath-surface-raised px-2 py-1.5"
    class:ring-2={marked}
    class:ring-oath-accent={marked}
>
    <img
        class="h-8 shrink-0 {wide ? 'w-11 rounded object-cover' : 'w-8'}"
        src={image}
        alt={imageAlt}
    />
    <span
        class="w-56 min-w-0 shrink-0 text-[15px] font-bold max-sm:w-auto max-sm:basis-[calc(100%-3rem)]"
        >{name}</span
    >
    <span class="flex gap-1.5 max-sm:basis-full">
        {@render children()}
    </span>
</div>
