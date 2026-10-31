<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RepairsSeatState, type RepairsRowView } from '$lib/model/repairsRow.js'

    let { row }: { row: RepairsRowView } = $props()

    const gameSession = getGameSession()
    const viewerId = $derived(gameSession.myPlayer?.id)
</script>

<!-- R-4.3, R-4.3-H4: one chip per seat, from the placing seat in seat order. -->
<ul class="flex flex-wrap gap-2 max-sm:gap-1" data-repairs-row>
    {#each row.entries as entry (entry.playerId)}
        <li
            class="seat-chip"
            class:deciding={entry.state === RepairsSeatState.Choosing}
            data-repairs-seat={entry.playerId}
            data-repairs-state={entry.state}
        >
            <span
                class="swatch"
                style:background={gameSession.colors.getPlayerUiColor(entry.playerId)}
            ></span>
            <b class="font-semibold"
                >{entry.playerId === viewerId
                    ? 'You'
                    : gameSession.getPlayerName(entry.playerId)}</b
            >
            <span>bill ${entry.bill} ·</span>
            {#if entry.short !== undefined}
                <span class="short">short ${entry.short}</span>
                <span>·</span>
            {/if}
            <span data-repairs-text
                >{entry.text}{#if entry.state === RepairsSeatState.Paid}{' '}<span class="ok"
                        >✓</span
                    >{/if}</span
            >
        </li>
    {/each}
</ul>

<style>
    .seat-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border: 1px solid var(--pp-paper-line);
        border-radius: 999px;
        background: color-mix(in srgb, var(--pp-paper-deep) 55%, transparent);
        font-size: 13px;
        white-space: nowrap;
    }

    .seat-chip.deciding {
        /* Being decided: the neutral dashed outline, drawn in charcoal on paper. */
        border: 2px dashed var(--pp-charcoal);
        padding: 3px 9px;
    }

    /* Contract, "Phone layout": two settled seats to a line. */
    @media (width < 40rem) {
        .seat-chip {
            gap: 4px;
            padding: 1px 6px;
            font-size: 11.5px;
        }

        .seat-chip.deciding {
            padding: 0 5px;
        }
    }

    .swatch {
        width: 11px;
        height: 11px;
        border-radius: 50%;
        border: 1px solid var(--pp-halo);
    }

    .short {
        background: var(--pp-cost);
        color: var(--pp-cost-ink);
        border-radius: 4px;
        padding: 0 5px;
        font-weight: 700;
        box-shadow: 0 0 0 1px var(--pp-halo);
    }

    .ok {
        color: var(--pp-ok);
        font-weight: 700;
    }
</style>
