<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { pointsAt, type MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'

    let {
        image,
        name,
        detail = undefined,
        tag = undefined,
        shape = 'wide',
        on,
        disabled,
        points = undefined,
        width = undefined,
        onclick
    }: {
        image: string
        /** Printed words, or a snippet for a name that is a player's colour chip. */
        name: string | Snippet
        detail?: string
        /** Shown while on; a row with none says it is on by its ring alone. */
        tag?: string
        shape?: 'wide' | 'relic' | 'piece'
        on: boolean
        disabled: boolean
        points?: MenuPointerTarget
        /** One width for a group of rows, each as wide as the widest. */
        width?: ChoiceWidth
        onclick: () => void
    } = $props()

    const SHAPES = {
        wide: 'h-8 w-11 rounded object-cover',
        relic: 'h-10 w-10 rounded',
        piece: 'h-8 w-8 object-contain'
    }
</script>

<button
    type="button"
    {@attach pointsAt(points)}
    class="flex items-center gap-2.5 rounded-md border px-2 py-1.5 text-left disabled:opacity-40 max-sm:min-h-11
           {on
        ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
        : 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent'}"
    aria-pressed={on}
    style:min-width={width ? `${width.widest}px` : undefined}
    {disabled}
    {onclick}
>
    <span class="flex w-max max-w-full items-center gap-2.5" {@attach width?.measure}>
        <img class="shrink-0 {SHAPES[shape]}" src={image} alt="" />
        <span class="flex min-w-0 flex-col">
            <span class="text-[15px] font-bold"
                >{#if typeof name === 'string'}{name}{:else}{@render name()}{/if}</span
            >
            {#if detail}<span class="text-xs text-oath-text-muted">{detail}</span>{/if}
        </span>
        <!-- The tag keeps its room when off, so a row keeps its width when tapped. -->
        {#if tag}
            <span
                class="shrink-0 rounded bg-oath-accent px-1.5 py-px text-[11px] font-extrabold text-oath-surface-raised"
                class:invisible={!on}
                aria-hidden={!on}>{tag}</span
            >
        {/if}
    </span>
</button>
