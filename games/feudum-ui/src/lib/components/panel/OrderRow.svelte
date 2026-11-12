<script lang="ts">
    import type { SeatNames } from '$lib/model/actionPanel.js'
    import type { OrderRow } from '$lib/model/sharedRows.js'

    /**
     * R-4.10, R-4.12.3 The seats in turn order: a tick on each done, a mark on the next, and the
     * seats with nothing to decide, whom the game fed (R-4.10-H4). A phone's row is dots: a tick,
     * "you" on the viewer deciding, "next" on another. The one drawing of the nourish and
     * landscapes rows (contract: Render ownership).
     */
    let {
        step,
        entries,
        seats,
        me
    }: {
        step: OrderRow['step']
        entries: OrderRow['entries']
        seats: SeatNames
        me?: string
    } = $props()

    const Headings: Record<OrderRow['step'], string> = {
        nourish: 'Nourish',
        landscapes: 'Landscapes'
    }

    function phoneWord(entry: OrderRow['entries'][number]): string {
        if (entry.done) {
            return '✓'
        }
        if (entry.next) {
            return entry.playerId === me ? 'you' : 'next'
        }
        return ''
    }
</script>

<div class="flex w-full flex-wrap items-center gap-1.5" data-order-row={step}>
    <span class="text-xs uppercase tracking-wide text-feudum-text-muted max-sm:sr-only"
        >{Headings[step]}</span
    >
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
            <span class="max-sm:sr-only">{seats.nameOf(entry.playerId)}</span>
            <span class="hidden max-sm:inline" aria-hidden="true" data-phone-word
                >{phoneWord(entry)}</span
            >
            <!-- A phone shows the dots' word instead, and still reads these out. -->
            {#if entry.done}
                <span class="max-sm:sr-only" role="img" aria-label="done">✓</span>
            {/if}
            {#if entry.fedByGame}
                <span class="text-feudum-text-muted max-sm:sr-only" data-fed-by-game
                    >· nothing to decide</span
                >
            {/if}
            {#if entry.next}
                <span class="text-feudum-accent max-sm:sr-only">· next</span>
            {/if}
        </span>
    {/each}
</div>
