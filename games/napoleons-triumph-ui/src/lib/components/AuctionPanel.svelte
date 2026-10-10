<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, MAX_BID, STARTING_MORALE, Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const auction = $derived(gameSession.gameState.auction)
    const highBid = $derived(auction?.highBid)
    const lowest = $derived((highBid ?? -1) + 1)
    let wanted = $state(0)
    const amount = $derived(Math.min(MAX_BID, Math.max(lowest, wanted)))
    const canBid = $derived(gameSession.validActionTypes.includes(ActionType.PlaceBid) && lowest <= MAX_BID)
    const canChoose = $derived(gameSession.validActionTypes.includes(ActionType.ChooseSide))

    const ARMIES = [
        { side: Side.French, name: 'the French' },
        { side: Side.Allied, name: 'the Allies' }
    ]
</script>

<div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 max-sm:px-1 pb-2 text-[15px] max-sm:text-[13px] text-[#2b2620]">
    {#if canChoose}
        <span>Your bid of {highBid ?? 0} wins the choice of army. It comes off that army's morale.</span>
        {#each ARMIES as army (army.side)}
            <button type="button" class="nt-plain-button" onclick={() => gameSession.chooseSide(army.side)}>
                Take {army.name} at {STARTING_MORALE[army.side] - (highBid ?? 0)} morale
            </button>
        {/each}
    {:else if gameSession.canAct && auction}
        <span>
            Bid morale for the choice of army.
            {#if highBid !== undefined && auction.highBidderId}
                <PlayerName playerId={auction.highBidderId} /> has bid {highBid}.
            {/if}
        </span>
        {#if canBid}
            <span class="inline-flex items-center gap-1">
                <button
                    type="button"
                    class="nt-plain-button"
                    aria-label="Bid one less"
                    disabled={amount <= lowest}
                    onclick={() => (wanted = amount - 1)}>−</button
                >
                <span class="min-w-[2ch] text-center font-bold">{amount}</span>
                <button
                    type="button"
                    class="nt-plain-button"
                    aria-label="Bid one more"
                    disabled={amount >= MAX_BID}
                    onclick={() => (wanted = amount + 1)}>+</button
                >
            </span>
            <button type="button" class="nt-plain-button" onclick={() => gameSession.placeBid(amount)}
                >Bid {amount}</button
            >
        {/if}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.passBid()}>
            {highBid === undefined ? 'Pass, and let them choose for nothing' : 'Pass'}
        </button>
    {:else if auction && !gameSession.isViewingHistory}
        <span>
            The armies are being bid for{highBid !== undefined ? `; the bid stands at ${highBid}` : ''}. Waiting
            for <PlayerName playerId={gameSession.gameState.activePlayerIds[0]} />.
        </span>
    {/if}
</div>
