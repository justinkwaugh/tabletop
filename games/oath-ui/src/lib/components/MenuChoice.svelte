<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    let {
        label,
        disabled,
        width,
        picked = undefined,
        onclick,
        children
    }: {
        label: string
        disabled: boolean
        /** The menu's one width, shared by every button in it. */
        width: ChoiceWidth
        /** Set on each of a group that holds one pick: ringed while it is the one picked. */
        picked?: boolean
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<!-- As wide as the widest content in its menu, on a phone as on a desktop; 44 px tall on a phone. -->
<button
    type="button"
    class="flex min-w-[8.5rem] flex-col items-center justify-center rounded-md border px-2.5 py-1.5
           text-[15px] font-semibold disabled:opacity-40 max-sm:min-h-11 {picked
        ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
        : 'border-oath-frame bg-oath-surface hover:border-oath-accent hover:bg-oath-accent-soft'}"
    {disabled}
    aria-label={label}
    aria-pressed={picked}
    {onclick}
>
    <span class="flex flex-col items-center" style:min-width="{width.widest}px">
        <span class="flex w-max flex-col items-center" {@attach width.measure}>
            {@render children()}
        </span>
    </span>
</button>
