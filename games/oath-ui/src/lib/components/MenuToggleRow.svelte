<script lang="ts">
    import { pointsAt, type MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'

    let {
        image,
        name,
        detail = undefined,
        tag,
        shape = 'wide',
        on,
        disabled,
        points = undefined,
        onclick
    }: {
        image: string
        name: string
        detail?: string
        tag: string
        shape?: 'wide' | 'card' | 'piece'
        on: boolean
        disabled: boolean
        points?: MenuPointerTarget
        onclick: () => void
    } = $props()

    const SHAPES = {
        wide: 'h-8 w-11 rounded object-cover',
        card: 'h-10 w-auto rounded',
        piece: 'h-8 w-8 object-contain'
    }
</script>

<button
    type="button"
    {@attach pointsAt(points)}
    class="flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left disabled:opacity-40
           {on
        ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
        : 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent'}"
    aria-pressed={on}
    {disabled}
    {onclick}
>
    <img class="shrink-0 {SHAPES[shape]}" src={image} alt="" />
    <span class="flex min-w-0 flex-col">
        <span class="text-[15px] font-bold">{name}</span>
        {#if detail}<span class="text-xs text-oath-text-muted">{detail}</span>{/if}
    </span>
    {#if on}
        <span
            class="shrink-0 rounded bg-oath-accent px-1.5 py-px text-[11px] font-extrabold text-oath-surface-raised"
            >{tag}</span
        >
    {/if}
</button>
