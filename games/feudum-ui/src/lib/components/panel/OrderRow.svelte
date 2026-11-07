<script lang="ts">
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { OrderRow } from '$lib/model/sharedRows.js'

    /**
     * R-4.10, R-4.12.3 The seats in turn order: a tick on each done, a mark on the next, and D11 the
     * seats the game fed. The one drawing of the nourish and landscapes rows (contract: Render ownership).
     */
    let {
        step,
        entries,
        seats
    }: { step: OrderRow['step']; entries: OrderRow['entries']; seats: SeatNames } = $props()

    const Headings: Record<OrderRow['step'], string> = {
        nourish: 'Nourish',
        landscapes: 'Landscapes'
    }
</script>

<div class="flex w-full flex-wrap items-center gap-1.5" data-order-row={step}>
    <span class="text-xs uppercase tracking-wide text-feudum-text-muted">{Headings[step]}</span>
    {#each entries as entry (entry.playerId)}
        <span
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-feudum-text
                {entry.next ? 'border-dashed border-feudum-accent' : 'border-feudum-frame'}"
            data-order-seat={seats.nameOf(entry.playerId)}
            data-done={entry.done ? '' : undefined}
            data-next={entry.next ? '' : undefined}
        >
            <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style:background-color={seats.paintOf(entry.playerId).fill}
            ></span>
            {seats.nameOf(entry.playerId)}
            {#if entry.done}
                <span aria-label="done">✓</span>
            {/if}
            {#if entry.fedByGame}
                <span class="text-feudum-text-muted" data-fed-by-game>· fed by the game</span>
            {/if}
            {#if entry.next}
                <span class="text-feudum-accent">· next</span>
            {/if}
        </span>
    {/each}
</div>
