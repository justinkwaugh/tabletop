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
        label = undefined,
        tagUnder = false,
        count = undefined,
        onclick
    }: {
        image: string
        /** Printed words, or a snippet for a name that is a player's colour chip. */
        name: string | Snippet
        /** A line under the name: words, or a snippet with a cost in gold and a consequence in rose. */
        detail?: string | Snippet
        /** Shown while on; a row with none says it is on by its ring alone. */
        tag?: string
        /** `card`: a denizen's small card, 40 px tall; `relic`: a relic's, 40 px square. */
        shape?: 'wide' | 'card' | 'relic' | 'piece'
        on: boolean
        disabled: boolean
        points?: MenuPointerTarget
        /** One width for a group of rows, each as wide as the widest. */
        width?: ChoiceWidth
        /** Its spoken name, where the printed one carries a count as a picture. */
        label?: string
        /** On a phone the tag goes under the line, for a row in a narrow column beside a card. */
        tagUnder?: boolean
        /** A count on the picture's corner: a discard pile's cards, public (R-9.4). */
        count?: number
        onclick: () => void
    } = $props()

    const SHAPES = {
        wide: 'h-8 w-11 rounded object-cover',
        card: 'h-10 w-[26px] rounded-[3px] object-cover',
        relic: 'h-10 w-10 rounded',
        piece: 'h-8 w-8 object-contain'
    }
</script>

{#snippet tagged(placed: string)}
    <span
        class="shrink-0 rounded bg-oath-accent px-1.5 py-px text-[11px] font-extrabold text-oath-surface-raised {placed}"
        class:invisible={!on}
        aria-hidden={!on}>{tag}</span
    >
{/snippet}

<button
    type="button"
    {@attach pointsAt(points)}
    class="flex items-center gap-2.5 rounded-md border px-2 py-1.5 text-left disabled:opacity-40 max-sm:min-h-11
           {on
        ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
        : 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent'}"
    aria-pressed={on}
    aria-label={label}
    style:min-width={width ? `${width.widest}px` : undefined}
    {disabled}
    {onclick}
>
    <span class="flex w-max max-w-full items-center gap-2.5" {@attach width?.measure}>
        {#if count === undefined}
            <img class="shrink-0 {SHAPES[shape]}" src={image} alt="" />
        {:else}
            <span class="relative shrink-0">
                <img class="{SHAPES[shape]} block" src={image} alt="" />
                <span
                    class="absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-oath-frame bg-oath-surface px-0.5 text-[10px] font-bold leading-none"
                    aria-hidden="true"
                    data-count>{count}</span
                >
            </span>
        {/if}
        <span class="flex min-w-0 flex-col">
            <span class="text-[15px] font-bold"
                >{#if typeof name === 'string'}{name}{:else}{@render name()}{/if}</span
            >
            {#if typeof detail === 'string'}<span class="text-xs text-oath-text-muted"
                    >{detail}</span
                >{:else if detail}<span class="text-xs">{@render detail()}</span>{/if}
            {#if tag && tagUnder}{@render tagged('mt-0.5 self-start sm:hidden')}{/if}
        </span>
        <!-- The tag keeps its room when off, so a row keeps its width when tapped. -->
        {#if tag}{@render tagged(tagUnder ? 'max-sm:hidden' : '')}{/if}
    </span>
</button>
