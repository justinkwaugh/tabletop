<script lang="ts">
    import type { FinaliseEntry } from '$lib/model/actionPanel.js'
    import SeatChip from './SeatChip.svelte'

    /**
     * R-3.1, R-3.1-H1 The hand selection's heading, the round, then the seats in turn order, each its
     * chip: a tick on each seat finalised, and once the viewer's hand is set a solid ring on each
     * seat it waits on. "(you)", "choosing" and "finalised" are read out, not shown. No chip holds a
     * pouch good: no seat sees another's until all have finalised.
     */
    let { entries, lead }: { entries: readonly FinaliseEntry[]; lead?: string } = $props()

    /** What a screen reader hears after the name, beside the tick's and the ring's own words. */
    function spokenOf(entry: FinaliseEntry): string | undefined {
        const words = [
            ...(entry.you ? ['(you)'] : []),
            ...(entry.finalised || entry.awaited ? [] : ['choosing'])
        ]
        return words.length > 0 ? words.join(' ') : undefined
    }
</script>

<!-- On a phone each seat is its colour and its tick: the seat strip names them. -->
<div
    class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 max-sm:gap-x-1.5 max-sm:gap-y-0"
    data-finalise-row
>
    {#if lead}<span class="text-sm font-semibold text-feudum-text" data-round-lead>{lead}</span
        >{/if}
    <span class="ml-auto flex flex-wrap gap-1.5 max-sm:gap-1" data-finalise-seats>
        {#each entries as entry (entry.playerId)}
            <span
                class="inline-flex"
                data-finalise-seat={entry.name}
                data-finalised={entry.finalised ? '' : undefined}
                data-awaited={entry.awaited ? '' : undefined}
                data-you={entry.you ? '' : undefined}
            >
                <SeatChip
                    name={entry.name}
                    paint={entry.paint}
                    ring={entry.awaited}
                    ringLabel="choosing"
                    done={entry.finalised}
                    doneLabel="finalised"
                    spoken={spokenOf(entry)}
                    compact
                />
            </span>
        {/each}
    </span>
</div>
