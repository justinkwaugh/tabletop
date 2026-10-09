<script lang="ts">
    // `gives`: the count is one the player gives, so the picked number is gold, as a cost is.
    let {
        values,
        picked,
        label,
        onpick,
        disabled,
        gives = false
    }: {
        values: readonly number[]
        picked: number | undefined
        label: (value: number) => string
        onpick: (value: number) => void
        disabled: boolean
        gives?: boolean
    } = $props()
</script>

<span class="flex flex-wrap gap-1">
    {#each values as value (value)}
        <button
            type="button"
            class="inline-flex h-8 w-9 items-center justify-center rounded-md border text-sm font-bold
                   disabled:opacity-40 {value === picked
                ? 'border-oath-accent bg-oath-accent-soft ring-1 ring-oath-accent'
                : 'border-oath-frame bg-oath-surface hover:border-oath-accent'}"
            class:text-oath-accent={gives && value === picked}
            aria-pressed={value === picked}
            aria-label={label(value)}
            title={label(value)}
            {disabled}
            onclick={() => onpick(value)}
        >
            {value}
        </button>
    {/each}
</span>
