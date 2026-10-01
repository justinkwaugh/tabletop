<script lang="ts">
    import type { Snippet } from 'svelte'

    // A button in a menu row; its label speaks the whole choice, since the face shows tokens.
    let {
        label,
        disabled,
        onclick,
        children
    }: {
        label: string
        disabled: boolean
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<button
    type="button"
    class="flex min-w-[8.5rem] flex-col items-center rounded-md border border-oath-frame
           bg-oath-surface px-2.5 py-1.5 text-[15px] font-semibold
           hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40
           max-sm:min-w-0 max-sm:flex-1"
    {disabled}
    title={label}
    aria-label={label}
    {onclick}
>
    {@render children()}
</button>
