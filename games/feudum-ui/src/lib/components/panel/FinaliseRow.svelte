<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { FinaliseEntry } from '$lib/model/actionPanel.js'

    /**
     * R-3.1 The finalise order, seats in turn order: a tick and the pouch good on each that has
     * finalised, a mark on the next. It is what lets a seat wait to see an earlier pouch good.
     */
    let { entries }: { entries: readonly FinaliseEntry[] } = $props()

    const TokenSize = 14
</script>

<!-- On a phone the row shares the prompt's line, each seat its colour: the seat strip names them. -->
<div
    class="flex w-full flex-wrap items-center gap-1.5 max-sm:w-auto max-sm:gap-1"
    data-finalise-row
>
    <span class="text-xs uppercase tracking-wide text-feudum-text-muted max-sm:sr-only"
        >Finalise order</span
    >
    {#each entries as entry (entry.playerId)}
        <span
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-feudum-text max-sm:px-1
                {entry.next ? 'border-dashed border-feudum-accent' : 'border-feudum-frame'}"
            data-finalise-seat={entry.name}
            data-finalised={entry.finalised ? '' : undefined}
            data-next={entry.next ? '' : undefined}
        >
            <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style:background-color={entry.paint.fill}
            ></span>
            <span class="max-sm:sr-only">{entry.name}</span>
            {#if entry.finalised}
                <span role="img" aria-label="finalised">✓</span>
            {/if}
            {#if entry.pouchGood}
                <GoodToken good={entry.pouchGood} size={TokenSize} />
            {/if}
            {#if entry.next}
                <span class="text-feudum-accent max-sm:sr-only">· next to finalise</span>
            {/if}
        </span>
    {/each}
</div>
