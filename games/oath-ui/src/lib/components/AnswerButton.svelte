<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    let {
        primary = false,
        picked = undefined,
        width,
        disabled,
        label,
        onclick,
        children
    }: {
        primary?: boolean
        /** Set on each of two answers that hold one pick (a card's "or"): ringed while picked. */
        picked?: boolean
        /** The question's one width, shared by every answer in it. */
        width: ChoiceWidth
        disabled: boolean
        /** The answer's name for a screen reader, where its tokens alone would not say it. */
        label?: string
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<!-- As wide as the widest answer beside it, on a phone as on a desktop; 44 px tall on a phone. Every
     answer has the primary's border width, so the same content gives the same width. -->
<button
    type="button"
    class="rounded border-[1.5px] px-4 py-2 text-base font-semibold disabled:opacity-40 max-sm:min-h-11 {primary
        ? 'border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover'
        : picked
          ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
          : 'border-transparent bg-oath-control hover:bg-oath-control-hover'}"
    {disabled}
    aria-label={label}
    aria-pressed={picked}
    {onclick}
>
    <span class="flex justify-center" style:min-width="{width.widest}px">
        <span class="flex w-max items-center gap-1.5" {@attach width.measure}>
            {@render children()}
        </span>
    </span>
</button>
