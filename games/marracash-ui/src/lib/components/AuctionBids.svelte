<script lang="ts">
    import type { AuctionResult } from '@tabletop/marracash'
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bidsInTableOrder } from '$lib/utils/auctionBids.js'

    let { result }: { result: AuctionResult } = $props()
    const gameSession = getGameSession()

    let bids = $derived(bidsInTableOrder(result, gameSession.gameState.turnManager.turnOrder))
</script>

<table class="mx-auto text-sm" aria-label="Bids">
    <tbody>
        {#each bids as bid (bid.playerId)}
            <tr>
                <td class="pr-2.5 pb-0.5 text-right"><PlayerTag playerId={bid.playerId} /></td>
                <td class="marracash-display pb-0.5 text-left tabular-nums"
                    >{bid.amount === 0 ? 'passed' : bid.amount}</td
                >
            </tr>
        {/each}
    </tbody>
</table>
