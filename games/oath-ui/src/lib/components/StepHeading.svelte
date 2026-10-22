<script lang="ts">
    import { range } from '@tabletop/common'

    // A stepped panel's heading: the step's name, then, with more than one step, a dot per step
    // (the current one large, those done small and gold, those to come grey) and "N of M".
    let {
        heading,
        step,
        steps,
        level = 'h3'
    }: {
        heading: string
        /** From 1. */
        step: number
        steps: number
        /** The heading's level in its panel. */
        level?: 'h3' | 'h4'
    } = $props()
</script>

<div class="mb-2 flex items-center gap-2.5" data-step-heading>
    <svelte:element this={level} class="text-[11px] uppercase tracking-[0.2em] text-oath-danger"
        >{heading}</svelte:element
    >
    {#if steps > 1}
        <span class="flex items-center gap-1" aria-hidden="true">
            {#each range(1, steps) as n (n)}
                <span
                    class="rounded-full {n === step
                        ? 'h-2.5 w-2.5 bg-oath-accent ring-2 ring-oath-accent-soft'
                        : n < step
                          ? 'h-1.5 w-1.5 bg-oath-accent'
                          : 'h-1.5 w-1.5 bg-oath-text-muted/50'}"
                ></span>
            {/each}
        </span>
        <span class="text-xs text-oath-text-muted">{step} of {steps}</span>
    {/if}
</div>
