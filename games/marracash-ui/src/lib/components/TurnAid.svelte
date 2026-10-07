<script lang="ts">
    import { MinimumAuctionBid } from '@tabletop/marracash'
    import AidCard from '$lib/components/AidCard.svelte'

    const ActionPairs = [
        ['Move', 'Move'],
        ['Move', 'Auction'],
        ['Auction', 'Auction']
    ] as const
</script>

<AidCard title="Your Turn">
    <h3 class="aid-heading">Two actions</h3>
    <p class="aid-lead">Take one of these pairs:</p>
    <table class="aid-table">
        <tbody>
            {#each ActionPairs as [first, second], index (index)}
                <tr>
                    <td>{first}<span class="aid-figure px-2">→</span>{second}</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <p class="aid-lead mt-1 mb-0">Move not allowed after Auction</p>
    <h3 class="aid-heading">Move</h3>
    <p>Visitors walk to the next fountain; each enters the first matching shop it passes.</p>
    <h3 class="aid-heading">Auction</h3>
    <p>Sealed bids, minimum {MinimumAuctionBid}. Ties go to the auctioneer, then clockwise.</p>
    <h3 class="aid-heading">End of Game</h3>
    <p>Game ends upon completing the round in which the queue empties.</p>
</AidCard>
