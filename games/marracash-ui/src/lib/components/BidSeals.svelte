<script lang="ts">
    import HistorySign from '$lib/components/HistorySign.svelte'
    import type { Bidder } from '$lib/utils/historyTurns.js'

    // Spread, the count sits at the far end of the row, as on a History card; otherwise it follows
    // the signs, so the row can be centred.
    let {
        bidders,
        signHeight = 16,
        spread = true
    }: { bidders: readonly Bidder[]; signHeight?: number; spread?: boolean } = $props()

    let submitted = $derived(bidders.filter((bidder) => bidder.submitted).length)
</script>

<span class="seals" class:spread>
    {#each bidders as bidder (bidder.playerId)}
        <span class="seal">
            <HistorySign playerId={bidder.playerId} height={signHeight} />
            <span
                class="marracash-merchant"
                class:submitted={bidder.submitted}
                class:waiting={!bidder.submitted}>{bidder.submitted ? '✓' : '…'}</span
            >
        </span>
    {/each}
    <span class="count marracash-merchant">{submitted} of {bidders.length} bids</span>
</span>

<style>
    .seals {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 9px;
    }

    .seals.spread {
        flex: 1;
    }

    .seal {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .submitted {
        color: #2e6b34;
    }

    .waiting {
        color: #b7a181;
    }

    .count {
        margin-left: 6px;
        color: #6e6252;
    }

    .spread .count {
        margin-left: auto;
    }
</style>
