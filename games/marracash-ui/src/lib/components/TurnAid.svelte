<script lang="ts">
    import { MinimumAuctionBid } from '@tabletop/marracash'
    import AidCard from '$lib/components/AidCard.svelte'
    import ActionPill from '$lib/components/ActionPill.svelte'

    type TurnAction = 'move' | 'auction'
    const ActionPairs: [TurnAction, TurnAction][] = [
        ['move', 'move'],
        ['move', 'auction'],
        ['auction', 'auction']
    ]
</script>

<AidCard title="Your Turn">
    <h3 class="aid-heading">Two actions</h3>
    {#each ActionPairs as [first, second], index (index)}
        <div class="flex items-center gap-[3px] py-[3px]">
            <ActionPill action={first} />
            <svg class="shrink-0" width="14" height="10" viewBox="0 0 14 10" aria-label="then">
                <path
                    d="M1 5 H11 M7.5 1.5 L11.5 5 L7.5 8.5"
                    fill="none"
                    stroke="#8a6a46"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                ></path>
            </svg>
            <ActionPill action={second} />
        </div>
    {/each}
    <p class="aid-lead mt-0.5">Move not allowed after Auction</p>
    <h3 class="aid-heading">Move</h3>
    <p>Visitors walk to the next fountain; each enters the first matching shop it passes.</p>
    <h3 class="aid-heading">Auction</h3>
    <p>
        Sealed bids, minimum {MinimumAuctionBid}. Ties go to the auctioneer, then clockwise.
    </p>
</AidCard>
