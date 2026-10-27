<script lang="ts">
    import { ActionType } from '@tabletop/power-grid'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import Stepper from './Stepper.svelte'
    import Elektro from './Elektro.svelte'

    const session = getGameSession()
    const auction = $derived(session.gameState.auction)
    const bidding = $derived(session.gameState.bidding())
    const canRaise = $derived(session.validActionTypes.includes(ActionType.RaiseBid))
</script>

{#if auction && bidding}
    <div class="choice">
        <PlantCard plant={auction.plant} size={64} />
        <div class="details">
            <p class="prompt">
                <PlayerName playerId={bidding.highBidderId} /> bids <Elektro
                    amount={bidding.highBid}
                /> for plant
                {auction.plant}.
                {#if !canRaise}You cannot afford to bid higher.{/if}
            </p>
            <div class="controls">
                {#if canRaise}
                    <Stepper
                        label="Your bid"
                        value={session.currentBid}
                        min={session.bidMinimum}
                        max={session.bidMaximum}
                        onchange={(value) => session.setBid(value)}
                    />
                    <button type="button" class="btn primary" onclick={() => session.raiseBid()}>
                        Bid <Elektro amount={session.currentBid} />
                    </button>
                {/if}
                <button type="button" class="btn secondary" onclick={() => session.passBid()}
                    >Pass</button
                >
            </div>
        </div>
    </div>
{/if}
