<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'

    let {
        label,
        disabled,
        width,
        onclick,
        children
    }: {
        label: string
        disabled: boolean
        /** The menu's one width, shared by every button in it. */
        width: ChoiceWidth
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<!-- As wide as the widest content in its menu, on a phone as on a desktop; 44 px tall on a phone. -->
<button
    type="button"
    class="flex min-w-[8.5rem] flex-col items-center justify-center rounded-md border
           border-oath-frame bg-oath-surface px-2.5 py-1.5 text-[15px] font-semibold
           hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40 max-sm:min-h-11"
    {disabled}
    title={label}
    aria-label={label}
    {onclick}
>
    <span class="flex flex-col items-center" style:min-width="{width.widest}px">
        <span class="flex w-max flex-col items-center" {@attach width.measure}>
            {@render children()}
        </span>
    </span>
</button>
