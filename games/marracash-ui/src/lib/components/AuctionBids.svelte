<script lang="ts">
    import type { AuctionResult } from '@tabletop/marracash'
    import PlayerTag from '$lib/components/PlayerTag.svelte'

    let { result, separator }: { result: AuctionResult; separator: string } = $props()

    let bids = $derived(result.bids.toSorted((a, b) => b.amount - a.amount))
</script>

Bids:
{#each bids as bid, index (bid.playerId)}
    {index > 0 ? separator : ''}{#if bid.amount === 0}<span class="italic opacity-70"
            ><PlayerTag playerId={bid.playerId} /> passed</span
        >{:else if bid.playerId === result.winnerId}<span class="font-bold"
            ><PlayerTag playerId={bid.playerId} /> {bid.amount}</span
        >{:else}<PlayerTag playerId={bid.playerId} /> {bid.amount}{/if}
{/each}
