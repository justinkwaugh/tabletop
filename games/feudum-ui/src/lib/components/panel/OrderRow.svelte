<script lang="ts">
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { OrderRow } from '$lib/model/sharedRows.js'
    import SeatChip from './SeatChip.svelte'

    /** R-4.10, R-4.12.3 The seats in turn order. R-4.10-H4 Every seat deciding is ringed. */
    let {
        step,
        entries,
        seats
    }: {
        step: OrderRow['step']
        entries: OrderRow['entries']
        seats: SeatNames
    } = $props()
</script>

<div class="flex w-full flex-wrap items-center gap-1.5" data-order-row={step}>
    {#each entries as entry (entry.playerId)}
        <span
            class="inline-flex"
            data-order-seat={seats.nameOf(entry.playerId)}
            data-done={entry.done ? '' : undefined}
            data-next={entry.next ? '' : undefined}
            data-deciding={entry.deciding ? '' : undefined}
        >
            <SeatChip
                name={seats.nameOf(entry.playerId)}
                paint={seats.paintOf(entry.playerId)}
                ring={entry.next || entry.deciding}
                ringLabel={entry.next ? 'next' : 'deciding'}
                done={entry.done}
                compact
            />
        </span>
    {/each}
</div>
