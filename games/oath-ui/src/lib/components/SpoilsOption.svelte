<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    // One of a spoils step's options: as wide as the widest in its group, 44 px tall on a phone,
    // ringed once chosen. No tooltip and no hover look.
    let {
        label,
        pressed = undefined,
        width,
        disabled,
        onclick,
        children
    }: {
        /** Its name for a screen reader, where its words alone would not say it. */
        label?: string
        /** Whether it is the step's choice; absent for an option that is never left marked. */
        pressed?: boolean
        width: ChoiceWidth
        disabled: boolean
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<button
    type="button"
    class="rounded-md border px-3 py-1.5 text-[15px] font-semibold disabled:opacity-40 max-sm:min-h-11
           {pressed
        ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
        : 'border-oath-frame bg-oath-surface'}"
    aria-pressed={pressed}
    aria-label={label}
    {disabled}
    {onclick}
>
    <span class="flex justify-center" style:min-width="{width.widest}px">
        <span class="flex w-max items-center gap-1.5" {@attach width.measure}>
            {@render children()}
        </span>
    </span>
</button>
