<script lang="ts">
    import { ActionType } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import Stepper from './Stepper.svelte'
    import Elektro from './Elektro.svelte'

    const session = getGameSession()
    const plant = $derived(session.chosenPlant)
    const canPass = $derived(session.validActionTypes.includes(ActionType.PassAuction))
    const unopposed = $derived(
        session.myPlayerId !== undefined && session.gameState.choosesUnopposed(session.myPlayerId)
    )
</script>

{#if plant === undefined}
    <div class="prompt-row">
        <p class="prompt">
            {#if session.choosablePlants.length > 0}
                Choose a power plant from the current market to put up for auction.
            {:else}
                You cannot afford any plant in the market.
            {/if}
        </p>
        {#if canPass}
            <button type="button" class="btn secondary" onclick={() => session.passAuction()}>
                Pass this round
            </button>
        {:else}
            <span class="note">Everyone buys a plant in the first round.</span>
        {/if}
    </div>
{:else}
    <div class="choice">
        <PlantCard {plant} size={64} />
        <div class="details">
            <p class="prompt">
                {#if unopposed}
                    Nobody is left to bid against you: you buy plant {plant} at its minimum.
                {:else}
                    Open the auction for plant {plant}. The minimum bid is <Elektro
                        amount={session.bidMinimum}
                    />.
                {/if}
            </p>
            <div class="controls">
                {#if !unopposed}
                    <Stepper
                        label="Opening bid"
                        value={session.currentBid}
                        min={session.bidMinimum}
                        max={session.bidMaximum}
                        onchange={(value) => session.setBid(value)}
                    />
                {/if}
                <button
                    type="button"
                    class="btn primary"
                    onclick={() => session.confirmPlantChoice()}
                >
                    {unopposed ? 'Buy for' : 'Bid'}
                    <Elektro amount={session.currentBid} />
                </button>
            </div>
        </div>
    </div>
{/if}
